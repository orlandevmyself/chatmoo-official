// Gift catalog — icons are temporary (emoji + lucide name) until real assets.
// Amounts are in coins; 1 coin = 100 minor units (PHP 1). Range 1 .. 5000 coins
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
  heart:    { key: 'heart',    label: 'Heart',    coins: 1,    amountMinor: 100,    emoji: '❤️', color: '#FF4D6A', lucide: 'Heart' },
  bottle:   { key: 'bottle',   label: 'Bottle',   coins: 5,    amountMinor: 500,    emoji: '🍼', color: '#38BDF8', lucide: 'Milk' },
  lollipop: { key: 'lollipop', label: 'Lollipop', coins: 10,   amountMinor: 1000,   emoji: '🍭', color: '#F472B6', lucide: 'Candy' },
  star:     { key: 'star',     label: 'Star',     coins: 50,   amountMinor: 5000,   emoji: '⭐', color: '#FACC15', lucide: 'Star' },
  diamond:  { key: 'diamond',  label: 'Diamond',  coins: 100,  amountMinor: 10000,  emoji: '💎', color: '#60A5FA', lucide: 'Gem' },
  crown:    { key: 'crown',    label: 'Crown',    coins: 500,  amountMinor: 50000,  emoji: '👑', color: '#F59E0B', lucide: 'Crown' },
  rocket:   { key: 'rocket',   label: 'Rocket',   coins: 1000, amountMinor: 100000, emoji: '🚀', color: '#A78BFA', lucide: 'Rocket' },
  trophy:   { key: 'trophy',   label: 'Trophy',   coins: 5000, amountMinor: 500000, emoji: '🏆', color: '#FBBF24', lucide: 'Trophy' },
};

export const GIFT_LIST: GiftItem[] = Object.values(GIFT_CATALOG);

export function getGift(key: string): GiftItem | undefined {
  return GIFT_CATALOG[key];
}
