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
import { RedisService } from '../redis/redis.service';
import { SaveOfferService } from '../conversations/save-offer.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ReconnectionService } from '../conversations/reconnection.service';
import { WalletService } from '../wallet/wallet.service';
import { isGuestUser } from '../auth/auth.constants';
import { computeBundlePrice } from '../wallet/gift-catalog';
import { walletEvents, WALLET_EVENTS } from '../wallet/wallet-events';
import { randomUUID } from 'crypto';

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
  private userSockets = new Map<string, Set<string>>(); // userId -> socketIds (authenticated users only)
  private typingUsers = new Map<string, Set<string>>(); // chatroomId -> Set of sessionIds
  private liveToSavedMessage = new Map<string, string>(); // live Message id -> SavedMessage id (continued conversations)

  constructor(
    private chatroomService: ChatroomService,
    private sessionService: SessionService,
    private prisma: PrismaService,
    private redis: RedisService,
    private saveOfferService: SaveOfferService,
    private conversationsService: ConversationsService,
    private reconnectionService: ReconnectionService,
    private walletService: WalletService,
  ) {
    walletEvents.on(WALLET_EVENTS.updated, (payload: { userId: string }) => {
      this.pushWalletBalance(payload.userId);
    });
  }

  // Fan a wallet balance change out to all live sockets of a user
  // (dashboard top-bar preview, wallet page, chat pills …).
  private pushWalletBalance(userId: string) {
    if (!userId) return;
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return;
    this.walletService
      .getBalance(userId)
      .then((wallet) => {
        const balance = typeof wallet?.balance === 'number' ? wallet.balance : null;
        for (const sid of sockets) {
          this.server.to(sid).emit('walletUpdated', { userId, balance });
        }
      })
      .catch((e) => console.error('[WS] walletUpdated push failed:', userId, e?.message));
  }

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

  // Resolve the partner (auth) of a chatroom from the viewer's session side.
  private async resolvePartnerSession(chatroom: any, sessionId: string) {
    const partnerMember = chatroom.members.find(
      (m: any) => m.sessionId !== sessionId && m.leftAt === null,
    ) || chatroom.members.find((m: any) => m.sessionId !== sessionId);
    if (!partnerMember) return null;
    return this.sessionService.getSession(partnerMember.sessionId).catch(() => null);
  }

  private async resolvePaidMediaForMessage(mediaPriceRaw: string | null | undefined) {
    if (!mediaPriceRaw) return null;
    try {
      const parsed = JSON.parse(mediaPriceRaw);
      return {
        priceCoins: parsed.priceCoins,
        priceMinor: parsed.priceMinor,
        items: parsed.items || [],
        sellerUserId: parsed.sellerUserId,
        mediaType: parsed.mediaType || 'image',
      };
    } catch {
      return null;
    }
  }

  // Live-chat history must also withhold the real URL of locked media from
  // anyone who is not the seller and hasn't unlocked it (otherwise a recipient
  // rejoining the room could read the URL without paying).
  private sanitizeHistoryForViewer(messages: any[], viewerUserId?: string) {
    return (messages || []).map((m: any) => {
      if (!m.mediaPrice) return m;
      const out = { ...m };
      let mediaPrice: any = null;
      try {
        mediaPrice = typeof m.mediaPrice === 'string' ? JSON.parse(m.mediaPrice) : m.mediaPrice;
      } catch {
        mediaPrice = null;
      }
      out.mediaPrice = mediaPrice;
      const viewerIsSeller = !!viewerUserId && !!mediaPrice?.sellerUserId && mediaPrice.sellerUserId === viewerUserId;
      const alreadyUnlocked = !!m.mediaUnlockedAt;
      if (!viewerIsSeller && !alreadyUnlocked) {
        out.imageUrl = undefined;
      }
      return out;
    });
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

      // Track sockets per authenticated user (used for conversation notifications)
      const connectedSession: any = session;
      if (connectedSession?.userId && connectedSession.user && !isGuestUser(connectedSession.user)) {
        const sockets = this.userSockets.get(connectedSession.userId) || new Set<string>();
        sockets.add(client.id);
        this.userSockets.set(connectedSession.userId, sockets);
      } else {
        // Dashboard / wallet sockets may connect with a bare userId (no session)
        // purely to receive live `walletUpdated` events.
        const userIdQuery = client.handshake.query.userId as string | undefined;
        if (userIdQuery) {
          try {
            const user = await (this.prisma as any).user.findUnique({
              where: { id: userIdQuery },
            });
            if (user && !isGuestUser(user)) {
              const sockets = this.userSockets.get(userIdQuery) || new Set<string>();
              sockets.add(client.id);
              this.userSockets.set(userIdQuery, sockets);
            }
          } catch (e: any) {
            console.error('[WS] Failed to register userId socket:', e?.message);
          }
        }
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
        const messages = this.sanitizeHistoryForViewer(
          await this.chatroomService.getChatroomMessages(chatroom.id),
          session.userId,
        );
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
      // Dashboard / wallet sockets may connect with a bare userId (no session)
      // purely to receive live `walletUpdated` events.
      const userIdQuery = client.handshake.query.userId as string | undefined;
      if (userIdQuery) {
        try {
          const user = await (this.prisma as any).user.findUnique({
            where: { id: userIdQuery },
          });
          if (user && !isGuestUser(user)) {
            const sockets = this.userSockets.get(userIdQuery) || new Set<string>();
            sockets.add(client.id);
            this.userSockets.set(userIdQuery, sockets);
            console.log(`[WS] Registered bare userId socket ${client.id} for ${userIdQuery}`);
          }
        } catch (e: any) {
          console.error('[WS] Failed to register userId socket:', e?.message);
        }
      } else {
        console.log(`[WS] Connection rejected - No session ID provided`);
      }
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

      // Clear per-user socket tracking
      for (const [userId, sockets] of this.userSockets.entries()) {
        if (sockets.delete(client.id) && sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }

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
    const messages = this.sanitizeHistoryForViewer(
      await this.chatroomService.getChatroomMessages(payload.chatroomId),
      (await this.sessionService.getSession(sessionId))?.userId,
    );
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
    payload: {
      chatroomId: string;
      content: string;
      type?: string;
      imageUrl?: string;
      replyTo?: any;
      conversationId?: string;
      mediaPrice?: Array<{ key: string; qty: number }>;
      mediaPreviewUrl?: string | null;
    },
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

    // Paid media (photo/video unlocked by a recipient) — AUTH <-> AUTH only.
    let mediaPriceJson: string | null = null;
    let mediaUnlockKey: string | null = null;
    const isMediaPayload = payload.type === 'image' || payload.type === 'video';
    if (isMediaPayload && payload.mediaPrice) {
      const chatroom = await this.chatroomService.getChatroom(payload.chatroomId);
      const senderSession: any = await this.sessionService.getSession(sessionId);
      const senderUserId = senderSession?.userId as string | undefined;
      const isSenderAuth = !!senderUserId && !isGuestUser(senderSession?.user);
      const partnerSession = chatroom
        ? await this.resolvePartnerSession(chatroom, sessionId)
        : null;
      const isPartnerAuth = !!partnerSession?.userId && !isGuestUser(partnerSession?.user);

      if (!isSenderAuth) {
        return { error: 'Paid media is only available for authenticated users' };
      }
      if (!partnerSession || !isPartnerAuth) {
        return { error: 'Paid media is only available between authenticated users' };
      }

      try {
        const bundle = computeBundlePrice(payload.mediaPrice);
        mediaPriceJson = JSON.stringify({
          items: bundle.items,
          priceCoins: bundle.priceCoins,
          priceMinor: bundle.priceMinor,
          sellerUserId: senderUserId,
          mediaType: payload.type,
        });
        mediaUnlockKey = randomUUID();
      } catch (priceError: any) {
        return { error: priceError?.message || 'Invalid media price' };
      }
    }

// replyToId must reference a live Message row; ids coming from saved
// conversation history (SavedMessage ids) are kept for display only.
    let replyToId = payload.replyTo?.id;
    if (replyToId) {
      const replyTarget = await (this.prisma as any).message.findUnique({
        where: { id: replyToId },
      });
      if (!replyTarget) {
        replyToId = undefined;
      }
    }
    const message = await this.chatroomService.addMessage({
      chatroomId: payload.chatroomId,
      senderId: sessionId,
      content: payload.content,
      imageUrl: payload.imageUrl,
      type: payload.type || 'text',
      replyToId,
      mediaPrice: mediaPriceJson,
      mediaUnlockKey,
      mediaPreviewUrl: payload.mediaPreviewUrl || null,
    });

    // Get sender session to include username
    const senderSession = await this.sessionService.getSession(sessionId);
    const messageWithUsername = {
      ...message,
      senderUsername: senderSession?.username || 'Anonymous',
      // Fall back to the client-provided reply preview (e.g. when replying
      // to a saved-history message that has no live Message row).
      replyTo: (message as any).replyTo || payload.replyTo || null,
    };

    console.log(`[WS] Message created:`, messageWithUsername);
    console.log(`[WS] Message senderId in created message: ${messageWithUsername.senderId}`);
    console.log(`[WS] Broadcasting message to room ${roomName} (excluding sender)`);

    // Locked media: withhold the URL from everyone except the sender so the
    // real photo/video is only revealed after a recipient unlocks it.
    if (mediaPriceJson) {
      const parsedBundle = JSON.parse(mediaPriceJson);
      const partnerView = {
        ...messageWithUsername,
        imageUrl: undefined,
        mediaPrice: parsedBundle,
        mediaUnlockKey,
        mediaUnlockedAt: null,
        mediaPreviewUrl: payload.mediaPreviewUrl || (messageWithUsername as any).mediaPreviewUrl || null,
      };
      this.server.to(roomName).except(client.id).emit('newMessage', partnerView);
      client.emit('newMessage', {
        ...messageWithUsername,
        mediaPrice: parsedBundle,
        mediaUnlockKey,
        mediaUnlockedAt: null,
      });
    } else {
      // Broadcast message to all users in the chatroom except sender
      this.server.to(roomName).except(client.id).emit('newMessage', messageWithUsername);
      // Emit to the sender for immediate feedback
      client.emit('newMessage', messageWithUsername);
    }

    // Clear typing status for this user after sending a message
    const typingSet = this.typingUsers.get(payload.chatroomId);
    if (typingSet && typingSet.has(sessionId)) {
      typingSet.delete(sessionId);
      this.server.to(roomName).except(client.id).emit('typingStatus', {
        sessionIds: Array.from(typingSet),
      });
    }

    // If this message belongs to a continued saved conversation, persist it there too
    if (payload.conversationId) {
      try {
        // Translate the reply target to a SavedMessage id so the reply
        // preview still resolves when the conversation is reopened later.
        let savedReplyToId = payload.replyTo?.id;
        if (savedReplyToId) {
          const mapped = this.liveToSavedMessage.get(savedReplyToId);
          if (mapped) {
            savedReplyToId = mapped;
          } else {
            const existingSaved = await (this.prisma as any).savedMessage.findFirst({
              where: { id: savedReplyToId, conversationId: payload.conversationId },
            });
            if (!existingSaved) {
              savedReplyToId = undefined;
            }
          }
        }
        const appendResult: any = await this.conversationsService.appendMessages(
          payload.conversationId,
          { sessionId, userId: senderSession?.userId },
          [{
            senderId: sessionId,
            senderUsername: senderSession?.username || 'Anonymous',
            content: payload.content,
            imageUrl: payload.imageUrl,
            type: payload.type || 'text',
            replyToId: savedReplyToId,
            mediaPrice: mediaPriceJson || undefined,
            mediaUnlockKey: mediaUnlockKey || undefined,
            mediaPreviewUrl: payload.mediaPreviewUrl || null,
          }],
        );
        const firstSavedId = appendResult?.savedIds?.[0];
        if (firstSavedId) {
          this.liveToSavedMessage.set(message.id, firstSavedId);
        }
      } catch (persistError: any) {
        console.error('[WS] Failed to persist conversation message:', persistError?.message);
      }
    }

    return { success: true, message };
  }

  @SubscribeMessage('unlockMedia')
  async handleUnlockMedia(
    client: Socket,
    payload: { chatroomId?: string; conversationId?: string; messageId: string; idempotencyKey?: string },
  ) {
    const sessionId = this.userSessions.get(client.id);
    console.log('[WS] unlockMedia - Socket:', client.id, 'Session:', sessionId, 'Message:', payload?.messageId);

    if (!sessionId) {
      return { error: 'No session found' };
    }

    try {
      const currentSession: any = await this.sessionService.getSession(sessionId);
      if (!currentSession) {
        return { error: 'Session not found' };
      }
      const buyerUserId = currentSession.userId as string | undefined;
      const isBuyerAuth = !!buyerUserId && !isGuestUser(currentSession.user);
      if (!isBuyerAuth) {
        return { error: 'Only authenticated users can unlock media' };
      }

      // Resolve the media message (live Message or saved SavedMessage).
      let target: any = await (this.prisma as any).message.findUnique({
        where: { id: payload.messageId },
      }).catch(() => null);
      let isSaved = false;
      if (!target) {
        target = await (this.prisma as any).savedMessage.findUnique({
          where: { id: payload.messageId },
        }).catch(() => null);
        isSaved = true;
      }
      if (!target || !target.mediaPrice) {
        return { error: 'Paid media message not found' };
      }

      const media = await this.resolvePaidMediaForMessage(target.mediaPrice);
      if (!media) {
        return { error: 'Invalid media metadata' };
      }
      const sellerUserId = media.sellerUserId as string | undefined;
      if (!sellerUserId) {
        return { error: 'Media seller unknown' };
      }
      if (buyerUserId === sellerUserId) {
        return { error: 'You own this media' };
      }

      // Already unlocked → idempotent success, no charge.
      if (target.mediaUnlockedAt) {
        return {
          success: true,
          mediaUnlockKey: target.mediaUnlockKey,
          imageUrl: target.imageUrl,
          mediaType: media.mediaType,
          url: target.imageUrl,
          alreadyUnlocked: true,
        };
      }

      // Purchase: debit buyer, credit seller (both wallets must be active).
      await this.walletService.purchaseMedia(
        buyerUserId as string,
        sellerUserId,
        media.priceMinor,
        {
          bundle: { priceCoins: media.priceCoins, items: media.items },
          mediaLabel: media.mediaType === 'video' ? 'a video' : 'a photo',
        },
        payload.idempotencyKey,
      );

      const now = new Date();
      const unlockKey = target.mediaUnlockKey as string | undefined;
      const imageUrl = target.imageUrl;

      // Mark unlocked on all copies sharing the same mediaUnlockKey.
      if (unlockKey) {
        await (this.prisma as any).message.updateMany({
          where: { mediaUnlockKey: unlockKey },
          data: { mediaUnlockedAt: now },
        });
        await (this.prisma as any).savedMessage.updateMany({
          where: { mediaUnlockKey: unlockKey },
          data: { mediaUnlockedAt: now },
        });
      } else {
        if (isSaved) {
          await (this.prisma as any).savedMessage.update({
            where: { id: target.id },
            data: { mediaUnlockedAt: now },
          });
        } else {
          await (this.prisma as any).message.update({
            where: { id: target.id },
            data: { mediaUnlockedAt: now },
          });
        }
      }

      // Notify everyone in the live chatroom (if any) + the partner's sockets.
      const unlockEvent = {
        messageId: payload.messageId,
        mediaUnlockKey: unlockKey,
        imageUrl,
        mediaType: media.mediaType,
        mediaUnlockedAt: now.toISOString(),
        buyerUserId,
        sellerUserId,
        buyerSessionId: sessionId,
      };
      if (payload.chatroomId) {
        const roomName = `chatroom:${payload.chatroomId}`;
        if (client.rooms.has(roomName)) {
          this.server.to(roomName).emit('mediaUnlocked', unlockEvent);
        } else {
          this.server.to(roomName).emit('mediaUnlocked', unlockEvent);
        }
      }
      if (payload.conversationId) {
        client.to(`conversation:${payload.conversationId}`).emit('mediaUnlocked', unlockEvent);
        const sockets = this.userSockets.get(sellerUserId);
        if (sockets) {
          for (const sid of sockets) {
            this.server.to(sid).emit('mediaUnlocked', unlockEvent);
          }
        }
      }
      // The buyer's own copy unlocks immediately.
      client.emit('mediaUnlocked', unlockEvent);

      const wallet = await this.walletService.getBalance(buyerUserId as string);
      return { success: true, ...unlockEvent, balance: wallet.balance };
    } catch (error: any) {
      console.error('[WS] Error unlocking media:', error);
      return { error: error.message || 'Failed to unlock media' };
    }
  }

  @SubscribeMessage('sendGift')
  async handleSendGift(
    client: Socket,
    payload: { chatroomId?: string; conversationId?: string; giftKey: string; idempotencyKey?: string },
  ) {
    const sessionId = this.userSessions.get(client.id);
    console.log('[WS] sendGift - Socket:', client.id, 'Session:', sessionId, 'Gift:', payload?.giftKey);

    if (!sessionId) {
      return { error: 'No session found' };
    }

    try {
      const currentSession: any = await this.sessionService.getSession(sessionId);
      if (!currentSession) {
        return { error: 'Session not found' };
      }

      const isCurrentAuth = !!currentSession.userId && !isGuestUser(currentSession.user);
      if (!isCurrentAuth) {
        return { error: 'Gifts only available for authenticated users' };
      }

      const senderUserId = currentSession.userId as string;
      let recipientUserId: string | undefined;
      let chatroomId = payload.chatroomId || null;
      let conversationId = payload.conversationId || null;

      // Determine recipient and chatroom from either saved conversation or live chatroom
      if (conversationId) {
        const conversation = await (this.prisma as any).savedConversation.findUnique({
          where: { id: conversationId },
        });
        if (!conversation) {
          return { error: 'Conversation not found' };
        }
        const isParticipant =
          conversation.userId === senderUserId || conversation.partnerUserId === senderUserId;
        if (!isParticipant) {
          return { error: 'You are not part of this conversation' };
        }
        recipientUserId =
          conversation.userId === senderUserId ? conversation.partnerUserId : conversation.userId;
        // Resolve live chatroom for this saved conversation
        if (!chatroomId) {
          chatroomId = await this.redis.get(`convchat:${conversationId}`);
        }
      } else if (chatroomId) {
        const chatroom = await this.chatroomService.getChatroom(chatroomId);
        if (!chatroom) {
          return { error: 'Chatroom not found' };
        }
        const partnerMember = chatroom.members.find(
          (m: any) => m.sessionId !== sessionId && m.leftAt === null,
        );
        // Fallback: also check members even if leftAt not null (for history gift?)
        const targetMember =
          partnerMember ||
          chatroom.members.find((m: any) => m.sessionId !== sessionId);
        if (!targetMember) {
          return { error: 'No partner found' };
        }
        const partnerSession: any = await this.sessionService.getSession(targetMember.sessionId);
        if (!partnerSession) {
          return { error: 'Partner session not found' };
        }
        const isPartnerAuth = !!partnerSession.userId && !isGuestUser(partnerSession.user);
        if (!isPartnerAuth) {
          return { error: 'Gifts only available between authenticated users' };
        }
        recipientUserId = partnerSession.userId;
      } else {
        return { error: 'chatroomId or conversationId is required' };
      }

      if (!recipientUserId) {
        return { error: 'Recipient is not an authenticated user (guests cannot receive gifts)' };
      }

      // Also verify recipient is not a guest user
      const recipientUser = await (this.prisma as any).user.findUnique({
        where: { id: recipientUserId },
      });
      if (!recipientUser || isGuestUser(recipientUser)) {
        return { error: 'Gifts only available between authenticated users' };
      }

      // Perform wallet transfer
      const giftResult = await this.walletService.sendGift(
        senderUserId,
        recipientUserId,
        payload.giftKey,
        payload.idempotencyKey,
      );

      const gift = giftResult.gift;

      // Create gift message in live chatroom if we have one
      let giftMessage: any = null;
      if (chatroomId) {
        const giftContent = JSON.stringify({
          giftKey: gift.key,
          label: gift.label,
          coins: gift.coins,
          amountMinor: gift.amountMinor,
          emoji: gift.emoji,
        });
        const roomName = `chatroom:${chatroomId}`;
        if (!client.rooms.has(roomName)) {
          client.join(roomName);
        }
        giftMessage = await this.chatroomService.addMessage({
          chatroomId,
          senderId: sessionId,
          content: giftContent,
          type: 'gift',
        });
        const senderSession = currentSession;
        const messageWithMeta = {
          ...giftMessage,
          senderUsername: senderSession?.username || 'Anonymous',
          giftMeta: {
            key: gift.key,
            label: gift.label,
            coins: gift.coins,
            amountMinor: gift.amountMinor,
            emoji: gift.emoji,
            color: gift.color,
          },
        };
        this.server.to(roomName).except(client.id).emit('newMessage', messageWithMeta);
        client.emit('newMessage', messageWithMeta);

        // Persist to saved conversation if in continued chat
        if (conversationId) {
          try {
            const senderUsername = senderSession?.username || 'Anonymous';
            await this.conversationsService.appendMessages(
              conversationId,
              { sessionId, userId: senderUserId },
              [
                {
                  senderId: sessionId,
                  senderUsername,
                  content: giftContent,
                  type: 'gift',
                },
              ],
            );
            const savedIds = (giftMessage as any).id ? [giftMessage.id] : [];
            // Map live->saved for reply handling if needed
            if (giftMessage && savedIds.length) {
              // Not critical for gift
            }
          } catch (persistError: any) {
            console.error('[WS] Failed to persist gift message:', persistError?.message);
          }
        }
      } else {
        // For saved conversations without live room yet, still persist
        if (conversationId) {
          const senderUsername = currentSession?.username || 'Anonymous';
          const giftContent = JSON.stringify({
            giftKey: gift.key,
            label: gift.label,
            coins: gift.coins,
            amountMinor: gift.amountMinor,
            emoji: gift.emoji,
          });
          await this.conversationsService.appendMessages(
            conversationId,
            { sessionId, userId: senderUserId },
            [
              {
                senderId: sessionId,
                senderUsername,
                content: giftContent,
                type: 'gift',
              },
            ],
          );
          // Fabricate a message for the response
          giftMessage = {
            id: `gift-${Date.now()}`,
            chatroomId: null,
            conversationId,
            senderId: sessionId,
            senderUsername: currentSession.username,
            content: giftContent,
            type: 'gift',
            createdAt: new Date().toISOString(),
            giftMeta: {
              key: gift.key,
              label: gift.label,
              coins: gift.coins,
              amountMinor: gift.amountMinor,
              emoji: gift.emoji,
              color: gift.color,
            },
          };
          // Notify partner via userSockets if online
          const con = await (this.prisma as any).savedConversation.findUnique({
            where: { id: conversationId },
          });
          const partnerUserId = con?.userId === senderUserId ? con?.partnerUserId : con?.userId;
          if (partnerUserId) {
            const sockets = this.userSockets.get(partnerUserId);
            if (sockets) {
              for (const sid of sockets) {
                this.server.to(sid).emit('newMessage', giftMessage);
              }
            }
          }
          // Also emit to sender if not already in room
          client.emit('newMessage', giftMessage);
        }
      }

      // Return wallet balance for sender
      const wallet = await this.walletService.getBalance(senderUserId);

      return {
        success: true,
        gift: {
          key: gift.key,
          label: gift.label,
          coins: gift.coins,
          amountMinor: gift.amountMinor,
          emoji: gift.emoji,
          color: gift.color,
        },
        message: giftMessage,
        balance: wallet.balance,
      };
    } catch (error: any) {
      console.error('[WS] Error sending gift:', error);
      return { error: error.message || 'Failed to send gift' };
    }
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

  @SubscribeMessage('offerToSave')
  async handleOfferToSave(client: Socket, payload: {
    partnerSessionId: string;
    partnerUserId?: string;
    partnerGuestId?: string;
    partnerUsername?: string;
    partnerInfo?: string;
    messages: Array<{
      senderId: string;
      senderUsername: string;
      content: string;
      imageUrl?: string;
      type?: string;
      replyToId?: string;
      mediaPrice?: any;
      mediaUnlockKey?: string;
      mediaUnlockedAt?: string | null;
      mediaPreviewUrl?: string | null;
    }>;
  }) {
    const sessionId = this.userSessions.get(client.id);
    console.log('[WS] offerToSave - Session:', sessionId, 'Partner:', payload.partnerSessionId);
    
    if (!sessionId) {
      return { error: 'No session found' };
    }

    try {
      // Get current session info
      const currentSession: any = await this.sessionService.getSession(sessionId);
      if (!currentSession) {
        return { error: 'Session not found' };
      }

      // Check user types and route accordingly
      const isCurrentAuth = !!currentSession.userId && !isGuestUser(currentSession.user);
      const isPartnerAuth = !!payload.partnerUserId;

      console.log('[WS] User types - Current auth:', isCurrentAuth, 'Partner auth:', isPartnerAuth);

      if (isCurrentAuth && !isPartnerAuth) {
        // AUTH <-> UNAUTH: Auto-save directly via conversations service
        console.log('[WS] Auto-saving conversation (auth to unauth)');

        const normalizedMessages = (payload.messages || []).map((m) => ({
          senderId: m.senderId,
          senderUsername: m.senderUsername,
          content: m.content,
          imageUrl: m.imageUrl,
          type: m.type,
          replyToId: m.replyToId,
          mediaPrice: m.mediaPrice ? (typeof m.mediaPrice === 'string' ? m.mediaPrice : JSON.stringify(m.mediaPrice)) : undefined,
          mediaUnlockKey: m.mediaUnlockKey,
          mediaUnlockedAt: m.mediaUnlockedAt ? new Date(m.mediaUnlockedAt) : undefined,
          mediaPreviewUrl: m.mediaPreviewUrl,
        }));

        const conversationData = {
          userId: currentSession.userId,
          title: `Chat with ${payload.partnerUsername || 'Anonymous'}`,
          partnerUsername: payload.partnerUsername,
          partnerInfo: payload.partnerInfo,
          partnerUserId: payload.partnerUserId,
          partnerGuestId: payload.partnerGuestId,
          messages: normalizedMessages,
        };

        const result = await this.conversationsService.saveConversation(currentSession.userId, conversationData);
        return { success: true, conversationId: result.id, autoSaved: true };
      } else if (!isCurrentAuth && isPartnerAuth) {
        // UNAUTH <-> AUTH: Guest users can't save
        console.log('[WS] Guest user cannot save conversations');
        return { error: 'Guest users cannot save conversations' };
      } else if (!isCurrentAuth && !isPartnerAuth) {
        // UNAUTH <-> UNAUTH: Neither can save
        console.log('[WS] Both unauth, conversation cannot be saved');
        return { error: 'Guest users cannot save conversations' };
      } else {
        // AUTH <-> AUTH: Use save offer system
        console.log('[WS] Creating save offer (auth to auth)');

        const normalizedMessages = (payload.messages || []).map((m) => ({
          senderId: m.senderId,
          senderUsername: m.senderUsername,
          content: m.content,
          imageUrl: m.imageUrl,
          type: m.type,
          replyToId: m.replyToId,
          mediaPrice: m.mediaPrice ? (typeof m.mediaPrice === 'string' ? m.mediaPrice : JSON.stringify(m.mediaPrice)) : undefined,
          mediaUnlockKey: m.mediaUnlockKey,
          mediaUnlockedAt: m.mediaUnlockedAt ? new Date(m.mediaUnlockedAt) : undefined,
          mediaPreviewUrl: m.mediaPreviewUrl,
        }));

        const result = await this.saveOfferService.offerToSaveConversation({
          userId: currentSession.userId,
          guestId: currentSession.userId ? undefined : sessionId,
          partnerUserId: payload.partnerUserId,
          partnerGuestId: payload.partnerGuestId,
          partnerUsername: payload.partnerUsername,
          partnerInfo: payload.partnerInfo,
          messages: normalizedMessages,
        });

        // Notify the partner about the save offer
        const partnerSocketId = this.getSocketIdBySessionId(payload.partnerSessionId);
        if (partnerSocketId) {
          this.server.to(partnerSocketId).emit('saveOfferReceived', {
            offerId: result.saveOffer.id,
            conversationId: result.conversation.id,
            offeredBy: currentSession.username,
            offeredByUserId: currentSession.userId,
            messageCount: result.conversation.messageCount,
          });
          console.log('[WS] Notified partner about save offer');
        }

        return { success: true, offerId: result.saveOffer.id, conversationId: result.conversation.id };
      }
    } catch (error: any) {
      console.error('[WS] Error in save operation:', error);
      return { error: error.message || 'Failed to save conversation' };
    }
  }

  @SubscribeMessage('respondToSaveOffer')
  async handleRespondToSaveOffer(client: Socket, payload: {
    offerId: string;
    response: 'accepted' | 'declined';
  }) {
    const sessionId = this.userSessions.get(client.id);
    console.log('[WS] respondToSaveOffer - Session:', sessionId, 'Offer:', payload.offerId, 'Response:', payload.response);
    
    if (!sessionId) {
      return { error: 'No session found' };
    }

    try {
      // Get current session info
      const currentSession: any = await this.sessionService.getSession(sessionId);
      if (!currentSession) {
        return { error: 'Session not found' };
      }

      // Respond to save offer
      const responderIsGuest = isGuestUser(currentSession.user);
      const result = await this.saveOfferService.respondToSaveOffer(
        payload.offerId,
        payload.response,
        responderIsGuest ? undefined : (currentSession.userId as string | undefined),
        responderIsGuest ? sessionId : undefined,
      );

      // If accepted, notify both parties
      if (payload.response === 'accepted') {
        const offer = await (this.prisma as any).saveOffer.findUnique({
          where: { id: payload.offerId },
          include: { conversation: true },
        });

        if (offer) {
          // Notify the offerer that their offer was accepted
          const offererSocketId = offer.offeredByUserId 
            ? this.getSocketIdBySessionId(offer.offeredByUserId)
            : this.getSocketIdBySessionId(offer.offeredByGuestId);
          
          if (offererSocketId) {
            this.server.to(offererSocketId).emit('saveOfferAccepted', {
              conversationId: offer.conversationId,
              partnerAccepted: true,
            });
          }

          // Notify the responder that the conversation is now saved
          client.emit('conversationSaved', {
            conversationId: offer.conversationId,
            canReconnect: true,
          });
        }
      } else {
        // Notify the offerer that their offer was declined
        const offer = await (this.prisma as any).saveOffer.findUnique({
          where: { id: payload.offerId },
        });

        if (offer) {
          const offererSocketId = offer.offeredByUserId 
            ? this.getSocketIdBySessionId(offer.offeredByUserId)
            : this.getSocketIdBySessionId(offer.offeredByGuestId);
          
          if (offererSocketId) {
            this.server.to(offererSocketId).emit('saveOfferDeclined', {
              offerId: payload.offerId,
            });
          }
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('[WS] Error responding to save offer:', error);
      return { error: 'Failed to respond to save offer' };
    }
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

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(client: Socket, payload: { conversationId: string }) {
    const sessionId = this.userSessions.get(client.id);
    console.log('[WS] joinConversation - Socket:', client.id, 'Session:', sessionId, 'Conversation:', payload?.conversationId);

    if (!sessionId) {
      return { error: 'No session found' };
    }

    try {
      const currentSession: any = await this.sessionService.getSession(sessionId);
      if (!currentSession) {
        return { error: 'Session not found' };
      }
      const myUserId = currentSession.userId as string | undefined;

      const conversation = await (this.prisma as any).savedConversation.findUnique({
        where: { id: payload.conversationId },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatar: true, avatarSeed: true } },
        },
      });

      if (!conversation) {
        return { error: 'Conversation not found' };
      }

      // Only participants (owner or partner side) may join
      const isParticipant =
        (myUserId && (conversation.userId === myUserId || conversation.partnerUserId === myUserId)) ||
        (conversation.guestId === sessionId || conversation.partnerGuestId === sessionId);

      if (!isParticipant) {
        return { error: 'You are not authorized to join this conversation' };
      }

      // Find or create the shared live chatroom for this conversation (cached in Redis)
      const mapKey = `convchat:${conversation.id}`;
      const mapTtl = 30 * 24 * 3600; // 30 days
      let chatroomId: string | null = await this.redis.get(mapKey);
      let chatroom: any = null;

      if (chatroomId) {
        chatroom = await this.chatroomService.getChatroom(chatroomId);
        if (!chatroom || chatroom.status !== 'active') {
          chatroom = null;
          chatroomId = null;
        }
      }

      if (!chatroom) {
        const created = await this.chatroomService.createChatroom([sessionId]);
        // Claim the mapping atomically; if the partner claimed it first, use theirs
        const redisClient: any = this.redis.getClient();
        const claimed = await redisClient.set(mapKey, created.id, 'EX', mapTtl, 'NX');
        if (claimed === 'OK') {
          chatroom = created;
          chatroomId = created.id;
        } else {
          await this.chatroomService.endChatroom(created.id);
          chatroomId = await this.redis.get(mapKey);
          chatroom = chatroomId ? await this.chatroomService.getChatroom(chatroomId) : null;
          if (!chatroom || chatroom.status !== 'active') {
            const retry = await this.chatroomService.createChatroom([sessionId]);
            await this.redis.set(mapKey, retry.id, mapTtl);
            chatroom = retry;
            chatroomId = retry.id;
          }
        }
      } else {
        // Refresh mapping TTL while the conversation is in use
        await this.redis.set(mapKey, chatroomId as string, mapTtl);
      }

      // Ensure membership (rejoin clears leftAt)
      const existingMember = await (this.prisma as any).chatroomMember.findFirst({
        where: { chatroomId, sessionId },
      });
      if (existingMember) {
        if (existingMember.leftAt) {
          await (this.prisma as any).chatroomMember.update({
            where: { id: existingMember.id },
            data: { leftAt: null },
          });
        }
      } else {
        await (this.prisma as any).chatroomMember.create({
          data: { chatroomId, sessionId },
        });
      }

      // Join the live chatroom room + the conversation presence room
      const roomName = `chatroom:${chatroomId}`;
      const convRoom = `conversation:${conversation.id}`;
      client.rooms.forEach((room) => {
        if (room.startsWith('chatroom:')) {
          client.leave(room);
        }
      });
      client.join(roomName);
      client.join(convRoom);

      // Load saved history mapped to the live chat message shape
      const saved = await (this.prisma as any).savedMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
      });
      const byId = new Map<string, any>(saved.map((m: any) => [m.id, m]));
      const messages = saved.map((m: any) => {
        const replied = m.replyToId ? byId.get(m.replyToId) : null;
        let imageUrl = m.imageUrl;
        let mediaPrice: any = null;
        let mediaUnlockKey = m.mediaUnlockKey || null;
        if (m.mediaPrice) {
          try {
            mediaPrice = JSON.parse(m.mediaPrice);
          } catch {
            mediaPrice = null;
          }
          // Locked media: only the seller and users who already unlocked it
          // get the real URL. Everyone else sees the lock state.
          const viewerIsSeller = !!myUserId && mediaPrice?.sellerUserId === myUserId;
          const unlocked = !!m.mediaUnlockedAt;
          if (!viewerIsSeller && !unlocked) {
            imageUrl = undefined;
          }
        }
        return {
          id: m.id,
          chatroomId,
          conversationId: conversation.id,
          senderId: m.senderId,
          senderUsername: m.senderUsername,
          content: m.content,
          imageUrl,
          type: m.type || 'text',
          mediaPrice,
          mediaUnlockKey,
          mediaUnlockedAt: m.mediaUnlockedAt,
          mediaPreviewUrl: m.mediaPreviewUrl || null,
          replyTo: replied
            ? { id: replied.id, content: replied.content, senderId: replied.senderId }
            : null,
          createdAt: m.createdAt,
        };
      });

      // Sender ids that belong to the viewer. Old sessions are recognized via
      // the viewer's username; stored session ids are only trusted for the
      // viewer's own side so the partner's old messages are never misattributed.
      const iAmOwner = !!myUserId && conversation.userId === myUserId;
      const ownSenderIds = new Set<string>([sessionId]);
      if (iAmOwner && conversation.currentUserId) ownSenderIds.add(conversation.currentUserId);
      if (conversation.guestId === sessionId) ownSenderIds.add(conversation.guestId);
      if (conversation.partnerGuestId === sessionId) ownSenderIds.add(conversation.partnerGuestId);
      for (const m of saved) {
        if (m.senderUsername && m.senderUsername === currentSession.username) {
          ownSenderIds.add(m.senderId);
        }
      }

      // Viewer-relative partner descriptor (auth people shown by live displayName)
      let partner: any;
      if (iAmOwner) {
        let info: any = {};
        try {
          info = conversation.partnerInfo ? JSON.parse(conversation.partnerInfo) : {};
        } catch {
          info = {};
        }
        let livePartner: any = null;
        if (conversation.partnerUserId) {
          livePartner = await (this.prisma as any).user.findUnique({
            where: { id: conversation.partnerUserId },
            select: { username: true, displayName: true },
          });
        }
        const partnerUsername = livePartner?.username || conversation.partnerUsername || 'Anonymous';
        partner = {
          username: partnerUsername,
          displayName: livePartner?.displayName || info.displayName || partnerUsername,
          country: info.country,
          countryCode: info.countryCode,
          university: info.university,
          gender: info.gender,
          avatar: info.avatar || 'adventurer',
          avatarSeed: info.avatarSeed,
          userId: conversation.partnerUserId,
          isAuthenticated: !!conversation.partnerUserId,
        };
      } else {
        const owner = conversation.user || {};
        const ownerUsername = owner.username || owner.displayName || conversation.partnerUsername || 'Anonymous';
        partner = {
          username: ownerUsername,
          displayName: owner.displayName || ownerUsername,
          avatar: owner.avatar || 'adventurer',
          avatarSeed: owner.avatarSeed,
          userId: conversation.userId,
          isAuthenticated: true,
        };
      }

      // Presence: anyone else already in the conversation room?
      const room = this.server.sockets.adapter.rooms.get(convRoom);
      const partnerOnline = !!room && room.size > 1;
      client.to(convRoom).emit('conversationPresence', {
        conversationId: conversation.id,
        sessionId,
        username: currentSession.username,
        online: true,
      });

      // Direct nudge to the partner's sockets if they are online elsewhere
      const partnerUserId = iAmOwner ? conversation.partnerUserId : conversation.userId;
      if (partnerUserId) {
        const sockets = this.userSockets.get(partnerUserId);
        if (sockets) {
          for (const sid of sockets) {
            if (sid !== client.id) {
              this.server.to(sid).emit('conversationOpened', {
                conversationId: conversation.id,
                byUsername: currentSession.username,
              });
            }
          }
        }
      }

      return {
        success: true,
        chatroomId,
        conversationId: conversation.id,
        messages,
        ownSenderIds: Array.from(ownSenderIds),
        partner,
        partnerOnline,
      };
    } catch (error: any) {
      console.error('[WS] Error joining conversation:', error);
      return { error: error.message || 'Failed to join conversation' };
    }
  }

  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(client: Socket, payload: { conversationId: string }) {
    const sessionId = this.userSessions.get(client.id);
    if (!sessionId) {
      return { error: 'No session found' };
    }

    const convRoom = `conversation:${payload.conversationId}`;
    client.to(convRoom).emit('conversationPresence', {
      conversationId: payload.conversationId,
      sessionId,
      online: false,
    });
    client.leave(convRoom);
    client.rooms.forEach((room) => {
      if (room.startsWith('chatroom:')) {
        client.leave(room);
      }
    });

    try {
      const chatroomId = await this.redis.get(`convchat:${payload.conversationId}`);
      if (chatroomId) {
        const member = await (this.prisma as any).chatroomMember.findFirst({
          where: { chatroomId, sessionId, leftAt: null },
        });
        if (member) {
          await (this.prisma as any).chatroomMember.update({
            where: { id: member.id },
            data: { leftAt: new Date() },
          });
        }
      }
    } catch (error: any) {
      console.error('[WS] Error leaving conversation:', error?.message);
    }

    return { success: true };
  }

  @SubscribeMessage('requestReconnection')
  async handleRequestReconnection(client: Socket, payload: {
    conversationId: string;
    partnerUserId?: string;
    partnerGuestId?: string;
  }) {
    const sessionId = this.userSessions.get(client.id);
    console.log('[WS] requestReconnection - Session:', sessionId, 'Conversation:', payload.conversationId);
    
    if (!sessionId) {
      return { error: 'No session found' };
    }

    try {
      const currentSession = await this.sessionService.getSession(sessionId);
      if (!currentSession) {
        return { error: 'Session not found' };
      }

      // For now, just create a new chatroom for the user
      // In a full implementation, this would notify the partner and wait for acceptance
      const chatroom = await this.chatroomService.createChatroom([sessionId]);
      
      return { success: true, chatroomId: chatroom.id };
    } catch (error: any) {
      console.error('[WS] Error requesting reconnection:', error);
      return { error: error.message || 'Failed to request reconnection' };
    }
  }
}