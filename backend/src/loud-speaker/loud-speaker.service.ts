import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

// Base price per 30 minutes per scope (in centavos)
const LOUD_SPEAKER_BASE_PRICES: Record<string, number> = {
  homepage: 1000, // ₱10 per 30 min
  chat: 1000,
  conversations: 1000,
  sitewide: 2000, // ₱20 per 30 min
};

@Injectable()
export class LoudSpeakerService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
  ) {}

  onModuleInit() {
    // Update campaign statuses every 10 seconds
    setInterval(() => this.updateCampaignStatus(), 10000);
  }

  async createCampaign(userId: string, data: {
    message: string;
    scope: string;
    durationMinutes: number;
    bannerStyle?: string;
    buttonLabel?: string;
    buttonLink?: string;
    animation?: string;
  }) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!data.message || data.message.trim().length === 0) {
      throw new BadRequestException('Message is required');
    }
    if (data.message.length > 500) {
      throw new BadRequestException('Message too long (max 500 characters)');
    }
    if (!data.scope || !Object.keys(LOUD_SPEAKER_BASE_PRICES).includes(data.scope)) {
      throw new BadRequestException(`Invalid scope. Allowed: ${Object.keys(LOUD_SPEAKER_BASE_PRICES).join(', ')}`);
    }
    if (!Number.isInteger(data.durationMinutes) || data.durationMinutes < 30 || data.durationMinutes > 480) {
      throw new BadRequestException('Duration must be between 30 and 480 minutes');
    }

    // Calculate price: base price * (duration / 30 minutes)
    const basePrice = LOUD_SPEAKER_BASE_PRICES[data.scope];
    const priceMinor = Math.ceil(basePrice * (data.durationMinutes / 30));
    const balanceInfo = await this.walletService.getBalance(userId);

    if (balanceInfo.balance < priceMinor) {
      throw new BadRequestException(
        `Insufficient balance. Required: ₱${(priceMinor / 100).toFixed(2)}, Available: ₱${(balanceInfo.balance / 100).toFixed(2)}`
      );
    }

    // Create campaign and deduct from wallet in transaction
    try {
      const campaign = await (this.prisma as any).$transaction(async (t: any) => {
        // Deduct from wallet
        const wallet = await t.wallet.findUnique({ where: { userId } });
        if (!wallet || wallet.balance < priceMinor) {
          throw new BadRequestException('Insufficient balance');
        }

        await t.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: priceMinor } },
        });

        // Create transaction record
        await t.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            type: 'loud_speaker',
            amount: priceMinor,
            fee: 0,
            status: 'completed',
            provider: 'demo',
            method: 'loud_speaker',
            remarks: `Loud Speaker - ${data.scope}`,
          },
        });

        // Create campaign
        const now = new Date();
        const startAt = now;
        const endAt = new Date(now.getTime() + data.durationMinutes * 60 * 1000);

        // Calculate scheduled show time based on campaigns that overlap with this campaign's duration
        const overlappingCampaigns = await t.loudSpeakerCampaign.count({
          where: {
            scope: data.scope,
            status: { in: ['scheduled', 'active'] },
            startAt: { lte: endAt }, // Campaign starts before this one ends
            endAt: { gte: startAt }, // Campaign ends after this one starts
          },
        });

        // Each campaign shows for 5 seconds in rotation
        const queuePosition = overlappingCampaigns;
        const secondsToWait = queuePosition * 5;
        const scheduledShowAt = new Date(now.getTime() + secondsToWait * 1000);

        return t.loudSpeakerCampaign.create({
          data: {
            userId,
            message: data.message,
            scope: data.scope,
            placement: 'shared',
            priceMinor,
            status: 'scheduled',
            bannerStyle: data.bannerStyle || 'gradient-coral',
            buttonLabel: data.buttonLabel || 'Visit',
            buttonLink: data.buttonLink || 'https://',
            animation: data.animation || 'none',
            startAt,
            endAt,
            scheduledShowAt,
          },
        });
      });

      return this.formatCampaign(campaign);
    } catch (e: any) {
      throw e;
    }
  }

  async getActiveCampaigns(scope?: string) {
    const now = new Date();
    const where: any = {
      status: { in: ['scheduled', 'active'] },
      startAt: { lte: now },
      endAt: { gte: now },
    };

    if (scope) {
      where.scope = scope;
    }

    const campaigns = await (this.prisma as any).loudSpeakerCampaign.findMany({
      where,
      include: { user: { select: { id: true, name: true, username: true, avatar: true, avatarSeed: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c: any) => this.formatCampaign(c));
  }

  async getUserCampaigns(userId: string) {
    const campaigns = await (this.prisma as any).loudSpeakerCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c: any) => this.formatCampaign(c));
  }

  async recordImpression(campaignId: string) {
    try {
      await (this.prisma as any).loudSpeakerCampaign.update({
        where: { id: campaignId },
        data: { impressions: { increment: 1 } },
      });
    } catch (e) {
      // Silently fail if campaign doesn't exist
    }
  }

  async recordClick(campaignId: string) {
    try {
      await (this.prisma as any).loudSpeakerCampaign.update({
        where: { id: campaignId },
        data: { clicks: { increment: 1 } },
      });
    } catch (e) {
      // Silently fail if campaign doesn't exist
    }
  }

  async getPublicConfig() {
    // Get admin-configured parameters for public display
    const configs = await (this.prisma as any).appConfig.findMany({
      where: {
        key: { startsWith: 'loud_speaker_' },
      },
    });

    const config: any = {
      enabled: true,
      basePrices: {
        homepage: 1000,
        chat: 1000,
        conversations: 1000,
        sitewide: 9900,
      },
      limits: {
        minDurationMinutes: 30,
        maxDurationMinutes: 480,
        maxMessageLength: 500,
      },
    };

    // Override with database values if they exist
    configs.forEach((c: any) => {
      const key = c.key.replace('loud_speaker_', '');
      const value = JSON.parse(c.value);
      if (key === 'enabled') config.enabled = value;
      if (key.startsWith('baseprice_')) {
        const scope = key.replace('baseprice_', '');
        config.prices[scope] = value;
      }
      if (key.startsWith('limit_')) {
        const limitKey = key.replace('limit_', '');
        config.limits[limitKey] = value;
      }
    });

    return config;
  }

  async updateCampaignStatus() {
    try {
      const now = new Date();

      // Mark as active if time has come
      await (this.prisma as any).loudSpeakerCampaign.updateMany({
        where: {
          status: 'scheduled',
          startAt: { lte: now },
        },
        data: { status: 'active' },
      });

      // Mark as completed if time has passed
      await (this.prisma as any).loudSpeakerCampaign.updateMany({
        where: {
          status: { in: ['scheduled', 'active'] },
          endAt: { lte: now },
        },
        data: { status: 'completed' },
      });
    } catch (error: any) {
      // Gracefully handle database connection errors
      if (error.code === 'P1001' || error.message?.includes('database server')) {
        console.warn('[LoudSpeaker] Database unavailable - skipping campaign status update');
      } else {
        console.error('[LoudSpeaker] Error updating campaign status:', error.message);
      }
      // Don't rethrow - let the service continue running
    }
  }

  async cancelCampaign(userId: string, campaignId: string) {
    const campaign = await (this.prisma as any).loudSpeakerCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) throw new BadRequestException('Campaign not found');
    if (campaign.userId !== userId) throw new BadRequestException('Not authorized');
    if (campaign.status !== 'scheduled') {
      throw new BadRequestException('Can only cancel scheduled campaigns');
    }

    // Refund the user
    await (this.prisma as any).$transaction(async (t: any) => {
      const wallet = await t.wallet.findUnique({ where: { userId } });
      await t.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: campaign.priceMinor } },
      });

      await t.loudSpeakerCampaign.update({
        where: { id: campaignId },
        data: { status: 'cancelled' },
      });

      await t.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'loud_speaker_refund',
          amount: campaign.priceMinor,
          fee: 0,
          status: 'completed',
          provider: 'demo',
          method: 'refund',
          remarks: `Loud Speaker refund - ${campaign.scope}`,
        },
      });
    });

    return { success: true, message: 'Campaign cancelled and refunded' };
  }

  private formatCampaign(campaign: any) {
    return {
      id: campaign.id,
      userId: campaign.userId,
      user: campaign.user,
      message: campaign.message,
      scope: campaign.scope,
      placement: campaign.placement,
      priceMinor: campaign.priceMinor,
      price: `₱${(campaign.priceMinor / 100).toFixed(2)}`,
      status: campaign.status,
      bannerStyle: campaign.bannerStyle || 'gradient-coral',
      buttonLabel: campaign.buttonLabel || 'Visit',
      buttonLink: campaign.buttonLink || 'https://',
      animation: campaign.animation || 'none',
      scheduledShowAt: campaign.scheduledShowAt,
      startAt: campaign.startAt,
      endAt: campaign.endAt,
      impressions: campaign.impressions || 0,
      clicks: campaign.clicks || 0,
      createdAt: campaign.createdAt,
    };
  }
}
