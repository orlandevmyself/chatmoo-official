import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import {
  Search,
  Send,
  X,
  CheckCircle,
  Clock,
  XCircle,
  MapPin,
  Building2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getAvatarUrl } from '../utils/conversationHelpers';

const API_URL = process.env.REACT_APP_API_URL || 'https://chatmoo-official.onrender.com';

function UserSearch({ googleUser, onClose, onStartConversation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('search'); // search, incoming, outgoing
  const [sendingMessage, setSendingMessage] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');

  useEffect(() => {
    if (activeTab === 'incoming') {
      loadIncomingRequests();
    } else if (activeTab === 'outgoing') {
      loadOutgoingRequests();
    }
  }, [activeTab]);

  const loadIncomingRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/message-requests/incoming?userId=${googleUser.id}`);
      setIncomingRequests(res.data);
    } catch (err) {
      console.error('Error loading incoming requests:', err);
      setError('Failed to load incoming requests');
    }
  };

  const loadOutgoingRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/message-requests/outgoing?userId=${googleUser.id}`);
      setOutgoingRequests(res.data);
    } catch (err) {
      console.error('Error loading outgoing requests:', err);
      setError('Failed to load outgoing requests');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/message-requests/search`, {
        params: {
          userId: googleUser.id,
          q: searchQuery,
          limit: 20,
        },
      });
      setResults(res.data);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (recipientId, hasMessage = false) => {
    if (hasMessage && !requestMessage.trim()) {
      setError('Message cannot be empty');
      return;
    }

    try {
      setSendingMessage(recipientId);
      await axios.post(`${API_URL}/message-requests?userId=${googleUser.id}`, {
        recipientId,
        message: requestMessage.trim() || undefined,
      });

      // Update results to show request sent
      setResults(results.map((u) =>
        u.id === recipientId ? { ...u, requestStatus: 'pending', isOutgoing: true } : u
      ));

      setRequestMessage('');
      setError('');
      loadOutgoingRequests();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send request';
      setError(msg);
    } finally {
      setSendingMessage(null);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await axios.patch(`${API_URL}/message-requests/${requestId}/accept?userId=${googleUser.id}`);
      loadIncomingRequests();
      setError('');
    } catch (err) {
      setError('Failed to accept request');
    }
  };

  const handleReject = async (requestId) => {
    try {
      await axios.patch(`${API_URL}/message-requests/${requestId}/reject?userId=${googleUser.id}`);
      loadIncomingRequests();
      setError('');
    } catch (err) {
      setError('Failed to reject request');
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await axios.delete(`${API_URL}/message-requests/${requestId}?userId=${googleUser.id}`);
      loadOutgoingRequests();
      setResults(results.map((u) =>
        u.requestId === requestId ? { ...u, requestStatus: null, requestId: null } : u
      ));
      setError('');
    } catch (err) {
      setError('Failed to cancel request');
    }
  };

  const getRequestStatus = (user) => {
    if (!user.requestStatus) return null;
    if (user.requestStatus === 'pending') {
      return user.isOutgoing ? 'Pending...' : null;
    }
    if (user.requestStatus === 'accepted') {
      return 'Connected';
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-navy">Find Users</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 px-6 pt-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('search')}
            className={cn(
              'pb-3 px-2 font-semibold border-b-2 transition',
              activeTab === 'search'
                ? 'border-coral text-coral'
                : 'border-transparent text-gray-600 hover:text-navy'
            )}
          >
            🔍 Search
          </button>
          <button
            onClick={() => setActiveTab('incoming')}
            className={cn(
              'pb-3 px-2 font-semibold border-b-2 transition relative',
              activeTab === 'incoming'
                ? 'border-coral text-coral'
                : 'border-transparent text-gray-600 hover:text-navy'
            )}
          >
            📥 Incoming
            {incomingRequests.length > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-coral text-white text-xs rounded-full flex items-center justify-center">
                {incomingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('outgoing')}
            className={cn(
              'pb-3 px-2 font-semibold border-b-2 transition relative',
              activeTab === 'outgoing'
                ? 'border-coral text-coral'
                : 'border-transparent text-gray-600 hover:text-navy'
            )}
          >
            📤 Outgoing
            {outgoingRequests.length > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 bg-coral text-white text-xs rounded-full flex items-center justify-center">
                {outgoingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* SEARCH TAB */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username or display name..."
                    className="pl-10"
                  />
                </div>
                <Button type="submit" disabled={loading} className="bg-coral hover:bg-coral/90">
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </form>

              {results.length === 0 && searchQuery && !loading && (
                <div className="text-center py-12 text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No users found</p>
                </div>
              )}

              {results.map((user) => (
                <div key={user.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  <div className="flex gap-4">
                    <img
                      src={getAvatarUrl(user.username, user.avatar, user.avatarSeed)}
                      alt={user.username}
                      className="w-12 h-12 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-navy truncate">{user.displayName || user.username}</p>
                        {getRequestStatus(user) && (
                          <span className={cn(
                            'text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0',
                            user.requestStatus === 'accepted'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          )}>
                            {getRequestStatus(user)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">@{user.username}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                        {user.country && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {user.country}
                          </span>
                        )}
                        {user.university && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {user.university}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    {user.requestStatus === 'accepted' ? (
                      <Button
                        onClick={() => onStartConversation?.(user)}
                        className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                      >
                        💬 Chat
                      </Button>
                    ) : user.requestStatus === 'pending' && user.isOutgoing ? (
                      <Button
                        onClick={() => handleCancel(user.requestId)}
                        disabled={sendingMessage === user.id}
                        variant="outline"
                        className="flex-shrink-0"
                      >
                        ✕ Cancel
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          setSendingMessage(user.id);
                          setRequestMessage('');
                        }}
                        disabled={sendingMessage !== null}
                        className="bg-coral hover:bg-coral/90 text-white flex-shrink-0"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Message
                      </Button>
                    )}
                  </div>

                  {/* Send message form */}
                  {sendingMessage === user.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                      <textarea
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                        placeholder="Optional message to include with your request..."
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-coral"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleSendRequest(user.id, true)}
                          className="flex-1 bg-coral hover:bg-coral/90"
                        >
                          Send Request
                        </Button>
                        <Button
                          onClick={() => setSendingMessage(null)}
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* INCOMING TAB */}
          {activeTab === 'incoming' && (
            <div className="space-y-3">
              {incomingRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No incoming message requests</p>
                </div>
              ) : (
                incomingRequests.map((req) => (
                  <div key={req.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex gap-4">
                      <img
                        src={getAvatarUrl(req.sender.username, req.sender.avatar, req.sender.avatarSeed)}
                        alt={req.sender.username}
                        className="w-12 h-12 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-navy">{req.sender.displayName || req.sender.username}</p>
                        <p className="text-sm text-gray-600">@{req.sender.username}</p>
                        {req.message && (
                          <p className="text-sm text-gray-700 mt-2 italic">"{req.message}"</p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          onClick={() => handleAccept(req.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          onClick={() => handleReject(req.id)}
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* OUTGOING TAB */}
          {activeTab === 'outgoing' && (
            <div className="space-y-3">
              {outgoingRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Send className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No outgoing message requests</p>
                </div>
              ) : (
                outgoingRequests.map((req) => (
                  <div key={req.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex gap-4 items-start">
                      <img
                        src={getAvatarUrl(req.recipient.username, req.recipient.avatar, req.recipient.avatarSeed)}
                        alt={req.recipient.username}
                        className="w-12 h-12 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-navy">{req.recipient.displayName || req.recipient.username}</p>
                        <p className="text-sm text-gray-600">@{req.recipient.username}</p>
                        {req.message && (
                          <p className="text-sm text-gray-700 mt-2 italic">"{req.message}"</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default UserSearch;
