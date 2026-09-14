import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Zap, TrendingUp } from 'lucide-react';

const API_URL = process.env.REACT_APP_ADMIN_API_URL || 'https://chatmoo-official.onrender.com';

function PremiumManagement({ adminUserId }) {
  const [tiers, setTiers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [changes, setChanges] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const [tiersRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/premium/tiers`),
          fetch(`${API_URL}/premium/stats?adminUserId=${adminUserId}`),
        ]);

        if (!tiersRes.ok || !statsRes.ok) {
          throw new Error('Failed to load premium data');
        }

        const tiersData = await tiersRes.json();
        const statsData = await statsRes.json();

        setTiers(tiersData);
        setStats(statsData);
        setChanges({});
      } catch (err) {
        setError(err.message || 'Failed to load premium data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [adminUserId]);

  const handleChange = (tier, field, value) => {
    setChanges({
      ...changes,
      [tier]: { ...changes[tier], [field]: parseInt(value, 10) },
    });
  };

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) {
      setError('No changes to save');
      return;
    }

    try {
      setError('');
      setSuccess('');
      const res = await fetch(`${API_URL}/premium/update-tiers?adminUserId=${adminUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });

      if (!res.ok) {
        throw new Error('Failed to update tiers');
      }

      setSuccess('Premium tiers updated successfully');
      setChanges({});
      // Refetch data
      const tiersRes = await fetch(`${API_URL}/premium/tiers`);
      if (tiersRes.ok) {
        const tiersData = await tiersRes.json();
        setTiers(tiersData);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update tiers');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  const formatPHP = (minor) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((minor || 0) / 100);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-3">
        <Zap className="w-8 h-8 text-coral" />
        <div>
          <h1 className="text-4xl font-bold text-navy">Premium Management</h1>
          <p className="text-gray-600 mt-2">Configure pricing tiers and view subscription stats</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-coral">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Subscriptions</p>
                <p className="text-3xl font-bold text-navy mt-2">{stats.totalSubscriptions || 0}</p>
              </div>
              <Zap className="w-8 h-8 text-coral opacity-30" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-softPurple">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Subscriptions</p>
                <p className="text-3xl font-bold text-navy mt-2">{stats.activeSubscriptions || 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-softPurple opacity-30" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Revenue</p>
                <p className="text-3xl font-bold text-navy mt-2">{formatPHP(stats.totalRevenueMinor || 0)}</p>
              </div>
              <span className="text-2xl opacity-30">💰</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Monthly Recurring</p>
                <p className="text-3xl font-bold text-navy mt-2">{formatPHP(stats.monthlyRecurringMinor || 0)}</p>
              </div>
              <span className="text-2xl opacity-30">📈</span>
            </div>
          </div>
        </div>
      )}

      {/* Tier Configuration */}
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-navy mb-6">Premium Tier Pricing</h2>

        <div className="space-y-8">
          {tiers.map((tier) => {
            const changed = changes[tier.tier];
            const costCoins = changed?.costCoins ?? tier.costCoins;
            const costPHP = changed?.costPHP ?? tier.costPHP;
            const durationDays = changed?.durationDays ?? tier.durationDays;

            return (
              <div key={tier.tier} className="border-b border-gray-200 pb-8 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <label className="block text-lg font-semibold text-navy">
                      {tier.label} ({tier.tier.toUpperCase()})
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      {durationDays} days of premium access
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cost in Coins */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cost in Coins 💰
                    </label>
                    <input
                      type="number"
                      value={costCoins}
                      onChange={(e) => handleChange(tier.tier, 'costCoins', e.target.value)}
                      min={100}
                      step={100}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent ${
                        changed?.costCoins !== undefined ? 'border-coral bg-coral/5' : 'border-gray-300'
                      }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">Coins users need to purchase</p>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (Days) 📅
                    </label>
                    <input
                      type="number"
                      value={durationDays}
                      onChange={(e) => handleChange(tier.tier, 'durationDays', e.target.value)}
                      min={1}
                      step={1}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Read-only</p>
                  </div>
                </div>

                {/* Summary Card */}
                <div className="mt-4 p-4 bg-gradient-to-r from-coral/5 to-softPurple/5 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Cost per Day</p>
                      <p className="font-semibold text-navy">{Math.round(costCoins / durationDays)} coins/day</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Cost</p>
                      <p className="font-semibold text-navy">{costCoins.toLocaleString()} coins</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 mt-8 pt-8 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={Object.keys(changes).length === 0}
            className="px-6 py-3 bg-coral text-white font-medium rounded-lg hover:bg-coral/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
          <button
            onClick={() => {
              setChanges({});
              setError('');
            }}
            disabled={Object.keys(changes).length === 0}
            className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard
          </button>
        </div>
      </div>

      {/* Subscription Breakdown */}
      {stats?.tierBreakdown && (
        <div className="mt-8 bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-navy mb-6">Subscription Breakdown</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-300">
                <tr>
                  <th className="pb-3 font-semibold text-navy">Tier</th>
                  <th className="pb-3 font-semibold text-navy">Total Users</th>
                  <th className="pb-3 font-semibold text-navy">Active Users</th>
                  <th className="pb-3 font-semibold text-navy">Revenue</th>
                  <th className="pb-3 font-semibold text-navy">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.tierBreakdown.map((breakdown) => (
                  <tr key={breakdown.tier} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3">
                      <span className="inline-block px-3 py-1 bg-coral/10 text-coral rounded-full text-xs font-semibold">
                        {breakdown.tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-navy">{breakdown.totalUsers}</td>
                    <td className="py-3 font-medium text-navy">{breakdown.activeUsers}</td>
                    <td className="py-3 font-medium text-navy">{formatPHP(breakdown.revenueMinor)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded h-2">
                          <div
                            className="bg-coral h-2 rounded"
                            style={{ width: `${breakdown.percentOfTotal}%` }}
                          />
                        </div>
                        <span className="text-gray-600">{breakdown.percentOfTotal.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default PremiumManagement;
