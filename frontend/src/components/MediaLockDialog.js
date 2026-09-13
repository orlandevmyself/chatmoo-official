import { useState } from 'react';
import { X, Minus, Plus, Lock, Coins, Image as ImageIcon, Video, LockOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { GIFT_LIST, formatCoins } from '../utils/giftCatalog';
import { cn } from '../lib/utils';

function MediaLockDialog({ mediaType, onChoose, onClose }) {
  const [qty, setQty] = useState(() => Object.fromEntries(GIFT_LIST.map((g) => [g.key, g.qty ?? 0])));

  const totItems = GIFT_LIST.filter((g) => (qty[g.key] || 0) > 0);
  const totalCoins = totItems.reduce((sum, g) => sum + g.coins * (qty[g.key] || 0), 0);
  const isVideo = mediaType === 'video';

  const updateQty = (key, delta) => {
    setQty((prev) => {
      const next = Math.min(100, Math.max(0, (prev[key] || 0) + delta));
      return { ...prev, [key]: next };
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <CardHeader className="relative pb-2">
          <CardTitle className="text-xl font-bold text-navy flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            {isVideo ? 'Video' : 'Photo'} unlock price
          </CardTitle>
          <p className="text-sm text-navy/60 mt-1">
            Set a price in coins — your partner pays with their wallet before seeing it.
          </p>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-navy/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-navy/50" />
          </button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pb-4 px-4">
          <p className="text-xs uppercase tracking-wide text-navy/50 font-semibold mb-2">Gifts that unlock it</p>
          <div className="space-y-2">
            {GIFT_LIST.map((gift) => {
              const count = qty[gift.key] || 0;
              const active = count > 0;
              return (
                <div
                  key={gift.key}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl border transition-colors",
                    active ? "border-amber-400 bg-amber-50" : "border-navy/10 bg-white"
                  )}
                >
                  <span className="text-2xl" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}>
                    {gift.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-navy leading-tight">{gift.label}</p>
                    <p className="flex items-center gap-1 text-[11px] text-navy/50">
                      <Coins className="w-3 h-3 text-amber-500" /> {formatCoins(gift.coins)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(gift.key, -1)}
                      className={cn(
                        "w-7 h-7 rounded-lg border flex items-center justify-center transition-colors",
                        count > 0 ? "border-amber-400 text-amber-600 hover:bg-amber-100" : "border-navy/10 text-navy/30"
                      )}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className={cn("w-8 text-center font-bold text-sm", active ? "text-navy" : "text-navy/30")}>
                      {count}
                    </span>
                    <button
                      onClick={() => updateQty(gift.key, 1)}
                      className="w-7 h-7 rounded-lg border border-amber-400 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
        <div className="p-4 border-t border-navy/10 bg-navy/[0.02] rounded-b-2xl">
          {totalCoins > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-navy/70 font-medium">Total</span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-navy">
                {totItems.map((g) => (
                  <span key={g.key} className="inline-flex items-center gap-0.5 bg-white border border-navy/10 rounded-full px-2 py-0.5 text-[11px] font-medium">
                    <span>{g.emoji}</span> {qty[g.key]}x
                  </span>
                ))}
                <span className="ml-1 bg-amber-400 text-white rounded-full px-2.5 py-1 text-xs font-bold">
                  {totalCoins} coins
                </span>
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onChoose({ mode: 'free' })}
              className="flex-1 border-navy/20 text-navy hover:bg-navy/5"
            >
              <LockOpen className="w-4 h-4 mr-1" /> Send free
            </Button>
            <Button
              onClick={() => onChoose({ mode: 'locked', items: totItems.map((g) => ({ key: g.key, qty: qty[g.key] })) })}
              disabled={totalCoins <= 0}
              className="flex-1 bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90"
            >
              <Lock className="w-4 h-4 mr-1" /> Lock for {totalCoins > 0 ? `${totalCoins} coins` : 'a price'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default MediaLockDialog;