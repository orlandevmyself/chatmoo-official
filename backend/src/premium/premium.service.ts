import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Premium tiers with costs in coins and durations
const PREMIUM_TIERS = {
  threeDays: {
    costCoins: 500, // ₱5
    durationDays: 3,
    label: '3 Days',
  },
  weekly: {
    costCoins: 1000, // ₱10
    durationDays: 7,
    label: '1 Week',
  },
  monthly: {
    costCoins: 5000, // ₱50
    durationDays: 30,
    label: '1 Month',
  },
  quarterly: {
    costCoins: 13500, // ₱135 (10% off monthly)
    durationDays: 90,
    label: '3 Months',
  },
  yearly: {
    costCoins: 50000, // ₱500 (17% off monthly)
    durationDays: 365,
    label: '1 Year',
  },
};

@Injectable()
export class PremiumService {
  private tiersCache: Map<string, any> = new Map();

  constructor(private prisma: PrismaService) {
    this.initializeTiers();
  }

  private async initializeTiers() {
    try {
      // Check if premiumTierConfig table exists
      const premiumTierConfigTable = (this.prisma as any).premiumTierConfig;
      if (!premiumTierConfigTable) {
        throw new Error('premiumTierConfig table not available - run prisma migrate');
      }

      const dbTiers = await premiumTierConfigTable.findMany();
      if (dbTiers.length > 0) {
        dbTiers.forEach((tier: any) => {
          this.tiersCache.set(tier.tier, {
            costCoins: tier.costCoins,
            durationDays: tier.durationDays,
            label: tier.label,
          });
        });
      } else {
        // Seed default tiers if none exist
        await this.seedDefaultTiers();
      }
    } catch (err: any) {
      console.error('[PremiumService] Error initializing tiers from DB:', err.message);
      console.warn('[PremiumService] Using hardcoded defaults. Run: npx prisma migrate dev');
      // Fall back to hardcoded defaults
      Object.entries(PREMIUM_TIERS).forEach(([key, value]) => {
        this.tiersCache.set(key, value);
      });
    }
  }

  private async seedDefaultTiers() {
    try {
      const premiumTierConfigTable = (this.prisma as any).premiumTierConfig;
      if (!premiumTierConfigTable) {
        console.warn('[PremiumService] Cannot seed tiers - table not available');
        return;
      }

      await Promise.all(
        Object.entries(PREMIUM_TIERS).map(([key, value]) =>
          premiumTierConfigTable.upsert({
            where: { tier: key },
            create: {
              tier: key,
              costCoins: value.costCoins,
              durationDays: value.durationDays,
              label: value.label,
            },
            update: {},
          }),
        ),
      );
      await this.initializeTiers();
    } catch (err: any) {
      console.error('[PremiumService] Error seeding default tiers:', err.message);
    }
  }

  async getPremiumTiers() {
    if (this.tiersCache.size === 0) {
      await this.initializeTiers();
    }

    return Array.from(this.tiersCache.entries()).map(([key, value]) => ({
      tier: key,
      costCoins: value.costCoins,
      costPHP: (value.costCoins / 100).toFixed(2),
      durationDays: value.durationDays,
      label: value.label,
    }));
  }

  async isPremium(userId: string): Promise<boolean> {
    const subscription = await (this.prisma as any).premiumSubscription.findUnique({
      where: { userId },
      select: { expiresAt: true },
    });

    if (!subscription) return false;
    return new Date() < subscription.expiresAt;
  }

  async getPremiumStatus(userId: string) {
    const subscription = await (this.prisma as any).premiumSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return { isPremium: false, tier: null, expiresAt: null };
    }

    const now = new Date();
    const isPremium = now < subscription.expiresAt;

    return {
      isPremium,
      tier: subscription.tier,
      expiresAt: subscription.expiresAt,
      daysRemaining: isPremium
        ? Math.ceil((subscription.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
    };
  }

  async purchasePremium(userId: string, tier: string) {
    if (this.tiersCache.size === 0) {
      await this.initializeTiers();
    }

    const tierConfig = this.tiersCache.get(tier);
    if (!tierConfig) {
      throw new BadRequestException(`Invalid premium tier: ${tier}`);
    }

    // Check user balance
    const wallet = await (this.prisma as any).wallet.findUnique({
      where: { userId },
      select: { balance: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.balance < tierConfig.costCoins) {
      throw new BadRequestException(
        `Insufficient coins. You need ${tierConfig.costCoins} coins, but have ${wallet.balance}`,
      );
    }

    // Calculate new expiry date
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tierConfig.durationDays * 24 * 60 * 60 * 1000);

    // Get existing subscription to extend or create new
    const existingSubscription = await (this.prisma as any).premiumSubscription.findUnique({
      where: { userId },
    });

    return await (this.prisma as any).$transaction(async (t: any) => {
      // Deduct coins from wallet
      await t.wallet.update({
        where: { userId },
        data: { balance: { decrement: tierConfig.costCoins } },
      });

      // Create wallet transaction for premium purchase
      await t.walletTransaction.create({
        data: {
          walletId: wallet.id || (await t.wallet.findUnique({ where: { userId } })).id,
          userId,
          type: 'premium_purchase',
          amount: tierConfig.costCoins,
          fee: 0,
          status: 'completed',
          provider: 'demo',
          method: 'coins',
          remarks: `Premium ${tier} subscription (${tierConfig.label})`,
        },
      });

      // Update or create subscription
      const subscription = await t.premiumSubscription.upsert({
        where: { userId },
        create: {
          userId,
          tier,
          costCoins: tierConfig.costCoins,
          expiresAt,
        },
        update: {
          tier,
          costCoins: tierConfig.costCoins,
          expiresAt,
        },
      });

      return {
        success: true,
        subscription: {
          tier: subscription.tier,
          expiresAt: subscription.expiresAt,
          costCoins: subscription.costCoins,
          costPHP: (subscription.costCoins / 100).toFixed(2),
        },
        newBalance: wallet.balance - tierConfig.costCoins,
      };
    });
  }

  async getAllPremiumUsers() {
    const now = new Date();
    return (this.prisma as any).premiumSubscription.findMany({
      where: {
        expiresAt: { gt: now },
      },
      select: { userId: true },
    });
  }

  async getPremiumStats() {
    const now = new Date();

    // Total subscriptions
    const totalSubscriptions = await (this.prisma as any).premiumSubscription.count();

    // Active subscriptions (not expired)
    const activeSubscriptions = await (this.prisma as any).premiumSubscription.count({
      where: { expiresAt: { gt: now } },
    });

    // Get all subscriptions for revenue calculation
    const allSubscriptions = await (this.prisma as any).premiumSubscription.findMany({
      select: { tier: true, costCoins: true },
    });

    // Calculate total revenue from all subscriptions
    const totalRevenueMinor = allSubscriptions.reduce((sum, sub) => {
      return sum + (sub.costCoins || 0);
    }, 0) * 100; // costCoins * 100 to convert to PHP minor units (assuming 100 coins = 1 PHP)

    // Calculate monthly recurring revenue (only active subscriptions in the next 30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const activeNextMonth = await (this.prisma as any).premiumSubscription.findMany({
      where: {
        expiresAt: { gt: now, lte: thirtyDaysFromNow },
      },
      select: { tier: true, costCoins: true },
    });

    const monthlyRecurringMinor = activeNextMonth.reduce((sum, sub) => {
      return sum + (sub.costCoins || 0);
    }, 0) * 100;

    // Tier breakdown
    const tierBreakdown = await Promise.all(
      Object.keys(PREMIUM_TIERS).map(async (tierKey) => {
        const totalByTier = await (this.prisma as any).premiumSubscription.count({
          where: { tier: tierKey },
        });

        const activeByTier = await (this.prisma as any).premiumSubscription.count({
          where: { tier: tierKey, expiresAt: { gt: now } },
        });

        const subscriptionsByTier = await (this.prisma as any).premiumSubscription.findMany({
          where: { tier: tierKey },
          select: { costCoins: true },
        });

        const revenueByTier = subscriptionsByTier.reduce((sum, sub) => {
          return sum + (sub.costCoins || 0);
        }, 0) * 100;

        return {
          tier: tierKey,
          totalUsers: totalByTier,
          activeUsers: activeByTier,
          revenueMinor: revenueByTier,
          percentOfTotal:
            totalSubscriptions > 0 ? (totalByTier / totalSubscriptions) * 100 : 0,
        };
      }),
    );

    return {
      totalSubscriptions,
      activeSubscriptions,
      totalRevenueMinor,
      monthlyRecurringMinor,
      tierBreakdown,
    };
  }

  async updateTierPricing(tierUpdates: Record<string, { costCoins?: number; costPHP?: number }>) {
    try {
      const validTiers = Object.keys(PREMIUM_TIERS);

      // Validate that all tier names are valid
      for (const tier of Object.keys(tierUpdates)) {
        if (!validTiers.includes(tier)) {
          throw new BadRequestException(`Invalid tier: ${tier}`);
        }
      }

      const premiumTierConfigTable = (this.prisma as any).premiumTierConfig;

      // If table doesn't exist yet, just update cache
      if (!premiumTierConfigTable) {
        console.warn('[PremiumService] premiumTierConfig table not available - updating cache only');
        for (const [tier, updates] of Object.entries(tierUpdates)) {
          if (updates.costCoins !== undefined) {
            const current = this.tiersCache.get(tier);
            this.tiersCache.set(tier, {
              ...current,
              costCoins: updates.costCoins,
            });
          }
        }
        return {
          success: true,
          message: 'Premium tier pricing updated (cache only). Run: npx prisma migrate dev to persist changes',
          appliedUpdates: tierUpdates,
        };
      }

      // Update each tier in the database
      for (const [tier, updates] of Object.entries(tierUpdates)) {
        if (updates.costCoins !== undefined) {
          await premiumTierConfigTable.update({
            where: { tier },
            data: {
              costCoins: updates.costCoins,
            },
          });

          // Update cache
          const current = this.tiersCache.get(tier);
          this.tiersCache.set(tier, {
            ...current,
            costCoins: updates.costCoins,
          });
        }
      }

      return {
        success: true,
        message: 'Premium tier pricing updated successfully',
        appliedUpdates: tierUpdates,
      };
    } catch (err: any) {
      console.error('[PremiumService] Error updating tier pricing:', err);
      throw new BadRequestException(`Failed to update tier pricing: ${err.message || 'Unknown error'}`);
    }
  }
}
