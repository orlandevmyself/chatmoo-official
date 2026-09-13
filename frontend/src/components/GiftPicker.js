import React from 'react';
import { X, Wallet, Coins } from 'lucide-react';
import { cn } from '../lib/utils';
import { GIFT_LIST, formatCoins } from '../utils/giftCatalog';

const formatPHP = (minor) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((minor || 0) / 100);

function GiftPicker({ balanceMinor = 0, onSelect, onClose, sendingKey }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] md:max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy/10 bg-gradient-to-r from-coral to-softPurple">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <span className="text-lg">🎁</span> Send a Gift
            </h3>
            <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
              <Wallet className="w-3 h-3" /> Balance: {formatPHP(balanceMinor)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          <p className="text-xs text-navy/60 text-center">Only available for User ↔ User chats</p>
          <div className="grid grid-cols-4 gap-3">
            {GIFT_LIST.map((gift) => {
              const canAfford = balanceMinor >= gift.amountMinor;
              const isSending = sendingKey === gift.key;
              return (
                <button
                  key={gift.key}
                  onClick={() => canAfford && !sendingKey && onSelect(gift.key)}
                  disabled={!canAfford || !!sendingKey}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all relative",
                    canAfford
                      ? "border-navy/10 hover:border-coral hover:bg-coral/5 hover:shadow-md bg-white"
                      : "border-navy/10 bg-navy/5 opacity-60 cursor-not-allowed",
                    isSending && "border-coral bg-coral/10 animate-pulse"
                  )}
                >
                  <span className="text-2xl md:text-3xl" style={{ filter: canAfford ? 'none' : 'grayscale(0.5)' }}>
                    {gift.emoji}
                  </span>
                  <span className="text-xs font-semibold text-navy">{gift.label}</span>
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
                    canAfford ? "bg-amber-100 text-amber-700" : "bg-navy/10 text-navy/50"
                  )}>
                    <Coins className="w-3 h-3" /> {gift.coins}
                  </span>
                  {isSending && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
                      <span className="w-5 h-5 border-2 border-coral/30 border-t-coral rounded-full animate-spin" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-center text-navy/50">
            Gifts deduct from your wallet and credit your partner instantly.
          </p>
        </div>
      </div>
    </div>
  );
}

export default GiftPicker;
