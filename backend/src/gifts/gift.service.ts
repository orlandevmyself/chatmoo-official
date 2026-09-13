import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GIFT_LIST, GIFT_CATALOG } from '../wallet/gift-catalog';

export interface GiftItem {
  key: string;
  label: string;
  coins: number;
  amountMinor: number;
  emoji: string;
  lucide: string;
  color: string;
  enabled: boolean;
  rank: number;
}

export interface MediaBundleItem {
  key: string;
  qty: number;
  label: string;
  coins: number;
  amountMinor: number;
  emoji: string;
}

export interface MediaBundle {
  items: MediaBundleItem[];
  priceCoins: number;
  priceMinor: number;
}

// Gift catalog with an admin-managed DB source (seeded from gift-catalog.ts on
// first boot) and a hardcoded fallback so chat/gift flows keep working even if
// the database is temporarily unreachable.
@Injectable()
export class GiftService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedIfEmpty().catch((e) =>
      console.warn('[GiftService] Seed skipped (DB unavailable):', e?.message),
    );
  }

  async seedIfEmpty() {
    const count = await (this.prisma as any).gift.count();
    if (count > 0) return;
    const rows = GIFT_LIST.map((g, i) => ({
      key: g.key,
      label: g.label,
      coins: g.coins,
      amountMinor: g.amountMinor,
      emoji: g.emoji,
      lucide: g.lucide,
      color: g.color,
      enabled: true,
      rank: i,
    }));
    await (this.prisma as any).gift.createMany({ data: rows });
    console.log(`[GiftService] Seeded ${rows.length} gifts`);
  }

  private toGift(g: any): GiftItem {
    return {
      key: g.key,
      label: g.label,
      coins: g.coins,
      amountMinor: g.amountMinor,
      emoji: g.emoji,
      lucide: g.lucide || '',
      color: g.color,
      enabled: g.enabled,
      rank: g.rank,
    };
  }

  private static hardcoded(key: string) {
    const g = GIFT_CATALOG[key];
    if (!g) return undefined;
    return { ...g, enabled: true, rank: GIFT_LIST.indexOf(g) };
  }

  async getGift(key: string): Promise<GiftItem | undefined> {
    if (!key) return undefined;
    try {
      const found = await (this.prisma as any).gift.findUnique({ where: { key } });
      return found ? this.toGift(found) : GiftService.hardcoded(key);
    } catch {
      return GiftService.hardcoded(key);
    }
  }

  // Public catalog (used for pricing/gifting) — enabled gifts only.
  async getCatalog(): Promise<GiftItem[]> {
    try {
      const rows = await (this.prisma as any).gift.findMany({
        where: { enabled: true },
        orderBy: { rank: 'asc' },
      });
      if (rows.length > 0) return rows.map((g: any) => this.toGift(g));
      return GIFT_LIST.map((g, i) => ({ ...g, enabled: true, rank: i }));
    } catch {
      return GIFT_LIST.map((g, i) => ({ ...g, enabled: true, rank: i }));
    }
  }

  // Admin catalog — every known gift (DB rows + any hardcoded entry missing
  // from the DB), including disabled ones.
  async listForAdmin(): Promise<GiftItem[]> {
    let rows: any[] = [];
    try {
      rows = await (this.prisma as any).gift.findMany({ orderBy: { rank: 'asc' } });
    } catch {
      rows = [];
    }
    const seen = new Set(rows.map((r) => r.key));
    for (const g of GIFT_LIST) {
      if (!seen.has(g.key)) {
        rows.push({ ...g, enabled: true, rank: GIFT_LIST.indexOf(g) });
      }
    }
    return rows.map((g) => this.toGift(g)).sort((a, b) => a.rank - b.rank);
  }

  validateGiftData(data: {
    key?: string;
    label?: string;
    coins?: number;
    amountMinor?: number;
    emoji?: string;
    color?: string;
    enabled?: boolean;
    rank?: number;
  }) {
    if (data.key !== undefined) {
      if (typeof data.key !== 'string' || !/^[a-z][a-z0-9_]{1,31}$/.test(data.key)) {
        throw new BadRequestException('Gift key must be 2-32 lowercase letters, digits, underscores');
      }
    }
    if (data.label !== undefined && (typeof data.label !== 'string' || !data.label.trim())) {
      throw new BadRequestException('Gift label is required');
    }
    if (data.coins !== undefined && (!Number.isInteger(data.coins) || data.coins < 1 || data.coins > 100000)) {
      throw new BadRequestException('Gift coins must be an integer between 1 and 100000');
    }
    if (data.amountMinor !== undefined && (!Number.isInteger(data.amountMinor) || data.amountMinor < 1 || data.amountMinor > 10000000)) {
      throw new BadRequestException('Gift amount must be an integer between 1 and 10000000 minor units');
    }
  }

  async upsert(key: string, patch: {
    label?: string;
    coins?: number;
    amountMinor?: number;
    emoji?: string;
    lucide?: string;
    color?: string;
    enabled?: boolean;
    rank?: number;
  }): Promise<GiftItem> {
    const clean: any = {};
    if (patch.label !== undefined) clean.label = String(patch.label).trim();
    if (patch.coins !== undefined) clean.coins = Number(patch.coins);
    if (patch.amountMinor !== undefined) clean.amountMinor = Number(patch.amountMinor);
    if (patch.emoji !== undefined) clean.emoji = String(patch.emoji).slice(0, 8);
    if (patch.lucide !== undefined) clean.lucide = String(patch.lucide).slice(0, 32);
    if (patch.color !== undefined) clean.color = String(patch.color).slice(0, 16);
    if (patch.enabled !== undefined) clean.enabled = !!patch.enabled;
    if (patch.rank !== undefined) clean.rank = Number(patch.rank) || 0;

    const existing = await (this.prisma as any).gift.findUnique({ where: { key } });
    if (!existing) {
      this.validateGiftData({ key, ...clean });
      const fallback = GiftService.hardcoded(key);
      const row = await (this.prisma as any).gift.create({
        data: {
          key,
          label: clean.label ?? fallback?.label ?? key,
          coins: clean.coins ?? fallback?.coins ?? 1,
          amountMinor: clean.amountMinor ?? fallback?.amountMinor ?? 100,
          emoji: clean.emoji ?? fallback?.emoji ?? '🎁',
          lucide: clean.lucide ?? fallback?.lucide ?? '',
          color: clean.color ?? fallback?.color ?? '#FF6B4A',
          enabled: clean.enabled ?? true,
          rank: clean.rank ?? fallback?.rank ?? 0,
        },
      });
      return this.toGift(row);
    }

    const row = await (this.prisma as any).gift.update({ where: { key }, data: clean });
    return this.toGift(row);
  }

  async setEnabled(key: string, enabled: boolean) {
    const row = await (this.prisma as any).gift.update({ where: { key }, data: { enabled: !!enabled } });
    return this.toGift(row);
  }

  async computeBundlePrice(
    rawItems: Array<{ key?: string; qty?: number }> | undefined,
  ): Promise<MediaBundle> {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new Error('A media price needs at least one gift item');
    }
    const items: MediaBundleItem[] = [];
    const seen = new Set<string>();
    let priceCoins = 0;
    let priceMinor = 0;
    for (const raw of rawItems) {
      const gift = await this.getGift(raw?.key || '');
      const qty = Math.floor(Number(raw?.qty) || 0);
      if (!gift || qty <= 0) {
        throw new Error(`Unknown or invalid gift item: ${raw?.key}`);
      }
      if (qty > 100) {
        throw new Error('Quantity per gift capped at 100');
      }
      if (seen.has(gift.key)) {
        throw new Error(`Duplicate gift item: ${gift.key}`);
      }
      seen.add(gift.key);
      items.push({
        key: gift.key,
        qty,
        label: gift.label,
        coins: gift.coins,
        amountMinor: gift.amountMinor,
        emoji: gift.emoji,
      });
      priceCoins += gift.coins * qty;
      priceMinor += gift.amountMinor * qty;
    }
    if (priceMinor <= 0) {
      throw new Error('Media price must be greater than zero');
    }
    return { items, priceCoins, priceMinor };
  }
}