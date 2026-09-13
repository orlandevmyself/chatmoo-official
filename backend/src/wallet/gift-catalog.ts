// Gift catalog — icons are temporary (emoji + lucide name) until real assets.
// Amounts are in coins; 1 coin = 100 minor units (PHP 1). Range 1 .. 20000 coins
// as requested.
export interface GiftItem {
  key: string;
  label: string;
  coins: number;
  amountMinor: number;
  emoji: string;
  lucide: string;
  color: string;
}

export const GIFT_CATALOG: Record<string, GiftItem> = {
  heart:    { key: 'heart',    label: 'Heart',    coins: 1,     amountMinor: 100,     emoji: '❤️', color: '#FF4D6A', lucide: 'Heart' },
  bottle:   { key: 'bottle',   label: 'Bottle',   coins: 5,     amountMinor: 500,     emoji: '🍼', color: '#38BDF8', lucide: 'Milk' },
  lollipop: { key: 'lollipop', label: 'Lollipop', coins: 10,    amountMinor: 1000,    emoji: '🍭', color: '#F472B6', lucide: 'Candy' },
  star:     { key: 'star',     label: 'Star',     coins: 50,    amountMinor: 5000,    emoji: '⭐', color: '#FACC15', lucide: 'Star' },
  diamond:  { key: 'diamond',  label: 'Diamond',  coins: 100,   amountMinor: 10000,   emoji: '💎', color: '#60A5FA', lucide: 'Gem' },
  crown:    { key: 'crown',    label: 'Crown',    coins: 500,   amountMinor: 50000,   emoji: '👑', color: '#F59E0B', lucide: 'Crown' },
  rocket:   { key: 'rocket',   label: 'Rocket',   coins: 1000,  amountMinor: 100000,  emoji: '🚀', color: '#A78BFA', lucide: 'Rocket' },
  trophy:   { key: 'trophy',   label: 'Trophy',   coins: 5000,  amountMinor: 500000,  emoji: '🏆', color: '#FBBF24', lucide: 'Trophy' },
  ring:     { key: 'ring',     label: 'Diamond Ring', coins: 10000, amountMinor: 1000000, emoji: '💍', color: '#E879F9', lucide: 'Gem' },
  mansion:  { key: 'mansion',  label: 'Mansion',  coins: 20000, amountMinor: 2000000, emoji: '🏰', color: '#C084FC', lucide: 'Home' },
};

export const GIFT_LIST: GiftItem[] = Object.values(GIFT_CATALOG);

export function getGift(key: string): GiftItem | undefined {
  return GIFT_CATALOG[key];
}

// A media price is a bundle of gift tiers with quantities, e.g.
// { items: [{ key: 'trophy', qty: 1 }, { key: 'bottle', qty: 1 }] }
// totals 5005 coins. The server always re-derives amounts from the catalog
// (the client-supplied totals are never trusted).
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

export function computeBundlePrice(rawItems: Array<{ key?: string; qty?: number }> | undefined): MediaBundle {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('A media price needs at least one gift item');
  }
  const items: MediaBundleItem[] = [];
  const seen = new Set<string>();
  let priceCoins = 0;
  let priceMinor = 0;
  for (const raw of rawItems) {
    const gift = getGift(raw?.key || '');
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
