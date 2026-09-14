import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { X, Zap, Check, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_API_URL || 'https://chatmoo-official.onrender.com';

const BENEFITS = [
  { icon: '🌍', label: 'Filter by Country' },
  { icon: '🎓', label: 'Filter by University' },
  { icon: '👥', label: 'Filter by Gender' },
  { icon: '⚡', label: 'Priority in Matching Queue' },
  { icon: '⏱️', label: 'Faster Connections' },
];

function PremiumPurchase({ googleUser, currentBalance, onClose, onSuccess }) {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState(null);

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      const res = await axios.get(`${API_URL}/premium/tiers`);
      setTiers(res.data);
    } catch (err) {
      setError('Failed to load premium tiers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (tier) => {
    setPurchasing(tier);
    setError('');

    try {
      const res = await axios.post(`${API_URL}/premium/purchase?userId=${googleUser.id}`, {
        tier,
      });

      onSuccess?.(res.data);
      onClose?.();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to purchase premium';
      setError(message);
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative p-6 bg-gradient-to-r from-coral to-softPurple text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Unlock Premium</h2>
          </div>
          <p className="text-white/90">Get advanced filters and priority matching</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Benefits */}
          <div className="mb-8">
            <h3 className="font-semibold text-navy mb-4">Premium Benefits</h3>
            <div className="grid grid-cols-2 gap-3">
              {BENEFITS.map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <span className="text-xl">{benefit.icon}</span>
                  <span className="text-sm font-medium text-navy">{benefit.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Balance Warning */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 mb-1">Error</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Current Balance */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900 mb-1">Your Coin Balance</p>
            <p className="text-2xl font-bold text-blue-700">
              {(currentBalance / 100).toFixed(2)} ₱
            </p>
          </div>

          {/* Tiers */}
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-coral rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="grid gap-4">
              {tiers.map((tier) => {
                const affordable = currentBalance >= tier.costCoins;
                return (
                  <div
                    key={tier.tier}
                    className={cn(
                      'p-5 rounded-xl border-2 transition',
                      affordable
                        ? 'border-coral bg-coral/5 hover:bg-coral/10'
                        : 'border-gray-200 bg-gray-50 opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-bold text-navy text-lg">{tier.label}</p>
                        <p className="text-sm text-gray-600">
                          {tier.durationDays} days of premium access
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 p-3 bg-coral/10 rounded-lg border border-coral/20">
                      <p className="text-xs font-semibold text-coral uppercase mb-1">Cost in Coins</p>
                      <p className="text-2xl font-bold text-coral">{tier.costCoins.toLocaleString()} 💰</p>
                    </div>

                    <Button
                      onClick={() => handlePurchase(tier.tier)}
                      disabled={!affordable || purchasing !== null}
                      className={cn(
                        'w-full',
                        affordable
                          ? 'bg-coral hover:bg-coral/90 text-white'
                          : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      )}
                    >
                      {purchasing === tier.tier ? (
                        'Processing...'
                      ) : !affordable ? (
                        'Insufficient Coins'
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Purchase Now
                        </>
                      )}
                    </Button>

                    {!affordable && (
                      <p className="text-xs text-red-600 mt-2">
                        Need {(tier.costCoins - currentBalance).toLocaleString()} more coins
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-2">
            <p>✓ Auto-renew disabled - manage your subscription anytime</p>
            <p>✓ Premium filters apply immediately when you search</p>
            <p>✓ Priority matching for faster connections</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default PremiumPurchase;
