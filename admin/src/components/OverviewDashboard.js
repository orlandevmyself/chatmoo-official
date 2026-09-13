import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { Users, MessageCircle, CreditCard, Gift, AlertCircle } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const data = await adminApi.getOverview(adminUserId);
        setOverview(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

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
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-navy">Dashboard Overview</h1>
        <p className="text-navy/60 mt-2">
          Generated {new Date(overview.generatedAt).toLocaleString()}
        </p>
      </div>

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
          label="Total Balance"
          value={`₱${(wallet.totalBalance / 100).toFixed(2)}`}
          icon={CreditCard}
          subtext={`${wallet.pendingTransactions} pending`}
        />
      </div>

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
