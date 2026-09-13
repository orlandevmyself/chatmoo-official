import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ArrowLeft, Globe, WifiOff } from 'lucide-react';
import { sessionManager } from '../utils/sessionManager';
import ChatWindow from './ChatWindow';
import { getAvatarUrl, getDisplayName, getFlagUrl } from '../utils/conversationHelpers';
import { getAppSettings, playMessageSound, notifyNewMessage } from '../utils/appSettings';
import { getErrorMessage, isNetworkError } from '../utils/network';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

function ChatPage({ session, onBackToLanding }) {
  const [status, setStatus] = useState('searching');
  const [chatroomId, setChatroomId] = useState(null);
  const [matchedUser, setMatchedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [messageReactions, setMessageReactions] = useState({}); // messageId -> array of sessionIds
  const [saveOfferSent, setSaveOfferSent] = useState(false);
  const [pendingSaveOffer, setPendingSaveOffer] = useState(null);
  const [showSaveOfferDialog, setShowSaveOfferDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [socketConnected, setSocketConnected] = useState(true);
  const [connectionNotice, setConnectionNotice] = useState('');
  const socketRef = useRef(null);
  const startMatchingRef = useRef(null);
  const matchingTimeoutRef = useRef(null);
  const isProcessingMatchRef = useRef(false);
  const hasSavedRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const savedMessageIdsRef = useRef(new Set());
  const syncTimerRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const matchedUserRef = useRef(matchedUser);
  matchedUserRef.current = matchedUser;
  const syncScheduleRef = useRef(null);
  const persistConversationRef = useRef(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      query: { sessionId: session.id },
    });

    newSocket.on('connect', () => {
      console.log('[Frontend] Connected to WebSocket with socket ID:', newSocket.id);
      setSocketConnected(true);
      setConnectionNotice('');
      if (status === 'searching') {
        console.log('[Frontend] Socket connected while searching, starting matching');
        setTimeout(() => startMatchingRef.current?.(), 500);
      } else if (status === 'matched' && chatroomId) {
        console.log('[Frontend] Socket connected while matched, rejoining chatroom:', chatroomId);
        newSocket.emit('joinChatroom', { chatroomId });
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Frontend] WebSocket disconnected:', reason);
      setSocketConnected(false);
      if (status === 'searching' && reason !== 'io server disconnect') {
        setConnectionNotice("You're offline — we'll reconnect you automatically.");
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Frontend] WebSocket connection error:', error);
      setSocketConnected(false);
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

      // If the conversation is already saved, sync the new message to it
      if (hasSavedRef.current) {
        syncScheduleRef.current?.();
      }

      // Honor notification settings
      const notifPrefs = getAppSettings();
      if (notifPrefs.messageSound) {
        playMessageSound();
      }
      if (notifPrefs.browserNotifications) {
        notifyNewMessage(
          getDisplayName(matchedUserRef.current),
          message.content || (message.type === 'image' ? 'Sent you an image' : 'New message')
        );
      }
    });

    newSocket.on('typingStatus', (data) => {
      console.log('[Frontend] Typing status received:', data);
      const otherTypingUsers = (data.sessionIds || []).filter(id => id !== session.id);
      setTypingUsers(otherTypingUsers);
    });

    newSocket.on('mediaUnlocked', (data) => {
      console.log('[Frontend] Media unlocked:', data);
      setMessages((prev) => prev.map((m) => {
        const keyMatch = data.mediaUnlockKey && m.mediaUnlockKey === data.mediaUnlockKey;
        if (m.id === data.messageId || keyMatch) {
          return {
            ...m,
            mediaUnlockedAt: data.mediaUnlockedAt || m.mediaUnlockedAt,
            imageUrl: data.imageUrl || m.imageUrl,
            mediaUnlockKey: data.mediaUnlockKey || m.mediaUnlockKey,
            mediaPrice: m.mediaPrice || undefined,
          };
        }
        return m;
      }));
      if (typeof data.balance === 'number') setWalletBalance(data.balance);
    });

    newSocket.on('saveOfferReceived', (data) => {
      console.log('[Frontend] Save offer received:', data);
      // Only show dialog for authenticated users (guests can't save)
      if (session.userId && !session.isGuest) {
        setPendingSaveOffer(data);
        setShowSaveOfferDialog(true);
      }
    });

    newSocket.on('saveOfferAccepted', (data) => {
      console.log('[Frontend] Save offer accepted:', data);
      setSaveOfferSent(true);
      // Could show a success notification
    });

    newSocket.on('saveOfferDeclined', (data) => {
      console.log('[Frontend] Save offer declined:', data);
      setSaveOfferSent(false);
      // Could show a notification that the offer was declined
    });

    newSocket.on('conversationSaved', (data) => {
      console.log('[Frontend] Conversation saved:', data);
      // Show notification that conversation was saved
      setSaveOfferSent(true);
    });

    newSocket.on('reconnectionAccepted', (data) => {
      console.log('[Frontend] Reconnection accepted:', data);
      setStatus('matched');
      setChatroomId(data.chatroomId);
      setMatchedUser(data.partner);
    });

    newSocket.on('reconnectionDeclined', (data) => {
      console.log('[Frontend] Reconnection declined:', data);
      setStatus('ended');
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

      hasSavedRef.current = false;
      saveInProgressRef.current = false;
      savedMessageIdsRef.current = new Set();
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      setHasSaved(false);
      setSaveOfferSent(false);

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
      
      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
      }
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [session.id]);

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

        hasSavedRef.current = false;
        saveInProgressRef.current = false;
        setHasSaved(false);
        setSaveOfferSent(false);

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
        if (isNetworkError(error)) {
          setConnectionNotice("Search paused — you appear to be offline. Reconnecting automatically…");
          return;
        }
        setConnectionNotice('');
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

  const handleSendMessage = async ({ content, replyTo }) => {
    if (!content.trim() || !chatroomId) return;

    try {
      const messageData = {
        chatroomId,
        content,
        type: 'text',
        replyTo,
      };

      console.log('[Frontend] Sending message:', messageData);

      if (socketRef.current) {
        socketRef.current.emit('sendMessage', messageData);
        socketRef.current.emit('typingStop', { chatroomId });
      }
    } catch (error) {
      console.error('[Frontend] Error sending message:', error);
    }
  };

  const handleSendImage = async ({ imageUrl, replyTo }) => {
    // Send image message
    if (socketRef.current && chatroomId) {
      socketRef.current.emit('sendMessage', {
        chatroomId,
        content: '',
        imageUrl,
        type: 'image',
        replyTo,
      });
    }
  };

  const handleSendMedia = async ({ imageUrl, previewUrl, type, mediaPrice, replyTo }) => {
    if (socketRef.current && chatroomId) {
      socketRef.current.emit('sendMessage', {
        chatroomId,
        content: '',
        imageUrl,
        mediaPreviewUrl: previewUrl || undefined,
        type: type === 'video' ? 'video' : 'image',
        replyTo: replyTo || null,
        mediaPrice: mediaPrice || undefined,
      });
    }
  };

  const handleUnlockMedia = async (messageId) => {
    if (!socketRef.current || !chatroomId) return { error: 'Not connected' };
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    try {
      const res = await socketRef.current.emitWithAck('unlockMedia', {
        chatroomId,
        messageId,
        idempotencyKey,
      });
      if (res?.error) return { error: res.error };
      if (typeof res.balance === 'number') setWalletBalance(res.balance);
      if (res.success) {
        setMessages((prev) => prev.map((m) => {
          const keyMatch = res.mediaUnlockKey && m.mediaUnlockKey === res.mediaUnlockKey;
          if (m.id === res.messageId || keyMatch) {
            return {
              ...m,
              mediaUnlockedAt: res.mediaUnlockedAt || m.mediaUnlockedAt,
              imageUrl: res.imageUrl || m.imageUrl,
              mediaUnlockKey: res.mediaUnlockKey || m.mediaUnlockKey,
            };
          }
          return m;
        }));
      }
      return res;
    } catch (e) {
      return { error: e?.message || 'Failed to unlock media' };
    }
  };

  const handleTypingStart = () => {
    if (socketRef.current && chatroomId) {
      socketRef.current.emit('typingStart', { chatroomId });
    }
  };

  const handleTypingStop = () => {
    if (socketRef.current && chatroomId) {
      socketRef.current.emit('typingStop', { chatroomId });
    }
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

    // Emit reaction to server
    if (socketRef.current && chatroomId) {
      socketRef.current.emit('messageReaction', {
        chatroomId,
        messageId,
        reacted: !hasReacted,
      });
    }
  };

  const canGift = !!session.userId && !session.isGuest && !!matchedUser?.isAuthenticated;

  useEffect(() => {
    if (canGift && matchedUser) {
      axios.get(`${API_URL}/wallet?userId=${session.userId}`).then(res=>setWalletBalance(res.data.balance)).catch(()=>{});
    } else {
      setWalletBalance(null);
    }
  }, [matchedUser?.isAuthenticated, matchedUser?.id, session.userId]);

  const handleSendGift = async (giftKey) => {
    if (!socketRef.current || !chatroomId) return { error: 'Not connected' };
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    try {
      const res = await socketRef.current.emitWithAck('sendGift', { chatroomId, giftKey, idempotencyKey });
      if (res?.error) return { error: res.error };
      if (typeof res.balance === 'number') setWalletBalance(res.balance);
      return res;
    } catch (e) {
      return { error: e?.message || 'Failed to send gift' };
    }
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
      
      // Save conversation if there are messages
      if (messages.length > 0 && matchedUser) {
        await saveConversation();
      }
      
      if (socketRef.current) {
        socketRef.current.emit('endMatch');
      }
    } catch (error) {
      console.error('Error ending match:', error);
    }
  };

  const canSaveConversations = () => !!session.userId && !session.isGuest;

  const persistConversation = async (onlyNew = false) => {
    if (!canSaveConversations() || !matchedUser) return;
    if (saveInProgressRef.current) return;

    const allMessages = messagesRef.current || [];
    if (allMessages.length === 0 || !chatroomId) return;

    const targetMessages = onlyNew
      ? allMessages.filter(m => !savedMessageIdsRef.current.has(m.id))
      : allMessages;
    if (targetMessages.length === 0) return;

    saveInProgressRef.current = true;
    try {
      const conversationData = {
        title: `Chat with ${matchedUser.username || 'Anonymous'}`,
        partnerUsername: matchedUser.username,
        partnerInfo: JSON.stringify({
          country: matchedUser.country,
          university: matchedUser.university,
          gender: matchedUser.gender,
          avatar: matchedUser.avatar,
          avatarSeed: matchedUser.avatarSeed,
          displayName: matchedUser.displayName || matchedUser.username,
        }),
        partnerGuestId: matchedUser.id, // Use session ID for guest partners
        currentUserId: session.id,
        chatroomId, // For backend dedup of duplicate saves
        messages: targetMessages.map(msg => ({
          senderId: msg.senderId,
          senderUsername: msg.senderUsername || (msg.senderId === session.id ? session.username : matchedUser.username),
          content: msg.content,
          imageUrl: msg.imageUrl,
          type: msg.type,
          replyToId: msg.replyToId,
        })),
      };

      console.log('[ChatPage] Syncing saved conversation to backend');
      await axios.post(`${API_URL}/conversations`, {
        userId: session.userId,
        ...conversationData,
      });

      targetMessages.forEach(m => savedMessageIdsRef.current.add(m.id));
      hasSavedRef.current = true;
      setSaveOfferSent(true);
      setHasSaved(true);
    } catch (error) {
      console.error('[ChatPage] Error syncing saved conversation:', error);
    } finally {
      saveInProgressRef.current = false;
    }
  };

  persistConversationRef.current = () => persistConversation(true);

  syncScheduleRef.current = () => {
    if (!hasSavedRef.current || saveInProgressRef.current) return;
    if (matchedUser?.isAuthenticated) return; // AUTH <-> AUTH uses the one-time offer snapshot
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(() => {
      persistConversationRef.current?.();
    }, 3000);
  };

  const handleOfferToSave = async () => {
    console.log('[ChatPage] handleOfferToSave called');
    console.log('[ChatPage] matchedUser:', matchedUser);
    console.log('[ChatPage] messages.length:', messages.length);
    console.log('[ChatPage] session.userId:', session.userId);
    console.log('[ChatPage] matchedUser.userId:', matchedUser.userId);
    
    if (!matchedUser || messages.length === 0) {
      console.log('[ChatPage] Cannot save: no matched user or no messages');
      return;
    }

    if (saveInProgressRef.current || hasSavedRef.current) {
      console.log('[ChatPage] Save already in progress or already saved, skipping');
      return;
    }

    if (!canSaveConversations()) {
      console.log('[ChatPage] Guest user cannot save conversations');
      return;
    }

    setIsSaving(true);
    
    try {
      const partnerInfo = JSON.stringify({
        country: matchedUser.country,
        university: matchedUser.university,
        gender: matchedUser.gender,
        avatar: matchedUser.avatar,
        avatarSeed: matchedUser.avatarSeed,
        displayName: matchedUser.displayName || matchedUser.username,
      });

      // Check if partner is authenticated (flag from match payload)
      const isPartnerAuth = !!matchedUser.isAuthenticated;
      
      if (isPartnerAuth) {
        // AUTH <-> AUTH: Use save offer system with mutual consent
        console.log('[ChatPage] Both users authenticated, using save offer system');
        
        const offerData = {
          partnerSessionId: matchedUser.id,
          partnerUserId: matchedUser.userId,
          partnerGuestId: matchedUser.isAuthenticated ? undefined : matchedUser.id,
          partnerUsername: matchedUser.username,
          partnerInfo,
          messages: messages.map(msg => ({
            senderId: msg.senderId,
            senderUsername: msg.senderUsername || (msg.senderId === session.id ? session.username : matchedUser.username),
            content: msg.content,
            imageUrl: msg.imageUrl,
            type: msg.type,
            replyToId: msg.replyToId,
            mediaPrice: msg.mediaPrice || undefined,
            mediaUnlockKey: msg.mediaUnlockKey || undefined,
            mediaUnlockedAt: msg.mediaUnlockedAt || undefined,
            mediaPreviewUrl: msg.mediaPreviewUrl || undefined,
          })),
        };

        console.log('[ChatPage] Sending offerToSave with data:', offerData);
        const response = await socketRef.current.emitWithAck('offerToSave', offerData);
        console.log('[ChatPage] Save offer response:', response);
        
        if (response.success) {
          setSaveOfferSent(true);
          hasSavedRef.current = true;
          savedMessageIdsRef.current = new Set(messages.map(m => m.id));
          console.log('[ChatPage] Save offer sent successfully');
        } else {
          console.error('[ChatPage] Save offer failed:', response.error);
        }
      } else {
        // AUTH <-> UNAUTH: Auto-save without offering
        console.log('[ChatPage] Partner is unauthenticated, auto-saving');
        await persistConversation(false);
      }
    } catch (error) {
      console.error('[ChatPage] Error in save operation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRespondToSaveOffer = async (response) => {
    if (!pendingSaveOffer) return;

    try {
      const result = await socketRef.current.emitWithAck('respondToSaveOffer', {
        offerId: pendingSaveOffer.offerId,
        response,
      });

      if (result.success) {
        setShowSaveOfferDialog(false);
        setPendingSaveOffer(null);
        console.log('[ChatPage] Save offer response sent successfully');
      }
    } catch (error) {
      console.error('[ChatPage] Error responding to save offer:', error);
    }
  };

  const saveConversation = async () => {
    const isAuth = canSaveConversations();
    const isPartnerAuth = !!matchedUser?.isAuthenticated;

    if (isAuth && isPartnerAuth) {
      // AUTH <-> AUTH: handled via the manual save offer; no auto-save on end
      console.log('[ChatPage] Both users authenticated, would use save offer system');
    } else if (isAuth && !isPartnerAuth) {
      // AUTH <-> UNAUTH: first save stores everything, later saves append new messages
      console.log('[ChatPage] Auth to unauth, syncing saved conversation');
      await persistConversation(hasSavedRef.current);
    } else if (!isAuth && isPartnerAuth) {
      // UNAUTH <-> AUTH: Unauth can't save, partner will handle their own save
      console.log('[ChatPage] Unauth to auth, authenticated user will handle saving');
    } else {
      // UNAUTH <-> UNAUTH: Neither can save to backend; guests keep a local copy
      console.log('[ChatPage] Both unauth, saving locally for guest');
      if (matchedUser && messages.length > 0) {
        sessionManager.saveGuestConversation({
          title: `Chat with ${matchedUser.username || 'Anonymous'}`,
          partnerUsername: matchedUser.username,
          partnerInfo: JSON.stringify({
            country: matchedUser.country,
            university: matchedUser.university,
            gender: matchedUser.gender,
            avatar: matchedUser.avatar,
            avatarSeed: matchedUser.avatarSeed,
            displayName: matchedUser.displayName || matchedUser.username,
          }),
          messages: messages.map(msg => ({
            senderId: msg.senderId,
            senderUsername: msg.senderUsername || (msg.senderId === session.id ? session.username : matchedUser.username),
            content: msg.content,
            imageUrl: msg.imageUrl,
            type: msg.type,
            replyToId: msg.replyToId,
          })),
        });
      }
    }
  };

  const handleBackToLanding = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    onBackToLanding();
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
          {connectionNotice && (
            <p className="mb-4 bg-amber-100/90 text-amber-800 text-sm font-medium rounded-lg px-3 py-2 flex items-center justify-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              {connectionNotice}
            </p>
          )}
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
    <div className="h-screen relative">
      {!socketConnected && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-amber-500/95 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
          <WifiOff className="w-3.5 h-3.5" />
          Reconnecting…
        </div>
      )}
      <ChatWindow
      session={session}
      partner={matchedUser}
      messages={messages}
      chatroomId={chatroomId}
      typingUsers={typingUsers}
      canSave={canSaveConversations()}
      showSaveButton
      saveOfferSent={saveOfferSent}
      isSaving={isSaving}
      onSave={handleOfferToSave}
      pendingSaveOffer={pendingSaveOffer}
      showSaveOfferDialog={showSaveOfferDialog}
      onRespondToSaveOffer={handleRespondToSaveOffer}
      showMatchActions
      partnerLeft={partnerLeft}
      onSkip={handleSkip}
      onEnd={handleEnd}
      messageReactions={messageReactions}
      onReact={handleHeartReaction}
      onSendMessage={handleSendMessage}
      onSendImage={handleSendImage}
      onSendMedia={handleSendMedia}
      onUnlockMedia={handleUnlockMedia}
      canGift={canGift}
      canLockMedia={canGift}
      walletBalance={walletBalance}
      onSendGift={handleSendGift}
      onTypingStart={handleTypingStart}
      onTypingStop={handleTypingStop}
      />
    </div>
  );
}

export default ChatPage;
