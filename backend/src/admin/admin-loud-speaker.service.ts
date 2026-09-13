import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminLoudSpeakerService {
  constructor(private prisma: PrismaService) {}

  async getStats(adminUserId: string) {
    // Get all campaigns stats
    const [
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      totalImpressions,
      totalClicks,
      totalRevenue,
      campaignsByScope,
    ] = await Promise.all([
      (this.prisma as any).loudSpeakerCampaign.count(),
      (this.prisma as any).loudSpeakerCampaign.count({
        where: { status: 'active' },
      }),
      (this.prisma as any).loudSpeakerCampaign.count({
        where: { status: 'completed' },
      }),
      (this.prisma as any).loudSpeakerCampaign.aggregate({
        _sum: { impressions: true },
      }),
      (this.prisma as any).loudSpeakerCampaign.aggregate({
        _sum: { clicks: true },
      }),
      (this.prisma as any).loudSpeakerCampaign.aggregate({
        _sum: { priceMinor: true },
      }),
      (this.prisma as any).loudSpeakerCampaign.groupBy({
        by: ['scope'],
        _count: true,
        _sum: { priceMinor: true },
      }),
    ]);

    const ctr = totalImpressions._sum?.impressions > 0
      ? ((totalClicks._sum?.clicks || 0) / (totalImpressions._sum?.impressions || 1) * 100).toFixed(2)
      : '0.00';

    const scopeStats = campaignsByScope.reduce((acc, item) => {
      acc[item.scope] = {
        count: item._count,
        revenue: item._sum?.priceMinor || 0,
      };
      return acc;
    }, {});

    return {
      campaigns: {
        total: totalCampaigns,
        active: activeCampaigns,
        completed: completedCampaigns,
      },
      engagement: {
        totalImpressions: totalImpressions._sum?.impressions || 0,
        totalClicks: totalClicks._sum?.clicks || 0,
        ctr: parseFloat(ctr),
      },
      revenue: {
        totalMinor: totalRevenue._sum?.priceMinor || 0,
        totalPHP: (totalRevenue._sum?.priceMinor || 0) / 100,
      },
      byScope: scopeStats,
    };
  }

  async listCampaigns(adminUserId: string, query: {
    status?: string;
    scope?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.scope) where.scope = query.scope;

    const [total, campaigns] = await Promise.all([
      (this.prisma as any).loudSpeakerCampaign.count({ where }),
      (this.prisma as any).loudSpeakerCampaign.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      items: campaigns.map((c: any) => ({
        id: c.id,
        userId: c.userId,
        user: c.user,
        message: c.message,
        scope: c.scope,
        placement: c.placement,
        price: c.priceMinor / 100,
        priceMinor: c.priceMinor,
        status: c.status,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00',
        startAt: c.startAt,
        endAt: c.endAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  }

  async getConfig(adminUserId: string) {
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
        sitewide: 2000,
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
        config.basePrices[scope] = value;
      }
      if (key.startsWith('limit_')) {
        const limitKey = key.replace('limit_', '');
        config.limits[limitKey] = value;
      }
    });

    return config;
  }

  async updateConfig(adminUserId: string, updates: any) {
    const configUpdates = [];

    if (updates.enabled !== undefined) {
      configUpdates.push({
        key: 'loud_speaker_enabled',
        value: JSON.stringify(updates.enabled),
      });
    }

    if (updates.basePrices) {
      Object.entries(updates.basePrices).forEach(([scope, price]) => {
        configUpdates.push({
          key: `loud_speaker_baseprice_${scope}`,
          value: JSON.stringify(price),
        });
      });
    }

    if (updates.limits) {
      Object.entries(updates.limits).forEach(([limitKey, value]) => {
        configUpdates.push({
          key: `loud_speaker_limit_${limitKey}`,
          value: JSON.stringify(value),
        });
      });
    }

    // Save all config updates
    for (const update of configUpdates) {
      await (this.prisma as any).appConfig.upsert({
        where: { key: update.key },
        create: { key: update.key, value: update.value },
        update: { value: update.value },
      });
    }

    return this.getConfig(adminUserId);
  }

  async getCampaignDetails(adminUserId: string, campaignId: string) {
    return (this.prisma as any).loudSpeakerCampaign.findUnique({
      where: { id: campaignId },
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
      },
    });
  }

  async cancelCampaign(adminUserId: string, campaignId: string, reason: string) {
    const campaign = await (this.prisma as any).loudSpeakerCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) throw new Error('Campaign not found');

    // Update campaign status
    await (this.prisma as any).loudSpeakerCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'cancelled',
      },
    });

    // Refund the user if campaign was not completed
    if (campaign.status !== 'completed') {
      const wallet = await (this.prisma as any).wallet.findUnique({
        where: { userId: campaign.userId },
      });

      if (wallet) {
        await (this.prisma as any).$transaction([
          (this.prisma as any).wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: campaign.priceMinor } },
          }),
          (this.prisma as any).walletTransaction.create({
            data: {
              walletId: wallet.id,
              userId: campaign.userId,
              type: 'loud_speaker_refund',
              amount: campaign.priceMinor,
              fee: 0,
              status: 'completed',
              provider: 'demo',
              method: 'refund',
              remarks: `Admin refund - Loud Speaker cancelled: ${reason}`,
            },
          }),
        ]);
      }
    }

    return { success: true, message: 'Campaign cancelled and refunded' };
  }
}
