import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import SavedConversationChat from './SavedConversationChat';
import { getAvatarUrl, getConversationPartner } from '../utils/conversationHelpers';
import { getAppSettings, initAppSettings, STATUS_META } from '../utils/appSettings';
import {
  Inbox,
  Settings,
  LogOut,
  User,
  Search,
  Plus,
  Trash2,
  Clock,
  MessageCircle,
  RefreshCw,
  Wallet,
  Coins,
} from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const formatPHP = (minor) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((minor || 0) / 100);

function UserDashboard({ googleUser, onLogout, onStartChat, onOpenSettings, onOpenWallet, refreshSignal }) {
  const [userProfile, setUserProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [, setSettingsVersion] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => {
    loadUserProfile();
    // Warm the settings cache from the DB, then re-render with DB values
    initAppSettings(googleUser?.id).finally(() => setSettingsVersion((v) => v + 1));
  }, [googleUser, refreshSignal]);

  useEffect(() => {
    let cancelled = false;
    if (!googleUser?.id) {
      setWalletBalance(null);
      return;
    }
    setWalletLoading(true);
    axios.get(`${API_URL}/wallet?userId=${googleUser.id}`)
      .then((res) => { if (!cancelled) setWalletBalance(res.data?.balance ?? null); })
      .catch(() => { if (!cancelled) setWalletBalance(null); })
      .finally(() => { if (!cancelled) setWalletLoading(false); });
    return () => { cancelled = true; };
  }, [googleUser?.id, refreshSignal]);

  useEffect(() => {
    if (!googleUser?.id) return;
    const socket = io(API_URL, { query: { userId: googleUser.id } });
    socket.on('walletUpdated', (data) => {
      if (typeof data?.balance === 'number') setWalletBalance(data.balance);
    });
    return () => { socket.disconnect(); };
  }, [googleUser?.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUserProfile = async () => {
    if (!googleUser?.id) return;

    try {
      const response = await axios.get(`${API_URL}/auth/user/${googleUser.id}`);
      setUserProfile(response.data);
      console.log('[UserDashboard] Loaded user profile:', response.data);
    } catch (error) {
      console.error('[UserDashboard] Error loading user profile:', error);
    }
  };

  const handleStartChat = async () => {
    console.log('[UserDashboard] Starting chat for authenticated user');
    
    if (!googleUser?.id) {
      console.error('[UserDashboard] No user ID available');
      setError('User information not available');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/sessions`, {
        userId: googleUser.id,
        username: userProfile?.username || googleUser.name,
        country: userProfile?.country,
        countryCode: userProfile?.countryCode,
        university: userProfile?.university,
        gender: userProfile?.gender,
        genderFilter: 'all',
        avatar: userProfile?.avatar || 'adventurer',
        avatarSeed: userProfile?.avatarSeed,
      });
      console.log('[UserDashboard] Session created:', response.data);
      onStartChat(response.data);
    } catch (error) {
      console.error('[UserDashboard] Error creating session:', error);
      setError('Failed to start chat. Please try again.');
    }
  };
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
    loadReconnectableConversations();
  }, [googleUser]);

  const loadConversations = async () => {
    if (!googleUser?.id) return;

    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/conversations/user/${googleUser.id}`);
      setConversations(response.data);
      console.log('[UserDashboard] Loaded conversations:', response.data);
    } catch (error) {
      console.error('[UserDashboard] Error loading conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadReconnectableConversations = async () => {
    if (!googleUser?.id) return;

    try {
      const response = await axios.get(`${API_URL}/save-offers/reconnectable?userId=${googleUser.id}`);
      const reconnectable = response.data.filter(conv => conv.canReconnect && conv.status === 'active');
      console.log('[UserDashboard] Loaded reconnectable conversations:', reconnectable);
      // Merge with regular conversations (dedup by id) or show separately
      setConversations(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newOnes = reconnectable.filter(c => !existingIds.has(c.id));
        return [...newOnes, ...prev];
      });
    } catch (error) {
      console.error('[UserDashboard] Error loading reconnectable conversations:', error);
    }
  };

  const handleDeleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await axios.delete(`${API_URL}/conversations/${conversationId}?userId=${googleUser.id}`);
      setConversations(conversations.filter(c => c.id !== conversationId));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error('[UserDashboard] Error deleting conversation:', error);
      setError('Failed to delete conversation');
    }
  };

  const handleSelectConversation = async (conversation) => {
    try {
      const response = await axios.get(`${API_URL}/conversations/${conversation.id}?userId=${googleUser.id}`);
      setSelectedConversation(response.data);
      console.log('[UserDashboard] Loaded full conversation:', response.data);
    } catch (error) {
      console.error('[UserDashboard] Error loading conversation details:', error);
      setError('Failed to load conversation details');
    }
  };

  const handleCloseChat = () => {
    setSelectedConversation(null);
    loadConversations();
    loadReconnectableConversations();
  };

  const filteredConversations = conversations.filter(conv => {
    const q = searchQuery.toLowerCase();
    const p = getConversationPartner(conv, googleUser.id);
    return (
      p.displayName?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q)
    );
  });

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex flex-col md:flex-row">
      {/* Sidebar - Inbox: full screen on mobile when no chat is open */}
      <div className={cn(
        "bg-white/95 backdrop-blur-lg border-r border-navy/10 flex-col w-full md:w-80 md:flex",
        selectedConversation ? "hidden" : "flex h-screen md:h-auto"
      )}>
        {/* User Info + Menu */}
        <div className="p-4 border-b border-navy/10">
          <div className="flex items-center gap-3">
            {(() => {
              const prefs = getAppSettings();
              const statusMeta = STATUS_META[prefs.status] || STATUS_META.online;
              const initial = userProfile?.username?.charAt(0).toUpperCase() || googleUser?.name?.charAt(0).toUpperCase() || 'U';
              return (
                <div
                  className="w-12 h-12 rounded-full overflow-hidden shadow bg-white flex-shrink-0 relative"
                  title={`${statusMeta.label}${prefs.statusMessage ? ` — ${prefs.statusMessage}` : ''}`}
                >
                  {userProfile ? (
                    <img
                      src={getAvatarUrl(userProfile.username, userProfile.avatar, userProfile.avatarSeed)}
                      alt={userProfile.displayName || userProfile.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-coral to-softPurple flex items-center justify-center text-white font-bold">
                      {initial}
                    </div>
                  )}
                  <span className={cn("absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white", statusMeta.dot)} />
                </div>
              );
            })()}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-navy truncate">{userProfile?.displayName || userProfile?.username || googleUser?.name || 'User'}</p>
              <p className="text-sm text-navy/60 truncate">@{userProfile?.username || googleUser?.email || ''}</p>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                onOpenWallet?.();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 hover:bg-amber-400/25 transition-colors flex-shrink-0"
              title="Wallet balance"
            >
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-navy">{walletLoading ? '…' : formatPHP(walletBalance)}</span>
            </button>
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="p-2 rounded-lg hover:bg-navy/5 text-navy/60 hover:text-navy transition-colors"
                title="Menu"
              >
                <Settings className="w-5 h-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-navy/10 overflow-hidden z-50">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenWallet?.();
                    }}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-navy/10 hover:from-amber-100 hover:to-yellow-100 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-amber-500" />
                      <span className="font-bold text-navy">{walletLoading ? '…' : formatPHP(walletBalance)}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-navy/40 font-semibold">Wallet</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenSettings?.();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-navy hover:bg-navy/5 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenWallet?.();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-navy hover:bg-navy/5 transition-colors text-left"
                  >
                    <Wallet className="w-4 h-4" />
                    Wallet
                  </button>
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/40" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-lg"
            />
          </div>
        </div>

        {/* New Chat Button */}
        <div className="px-4 pb-4">
          <Button
            onClick={handleStartChat}
            className="w-full bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2">
          {loading ? (
            <div className="p-4 text-center text-navy/60">Loading conversations...</div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-navy/60">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 text-navy/20" />
              <p>No conversations yet</p>
              <p className="text-sm">Start a new chat to begin!</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className={cn(
                  "p-3 rounded-lg mb-2 cursor-pointer transition-all",
                  selectedConversation?.id === conversation.id
                    ? "bg-coral/10 border-2 border-coral"
                    : "hover:bg-navy/5 border-2 border-transparent"
                )}
              >
                <div className="flex items-start gap-3">
                  {(() => {
                    // Viewer-relative partner: a shared AUTH <-> AUTH conversation
                    // shows the other side to whoever is looking at the inbox.
                    const displayPartner = getConversationPartner(conversation, googleUser.id);
                    return (
                      <img
                        src={getAvatarUrl(displayPartner.username, displayPartner.avatar, displayPartner.avatarSeed)}
                        alt={displayPartner.username}
                        className="w-10 h-10 rounded-full flex-shrink-0"
                      />
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const displayPartner = getConversationPartner(conversation, googleUser.id);
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-medium text-navy truncate">{displayPartner.displayName}</p>
                              <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0",
                                displayPartner.isAuthenticated
                                  ? "bg-softPurple/15 text-softPurple"
                                  : "bg-navy/10 text-navy/60"
                              )}>
                                {displayPartner.isAuthenticated ? 'User' : 'Guest'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleDeleteConversation(conversation.id, e)}
                                className="p-1 rounded hover:bg-red-10 text-navy/40 hover:text-red-500"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-navy/60 truncate">@{displayPartner.username}</p>
                        </>
                      );
                    })()}
                    <div className="flex items-center gap-1 text-xs text-navy/40 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(conversation.lastMessageAt)}</span>
                      <span className="mx-1">•</span>
                      <span>{conversation.messageCount} messages</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area: takes over the screen on mobile when a chat is open */}
      <div className={cn(
        "flex-1 flex-col min-w-0",
        selectedConversation ? "flex" : "hidden md:flex"
      )}>
        {selectedConversation ? (
          <SavedConversationChat
            key={selectedConversation.id}
            conversation={selectedConversation}
            googleUser={googleUser}
            userProfile={userProfile}
            onClose={handleCloseChat}
          />
        ) : (
          <div className="flex-1 bg-cream/95 backdrop-blur-lg flex items-center justify-center">
            <div className="text-center">
              <Inbox className="w-24 h-24 mx-auto mb-4 text-navy/20" />
              <h2 className="text-2xl font-bold text-navy mb-2">Your Inbox</h2>
              <p className="text-navy/60 mb-6">Select a conversation to view or start a new chat</p>
              <Button
                onClick={handleStartChat}
                className="bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Start New Chat
              </Button>
              {/* <Button
                onClick={loadReconnectableConversations}
                variant="outline"
                className="flex items-center gap-2 ml-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </Button> */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;
