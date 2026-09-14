import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Trash2, AlertCircle } from 'lucide-react';
import { getAvatarUrl } from '../utils/conversationHelpers';
import { blockReportApi } from '../utils/blockReportApi';

function BlockedUsers({ userId, onBack }) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unblockingId, setUnblockingId] = useState(null);

  useEffect(() => {
    fetchBlockedUsers();
  }, [userId]);

  const fetchBlockedUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await blockReportApi.getBlockedUsers(userId);
      setBlockedUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedId) => {
    setUnblockingId(blockedId);
    try {
      await blockReportApi.unblockUser(userId, blockedId);
      setBlockedUsers(blockedUsers.filter(u => u.blockedId !== blockedId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unblock user');
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Blocked Users</h2>
        {blockedUsers.length > 0 && (
          <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
            {blockedUsers.length}
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-red-700">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : blockedUsers.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">You haven't blocked any users yet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {blockedUsers.map((block) => (
            <Card key={block.blockedId} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <img
                    src={getAvatarUrl(
                      block.blocked.avatar || 'adventurer',
                      block.blocked.avatarSeed || 'default'
                    )}
                    alt="Avatar"
                    className="w-12 h-12 rounded-full flex-shrink-0"
                  />

                  {/* User Info */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {block.blocked.displayName || block.blocked.username || 'Anonymous'}
                    </h3>
                    {block.blocked.username && (
                      <p className="text-sm text-gray-500 truncate">
                        @{block.blocked.username}
                      </p>
                    )}
                    {block.blocked.country && (
                      <p className="text-xs text-gray-400 mt-1">
                        {block.blocked.country}
                        {block.blocked.university && ` • ${block.blocked.university}`}
                      </p>
                    )}
                    {block.reason && (
                      <p className="text-xs text-gray-600 mt-2 italic">
                        Reason: {block.reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Unblock Button */}
                <button
                  onClick={() => handleUnblock(block.blockedId)}
                  disabled={unblockingId === block.blockedId}
                  className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Unblock user"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Back Button */}
      <div className="pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={onBack} className="w-full">
          Back
        </Button>
      </div>
    </div>
  );
}

export default BlockedUsers;
