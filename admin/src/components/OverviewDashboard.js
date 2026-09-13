import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { Users, MessageCircle, CreditCard, Gift, AlertCircle, Trash2, TrendingUp, PiggyBank } from 'lucide-react';

function StatCard({ label, value, icon: Icon, subtext }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-coral hover:shadow-lg transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-navy/60 text-sm font-medium">{label}</p>
          <p className="text-4xl font-bold text-navy mt-3">{value}</p>
          {subtext && <p className="text-xs text-navy/50 mt-2">{subtext}</p>}
        </div>
        <Icon className="text-coral" size={40} />
      </div>
    </div>
  );
}

function OverviewDashboard({ adminUserId }) {
  const [overview, setOverview] = useState(null);
  const [walletStats, setWalletStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState('');

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const [overviewData, walletData] = await Promise.all([
        adminApi.getOverview(adminUserId),
        adminApi.getWalletStats(adminUserId),
      ]);
      setOverview(overviewData);
      setWalletStats(walletData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm('This will delete inactive sessions (>24h) and empty ended chatrooms. Continue?')) {
      return;
    }
    try {
      setCleanupLoading(true);
      const result = await adminApi.cleanup(adminUserId);
      setCleanupMessage(
        `Cleanup complete! Deleted ${result.deletedDemoUsers} demo users, ${result.deletedSessions} sessions, ${result.deletedOrphanedSessions} orphaned sessions, and ${result.deletedChatrooms} empty chatrooms.`
      );
      setTimeout(() => setCleanupMessage(''), 5000);
      // Refresh overview
      fetchOverview();
    } catch (err) {
      alert(`Cleanup failed: ${err.message}`);
    } finally {
      setCleanupLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [adminUserId]);

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
            <h3 className="font-semibold text-red-900">Error loading overview</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const { users, sessions, chatrooms, messages, wallet, conversations, gifts } = overview;

  return (
    <div className="p-8 bg-cream-50 min-h-screen">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-navy">Dashboard Overview</h1>
          <p className="text-navy/60 mt-2">
            Generated {new Date(overview.generatedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleCleanup}
          disabled={cleanupLoading}
          className="flex items-center gap-2 px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition disabled:opacity-50"
        >
          <Trash2 size={18} />
          {cleanupLoading ? 'Cleaning...' : 'Cleanup Data'}
        </button>
      </div>

      {cleanupMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {cleanupMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total Users"
          value={users.total.toLocaleString()}
          icon={Users}
          subtext={`${users.newToday} new today`}
        />
        <StatCard
          label="Active Sessions"
          value={sessions.total.toLocaleString()}
          icon={MessageCircle}
          subtext={`${sessions.active || 0} active`}
        />
        <StatCard
          label="Chatrooms"
          value={chatrooms.total.toLocaleString()}
          icon={MessageCircle}
          subtext={`${chatrooms.active} active`}
        />
        <StatCard
          label="Admin Income"
          value={walletStats ? `₱${(walletStats.adminWallet.balance / 100).toFixed(2)}` : '₱0.00'}
          icon={PiggyBank}
          subtext={walletStats ? `Estimated: ₱${(walletStats.adminWallet.estimatedIncome / 100).toFixed(2)}` : 'Loading...'}
        />
      </div>

      {/* Wallet Stats Row */}
      {walletStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            label="Total Commission"
            value={`₱${(walletStats.commissionStats.totalCommission / 100).toFixed(2)}`}
            icon={TrendingUp}
            subtext={`${walletStats.commissionStats.completedCommission > 0 ? '₱' + (walletStats.commissionStats.completedCommission / 100).toFixed(2) : 'No'} completed`}
          />
          <StatCard
            label="User Total Balance"
            value={`₱${(walletStats.userStats.totalBalance / 100).toFixed(2)}`}
            icon={Users}
            subtext={`${walletStats.withdrawalStats.completedWithdrawals} withdrawals`}
          />
          <StatCard
            label="Coins in Circulation"
            value={`₱${(walletStats.totalCoinsInCirculation / 100).toFixed(2)}`}
            icon={CreditCard}
            subtext="Admin + Users total"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-navy mb-6">User Statistics</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Users</span>
              <span className="text-xl font-semibold">{users.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">New (Last 7d)</span>
              <span className="text-xl font-semibold">{users.newLast7d}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">New (Last 30d)</span>
              <span className="text-xl font-semibold">{users.newLast30d}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Banned</span>
              <span className="text-xl font-semibold text-red-600">{users.banned}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Admins</span>
              <span className="text-xl font-semibold">{users.admins}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-navy mb-6">Wallet Activity</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Balance</span>
              <span className="text-xl font-semibold">₱{(wallet.totalBalance / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Completed Deposits</span>
              <span className="text-xl font-semibold">{wallet.completedDeposits}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Deposited</span>
              <span className="text-xl font-semibold">₱{(wallet.totalDeposited / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Completed Withdrawals</span>
              <span className="text-xl font-semibold">{wallet.completedWithdrawals}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Withdrawn</span>
              <span className="text-xl font-semibold">₱{(wallet.totalWithdrawn / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-bold text-navy mb-6">Recent Signups</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200">
              <tr className="text-left text-sm font-semibold text-gray-700">
                <th className="pb-3">Email</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Country</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.recent.map((user) => (
                <tr key={user.id} className="text-sm hover:bg-gray-50">
                  <td className="py-3">{user.email}</td>
                  <td className="py-3">{user.name || '-'}</td>
                  <td className="py-3">{user.country || '-'}</td>
                  <td className="py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3">
                    {user.banned ? (
                      <span className="text-red-600 font-medium">Banned</span>
                    ) : user.profileComplete ? (
                      <span className="text-green-600 font-medium">Complete</span>
                    ) : (
                      <span className="text-amber-600 font-medium">Incomplete</span>
                    )}
                  </td>
                  <td className="py-3 text-gray-600">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default OverviewDashboard;
