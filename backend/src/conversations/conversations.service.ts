import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  // A conversation is shared: visible to the owner (userId/guestId)
  // AND to the partner (partnerUserId/partnerGuestId). This is what makes
  // an AUTH <-> AUTH save appear in both users' inboxes as the same conversation.
  private participantOr(userId?: string, guestId?: string) {
    const or: any[] = [];
    if (userId) {
      or.push({ userId });
      or.push({ partnerUserId: userId });
    }
    if (guestId) {
      or.push({ guestId });
      or.push({ partnerGuestId: guestId });
    }
    return or;
  }

  // Owner profile so the partner side can render viewer-relative partner info
  private ownerSelect() {
    return { id: true, username: true, displayName: true, avatar: true, avatarSeed: true };
  }

  // Live auth-partner profile (username/displayName can change any time, so
  // resolve it from the User row instead of the save-time snapshot).
  async attachLivePartnerUsers(conversations: any[]) {
    const ids = Array.from(new Set(
      conversations.map((c) => c.partnerUserId).filter(Boolean),
    )) as string[];
    if (ids.length === 0) return conversations;
    const users = await (this.prisma as any).user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, displayName: true },
    });
    const byId = new Map(users.map((u: any) => [u.id, u]));
    return conversations.map((c) => ({
      ...c,
      partnerUser: c.partnerUserId ? byId.get(c.partnerUserId) || null : null,
    }));
  }

  private async enrichSenderUsernames(messagesToSave: any[]) {
    const missingSenderIds = Array.from(new Set(
      messagesToSave.filter((m: any) => !m.senderUsername).map((m: any) => m.senderId),
    ));
    const senderSessions: Array<{ id: string; username: string }> = missingSenderIds.length
      ? await (this.prisma as any).session.findMany({
          where: { id: { in: missingSenderIds } },
          select: { id: true, username: true },
        })
      : [];
    const usernameBySessionId = new Map<string, string>(
      senderSessions.map((s) => [s.id, s.username as string]),
    );
    return messagesToSave.map((msg: any) => ({
      ...msg,
      senderUsername: msg.senderUsername || usernameBySessionId.get(msg.senderId) || null,
      type: msg.type || 'text',
    }));
  }

  async saveConversation(userId: string, conversationData: {
    title?: string;
    partnerUsername?: string;
    partnerInfo?: string;
    partnerUserId?: string;
    partnerGuestId?: string;
    currentUserId?: string; // Session ID of the user saving
    messages: Array<{
      senderId: string;
      senderUsername: string;
      content: string;
      imageUrl?: string;
      type?: string;
      replyToId?: string;
    }>;
  }) {
    console.log('[ConversationsService] Saving conversation for user:', userId);
    console.log('[ConversationsService] Messages to save:', conversationData.messages.length);
    
    // Determine if this is auto-save (auth to unauth) or mutual consent save
    const isAutoSave = !conversationData.partnerUserId && conversationData.partnerGuestId;
    
    // Resolve missing sender usernames (raw chatroom history doesn't include them)
    const enrichedMessages = await this.enrichSenderUsernames(conversationData.messages);

    // Upsert: find an existing auto-save conversation for this user + guest partner and append new messages
    if (isAutoSave && conversationData.partnerGuestId) {
      const existing = await (this.prisma as any).savedConversation.findFirst({
        where: {
          userId,
          partnerGuestId: conversationData.partnerGuestId,
        },
        include: { messages: true },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        if (enrichedMessages.length > 0) {
          await (this.prisma as any).savedConversation.update({
            where: { id: existing.id },
            data: {
              title: conversationData.title || existing.title,
              partnerUsername: conversationData.partnerUsername || existing.partnerUsername,
              partnerInfo: conversationData.partnerInfo || existing.partnerInfo,
              currentUserId: conversationData.currentUserId || existing.currentUserId,
              messageCount: existing.messageCount + enrichedMessages.length,
              lastMessageAt: new Date(),
              messages: {
                create: enrichedMessages.map((msg: any) => ({
                  senderId: msg.senderId,
                  senderUsername: msg.senderUsername,
                  content: msg.content,
                  imageUrl: msg.imageUrl,
                  type: msg.type || 'text',
                  replyToId: msg.replyToId,
                })),
              },
            },
          });
          console.log('[ConversationsService] Appended', enrichedMessages.length, 'messages to conversation:', existing.id);
        }
        return this.getConversationById(existing.id, userId);
      }
    }
    
    // Create saved conversation using raw query to avoid TypeScript issues
    const savedConversation = await (this.prisma as any).savedConversation.create({
      data: {
        userId,
        title: conversationData.title || `Chat with ${conversationData.partnerUsername || 'Anonymous'}`,
        partnerUsername: conversationData.partnerUsername,
        partnerInfo: conversationData.partnerInfo,
        partnerUserId: conversationData.partnerUserId,
        partnerGuestId: conversationData.partnerGuestId,
        currentUserId: conversationData.currentUserId, // Save the current user's session ID
        messageCount: conversationData.messages.length,
        status: isAutoSave ? 'ended' : 'active', // Auto-saved conversations are ended
        canReconnect: !isAutoSave, // Only mutual consent saves can reconnect
        reconnectOffered: !isAutoSave, // Only mutual consent saves have reconnection offers
        messages: {
          create: enrichedMessages.map(msg => ({
            senderId: msg.senderId,
            senderUsername: msg.senderUsername,
            content: msg.content,
            imageUrl: msg.imageUrl,
            type: msg.type || 'text',
            replyToId: msg.replyToId,
          })),
        },
      },
    });

    console.log('[ConversationsService] Conversation saved:', savedConversation.id, 'Auto-save:', isAutoSave, 'Messages saved:', savedConversation.messageCount);
    return savedConversation;
  }

  async getUserConversations(userId: string) {
    console.log('[ConversationsService] Getting conversations for user:', userId);
    
    // Shared conversations: rows I own AND rows where I am the partner
    // (e.g. AUTH <-> AUTH saves are visible to both users as the same conversation)
    const conversations = await (this.prisma as any).savedConversation.findMany({
      where: { OR: [{ userId }, { partnerUserId: userId }] },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1, // Get first message for preview
        },
        user: { select: this.ownerSelect() },
      },
    });

    console.log('[ConversationsService] Found conversations:', conversations.length);
    return this.attachLivePartnerUsers(conversations);
  }

  async getConversationById(conversationId: string, userId: string, guestId?: string) {
    console.log('[ConversationsService] Getting conversation:', conversationId);
    
    const or = this.participantOr(userId, guestId);
    const conversation = await (this.prisma as any).savedConversation.findFirst({
      where: or.length > 0
        ? { id: conversationId, OR: or }
        : { id: conversationId, userId: '__none__' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        user: { select: this.ownerSelect() },
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    console.log('[ConversationsService] Conversation found with', conversation.messages.length, 'messages');
    const [enriched] = await this.attachLivePartnerUsers([conversation]);
    return enriched;
  }

  // Append live messages to an existing shared conversation (used when
  // continuing a saved conversation — both sides write to the same row).
  async appendMessages(conversationId: string, sender: { sessionId: string; userId?: string }, messages: Array<{
    senderId: string;
    senderUsername?: string;
    content: string;
    imageUrl?: string;
    type?: string;
    replyToId?: string;
  }>) {
    console.log('[ConversationsService] Appending', messages?.length, 'messages to conversation:', conversationId);

    const conversation = await (this.prisma as any).savedConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const isParticipant =
      (sender.userId && (conversation.userId === sender.userId || conversation.partnerUserId === sender.userId)) ||
      (conversation.guestId === sender.sessionId || conversation.partnerGuestId === sender.sessionId);

    if (!isParticipant) {
      throw new Error('You are not authorized to write to this conversation');
    }

    if (!messages || messages.length === 0) {
      return { appended: 0, conversationId };
    }

    const enrichedMessages = await this.enrichSenderUsernames(messages as any[]);

    // Create one by one so we can return the new ids (used to keep reply
    // chains resolvable when the conversation is reopened later).
    const savedIds: string[] = [];
    for (const msg of enrichedMessages) {
      const created = await (this.prisma as any).savedMessage.create({
        data: {
          conversationId,
          senderId: msg.senderId,
          senderUsername: msg.senderUsername,
          content: msg.content,
          imageUrl: msg.imageUrl,
          type: msg.type || 'text',
          replyToId: msg.replyToId,
        },
      });
      savedIds.push(created.id);
    }

    await (this.prisma as any).savedConversation.update({
      where: { id: conversationId },
      data: {
        messageCount: { increment: enrichedMessages.length },
        lastMessageAt: new Date(),
      },
    });

    console.log('[ConversationsService] Appended messages to conversation:', conversationId);
    return { appended: enrichedMessages.length, conversationId, savedIds };
  }

  async deleteConversation(conversationId: string, userId: string) {
    console.log('[ConversationsService] Deleting conversation:', conversationId);
    
    const conversation = await (this.prisma as any).savedConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ userId }, { partnerUserId: userId }],
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    await (this.prisma as any).savedConversation.delete({
      where: { id: conversationId },
    });

    console.log('[ConversationsService] Conversation deleted');
    return { success: true };
  }

  async updateConversationTitle(conversationId: string, userId: string, title: string) {
    console.log('[ConversationsService] Updating conversation title:', conversationId);
    
    const conversation = await (this.prisma as any).savedConversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ userId }, { partnerUserId: userId }],
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const updated = await (this.prisma as any).savedConversation.update({
      where: { id: conversationId },
      data: { title },
    });

    return updated;
  }
}