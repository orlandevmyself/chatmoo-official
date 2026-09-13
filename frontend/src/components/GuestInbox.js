import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Inbox, 
  MessageSquare, 
  Search,
  Plus,
  Trash2,
  X,
  Clock,
  MessageCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { sessionManager } from '../utils/sessionManager';

function GuestInbox({ guestSession, onStartChat, onBackToLanding }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadGuestConversations();
  }, []);

  const loadGuestConversations = () => {
    const guestConversations = sessionManager.getGuestConversations();
    setConversations(guestConversations);
    console.log('[GuestInbox] Loaded guest conversations:', guestConversations.length);
  };

  const handleDeleteConversation = (conversationId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    sessionManager.deleteGuestConversation(conversationId);
    setConversations(conversations.filter(c => c.id !== conversationId));
    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.partnerUsername?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex items-center justify-center p-4">
      <Card className="bg-cream/95 backdrop-blur-lg shadow-2xl border-0 max-w-4xl w-full max-h-[90vh] flex flex-col">
        <CardHeader className="border-b border-navy/10 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-navy">Guest Inbox</CardTitle>
              <p className="text-sm text-navy/60">Your conversation history (saved locally)</p>
            </div>
            <Button variant="outline" onClick={onBackToLanding}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex flex-col p-4">
          {/* Search */}
          <div className="mb-4">
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
          <div className="mb-4">
            <Button
              onClick={() => onStartChat(guestSession)}
              className="w-full bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>

          <div className="flex-1 overflow-hidden flex gap-4">
            {/* Conversations List */}
            <div className="w-80 overflow-y-auto pr-2">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 text-navy/20" />
                  <p className="text-navy/60">No conversations yet</p>
                  <p className="text-sm text-navy/40">Start a new chat to begin!</p>
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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-coral to-softPurple flex items-center justify-center text-white font-bold flex-shrink-0">
                        {conversation.partnerUsername?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-navy truncate">{conversation.title}</p>
                          <button
                            onClick={(e) => handleDeleteConversation(conversation.id, e)}
                            className="p-1 rounded hover:bg-red-10 text-navy/40 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-sm text-navy/60 truncate">{conversation.partnerUsername || 'Anonymous'}</p>
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

            {/* Conversation View */}
            <div className="flex-1 bg-white/50 rounded-lg overflow-hidden flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Conversation Header */}
                  <div className="p-4 border-b border-navy/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-coral to-softPurple flex items-center justify-center text-white font-bold">
                        {selectedConversation.partnerUsername?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <h3 className="font-bold text-navy">{selectedConversation.title}</h3>
                        <p className="text-sm text-navy/60">
                          {selectedConversation.messageCount} messages • {formatDate(selectedConversation.lastMessageAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      {selectedConversation.messages?.map((message, index) => (
                        <div
                          key={index}
                          className="flex gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-white font-bold flex-shrink-0">
                            {message.senderUsername?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="max-w-[70%] p-3 rounded-lg bg-white border border-navy/10">
                            <p className="text-sm font-medium mb-1">{message.senderUsername}</p>
                            <p>{message.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="p-4 border-t border-navy/10">
                    <Button
                      onClick={() => onStartChat(guestSession)}
                      className="w-full bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Start New Chat
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Inbox className="w-16 h-16 mx-auto mb-4 text-navy/20" />
                    <h3 className="text-lg font-bold text-navy mb-2">Select a Conversation</h3>
                    <p className="text-navy/60">Choose a conversation to view or start a new chat</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GuestInbox;