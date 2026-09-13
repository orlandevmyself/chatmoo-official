import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { CreditCard, TrendingUp, Users, AlertCircle, PiggyBank } from 'lucide-react';

function StatBox({ label, value, icon: Icon, subtext, color = 'coral' }) {
  const colorClasses = {
    coral: 'border-coral text-coral',
    green: 'border-green-500 text-green-600',
    blue: 'border-blue-500 text-blue-600',
    purple: 'border-softPurple text-softPurple',
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 border-${color === 'coral' ? 'coral' : color === 'green' ? 'green-500' : color === 'blue' ? 'blue-500' : 'softPurple'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-navy/60 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-navy mt-3">{value}</p>
          {subtext && <p className="text-xs text-navy/50 mt-2">{subtext}</p>}
        </div>
        <Icon className={`${colorClasses[color]} opacity-70`} size={40} />
      </div>
    </div>
  );
}

function WalletDashboard({ adminUserId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState('');
  const [withdrawalForm, setWithdrawalForm] = useState({
    amountMinor: '',
    method: 'bank',
    destination: '',
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await adminApi.getWalletStats(adminUserId);
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [adminUserId]);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawalForm.amountMinor || !withdrawalForm.destination) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setWithdrawalLoading(true);
      setError('');
      const amountMinor = Math.floor(parseFloat(withdrawalForm.amountMinor) * 100);
      const result = await adminApi.withdrawAdminIncome(
        adminUserId,
        amountMinor,
        withdrawalForm.method,
        withdrawalForm.destination,
      );
      setWithdrawalSuccess(result.message);
      setWithdrawalForm({ amountMinor: '', method: 'bank', destination: '' });
      setTimeout(() => setWithdrawalSuccess(''), 5000);
      // Refresh stats
      const newStats = await adminApi.getWalletStats(adminUserId);
      setStats(newStats);
    } catch (err) {
      setError(`Withdrawal failed: ${err.message}`);
    } finally {
      setWithdrawalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-4">
          <AlertCircle className="text-red-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Error loading wallet stats</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-8 bg-cream-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-navy">Wallet & Revenue</h1>
        <p className="text-navy/60 mt-2">Track your platform income and user wallet statistics</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatBox
          label="Admin Income"
          value={`₱${(stats.adminWallet.balance / 100).toFixed(2)}`}
          icon={PiggyBank}
          subtext="Current balance"
          color="green"
        />
        <StatBox
          label="Estimated Income"
          value={`₱${(stats.adminWallet.estimatedIncome / 100).toFixed(2)}`}
          icon={TrendingUp}
          subtext="Pending commission"
          color="coral"
        />
        <StatBox
          label="Total Commission"
          value={`₱${(stats.commissionStats.totalCommission / 100).toFixed(2)}`}
          icon={TrendingUp}
          subtext={`${stats.commissionStats.commissionRate}% from withdrawals`}
          color="blue"
        />
        <StatBox
          label="Total User Balance"
          value={`₱${(stats.userStats.totalBalance / 100).toFixed(2)}`}
          icon={Users}
          subtext="Across all users"
          color="purple"
        />
      </div>

      {/* Commission Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-navy mb-6 flex items-center gap-2">
            <TrendingUp size={24} className="text-coral" />
            Commission Breakdown
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-navy/60">Completed Commission</span>
              <span className="font-semibold text-green-600">₱{(stats.commissionStats.completedCommission / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-navy/60">Pending Commission</span>
              <span className="font-semibold text-yellow-600">₱{(stats.commissionStats.pendingCommission / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pb-4">
              <span className="text-navy/60">Commission Rate</span>
              <span className="font-semibold text-coral">{stats.commissionStats.commissionRate}%</span>
            </div>
          </div>
        </div>

        {/* Withdrawal Stats */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-navy mb-6 flex items-center gap-2">
            <CreditCard size={24} className="text-blue-500" />
            Withdrawal Activity
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-navy/60">Total Withdrawn</span>
              <span className="font-semibold">₱{(stats.withdrawalStats.totalWithdrawnAmount / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-navy/60">Completed Withdrawals</span>
              <span className="font-semibold">{stats.withdrawalStats.completedWithdrawals}</span>
            </div>
            <div className="flex justify-between items-center pb-4">
              <span className="text-navy/60">Average Withdrawal</span>
              <span className="font-semibold">₱{(stats.withdrawalStats.averageWithdrawal / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Stats */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-navy mb-6 flex items-center gap-2">
          <TrendingUp size={24} className="text-green-500" />
          Deposit Activity
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-200 md:border-b-0">
            <span className="text-navy/60">Total Deposited</span>
            <span className="font-semibold">₱{(stats.depositStats.totalDepositedAmount / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pb-4 border-b border-gray-200 md:border-b-0">
            <span className="text-navy/60">Total Deposits</span>
            <span className="font-semibold">{stats.depositStats.totalDeposits}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-navy/60">Average Deposit</span>
            <span className="font-semibold">₱{(stats.depositStats.averageDeposit / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Withdrawal Form */}
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-navy mb-6">Withdraw Your Income</h2>

        {withdrawalSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            ✅ {withdrawalSuccess}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleWithdraw} className="space-y-6 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (PHP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500">₱</span>
                <input
                  type="number"
                  step="0.01"
                  min="100"
                  max={stats.adminWallet.balance / 100}
                  value={withdrawalForm.amountMinor}
                  onChange={(e) =>
                    setWithdrawalForm({ ...withdrawalForm, amountMinor: e.target.value })
                  }
                  placeholder="100.00"
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Available: ₱{(stats.adminWallet.balance / 100).toFixed(2)} | Min: ₱100.00
              </p>
            </div>

            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Withdrawal Method
              </label>
              <select
                value={withdrawalForm.method}
                onChange={(e) =>
                  setWithdrawalForm({ ...withdrawalForm, method: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
              >
                <option value="bank">Bank Transfer</option>
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
              </select>
            </div>
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account / Destination
            </label>
            <input
              type="text"
              value={withdrawalForm.destination}
              onChange={(e) =>
                setWithdrawalForm({ ...withdrawalForm, destination: e.target.value })
              }
              placeholder="e.g., Account number or phone number"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Where should the funds be transferred?
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={withdrawalLoading || !stats || stats.adminWallet.balance === 0}
            className="w-full bg-coral text-white font-medium py-3 rounded-lg hover:bg-coral/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {withdrawalLoading ? 'Processing...' : 'Withdraw Now'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default WalletDashboard;
