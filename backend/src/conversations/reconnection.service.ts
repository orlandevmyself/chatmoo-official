import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';

@Injectable()
export class ReconnectionService {
  constructor(
    private prisma: PrismaService,
    private sessionService: SessionService,
  ) {}

  async requestReconnection(conversationId: string, userId?: string, guestId?: string) {
    console.log('[ReconnectionService] Requesting reconnection for conversation:', conversationId);
    
    const conversation = await (this.prisma as any).savedConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (!conversation.canReconnect) {
      throw new Error('Reconnection not allowed for this conversation');
    }

    // Verify the requester is part of this conversation
    const isRequesterValid = 
      (userId && (conversation.userId === userId || conversation.partnerUserId === userId)) ||
      (guestId && (conversation.guestId === guestId || conversation.partnerGuestId === guestId));

    if (!isRequesterValid) {
      throw new Error('You are not authorized to reconnect to this conversation');
    }

    // Update conversation status to pending_reconnect
    const updated = await (this.prisma as any).savedConversation.update({
      where: { id: conversationId },
      data: {
        status: 'pending_reconnect',
        reconnectOffered: true,
      },
    });

    return updated;
  }

  async acceptReconnection(conversationId: string, userId?: string, guestId?: string) {
    console.log('[ReconnectionService] Accepting reconnection for conversation:', conversationId);
    
    const conversation = await (this.prisma as any).savedConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Verify the accepter is the other party
    const isAcceptorValid = 
      (userId && ((conversation.userId === userId && conversation.partnerUserId) || 
                 (conversation.partnerUserId === userId && conversation.userId))) ||
      (guestId && ((conversation.guestId === guestId && conversation.partnerGuestId) || 
                   (conversation.partnerGuestId === guestId && conversation.guestId)));

    if (!isAcceptorValid) {
      throw new Error('You are not authorized to accept this reconnection');
    }

    // Update conversation status to active
    const updated = await (this.prisma as any).savedConversation.update({
      where: { id: conversationId },
      data: {
        status: 'active',
        reconnectOffered: true,
      },
    });

    return updated;
  }

  async getReconnectionInfo(conversationId: string) {
    const conversation = await (this.prisma as any).savedConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return conversation;
  }
}