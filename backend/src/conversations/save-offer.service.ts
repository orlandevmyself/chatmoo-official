import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from './conversations.service';

@Injectable()
export class SaveOfferService {
  constructor(
    private prisma: PrismaService,
    private conversationsService: ConversationsService,
  ) {}

  async offerToSaveConversation(conversationData: {
    conversationId?: string;
    userId?: string;
    guestId?: string;
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
mediaPrice?: string;
      mediaUnlockKey?: string;
      mediaUnlockedAt?: Date | null;
      mediaPreviewUrl?: string | null;
    }>;
  }) {
    console.log('[SaveOfferService] Offering to save conversation');
    
    // Check if saving is allowed based on user types
    const isOffererAuth = !!conversationData.userId;
    const isPartnerAuth = !!conversationData.partnerUserId;
    
    // UNAUTH <-> UNAUTH: Can't save
    if (!isOffererAuth && !isPartnerAuth) {
      throw new Error('Guest users cannot save conversations');
    }
    
    // UNAUTH <-> AUTH: Auth user can save automatically without offering
    if (isOffererAuth && !isPartnerAuth) {
      console.log('[SaveOfferService] Auth to unauth - should auto-save via conversations endpoint');
      throw new Error('Use auto-save endpoint for auth to unauth conversations');
    }
    
    // AUTH <-> AUTH: Need mutual consent with offer
    return this.createSaveOffer(conversationData);
  }

  private async createSaveOffer(conversationData: {
    conversationId?: string;
    userId?: string;
    guestId?: string;
    partnerUserId?: string;
    partnerGuestId?: string;
    partnerUsername?: string;
    partnerInfo?: string;
    messages: Array<any>;
  }) {
    console.log('[SaveOfferService] Creating save offer (auth to auth)');
    
    // Create or get the saved conversation
    let conversation;
    if (conversationData.conversationId) {
      conversation = await (this.prisma as any).savedConversation.findUnique({
        where: { id: conversationData.conversationId },
      });
    }

    if (!conversation) {
      conversation = await (this.prisma as any).savedConversation.create({
        data: {
          userId: conversationData.userId,
          guestId: conversationData.guestId,
          title: `Chat with ${conversationData.partnerUsername || 'Anonymous'}`,
          partnerUsername: conversationData.partnerUsername,
          partnerInfo: conversationData.partnerInfo,
          partnerUserId: conversationData.partnerUserId,
          partnerGuestId: conversationData.partnerGuestId,
          messageCount: conversationData.messages.length,
          status: 'pending_reconnect',
          messages: {
            create: conversationData.messages.map(msg => ({
              senderId: msg.senderId,
              senderUsername: msg.senderUsername,
              content: msg.content,
              imageUrl: msg.imageUrl,
              type: msg.type || 'text',
              replyToId: msg.replyToId,
              mediaPrice: (msg as any).mediaPrice,
              mediaUnlockKey: (msg as any).mediaUnlockKey,
              mediaUnlockedAt: (msg as any).mediaUnlockedAt,
              mediaPreviewUrl: (msg as any).mediaPreviewUrl,
            })),
          },
        },
      });
    }

    // Create save offer
    const saveOffer = await (this.prisma as any).saveOffer.create({
      data: {
        conversationId: conversation.id,
        offeredByUserId: conversationData.userId,
        offeredByGuestId: conversationData.guestId,
        offeredToUserId: conversationData.partnerUserId,
        offeredToGuestId: conversationData.partnerGuestId,
        status: 'pending',
      },
    });

    console.log('[SaveOfferService] Save offer created:', saveOffer.id);
    return { conversation, saveOffer };
  }

  async respondToSaveOffer(offerId: string, response: 'accepted' | 'declined', userId?: string, guestId?: string) {
    console.log('[SaveOfferService] Responding to save offer:', offerId, response);
    
    const offer = await (this.prisma as any).saveOffer.findUnique({
      where: { id: offerId },
      include: { conversation: true },
    });

    if (!offer) {
      throw new Error('Save offer not found');
    }

    // Verify the responder is the intended recipient
    if (userId && offer.offeredToUserId !== userId) {
      throw new Error('You are not authorized to respond to this offer');
    }
    if (guestId && offer.offeredToGuestId !== guestId) {
      throw new Error('You are not authorized to respond to this offer');
    }

    // Update offer status
    const updatedOffer = await (this.prisma as any).saveOffer.update({
      where: { id: offerId },
      data: {
        status: response,
        respondedAt: new Date(),
      },
    });

    // If accepted, update conversation to allow reconnection
    if (response === 'accepted') {
      await (this.prisma as any).savedConversation.update({
        where: { id: offer.conversationId },
        data: {
          status: 'active',
          canReconnect: true,
          reconnectOffered: true,
        },
      });

      // Create a reverse save offer for the other user
      if (offer.offeredByUserId && !offer.offeredToUserId) {
        // Offer was from authenticated to guest, create offer for guest to authenticated
        await (this.prisma as any).saveOffer.create({
          data: {
            conversationId: offer.conversationId,
            offeredByUserId: offer.offeredToUserId,
            offeredToGuestId: offer.offeredToGuestId,
            status: 'accepted',
            respondedAt: new Date(),
          },
        });
      } else if (offer.offeredByGuestId && !offer.offeredToUserId) {
        // Offer was from guest to authenticated, create offer for authenticated to guest
        await (this.prisma as any).saveOffer.create({
          data: {
            conversationId: offer.conversationId,
            offeredByGuestId: offer.offeredByGuestId,
            offeredToUserId: offer.offeredToUserId,
            status: 'accepted',
            respondedAt: new Date(),
          },
        });
      }
    } else {
      // If declined, mark conversation as ended
      await (this.prisma as any).savedConversation.update({
        where: { id: offer.conversationId },
        data: {
          status: 'ended',
          canReconnect: false,
        },
      });
    }

    console.log('[SaveOfferService] Save offer response processed:', response);
    return updatedOffer;
  }

  async getPendingOffers(userId?: string, guestId?: string) {
    console.log('[SaveOfferService] Getting pending offers for user:', userId, guestId);
    
    const offers = await (this.prisma as any).saveOffer.findMany({
      where: {
        status: 'pending',
        OR: [
          userId ? { offeredToUserId: userId } : {},
          guestId ? { offeredToGuestId: guestId } : {},
        ],
      },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return offers;
  }

  async getReconnectableConversations(userId?: string, guestId?: string) {
    console.log('[SaveOfferService] Getting reconnectable conversations');
    
    const conversations = await (this.prisma as any).savedConversation.findMany({
      where: {
        status: 'active',
        canReconnect: true,
        OR: [
          userId ? { userId: userId } : {},
          userId ? { partnerUserId: userId } : {},
          guestId ? { guestId: guestId } : {},
        ],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        user: {
          select: { id: true, username: true, displayName: true, avatar: true, avatarSeed: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return this.conversationsService.attachLivePartnerUsers(conversations);
  }
}