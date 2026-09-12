import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Send, X, User, GraduationCap, Venus, Mars, Transgender, MoreVertical, Forward, Image as ImageIcon, Globe, Heart, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

function ChatPage({ session, onBackToLanding }) {
  const [status, setStatus] = useState('searching');
  const [chatroomId, setChatroomId] = useState(null);
  const [matchedUser, setMatchedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageReactions, setMessageReactions] = useState({}); // messageId -> array of sessionIds
  const [showMessageActions, setShowMessageActions] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const startMatchingRef = useRef(null);
  const matchingTimeoutRef = useRef(null);
  const isProcessingMatchRef = useRef(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      query: { sessionId: session.id },
    });

    newSocket.on('connect', () => {
      console.log('[Frontend] Connected to WebSocket with socket ID:', newSocket.id);
      if (status === 'searching') {
        console.log('[Frontend] Socket connected while searching, starting matching');
        setTimeout(() => startMatchingRef.current?.(), 500);
      } else if (status === 'matched' && chatroomId) {
        console.log('[Frontend] Socket connected while matched, rejoining chatroom:', chatroomId);
        newSocket.emit('joinChatroom', { chatroomId });
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Frontend] WebSocket connection error:', error);
    });

    newSocket.on('messageHistory', (historyMessages) => {
      console.log('[Frontend] Received message history:', historyMessages);
      const filteredMessages = (historyMessages || []).filter(msg => msg.type !== 'system');
      setMessages(filteredMessages);

      if (filteredMessages.length > 0) {
        const inferredChatroomId = filteredMessages[0].chatroomId;
        console.log('[Frontend] Setting chatroomId from message history:', inferredChatroomId);
        setChatroomId(inferredChatroomId);
      }
    });

    newSocket.on('newMessage', (message) => {
      console.log('[Frontend] Received new message:', message);

      if (message.type === 'system') {
        console.log('[Frontend] Filtering out system message');
        return;
      }

      // If we have a chatroomId set, check if the message matches
      // If not, set the chatroomId from the message
      if (chatroomId && message.chatroomId !== chatroomId) {
        console.log('[Frontend] Message chatroomId mismatch - updating from message');
        setChatroomId(message.chatroomId);
      }

      if (!chatroomId && message.chatroomId) {
        console.log('[Frontend] Setting chatroomId from incoming message:', message.chatroomId);
        setChatroomId(message.chatroomId);
      }

      setMessages((prev) => [...prev, message]);
    });

    newSocket.on('typingStatus', (data) => {
      console.log('[Frontend] Typing status received:', data);
      const otherTypingUsers = (data.sessionIds || []).filter(id => id !== session.id);
      setTypingUsers(otherTypingUsers);
    });

    newSocket.on('partnerSkipped', (data) => {
      console.log('[Frontend] Partner skipped:', data);

      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
        matchingTimeoutRef.current = null;
      }

      // Partner left, but we stay in the chat
      setPartnerLeft(true);
    });

    newSocket.on('partnerEnded', (data) => {
      console.log('[Frontend] Partner ended:', data);
      // Partner left, but we stay in the chat
      setPartnerLeft(true);
    });

    newSocket.on('partnerDisconnected', (data) => {
      console.log('[Frontend] Partner disconnected:', data);
      // Partner left, but we stay in the chat
      setPartnerLeft(true);
    });

    newSocket.on('partnerReconnected', (data) => {
      console.log('[Frontend] Partner reconnected:', data);
      // Partner came back
      setPartnerLeft(false);
    });

    newSocket.on('messageReaction', (data) => {
      console.log('[Frontend] Message reaction received:', data);
      setMessageReactions(prev => {
        const currentReactions = prev[data.messageId] || [];
        const hasReacted = currentReactions.includes(data.sessionId);

        if (data.reacted) {
          // Add reaction if not already present
          if (!hasReacted) {
            return {
              ...prev,
              [data.messageId]: [...currentReactions, data.sessionId],
            };
          }
        } else {
          // Remove reaction
          return {
            ...prev,
            [data.messageId]: currentReactions.filter(id => id !== data.sessionId),
          };
        }
        return prev;
      });
    });

    newSocket.on('joinChatroom', (response) => {
      console.log('[Frontend] Join chatroom response:', response);
    });

    newSocket.on('matchFound', (matchData) => {
      console.log('[Frontend] Match found via WebSocket:', matchData);

      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
        matchingTimeoutRef.current = null;
      }

      isProcessingMatchRef.current = false;

      setChatroomId(matchData.chatroomId);
      setMatchedUser(matchData.matchedSession);
      setStatus('matched');
      setPartnerLeft(false);

      setMessages([]);

      if (newSocket) {
        console.log('[Frontend] Socket is ready, emitting joinChatroom for:', matchData.chatroomId);
        newSocket.emit('joinChatroom', { chatroomId: matchData.chatroomId });
      } else {
        console.log('[Frontend] ERROR: Socket is not available for joining chatroom');
      }
    });

    socketRef.current = newSocket;

    return () => {
      console.log('[Frontend] Cleanup - Disconnecting WebSocket');
      newSocket.disconnect();
      socketRef.current = null;
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
      }
    };
  }, [session.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startMatching = async () => {
    if (status === 'matched' || status === 'ended') {
      console.log('[Frontend] Already matched or ended, skipping matching');
      return;
    }

    if (isProcessingMatchRef.current) {
      console.log('[Frontend] Already processing a match, skipping');
      return;
    }

    isProcessingMatchRef.current = true;

    try {
      console.log('[Frontend] Starting match search for session:', session.id);
      console.log('[Frontend] Socket status:', socketRef.current ? 'Connected' : 'Not connected');
      const response = await axios.post(`${API_URL}/match/${session.id}/find`);
      console.log('[Frontend] Match response:', response.data);
      
      if (response.data.matched) {
        console.log('[Frontend] Match found! Chatroom ID:', response.data.chatroomId);
        setChatroomId(response.data.chatroomId);
        setMatchedUser(response.data.matchedSession);
        setStatus('matched');
        setPartnerLeft(false);

        setMessages([]);

        if (matchingTimeoutRef.current) {
          clearTimeout(matchingTimeoutRef.current);
          matchingTimeoutRef.current = null;
        }

        if (socketRef.current) {
          console.log('[Frontend] Socket is ready, emitting joinChatroom for:', response.data.chatroomId);
          socketRef.current.emit('joinChatroom', { chatroomId: response.data.chatroomId });
        } else {
          console.log('[Frontend] ERROR: Socket is not available for joining chatroom');
        }

        isProcessingMatchRef.current = false;
      } else {
        console.log('[Frontend] No match found, retrying in 2 seconds');
        isProcessingMatchRef.current = false;
        matchingTimeoutRef.current = setTimeout(() => {
          if (status === 'searching') {
            console.log('[Frontend] Retrying matching...');
            startMatchingRef.current?.();
          } else {
            console.log('[Frontend] Status changed, canceling retry');
          }
        }, 2000);
      }
    } catch (error) {
      console.error('[Frontend] Matching error:', error);
      isProcessingMatchRef.current = false;
      if (status === 'searching') {
        const retryDelay = error.response?.status === 500 ? 5000 : 2000;
        matchingTimeoutRef.current = setTimeout(() => {
          console.log(`[Frontend] Retrying matching after ${retryDelay}ms due to error...`);
          startMatchingRef.current?.();
        }, retryDelay);
      }
    }
  };

  startMatchingRef.current = startMatching;

  useEffect(() => {
    if (session && status === 'searching' && socketRef.current) {
      console.log('[Frontend] Socket ready, starting matching');
      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
        matchingTimeoutRef.current = null;
      }
      startMatchingRef.current?.();
    }
  }, [session, status]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (status === 'searching' || status === 'matched') {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    const handleCleanup = async () => {
      console.log('[Frontend] Cleaning up session on page leave');
      try {
        if (status === 'searching') {
          await axios.post(`${API_URL}/match/${session.id}/stop-searching`);
          console.log('[Frontend] Stopped searching');
        }
        await axios.post(`${API_URL}/match/${session.id}/end`);
        console.log('[Frontend] Session ended successfully');
      } catch (error) {
        console.error('[Frontend] Error ending session:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleCleanup);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleCleanup);
    };
  }, [session.id, status]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatroomId) return;

    try {
      const messageData = {
        chatroomId,
        content: newMessage,
        type: 'text',
        replyTo: replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          senderId: replyingTo.senderId,
        } : null,
      };

      console.log('[Frontend] Sending message:', messageData);

      if (socketRef.current) {
        socketRef.current.emit('sendMessage', messageData);
        socketRef.current.emit('typingStop', { chatroomId });
      }

      setNewMessage('');
      setReplyingTo(null);
      setIsTyping(false);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    } catch (error) {
      console.error('[Frontend] Error sending message:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size exceeds 5MB limit');
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/upload/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const imageUrl = response.data.url;

      // Send image message
      if (socketRef.current && chatroomId) {
        socketRef.current.emit('sendMessage', {
          chatroomId,
          content: '',
          imageUrl,
          type: 'image',
          replyTo: replyingTo ? {
            id: replyingTo.id,
            content: replyingTo.content,
            senderId: replyingTo.senderId,
          } : null,
        });
      }

      setReplyingTo(null);
    } catch (error) {
      console.error('[Frontend] Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTypingStart = () => {
    console.log('[Frontend] Typing start triggered. isTyping:', isTyping, 'chatroomId:', chatroomId, 'socket:', !!socketRef.current);
    if (!isTyping && chatroomId && socketRef.current) {
      setIsTyping(true);
      console.log('[Frontend] Emitting typingStart for chatroom:', chatroomId);
      socketRef.current.emit('typingStart', { chatroomId });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        console.log('[Frontend] Typing timeout - stopping typing indicator');
        setIsTyping(false);
        if (socketRef.current && chatroomId) {
          socketRef.current.emit('typingStop', { chatroomId });
        }
      }, 3000);
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      handleTypingStart();
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    setShowMessageActions(null);
    if (inputRef?.current) {
      inputRef.current.focus();
    }
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleHeartReaction = (messageId) => {
    const currentReactions = messageReactions[messageId] || [];
    const hasReacted = currentReactions.includes(session.id);
    const newReactions = hasReacted
      ? currentReactions.filter(id => id !== session.id)
      : [...currentReactions, session.id];

    setMessageReactions(prev => ({
      ...prev,
      [messageId]: newReactions,
    }));
    setShowMessageActions(null);

    // Emit reaction to server
    if (socketRef.current && chatroomId) {
      socketRef.current.emit('messageReaction', {
        chatroomId,
        messageId,
        reacted: !hasReacted,
      });
    }
  };

  const getMessageGrouping = (messages, index) => {
    const currentMessage = messages[index];
    const prevMessage = messages[index - 1];
    const nextMessage = messages[index + 1];

    const isGroupedWithPrev = prevMessage && prevMessage.senderId === currentMessage.senderId;
    const isGroupedWithNext = nextMessage && nextMessage.senderId === currentMessage.senderId;

    return {
      isFirst: !isGroupedWithPrev,
      isLast: !isGroupedWithNext,
      isMiddle: isGroupedWithPrev && isGroupedWithNext,
      showAvatar: !isGroupedWithPrev,
    };
  };

  const handleSkip = async () => {
    try {
      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
        matchingTimeoutRef.current = null;
      }
      isProcessingMatchRef.current = false;

      // If partner has left, just start searching for a new match
      if (partnerLeft) {
        setStatus('searching');
        setChatroomId(null);
        setMatchedUser(null);
        setMessages([]);
        setPartnerLeft(false);
        setReplyingTo(null);
        setMessageReactions({});
        setTimeout(startMatching, 1000);
        return;
      }

      // Normal skip - notify backend
      await axios.post(`${API_URL}/match/${session.id}/skip`);
      setStatus('searching');
      setChatroomId(null);
      setMatchedUser(null);
      setMessages([]);
      setReplyingTo(null);
      setMessageReactions({});

      if (socketRef.current) {
        socketRef.current.emit('skipMatch');
      }

      setTimeout(startMatching, 1000);
    } catch (error) {
      console.error('Error skipping match:', error);
    }
  };

  const handleEnd = async () => {
    try {
      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
        matchingTimeoutRef.current = null;
      }
      isProcessingMatchRef.current = false;
      
      await axios.post(`${API_URL}/match/${session.id}/end`);
      setStatus('ended');
      
      if (socketRef.current) {
        socketRef.current.emit('endMatch');
      }
    } catch (error) {
      console.error('Error ending match:', error);
    }
  };

  const handleBackToLanding = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onBackToLanding();
  };

  const getGenderIcon = (gender) => {
    switch (gender) {
      case 'male':
        return <Mars className="w-4 h-4" />;
      case 'female':
        return <Venus className="w-4 h-4" />;
      case 'other':
        return <Transgender className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getGenderColor = (gender) => {
    switch (gender) {
      case 'male':
        return 'bg-coral';
      case 'female':
        return 'bg-softPurple';
      case 'other':
        return 'bg-navy';
      default:
        return 'bg-navy/50';
    }
  };

  const getAvatarUrl = (username, avatarStyle, avatarSeed) => {
    const style = avatarStyle || 'adventurer';
    const seed = avatarSeed || username || 'default';
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
  };

  const getFlagUrl = (countryCode) => {
    if (!countryCode) return null;
    return `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`;
  };

  if (status === 'searching') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <Card className="relative z-10 bg-cream/95 backdrop-blur-lg shadow-2xl border-0 max-w-md w-full p-8 text-center">
          <div className="w-24 h-24 mx-auto mb-6 relative">
            <div className="absolute inset-0 border-4 border-coral/20 rounded-full animate-spin" />
            <div className="absolute inset-2 border-4 border-coral/40 rounded-full animate-spin" style={{ animationDelay: '0.1s' }} />
            <div className="absolute inset-4 border-4 border-coral rounded-full animate-spin" style={{ animationDelay: '0.2s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={getAvatarUrl(session.username, session.avatar, session.avatarSeed)}
                alt="Your avatar"
                className="w-16 h-16"
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-navy">Searching for a match...</h2>
          <p className="text-navy/70 mb-2">Looking for someone to chat with</p>
          {session.country && (
            <p className="text-navy/50 text-sm flex items-center justify-center gap-2">
              <Globe className="w-4 h-4" />
              {session.countryCode ? (
                <img
                  src={getFlagUrl(session.countryCode)}
                  alt={session.country}
                  className="w-6 h-4 object-cover rounded"
                />
              ) : (
                <span className="text-2xl">🌍</span>
              )}
              {session.country}
            </p>
          )}
          <Button
            variant="outline"
            onClick={handleBackToLanding}
            className="rounded-xl border-navy/20 text-navy hover:bg-navy/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <Card className="relative z-10 bg-cream/95 backdrop-blur-lg shadow-2xl border-0 max-w-md w-full p-8 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full overflow-hidden border-4 border-coral shadow-lg bg-white">
            <img
              src={getAvatarUrl(session.username, session.avatar, session.avatarSeed)}
              alt="Your avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-navy">Chat Ended</h2>
          <p className="text-navy/70 mb-2">Thanks for using ChatMoo!</p>
          {session.country && (
            <p className="text-navy/50 text-sm flex items-center justify-center gap-2 mb-6">
              <Globe className="w-4 h-4" />
              {session.countryCode ? (
                <img
                  src={getFlagUrl(session.countryCode)}
                  alt={session.country}
                  className="w-6 h-4 object-cover rounded"
                />
              ) : (
                <span className="text-2xl">🌍</span>
              )}
              {session.country}
            </p>
          )}
          <Button
            variant="outline"
            onClick={handleBackToLanding}
            className="rounded-xl border-navy/20 text-navy hover:bg-navy/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-cream">
      {/* Header */}
      <div className="bg-gradient-to-r from-coral to-softPurple shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white">
            <img
              src={getAvatarUrl(matchedUser?.username, matchedUser?.avatar, matchedUser?.avatarSeed)}
              alt={matchedUser?.username}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-lg">{matchedUser?.username}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {matchedUser?.country && (
                <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                  {matchedUser.countryCode ? (
                    <img
                      src={getFlagUrl(matchedUser.countryCode)}
                      alt={matchedUser.country}
                      className="w-6 h-4 object-cover rounded mr-1"
                    />
                  ) : (
                    <span className="mr-1">🌍</span>
                  )}
                  {matchedUser.country}
                </Badge>
              )}
              {matchedUser?.gender && (
                <Badge variant="secondary" className={cn(getGenderColor(matchedUser.gender), "text-white")}>
                  {getGenderIcon(matchedUser.gender)}
                  <span className="ml-1">{matchedUser.gender.charAt(0).toUpperCase() + matchedUser.gender.slice(1)}</span>
                </Badge>
              )}
              {matchedUser?.university && (
                <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                  <GraduationCap className="w-3 h-3 mr-1" />
                  {matchedUser.university}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="bg-white/20 text-white hover:bg-white/30"
            >
              <Forward className="w-5 h-5" />
            </Button>
            {!partnerLeft && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEnd}
                className="bg-white/20 text-white hover:bg-white/30"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-navy/50">
              <div className="w-20 h-20 bg-navy/10 rounded-full flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-navy/30" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-navy">No messages yet</h3>
              <p className="text-navy/70">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => {
                const grouping = getMessageGrouping(messages, index);
                const isOwnMessage = message.senderId === session.id;
                const hasReacted = messageReactions[message.id]?.includes(session.id);
                const reactionCount = messageReactions[message.id]?.length || 0;

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3 animate-fade-in",
                      isOwnMessage ? "justify-end" : "justify-start"
                    )}
                  >
                    {!isOwnMessage && grouping.showAvatar && (
                      <div className="w-10 h-10 rounded-full overflow-hidden shadow-md border-2 border-softPurple flex-shrink-0">
                        <img
                          src={getAvatarUrl(matchedUser?.username, matchedUser?.avatar, matchedUser?.avatarSeed)}
                          alt={matchedUser?.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {!isOwnMessage && !grouping.showAvatar && (
                      <div className="w-10 flex-shrink-0" />
                    )}
                    <div className="max-w-[75%]">
                      <Card className={cn(
                        "shadow-md relative group",
                        isOwnMessage ? "bg-coral text-white" : "bg-white",
                        grouping.isFirst && "rounded-t-2xl",
                        grouping.isLast && "rounded-b-2xl",
                        grouping.isMiddle && "rounded-none",
                        grouping.isFirst && grouping.isLast && "rounded-2xl"
                      )}>
                        <CardContent className="p-3">
                          {message.replyTo && (
                            <div className={cn(
                              "text-xs mb-2 p-2 rounded-lg opacity-80",
                              isOwnMessage ? "bg-white/20" : "bg-navy/10"
                            )}>
                              <div className="flex items-center gap-1 mb-1">
                                <MessageCircle className="w-3 h-3" />
                                <span className="font-medium">
                                  {message.replyTo.senderId === session.id ? 'You' : matchedUser?.username}
                                </span>
                              </div>
                              <p className="truncate">{message.replyTo.content}</p>
                            </div>
                          )}
                          {message.type === 'image' && message.imageUrl ? (
                            <img
                              src={message.imageUrl}
                              alt="Shared image"
                              className="max-w-full rounded-lg mb-2"
                            />
                          ) : (
                            <p className="font-medium">{message.content}</p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <p className={cn(
                              "text-xs opacity-80",
                              isOwnMessage ? "text-white/80" : "text-navy/50"
                            )}>
                              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {messageReactions[message.id] && messageReactions[message.id].length > 0 && (
                              <div className="flex items-center gap-1 ml-2">
                                <Heart className={cn(
                                  "w-4 h-4",
                                  isOwnMessage ? "fill-white text-white" : "fill-red-500 text-red-500"
                                )} />
                                <span className={cn(
                                  "text-xs font-medium",
                                  isOwnMessage ? "text-white" : "text-red-500"
                                )}>
                                  {messageReactions[message.id].length}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                        <button
                          onClick={() => setShowMessageActions(showMessageActions === message.id ? null : message.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </Card>
                      {showMessageActions === message.id && (
                        <div className={cn(
                          "flex gap-2 mt-1",
                          isOwnMessage ? "justify-end" : "justify-start"
                        )}>
                          <button
                            onClick={() => handleReply(message)}
                            className="px-3 py-1 bg-white border border-navy/20 rounded-lg text-sm hover:bg-navy/5 transition-all"
                          >
                            <MessageCircle className="w-4 h-4 inline mr-1" />
                            Reply
                          </button>
                          <button
                            onClick={() => handleHeartReaction(message.id)}
                            className={cn(
                              "px-3 py-1 border rounded-lg text-sm transition-all",
                              hasReacted
                                ? "bg-red-500 text-white border-red-500"
                                : "bg-white border-navy/20 hover:bg-navy/5"
                            )}
                          >
                            <Heart className={cn(
                              "w-4 h-4 inline mr-1",
                              hasReacted ? "fill-white text-white" : "text-navy"
                            )} />
                            {hasReacted ? 'Liked' : 'Like'}
                            {reactionCount > 0 && (
                              <span className="ml-1 text-xs">({reactionCount})</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    {isOwnMessage && grouping.showAvatar && (
                      <div className="w-10 h-10 rounded-full overflow-hidden shadow-md border-2 border-coral flex-shrink-0">
                        <img
                          src={getAvatarUrl(session.username, session.avatar, session.avatarSeed)}
                          alt={session.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {isOwnMessage && !grouping.showAvatar && (
                      <div className="w-10 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
              
              {typingUsers.length > 0 && (
                <div className="flex gap-3 justify-start animate-slide-up">
                  <div className="w-10 h-10 rounded-full overflow-hidden shadow-md border-2 border-softPurple flex-shrink-0">
                    <img
                      src={getAvatarUrl(matchedUser?.username, matchedUser?.avatar, matchedUser?.avatarSeed)}
                      alt={matchedUser?.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Card className="bg-navy/10 shadow-md rounded-2xl rounded-tl-sm">
                    <CardContent className="p-3">
                      <p className="text-sm text-navy/70 font-medium">
                        {matchedUser?.username} is typing...
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-navy/10 shadow-lg p-4">
        <div className="max-w-4xl mx-auto">
          {partnerLeft && (
            <div className="bg-navy/10 border border-navy/20 rounded-lg p-3 mb-3 text-center">
              <p className="text-navy font-medium text-sm">Your partner has left the chat</p>
              <p className="text-navy/70 text-xs mt-1">Click Skip to find a new match</p>
            </div>
          )}
          {replyingTo && (
            <div className="bg-navy/10 rounded-lg p-3 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <MessageCircle className="w-4 h-4 text-navy/50" />
                <div className="flex-1">
                  <p className="text-xs text-navy/70 font-medium">
                    Replying to {replyingTo.senderId === session.id ? 'yourself' : matchedUser?.username}
                  </p>
                  <p className="text-sm text-navy truncate">{replyingTo.content}</p>
                </div>
              </div>
              <button
                onClick={handleCancelReply}
                className="p-1 hover:bg-navy/20 rounded transition-colors"
              >
                <X className="w-4 h-4 text-navy/50" />
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage || partnerLeft}
              variant="outline"
              className="rounded-xl h-12 px-4 border-navy/20 text-navy hover:bg-navy/5"
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              placeholder={partnerLeft ? "Partner has left - click Skip to find a new match" : "Type a message..."}
              className="flex-1 rounded-xl"
              disabled={uploadingImage || partnerLeft}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || uploadingImage || partnerLeft}
              className="rounded-xl h-12 px-6 bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90 shadow-lg"
            >
              {uploadingImage ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;