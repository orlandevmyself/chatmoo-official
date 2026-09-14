import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import ChatWindow from './ChatWindow';
import LoudSpeaker from './LoudSpeaker';
import { getConversationPartner, mapSavedToChat, mergeMessagesById, computeOwnSenderIds, getDisplayName } from '../utils/conversationHelpers';
import { getAppSettings, playMessageSound, notifyNewMessage } from '../utils/appSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || API_URL;
const JOIN_TIMEOUT_MS = 12000;

// Full-featured chat for a saved (shared) conversation, used inside the
// authenticated user's inbox. Reuses the same ChatWindow as the random
// match flow: text, images, typing indicator, replies, likes, avatars,
// presence. The saved history renders instantly (even if the partner is
// offline); the live channel joins in the background, and anything the
// partner writes later appears for both sides. New messages are appended
// to the shared SavedConversation so both users keep one continuous history.
function SavedConversationChat({ conversation, googleUser, userProfile, onClose }) {
  const [session, setSession] = useState(null);
  const [chatroomId, setChatroomId] = useState(null);
  const [messages, setMessages] = useState(() =>
    mapSavedToChat(conversation.messages, null, conversation.id)
  );
  const [ownSenderIds, setOwnSenderIds] = useState([]);
  const [partner, setPartner] = useState(() => getConversationPartner(conversation, googleUser?.id));
  const [partnerOnline, setPartnerOnline] = useState(null);
  const [liveJoined, setLiveJoined] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [messageReactions, setMessageReactions] = useState({});
  const [joinError, setJoinError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [walletBalance, setWalletBalance] = useState(null);
  const socketRef = useRef(null);
  const sessionRef = useRef(null);
  const liveJoinedRef = useRef(false);
  const partnerRef = useRef(partner);
  partnerRef.current = partner;

  const canGift = !!googleUser?.id && !!conversation.partnerUserId && !!conversation.userId;

  useEffect(() => {
    let cancelled = false;
    let activeSocket = null;
    let watchdog = null;

    const applyJoinResult = (result) => {
      setChatroomId(result.chatroomId);
      // Server history is the source of truth (includes anything new).
      setMessages(result.messages || []);
      setOwnSenderIds(result.ownSenderIds || []);
      if (result.partner) setPartner(result.partner);
      setPartnerOnline(result.partnerOnline ?? null);
      setLiveJoined(true);
      liveJoinedRef.current = true;
      if (watchdog) {
        clearTimeout(watchdog);
        watchdog = null;
      }
    };

    const init = async () => {
      setJoinError('');
      setLiveJoined(false);
      liveJoinedRef.current = false;
      try {
        // Real backend session (same as starting a random chat)
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
        if (cancelled) return;
        const sessionData = response.data;
        console.log('[SavedConversationChat] Session created:', sessionData.id);
        sessionRef.current = sessionData;
        setSession(sessionData);
        // History is already on screen from the conversation prop; refresh
        // viewer-relative attribution for this fresh session.
        setOwnSenderIds(computeOwnSenderIds(conversation, sessionData.username, sessionData.id, googleUser.id));

        // Watchdog: never hang forever — history stays visible regardless.
        watchdog = setTimeout(() => {
          if (!cancelled && !liveJoinedRef.current) {
            setJoinError('Live chat is unreachable (the server may need a restart to load the latest code). Showing saved history.');
          }
        }, JOIN_TIMEOUT_MS + 3000);

        const newSocket = io(SOCKET_URL, {
          query: { sessionId: sessionData.id },
        });
        activeSocket = newSocket;
        socketRef.current = newSocket;

        newSocket.on('connect', async () => {
          console.log('[SavedConversationChat] Connected, joining conversation:', conversation.id);
          try {
            const timeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Join timed out — please restart the backend to load the latest server code.')), JOIN_TIMEOUT_MS)
            );
            const result = await Promise.race([
              newSocket.emitWithAck('joinConversation', { conversationId: conversation.id }),
              timeout,
            ]);
            console.log('[SavedConversationChat] Join result:', result && result.success ? 'ok' : result);
            if (cancelled) return;
            if (result && result.success) {
              applyJoinResult(result);
            } else {
              setJoinError(result?.error || 'Failed to join live chat. Showing saved history.');
            }
          } catch (error) {
            console.error('[SavedConversationChat] Join error:', error);
            if (!cancelled) {
              setJoinError(error?.message || 'Failed to join live chat. Showing saved history.');
            }
          }
        });

        newSocket.on('connect_error', (error) => {
          console.error('[SavedConversationChat] WebSocket connection error:', error);
        });

        newSocket.on('messageHistory', (historyMessages) => {
          // Merge (never replace): live chatroom history is a subset of the
          // saved conversation history already on screen.
          const live = (historyMessages || []).filter(msg => msg.type !== 'system');
          if (live.length > 0) {
            setMessages((prev) => mergeMessagesById(prev, live));
            const inferred = live[0].chatroomId;
            if (inferred) setChatroomId((prev) => prev || inferred);
          }
        });

        newSocket.on('newMessage', (message) => {
          if (message.type === 'system') return;
          setMessages((prev) => mergeMessagesById(prev, [message]));
          if (message.chatroomId) {
            setChatroomId((prev) => prev || message.chatroomId);
          }
          // Honor notification settings
          const notifPrefs = getAppSettings();
          if (notifPrefs.messageSound) {
            playMessageSound();
          }
          if (notifPrefs.browserNotifications) {
            notifyNewMessage(
              getDisplayName(partnerRef.current),
              message.content || (message.type === 'image' ? 'Sent you an image' : 'New message')
            );
          }
        });

        newSocket.on('typingStatus', (data) => {
          const others = (data.sessionIds || []).filter(id => id !== sessionRef.current?.id);
          setTypingUsers(others);
        });

        newSocket.on('mediaUnlocked', (data) => {
          console.log('[SavedConversationChat] Media unlocked:', data);
          setMessages((prev) => prev.map((m) => {
            const keyMatch = data.mediaUnlockKey && m.mediaUnlockKey === data.mediaUnlockKey;
            if (m.id === data.messageId || keyMatch) {
              return {
                ...m,
                mediaUnlockedAt: data.mediaUnlockedAt || m.mediaUnlockedAt,
                imageUrl: data.imageUrl || m.imageUrl,
                mediaUnlockKey: data.mediaUnlockKey || m.mediaUnlockKey,
              };
            }
            return m;
          }));
          if (typeof data.balance === 'number') setWalletBalance(data.balance);
        });

        newSocket.on('messageReaction', (data) => {
          setMessageReactions(prev => {
            const current = prev[data.messageId] || [];
            const hasReacted = current.includes(data.sessionId);
            if (data.reacted) {
              if (!hasReacted) {
                return { ...prev, [data.messageId]: [...current, data.sessionId] };
              }
            } else {
              return { ...prev, [data.messageId]: current.filter(id => id !== data.sessionId) };
            }
            return prev;
          });
        });

        newSocket.on('conversationPresence', (data) => {
          if (data.conversationId !== conversation.id) return;
          if (data.sessionId === sessionRef.current?.id) return;
          console.log('[SavedConversationChat] Partner presence:', data);
          setPartnerOnline(!!data.online);
        });

        newSocket.on('partnerDisconnected', () => {
          setPartnerOnline(false);
        });

        newSocket.on('partnerReconnected', () => {
          setPartnerOnline(true);
        });
      } catch (error) {
        console.error('[SavedConversationChat] Init error:', error);
        if (!cancelled) {
          setJoinError('Failed to start conversation');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      try {
        if (activeSocket) {
          activeSocket.emit('leaveConversation', { conversationId: conversation.id });
          activeSocket.disconnect();
        }
      } catch {
        // ignore cleanup errors
      }
      socketRef.current = null;
    };
  }, [conversation.id, attempt]);

  useEffect(() => {
    if (canGift) {
      axios.get(`${API_URL}/wallet?userId=${googleUser.id}`).then(res=>setWalletBalance(res.data.balance)).catch(()=>{});
    } else {
      setWalletBalance(null);
    }
  }, [canGift, googleUser?.id]);

  const handleSendGift = async (giftKey) => {
    if (!socketRef.current) return { error: 'Not connected' };
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    try {
      const res = await socketRef.current.emitWithAck('sendGift', { conversationId: conversation.id, chatroomId: chatroomId || undefined, giftKey, idempotencyKey });
      if (res?.error) return { error: res.error };
      if (typeof res.balance === 'number') setWalletBalance(res.balance);
      return res;
    } catch (e) {
      return { error: e?.message || 'Failed to send gift' };
    }
  };

  const handleSendMessage = async ({ content, replyTo }) => {
    if (!content.trim() || !chatroomId || !socketRef.current) return;
    socketRef.current.emit('sendMessage', {
      chatroomId,
      conversationId: conversation.id,
      content,
      type: 'text',
      replyTo,
    });
    socketRef.current.emit('typingStop', { chatroomId });
  };

  const handleSendImage = async ({ imageUrl, replyTo }) => {
    if (!socketRef.current || !chatroomId) return;
    socketRef.current.emit('sendMessage', {
      chatroomId,
      conversationId: conversation.id,
      content: '',
      imageUrl,
      type: 'image',
      replyTo,
    });
  };

  const handleSendMedia = async ({ imageUrl, previewUrl, type, mediaPrice, replyTo }) => {
    if (!socketRef.current || !chatroomId) return;
    socketRef.current.emit('sendMessage', {
      chatroomId,
      conversationId: conversation.id,
      content: '',
      imageUrl,
      mediaPreviewUrl: previewUrl || undefined,
      type: type === 'video' ? 'video' : 'image',
      replyTo: replyTo || null,
      mediaPrice: mediaPrice || undefined,
    });
  };

  const handleUnlockMedia = async (messageId) => {
    if (!socketRef.current) return { error: 'Not connected' };
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    try {
      const res = await socketRef.current.emitWithAck('unlockMedia', {
        conversationId: conversation.id,
        chatroomId: chatroomId || undefined,
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
    const me = sessionRef.current?.id;
    if (!me) return;
    const current = messageReactions[messageId] || [];
    const hasReacted = current.includes(me);
    setMessageReactions(prev => ({
      ...prev,
      [messageId]: hasReacted ? current.filter(id => id !== me) : [...current, me],
    }));
    if (socketRef.current && chatroomId) {
      socketRef.current.emit('messageReaction', {
        chatroomId,
        messageId,
        reacted: !hasReacted,
      });
    }
  };

  const handleLeave = () => {
    try {
      if (socketRef.current) {
        socketRef.current.emit('leaveConversation', { conversationId: conversation.id });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    } catch {
      // ignore
    }
    onClose?.();
  };

  if (!session) {
    return (
      <div className="flex-1 bg-cream/95 backdrop-blur-lg flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-coral/30 border-t-coral rounded-full animate-spin" />
          <p className="text-navy font-medium">
            {joinError || 'Starting conversation...'}
          </p>
          {joinError && (
            <button
              onClick={handleLeave}
              className="mt-4 px-4 py-2 rounded-lg border border-navy/20 text-navy hover:bg-navy/5"
            >
              Back to inbox
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-cream">
      {joinError && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900 flex items-center justify-between gap-3">
          <span className="flex-1">{joinError}</span>
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600"
          >
            Retry
          </button>
        </div>
      )}
      <div className="flex-1 flex flex-col min-h-0">
        <ChatWindow
          session={session}
          partner={partner}
          messages={messages}
          chatroomId={chatroomId}
          typingUsers={typingUsers}
          partnerOnline={partnerOnline}
          liveConnected={liveJoined && !!chatroomId}
          ownSenderIds={ownSenderIds}
          showLeaveButton
          onLeave={handleLeave}
          onBack={handleLeave}
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
          partnerOfflineText="Waiting for your partner to join — anything you send is saved for them."
          emptyTitle="No messages yet"
          emptySubtitle="Say hello to continue the conversation!"
          loudspeakerScope="conversations"
          loudspeakerId={googleUser?.id}
        />
      </div>
    </div>
  );
}

export default SavedConversationChat;
