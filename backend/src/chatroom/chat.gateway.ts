import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatroomService } from './chatroom.service';
import { SessionService } from '../session/session.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3001',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSessions = new Map<string, string>(); // socketId -> sessionId
  private sessionSockets = new Map<string, string>(); // sessionId -> socketId
  private typingUsers = new Map<string, Set<string>>(); // chatroomId -> Set of sessionIds

  constructor(
    private chatroomService: ChatroomService,
    private sessionService: SessionService,
    private prisma: PrismaService,
  ) {}

  // Helper method to get socket ID by session ID
  getSocketIdBySessionId(sessionId: string): string | undefined {
    return this.sessionSockets.get(sessionId);
  }

  // Helper method to get session ID by socket ID
  getSessionIdBySocketId(socketId: string): string | undefined {
    return this.userSessions.get(socketId);
  }

  // Notify a specific session about a match
  notifyMatch(sessionId: string, matchData: any) {
    const socketId = this.getSocketIdBySessionId(sessionId);
    if (socketId) {
      this.server.to(socketId).emit('matchFound', matchData);
      console.log(`[WS] Notified session ${sessionId} about match`);
    } else {
      console.log(`[WS] Could not notify session ${sessionId} - no socket found`);
    }
  }

  // Notify a specific session that their partner disconnected
  notifyPartnerDisconnected(sessionId: string, partnerSessionId: string) {
    const socketId = this.getSocketIdBySessionId(sessionId);
    if (socketId) {
      this.server.to(socketId).emit('partnerDisconnected', { sessionId: partnerSessionId });
      console.log(`[WS] Notified session ${sessionId} that partner ${partnerSessionId} disconnected`);
    }
  }

  // Notify a specific session that their partner skipped
  notifyPartnerSkipped(sessionId: string, partnerSessionId: string) {
    const socketId = this.getSocketIdBySessionId(sessionId);
    if (socketId) {
      this.server.to(socketId).emit('partnerSkipped', { sessionId: partnerSessionId });
      console.log(`[WS] Notified session ${sessionId} that partner ${partnerSessionId} skipped`);
    }
  }

  // Notify a specific session that their partner ended the chat
  notifyPartnerEnded(sessionId: string, partnerSessionId: string) {
    const socketId = this.getSocketIdBySessionId(sessionId);
    if (socketId) {
      this.server.to(socketId).emit('partnerEnded', { sessionId: partnerSessionId });
      console.log(`[WS] Notified session ${sessionId} that partner ${partnerSessionId} ended the chat`);
    }
  }

  async handleConnection(client: Socket) {
    const sessionId = client.handshake.query.sessionId as string;
    console.log(`[WS] Connection attempt - Socket ID: ${client.id}, Session ID: ${sessionId}`);
    
    if (sessionId) {
      // Clean up any existing socket mapping for this session (reconnection case)
      const existingSocketId = this.sessionSockets.get(sessionId);
      if (existingSocketId) {
        console.log(`[WS] Cleaning up existing socket mapping for session ${sessionId}: ${existingSocketId}`);
        this.userSessions.delete(existingSocketId);
      }

      this.userSessions.set(client.id, sessionId);
      this.sessionSockets.set(sessionId, client.id);
      console.log(`[WS] Client connected: ${client.id} with session: ${sessionId}`);

      // Update session status back to active if it was inactive
      const session = await this.sessionService.getSession(sessionId);
      if (session && session.status === 'inactive') {
        await this.sessionService.updateSessionStatus(sessionId, 'active');
        console.log(`[WS] Reactivated session ${sessionId} on reconnection`);
      }

      // Join the user's chatroom if they have one
      const chatroom = await this.chatroomService.getChatroomBySession(sessionId);
      console.log(`[WS] Chatroom lookup for session ${sessionId}:`, chatroom ? `Found ${chatroom.id}` : 'Not found');
      
      if (chatroom && chatroom.status === 'active') {
        // Leave any existing chatroom rooms first
        client.rooms.forEach((room) => {
          if (room.startsWith('chatroom:')) {
            console.log(`[WS] Leaving previous room on connection: ${room}`);
            client.leave(room);
          }
        });
        
        client.join(`chatroom:${chatroom.id}`);
        console.log(`[WS] User ${sessionId} joined chatroom: ${chatroom.id}`);
        
        // Send existing messages to the reconnected user
        const messages = await this.chatroomService.getChatroomMessages(chatroom.id);
        console.log(`[WS] Sending message history to reconnected user:`, messages.length, 'messages');
        client.emit('messageHistory', messages);

        // Notify partner that user has reconnected
        const partnerMember = chatroom.members.find(
          (member) => member.sessionId !== sessionId && member.leftAt === null
        );
        if (partnerMember) {
          const partnerSocketId = this.getSocketIdBySessionId(partnerMember.sessionId);
          if (partnerSocketId) {
            this.server.to(partnerSocketId).emit('partnerReconnected', { sessionId });
            console.log(`[WS] Notified partner ${partnerMember.sessionId} that ${sessionId} reconnected`);
          }
        }
      }
    } else {
      console.log(`[WS] Connection rejected - No session ID provided`);
    }
  }

  async handleDisconnect(client: Socket) {
    const sessionId = this.userSessions.get(client.id);
    console.log(`[WS] Client disconnected: ${client.id} with session: ${sessionId}`);

    if (sessionId) {
      // Get current chatroom
      const chatroom = await this.chatroomService.getChatroomBySession(sessionId);
      console.log(`[WS] Disconnect - Chatroom for session ${sessionId}:`, chatroom ? `Found ${chatroom.id}` : 'Not found');

      if (chatroom && chatroom.status === 'active') {
        // Find this user's chatroom member record
        const thisMember = chatroom.members.find(
          (member) => member.sessionId === sessionId && member.leftAt === null
        );

        // Remove this user from the chatroom (mark leftAt)
        if (thisMember) {
          await this.prisma.chatroomMember.update({
            where: { id: thisMember.id },
            data: { leftAt: new Date() },
          });
          console.log(`[WS] Marked session ${sessionId} as left chatroom ${chatroom.id}`);
        }

        // Find the partner session
        const partnerMember = chatroom.members.find(
          (member) => member.sessionId !== sessionId && member.leftAt === null
        );

        if (partnerMember) {
          // Notify partner specifically about disconnection
          this.notifyPartnerDisconnected(partnerMember.sessionId, sessionId);

          // Add system message about disconnection
          const leaveMessage = await this.chatroomService.addMessage({
            chatroomId: chatroom.id,
            senderId: 'system',
            content: 'Your partner has disconnected',
            type: 'system',
          });

          console.log(`[WS] Emitting leave message to chatroom ${chatroom.id}:`, leaveMessage);
          this.server.to(`chatroom:${chatroom.id}`).emit('newMessage', leaveMessage);
        }

        // Remove from typing users if present
        const typingSet = this.typingUsers.get(chatroom.id);
        if (typingSet) {
          typingSet.delete(sessionId);
          this.server.to(`chatroom:${chatroom.id}`).emit('typingStatus', {
            sessionIds: Array.from(typingSet),
          });
        }

        // Leave the chatroom room
        client.leave(`chatroom:${chatroom.id}`);
      }

      // Clear socket mappings immediately
      this.userSessions.delete(client.id);
      this.sessionSockets.delete(sessionId);

      // Set a timeout before marking session as inactive to allow for reconnection
      setTimeout(async () => {
        // Check if session has reconnected (socket mapping exists again)
        if (!this.sessionSockets.has(sessionId)) {
          // Session hasn't reconnected, mark as inactive
          await this.sessionService.updateSessionStatus(sessionId, 'inactive');
          console.log(`[WS] Session ${sessionId} marked as inactive after timeout (no reconnection)`);
        } else {
          console.log(`[WS] Session ${sessionId} reconnected, not marking as inactive`);
        }
      }, 30000); // 30 second grace period for reconnection
    }
  }

  @SubscribeMessage('joinChatroom')
  async handleJoinChatroom(client: Socket, payload: { chatroomId: string }) {
    const sessionId = this.userSessions.get(client.id);
    console.log(`[WS] joinChatroom - Socket: ${client.id}, Session: ${sessionId}, Payload:`, payload);
    console.log(`[WS] Current socket rooms:`, client.rooms);
    
    if (!sessionId) {
      console.log(`[WS] joinChatroom failed - No session found for socket ${client.id}`);
      return { error: 'No session found' };
    }

    const chatroom = await this.chatroomService.getChatroom(payload.chatroomId);
    if (!chatroom) {
      console.log(`[WS] joinChatroom failed - Chatroom ${payload.chatroomId} not found`);
      return { error: 'Chatroom not found' };
    }

    const roomName = `chatroom:${payload.chatroomId}`;
    
    // Leave ALL existing chatroom rooms first
    client.rooms.forEach((room) => {
      if (room.startsWith('chatroom:')) {
        console.log(`[WS] Leaving previous room: ${room}`);
        client.leave(room);
      }
    });
    
    client.join(roomName);
    console.log(`[WS] Socket ${client.id} joined room ${roomName}`);
    console.log(`[WS] Socket rooms after join:`, client.rooms);
    
    // Send existing messages to the newly joined user
    const messages = await this.chatroomService.getChatroomMessages(payload.chatroomId);
    console.log(`[WS] Sending message history to socket ${client.id}:`, messages.length, 'messages');
    client.emit('messageHistory', messages);
    
    // Notify other users (but don't add a system message - it's redundant)
    console.log(`[WS] User ${sessionId} joined chatroom ${roomName}`);
    
    // Also send response to the client
    client.emit('joinChatroom', { success: true, chatroom });
    
    return { success: true, chatroom };
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    client: Socket,
    payload: { chatroomId: string; content: string; type?: string; imageUrl?: string; replyTo?: any },
  ) {
    const sessionId = this.userSessions.get(client.id);
    console.log(`[WS] sendMessage - Socket: ${client.id}, Session: ${sessionId}, Payload:`, payload);
    console.log(`[WS] Socket rooms:`, client.rooms);

    if (!sessionId) {
      console.log(`[WS] sendMessage failed - No session found for socket ${client.id}`);
      return { error: 'No session found' };
    }

    const roomName = `chatroom:${payload.chatroomId}`;
    console.log(`[WS] Socket is in room ${roomName}:`, client.rooms.has(roomName));

    // Force join the room if not already in it
    if (!client.rooms.has(roomName)) {
      console.log(`[WS] Socket not in room, forcing join to ${roomName}`);
      client.join(roomName);
    }

    console.log(`[WS] Creating message with senderId: ${sessionId}`);
    const message = await this.chatroomService.addMessage({
      chatroomId: payload.chatroomId,
      senderId: sessionId,
      content: payload.content,
      imageUrl: payload.imageUrl,
      type: payload.type || 'text',
      replyToId: payload.replyTo?.id,
    });

    console.log(`[WS] Message created:`, message);
    console.log(`[WS] Message senderId in created message: ${message.senderId}`);
    console.log(`[WS] Broadcasting message to room ${roomName} (excluding sender)`);

    // Broadcast message to all users in the chatroom except sender
    this.server.to(roomName).except(client.id).emit('newMessage', message);

    // Emit to the sender for immediate feedback
    client.emit('newMessage', message);

    // Clear typing status for this user after sending a message
    const typingSet = this.typingUsers.get(payload.chatroomId);
    if (typingSet && typingSet.has(sessionId)) {
      typingSet.delete(sessionId);
      this.server.to(roomName).except(client.id).emit('typingStatus', {
        sessionIds: Array.from(typingSet),
      });
    }

    return { success: true, message };
  }

  @SubscribeMessage('typingStart')
  async handleTypingStart(client: Socket, payload: { chatroomId: string }) {
    const sessionId = this.userSessions.get(client.id);
    console.log(`[WS] typingStart - Socket: ${client.id}, Session: ${sessionId}, Chatroom: ${payload.chatroomId}`);
    
    if (!sessionId) {
      console.log(`[WS] typingStart failed - No session found for socket ${client.id}`);
      return { error: 'No session found' };
    }

    let typingSet = this.typingUsers.get(payload.chatroomId);
    if (!typingSet) {
      typingSet = new Set();
      this.typingUsers.set(payload.chatroomId, typingSet);
    }

    typingSet.add(sessionId);
    console.log(`[WS] Typing status for chatroom ${payload.chatroomId}:`, Array.from(typingSet));
    
    const roomName = `chatroom:${payload.chatroomId}`;
    // Send typing status to all users except the sender
    this.server.to(roomName).except(client.id).emit('typingStatus', {
      sessionIds: Array.from(typingSet),
    });

    return { success: true };
  }

  @SubscribeMessage('typingStop')
  async handleTypingStop(client: Socket, payload: { chatroomId: string }) {
    const sessionId = this.userSessions.get(client.id);
    console.log(`[WS] typingStop - Socket: ${client.id}, Session: ${sessionId}, Chatroom: ${payload.chatroomId}`);
    
    if (!sessionId) {
      console.log(`[WS] typingStop failed - No session found for socket ${client.id}`);
      return { error: 'No session found' };
    }

    const typingSet = this.typingUsers.get(payload.chatroomId);
    if (typingSet) {
      typingSet.delete(sessionId);
      console.log(`[WS] Typing status for chatroom ${payload.chatroomId}:`, Array.from(typingSet));
      
      const roomName = `chatroom:${payload.chatroomId}`;
      // Send typing status to all users except the sender
      this.server.to(roomName).except(client.id).emit('typingStatus', {
        sessionIds: Array.from(typingSet),
      });
    }

    return { success: true };
  }

  @SubscribeMessage('skipMatch')
  async handleSkipMatch(client: Socket) {
    const sessionId = this.userSessions.get(client.id);
    if (!sessionId) {
      return { error: 'No session found' };
    }

    // Get current chatroom
    const chatroom = await this.chatroomService.getChatroomBySession(sessionId);
    if (chatroom) {
      const roomName = `chatroom:${chatroom.id}`;
      
      // Find the partner session
      const partnerMember = chatroom.members.find(
        (member) => member.sessionId !== sessionId && member.leftAt === null
      );

      // Add system message about skip
      const skipMessage = await this.chatroomService.addMessage({
        chatroomId: chatroom.id,
        senderId: 'system',
        content: 'Your partner has skipped to find a new match',
        type: 'system',
      });

      this.server.to(roomName).emit('newMessage', skipMessage);

      // Notify partner specifically using the helper method
      if (partnerMember) {
        this.notifyPartnerSkipped(partnerMember.sessionId, sessionId);
      }

      // Leave the chatroom
      client.leave(roomName);
      
      // Clear typing status
      this.typingUsers.delete(chatroom.id);
    }

    return { success: true };
  }

  @SubscribeMessage('endMatch')
  async handleEndMatch(client: Socket) {
    const sessionId = this.userSessions.get(client.id);
    if (!sessionId) {
      return { error: 'No session found' };
    }

    // Get current chatroom
    const chatroom = await this.chatroomService.getChatroomBySession(sessionId);
    if (chatroom) {
      const roomName = `chatroom:${chatroom.id}`;

      // Find the partner session
      const partnerMember = chatroom.members.find(
        (member) => member.sessionId !== sessionId && member.leftAt === null
      );

      // Add system message about ending
      const endMessage = await this.chatroomService.addMessage({
        chatroomId: chatroom.id,
        senderId: 'system',
        content: 'Your partner has ended the chat',
        type: 'system',
      });

      this.server.to(roomName).emit('newMessage', endMessage);

      // Notify partner specifically using the helper method
      if (partnerMember) {
        this.notifyPartnerEnded(partnerMember.sessionId, sessionId);
      }

      // Leave the chatroom
      client.leave(roomName);

      // Clear typing status
      this.typingUsers.delete(chatroom.id);
    }

    return { success: true };
  }

  @SubscribeMessage('messageReaction')
  async handleMessageReaction(client: Socket, payload: { chatroomId: string; messageId: string; reacted: boolean }) {
    const sessionId = this.userSessions.get(client.id);
    console.log(`[WS] messageReaction - Socket: ${client.id}, Session: ${sessionId}, Payload:`, payload);

    if (!sessionId) {
      console.log(`[WS] messageReaction failed - No session found for socket ${client.id}`);
      return { error: 'No session found' };
    }

    const roomName = `chatroom:${payload.chatroomId}`;
    console.log(`[WS] Broadcasting reaction to room ${roomName}`);

    // Broadcast reaction to all users in the chatroom
    this.server.to(roomName).emit('messageReaction', {
      messageId: payload.messageId,
      reacted: payload.reacted,
      sessionId,
    });

    return { success: true };
  }
}