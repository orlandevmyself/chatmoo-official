import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Send, X, User, GraduationCap, Venus, Mars, Transgender, MoreVertical, Forward, Image as ImageIcon, Heart, MessageCircle, Bookmark, Clock, Check, ArrowLeft, Gift, Video, Lock, LockOpen, Coins, Ban, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { getAvatarUrl, getDisplayName, getFlagUrl } from '../utils/conversationHelpers';
import { getAppSettings, CHAT_THEMES, FONT_SIZE_CLASSES } from '../utils/appSettings';
import GiftPicker from './GiftPicker';
import MediaLockDialog from './MediaLockDialog';
import LoudSpeaker from './LoudSpeaker';
import ReportUserDialog from './ReportUserDialog';
import { getGift } from '../utils/giftCatalog';
import { blockReportApi } from '../utils/blockReportApi';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Reusable chat surface used by both the random-match ChatPage and the
// saved-conversation chat. All transport (socket) lives in the parent;
// this component owns the composer state, message rendering and dialogs.
function ChatWindow({
  session,
  partner,
  messages,
  chatroomId,
  typingUsers = [],
  partnerOnline = null, // null = unknown (no presence), true/false = presence state
  liveConnected = true, // false = still joining the live channel; history still shown
  ownSenderIds = [],
  canSave = false,
  loudspeakerScope = null,
  loudspeakerId = null,
  showSaveButton = false,
  saveOfferSent = false,
  isSaving = false,
  onSave,
  pendingSaveOffer = null,
  showSaveOfferDialog = false,
  onRespondToSaveOffer,
  showMatchActions = false,
  partnerLeft = false,
  partnerOfflineText = 'Your partner has left the chat',
  partnerOfflineHint = 'Click Skip to find a new match',
  inputDisabled = false,
  inputPlaceholder = 'Type a message...',
  onSkip,
  onEnd,
  showLeaveButton = false,
  onLeave,
  onBack = null,
  messageReactions = {},
  onReact,
  onSendMessage,
  onSendImage,
  onSendMedia,
  onUnlockMedia,
  onSendGift,
  canGift = false,
  canLockMedia = false,
  walletBalance = null,
  onTypingStart,
  onTypingStop,
  emptyTitle = 'No messages yet',
  emptySubtitle = 'Start the conversation!',
}) {
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMessageActions, setShowMessageActions] = useState(null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [sendingGiftKey, setSendingGiftKey] = useState(null);
  const [giftError, setGiftError] = useState('');
  const [pendingMedia, setPendingMedia] = useState(null);
  const [showMediaLock, setShowMediaLock] = useState(false);
  const [unlockingKey, setUnlockingKey] = useState(null);
  const [unlockError, setUnlockError] = useState(null);
  const [pendingUnlock, setPendingUnlock] = useState(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [blockError, setBlockError] = useState('');
  const [blockSuccess, setBlockSuccess] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const isOwnMessage = (message) =>
    message.senderId === session.id || (ownSenderIds || []).includes(message.senderId);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatroomId) return;

    try {
      await onSendMessage?.({
        content: newMessage,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          senderId: replyingTo.senderId,
        } : null,
      });

      setNewMessage('');
      setReplyingTo(null);
      setIsTyping(false);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    } catch (error) {
      console.error('[ChatWindow] Error sending message:', error);
    }
  };

  const uploadMedia = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${API_URL}/upload/media`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only JPEG, PNG, GIF, WebP, MP4, WebM, and QuickTime are allowed.');
      return;
    }

    // Validate file size
    const maxSize = mediaType === 'video' ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(mediaType === 'video' ? 'File size exceeds 50MB limit' : 'File size exceeds 8MB limit');
      return;
    }

    if (canLockMedia && chatroomId) {
      setPendingMedia({ file, mediaType });
      setShowMediaLock(true);
      return;
    }

    setUploadingImage(true);

    try {
      const data = await uploadMedia(file);
      await onSendMedia?.({
        imageUrl: data.url,
        previewUrl: data.previewUrl,
        type: data.type || mediaType,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          senderId: replyingTo.senderId,
        } : null,
      });
      setReplyingTo(null);
    } catch (error) {
      console.error('[ChatWindow] Error uploading media:', error);
      alert('Failed to upload media. Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleMediaLockChoice = async (choice) => {
    const { file, mediaType } = pendingMedia || {};
    if (!file) return;
    setPendingMedia(null);
    setShowMediaLock(false);

    setUploadingImage(true);
    try {
      const data = await uploadMedia(file);
      await onSendMedia?.({
        imageUrl: data.url,
        previewUrl: data.previewUrl,
        type: data.type || mediaType,
        mediaPrice: choice.mode === 'locked' ? choice.items : undefined,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          senderId: replyingTo.senderId,
        } : null,
      });
      setReplyingTo(null);
    } catch (error) {
      console.error('[ChatWindow] Error uploading locked media:', error);
      alert('Failed to upload media. Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUnlock = async (message) => {
    if (!onUnlockMedia || unlockingKey) return;
    setUnlockingKey(message.id);
    setUnlockError(null);
    try {
      const res = await onUnlockMedia(message.id);
      if (res?.error) {
        setUnlockError({ id: message.id, message: res.error });
        setTimeout(() => setUnlockError(null), 4000);
      }
    } catch (error) {
      console.error('[ChatWindow] Error unlocking media:', error);
      setUnlockError({ id: message.id, message: 'Failed to unlock media. Please try again.' });
      setTimeout(() => setUnlockError(null), 4000);
    } finally {
      setUnlockingKey(null);
    }
  };

  const confirmUnlock = async () => {
    const message = pendingUnlock;
    if (!message) return;
    setPendingUnlock(null);
    await handleUnlock(message);
  };

  const handleTypingStart = () => {
    if (!isTyping && chatroomId) {
      setIsTyping(true);
      onTypingStart?.();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTypingStop?.();
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
    onReact?.(messageId);
    setShowMessageActions(null);
  };

  const handleGiftSelect = async (giftKey) => {
    if (!onSendGift || sendingGiftKey) return;
    setSendingGiftKey(giftKey);
    setGiftError('');
    try {
      const res = await onSendGift(giftKey);
      if (res?.error) {
        setGiftError(res.error);
      } else {
        setShowGiftPicker(false);
      }
    } catch (e) {
      setGiftError(e?.message || 'Failed to send gift');
    } finally {
      setSendingGiftKey(null);
    }
  };

  const parseGift = (message) => {
    if (message.type !== 'gift') return null;
    // New format: content is JSON with giftKey, label, coins, emoji
    // Fallback: giftMeta attached by server
    if (message.giftMeta) return message.giftMeta;
    try {
      const data = JSON.parse(message.content);
      if (data.giftKey || data.label) {
        const catalogGift = getGift(data.giftKey);
        return {
          key: data.giftKey,
          label: data.label || catalogGift?.label || 'Gift',
          coins: data.coins ?? catalogGift?.coins ?? 0,
          emoji: data.emoji || catalogGift?.emoji || '🎁',
          color: data.color || catalogGift?.color || '#FF6B4A',
        };
      }
    } catch {
      // content is not JSON, treat as plain
    }
    return { label: 'Gift', emoji: '🎁', coins: 0, color: '#FF6B4A' };
  };

  const hexToRgba = (hex, alpha) => {
    try {
      const h = hex.replace('#', '');
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch {
      return `rgba(255, 107, 74, ${alpha})`;
    }
  };

  const giftTier = (coins) => {
    if (coins >= 1000) return 'epic';
    if (coins >= 100) return 'big';
    if (coins >= 10) return 'medium';
    return 'small';
  };

  const giftTierAnim = (tier) => cn(
    "gift-pop",
    (tier === 'medium' || tier === 'big' || tier === 'epic') && "gift-glow"
  );

  const giftInnerAnim = (tier) => {
    if (tier === 'epic') return 'gift-epic-bounce';
    if (tier === 'big') return 'gift-big-bounce';
    return 'gift-float';
  };

  const giftSparkles = (tier) => {
    const count = tier === 'medium' ? 3 : tier === 'big' ? 5 : tier === 'epic' ? 7 : 0;
    return Array.from({ length: count }, (_, i) => ({
      left: `${18 + (i * 61) % 64}%`,
      top: `${8 + (i * 37) % 80}%`,
      delay: `${(i * 0.29) % 1.5}s`,
      size: tier === 'epic' ? 'text-xl' : tier === 'big' ? 'text-lg' : 'text-base',
    }));
  };

  const giftConfetti = (tier, color) => {
    const count = tier === 'epic' ? 14 : tier === 'big' ? 10 : 0;
    const palette = ['#FF6B4A', color, '#FFD166', '#4ECDC4', '#FF8FAB', '#A78BFA', '#F5F5F5'];
    return Array.from({ length: count }, (_, i) => ({
      cx: `${Math.round((Math.sin((i * 137.5) % 360) * 0.5 + 0.5) * 120 - 60) * -1}px`,
      cy: `${Math.round((Math.cos((i * 97.5) % 360) * 0.5 + 0.5) * 150 - 75) * -1}px`,
      bg: palette[i % palette.length],
      delay: `${(i * 0.17) % 2}s`,
      cd: `${2.2 + (i % 5) * 0.18}s`,
      w: `${6 + (i % 3) * 3}px`,
      h: `${10 + (i % 4) * 4}px`,
      rounded: i % 3 === 0,
    }));
  };

  const getMessageGrouping = (msgs, index) => {
    const currentMessage = msgs[index];
    const prevMessage = msgs[index - 1];
    const nextMessage = msgs[index + 1];

    const isGroupedWithPrev = prevMessage && prevMessage.senderId === currentMessage.senderId;
    const isGroupedWithNext = nextMessage && nextMessage.senderId === currentMessage.senderId;

    return {
      isFirst: !isGroupedWithPrev,
      isLast: !isGroupedWithNext,
      isMiddle: isGroupedWithPrev && isGroupedWithNext,
      showAvatar: !isGroupedWithPrev,
    };
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

  const composerDisabled = uploadingImage || inputDisabled || partnerLeft || !chatroomId;
  const showPartnerBanner = partnerLeft || partnerOnline === false;

  const handleBlockUser = async () => {
    if (!session?.userId || !partner?.id) return;
    try {
      setBlockError('');
      await blockReportApi.blockUser(session.userId, partner.id);
      setBlockSuccess('User blocked successfully');
      setTimeout(() => setBlockSuccess(''), 3000);
    } catch (err) {
      setBlockError(err.response?.data?.message || 'Failed to block user');
    }
  };

  const handleReportUser = () => {
    setShowReportDialog(true);
  };
  const prefs = getAppSettings();
  const theme = CHAT_THEMES[prefs.chatTheme] || CHAT_THEMES.default;

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: theme.chat }}>
      {/* Header */}
      <div className="shadow-lg" style={{ background: theme.header }}>
        <div className="max-w-4xl mx-auto px-3 md:px-4 py-3 md:py-4 flex items-center gap-3 md:gap-4">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="bg-white/20 text-white hover:bg-white/30"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white relative flex-shrink-0">
            <img
              src={getAvatarUrl(partner?.username, partner?.avatar, partner?.avatarSeed)}
              alt={partner?.username}
              className="w-full h-full object-cover"
            />
            {partnerOnline !== null && (
              <span
                className={cn(
                  "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white",
                  partnerOnline ? "bg-green-500" : "bg-gray-400"
                )}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base md:text-lg flex items-center flex-wrap gap-2">
              {getDisplayName(partner)}
              <Badge className={cn(
                partner?.isAuthenticated ? "bg-white/25 text-white" : "bg-navy/40 text-white"
              )}>
                {partner?.isAuthenticated ? 'User' : 'Guest'}
              </Badge>
              {partnerOnline !== null && (
                <Badge className={cn(
                  "ml-2",
                  partnerOnline ? "bg-green-500 text-white" : "bg-white/30 text-white"
                )}>
                  {partnerOnline ? 'Online' : 'Offline'}
                </Badge>
              )}
              {!liveConnected && (
                <Badge variant="outline" className="ml-2 bg-white/20 text-white border-white/30">
                  Connecting…
                </Badge>
              )}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {partner?.country && (
                <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                  {partner.countryCode ? (
                    <img
                      src={getFlagUrl(partner.countryCode)}
                      alt={partner.country}
                      className="w-6 h-4 object-cover rounded mr-1"
                    />
                  ) : (
                    <span className="mr-1">🌍</span>
                  )}
                  {partner.country}
                </Badge>
              )}
              {partner?.gender && (
                <Badge variant="secondary" className={cn(getGenderColor(partner.gender), "text-white")}>
                  {getGenderIcon(partner.gender)}
                  <span className="ml-1">{partner.gender.charAt(0).toUpperCase() + partner.gender.slice(1)}</span>
                </Badge>
              )}
              {partner?.university && (
                <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                  <GraduationCap className="w-3 h-3 mr-1" />
                  {partner.university}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {showMatchActions && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSkip}
                className="bg-white/20 text-white hover:bg-white/30"
              >
                <Forward className="w-5 h-5" />
              </Button>
            )}
            {!partnerLeft && (
              <>
                {showSaveButton && messages.length > 0 && !saveOfferSent && canSave && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSave}
                    disabled={isSaving}
                    className="bg-white/20 text-white hover:bg-white/30"
                    title="Save conversation"
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Bookmark className="w-5 h-5" />
                    )}
                  </Button>
                )}
                {canGift && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowGiftPicker(true)}
                    className="bg-white/20 text-white hover:bg-white/30"
                    title="Send gift"
                  >
                    <Gift className="w-5 h-5" />
                  </Button>
                )}
                {showMatchActions && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onEnd}
                    className="bg-white/20 text-white hover:bg-white/30"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
                {showLeaveButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onLeave}
                    className="bg-white/20 text-white hover:bg-white/30"
                    title="Leave conversation"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBlockUser}
                  className="bg-white/20 text-white hover:bg-white/30"
                  title="Block user"
                >
                  <Ban className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReportUser}
                  className="bg-white/20 text-white hover:bg-white/30"
                  title="Report user"
                >
                  <AlertTriangle className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {loudspeakerScope && <LoudSpeaker scope={loudspeakerScope} userId={loudspeakerId} />}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-navy/50">
              <div className="w-20 h-20 bg-navy/10 rounded-full flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-navy/30" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-navy">{emptyTitle}</h3>
              <p className="text-navy/70">{emptySubtitle}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => {
                const grouping = getMessageGrouping(messages, index);
                const ownMessage = isOwnMessage(message);
                const reacted = messageReactions[message.id]?.includes(session.id);
                const reactionCount = messageReactions[message.id]?.length || 0;
                const gift = message.type === 'gift' ? parseGift(message) : null;

                if (gift) {
                  const tier = giftTier(gift.coins);
                  const glow = hexToRgba(gift.color, tier === 'epic' ? 0.9 : tier === 'big' ? 0.8 : 0.7);
                  const ring = hexToRgba(gift.color, 0.85);
                  const ray = hexToRgba(gift.color, 0.35);
                  const sizeClass = `gift-tier-${tier}`;
                  const sparkles = giftSparkles(tier);
                  const confetti = tier === 'epic' ? giftConfetti(tier, gift.color) : [];
                  return (
                    <div key={message.id} className="flex justify-center py-4 animate-gift-row">
                      <div className="flex flex-col items-center gap-1 select-none">
                        <p className="text-xs md:text-sm font-semibold text-navy/70 tracking-wide flex items-center gap-2">
                          {ownMessage ? (
                            <>
                              <span className="text-navy/90">You sent</span>
                              <span className="font-bold" style={{ color: gift.color }}>{gift.label}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-navy/90">{getDisplayName(partner)}</span>
                              <span>sent</span>
                              <span className="font-bold" style={{ color: gift.color }}>{gift.label}</span>
                            </>
                          )}
                          <span className="inline-flex items-center gap-1 bg-amber-400 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                            {gift.coins} coins
                          </span>
                        </p>
                        <div
                          className={cn(
                            "relative flex items-center justify-center",
                            tier === 'epic' ? "w-44 h-44" : tier === 'big' ? "w-36 h-36" : tier === 'medium' ? "w-28 h-28" : "w-24 h-24"
                          )}
                          style={{ '--gift-glow': glow, '--gift-ring': ring, '--gift-ray-color': ray }}
                        >
                          {tier === 'epic' && <div className="gift-rays" />}
                          {(tier === 'big' || tier === 'epic') && (
                            <>
                              <div className="gift-ring" />
                              <div className="gift-ring" style={{ animationDelay: '0.9s' }} />
                            </>
                          )}
                          {sparkles.map((s, i) => (
                            <span
                              key={i}
                              className={cn("gift-sparkle", s.size)}
                              style={{ left: s.left, top: s.top, animationDelay: s.delay }}
                            >
                              ✦
                            </span>
                          ))}
                          {confetti.map((c, i) => (
                            <span
                              key={i}
                              className="gift-confetti"
                              style={{
                                width: c.w,
                                height: c.h,
                                backgroundColor: c.bg,
                                borderRadius: c.rounded ? '9999px' : '2px',
                                '--cx': c.cx,
                                '--cy': c.cy,
                                '--delay': c.delay,
                                '--cd': c.cd,
                              }}
                            />
                          ))}
                          <span className={cn("gift-emoji", sizeClass, giftTierAnim(tier), "drop-shadow-[0_8px_12px_rgba(0,0,0,0.25)]")}>
                            <span className={cn("inline-block", giftInnerAnim(tier))}>{gift.emoji}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3 animate-fade-in",
                      ownMessage ? "justify-end" : "justify-start"
                    )}
                  >
                    {!ownMessage && grouping.showAvatar && prefs.showAvatars && (
                      <div className="w-10 h-10 rounded-full overflow-hidden shadow-md border-2 border-softPurple flex-shrink-0">
                        <img
                          src={getAvatarUrl(partner?.username, partner?.avatar, partner?.avatarSeed)}
                          alt={partner?.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {!ownMessage && !grouping.showAvatar && prefs.showAvatars && (
                      <div className="w-10 flex-shrink-0" />
                    )}
                    <div className="max-w-[75%]">
                      <Card className={cn(
                        "shadow-md relative group",
                        ownMessage ? "bg-coral text-white" : "bg-white",
                        grouping.isFirst && "rounded-t-2xl",
                        grouping.isLast && "rounded-b-2xl",
                        grouping.isMiddle && "rounded-none",
                        grouping.isFirst && grouping.isLast && "rounded-2xl"
                      )}>
                        <CardContent className="p-3">
                          {message.replyTo && (
                            <div className={cn(
                              "text-xs mb-2 p-2 rounded-lg opacity-80",
                              ownMessage ? "bg-white/20" : "bg-navy/10"
                            )}>
                              <div className="flex items-center gap-1 mb-1">
                                <MessageCircle className="w-3 h-3" />
                                <span className="font-medium">
                                  {message.replyTo.senderId === session.id ? 'You' : getDisplayName(partner)}
                                </span>
                              </div>
                              <p className="truncate">{message.replyTo.content}</p>
                            </div>
                          )}
                          {(() => {
                            const isMediaMsg = message.type === 'image' || message.type === 'video';
                            const isLocked = !!message.mediaPrice && !message.mediaUnlockedAt;
                            const hasUrl = !!message.imageUrl;

                            // Locked media for the recipient (URL is withheld until paid).
                            if (isMediaMsg && isLocked && !ownMessage && !hasUrl) {
                              const price = message.mediaPrice;
                              const totalCoins = price?.priceCoins ?? 0;
                              const hasPreview = message.type === 'image' && !!message.mediaPreviewUrl;
                              return (
                                <div className="rounded-xl overflow-hidden border-2 border-dashed border-amber-400/70 bg-amber-50/60 mb-2">
                                  {hasPreview ? (
                                    <div className="relative h-40 overflow-hidden">
                                      <img
                                        src={message.mediaPreviewUrl}
                                        alt="Locked media preview"
                                        className="w-full h-full object-cover scale-110 blur-xl"
                                      />
                                      <div className="absolute inset-0 bg-navy/30" />
                                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-1.5">
                                        <span className="w-10 h-10 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
                                          <Lock className="w-5 h-5" />
                                        </span>
                                        <span className="text-xs font-semibold flex items-center gap-1">
                                          {message.type === 'video' ? 'Video' : 'Photo'} locked
                                        </span>
                                        <span className="text-[10px] text-white/70">blurred preview</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="h-28 flex flex-col items-center justify-center text-navy/70 gap-1">
                                      {message.type === 'video' ? (
                                        <Video className="w-8 h-8 text-amber-500/70" />
                                      ) : (
                                        <ImageIcon className="w-8 h-8 text-amber-500/70" />
                                      )}
                                      <span className="text-xs font-semibold flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-amber-500" />
                                        {message.type === 'video' ? 'Video' : 'Photo'} locked
                                      </span>
                                    </div>
                                  )}
                                  <div className="bg-white/90 px-3 py-2">
                                    <div className="flex flex-wrap gap-1 items-center mb-2">
                                      {(price?.items || []).map((it) => (
                                        <span key={it.key} className="inline-flex items-center gap-0.5 bg-white border border-navy/10 rounded-full px-2 py-0.5 text-[11px] font-medium text-navy">
                                          <span>{getGift(it.key)?.emoji}</span> {it.qty}x
                                        </span>
                                      ))}
                                      <span className="inline-flex items-center gap-1 bg-amber-400 text-white rounded-full px-2 py-0.5 text-[11px] font-bold">
                                        {totalCoins} coins
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      disabled={unlockingKey === message.id}
                                      onClick={() => setPendingUnlock(message)}
                                      className="w-full bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90"
                                    >
                                      {unlockingKey === message.id ? (
                                        <span className="inline-flex items-center gap-1">
                                          <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                          Unlocking...
                                        </span>
                                      ) : (
                                        <><Lock className="w-3 h-3 mr-1" /> Unlock for {totalCoins} coins</>
                                      )}
                                    </Button>
                                    {unlockError?.id === message.id && (
                                      <p className="text-xs text-red-500 mt-1.5 text-center">{unlockError.message}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            // Media with a URL (free, own locked media, or unlocked).
                            if (isMediaMsg && hasUrl) {
                              return (
                                <div className="relative mb-2">
                                  {message.type === 'video' ? (
                                    <video
                                      src={message.imageUrl}
                                      controls
                                      preload="metadata"
                                      className="max-w-full max-h-80 rounded-lg"
                                    />
                                  ) : (
                                    <img
                                      src={message.imageUrl}
                                      alt="Shared media"
                                      className="max-w-full max-h-80 rounded-lg"
                                    />
                                  )}
                                  {isLocked && (
                                    <span className={cn(
                                      "absolute top-2 left-2 inline-flex items-center gap-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur",
                                      ownMessage ? "bg-coral/80" : "bg-amber-500/80"
                                    )}>
                                      <Lock className="w-3 h-3" />
                                      {ownMessage ? `You set ${message.mediaPrice?.priceCoins ?? 0} coins` : `${message.mediaPrice?.priceCoins ?? 0} coins`}
                                    </span>
                                  )}
                                  {message.mediaPrice && message.mediaUnlockedAt && (
                                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-emerald-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur">
                                      <LockOpen className="w-3 h-3" /> Unlocked
                                    </span>
                                  )}
                                </div>
                              );
                            }

                            // Plain text.
                            return <p className={cn("font-medium", FONT_SIZE_CLASSES[prefs.fontSize])}>{message.content}</p>;
                          })()}
                          {(prefs.showTimestamps !== false || (messageReactions[message.id] && messageReactions[message.id].length > 0)) && (
                          <div className="flex items-center justify-between mt-1">
                            {prefs.showTimestamps !== false ? (
                              <p className={cn(
                                "text-xs opacity-80",
                                ownMessage ? "text-white/80" : "text-navy/50"
                              )}>
                                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            ) : (
                              <span />
                            )}
                            {messageReactions[message.id] && messageReactions[message.id].length > 0 && (
                              <div className="flex items-center gap-1 ml-2">
                                <Heart className={cn(
                                  "w-4 h-4",
                                  ownMessage ? "fill-white text-white" : "fill-red-500 text-red-500"
                                )} />
                                <span className={cn(
                                  "text-xs font-medium",
                                  ownMessage ? "text-white" : "text-red-500"
                                )}>
                                  {messageReactions[message.id].length}
                                </span>
                              </div>
                            )}
                          </div>
                          )}
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
                          ownMessage ? "justify-end" : "justify-start"
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
                              reacted
                                ? "bg-red-500 text-white border-red-500"
                                : "bg-white border-navy/20 hover:bg-navy/5"
                            )}
                          >
                            <Heart className={cn(
                              "w-4 h-4 inline mr-1",
                              reacted ? "fill-white text-white" : "text-navy"
                            )} />
                            {reacted ? 'Liked' : 'Like'}
                            {reactionCount > 0 && (
                              <span className="ml-1 text-xs">({reactionCount})</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    {ownMessage && grouping.showAvatar && prefs.showAvatars && (
                      <div className="w-10 h-10 rounded-full overflow-hidden shadow-md border-2 border-coral flex-shrink-0">
                        <img
                          src={getAvatarUrl(session.username, session.avatar, session.avatarSeed)}
                          alt={session.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {ownMessage && !grouping.showAvatar && prefs.showAvatars && (
                      <div className="w-10 flex-shrink-0" />
                    )}
                  </div>
                );
              })}

              {prefs.typingIndicators && typingUsers.length > 0 && (
                <div className="flex gap-3 justify-start animate-slide-up">
                  <div className="w-10 h-10 rounded-full overflow-hidden shadow-md border-2 border-softPurple flex-shrink-0">
                    <img
                      src={getAvatarUrl(partner?.username, partner?.avatar, partner?.avatarSeed)}
                      alt={partner?.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Card className="bg-navy/10 shadow-md rounded-2xl rounded-tl-sm">
                    <CardContent className="p-3">
                      <p className="text-sm text-navy/70 font-medium">
                        {getDisplayName(partner)} is typing...
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
          {giftError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2 mb-3 text-sm text-red-600 flex items-center justify-between">
              <span>{giftError}</span>
              <button onClick={() => setGiftError('')} className="p-1"><X className="w-4 h-4" /></button>
            </div>
          )}
          {showPartnerBanner && (
            <div className="bg-navy/10 border border-navy/20 rounded-lg p-3 mb-3 text-center">
              <p className="text-navy font-medium text-sm">{partnerOfflineText}</p>
              {showMatchActions && partnerLeft && (
                <p className="text-navy/70 text-xs mt-1">{partnerOfflineHint}</p>
              )}
            </div>
          )}
          {replyingTo && (
            <div className="bg-navy/10 rounded-lg p-3 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <MessageCircle className="w-4 h-4 text-navy/50" />
                <div className="flex-1">
                  <p className="text-xs text-navy/70 font-medium">
                    Replying to {replyingTo.senderId === session.id ? 'yourself' : getDisplayName(partner)}
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
          <form onSubmit={handleSendMessage} className="flex gap-2 md:gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={composerDisabled}
              variant="outline"
              className="rounded-xl h-12 px-3 md:px-4 border-navy/20 text-navy hover:bg-navy/5 flex-shrink-0"
              title={canLockMedia ? "Send photo or video (set unlock price)" : "Send photo or video"}
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
            {canGift && (
              <Button
                type="button"
                onClick={() => setShowGiftPicker(true)}
                disabled={composerDisabled}
                variant="outline"
                className="rounded-xl h-12 px-3 md:px-4 border-navy/20 text-navy hover:bg-navy/5 flex-shrink-0"
                title="Send gift"
              >
                <Gift className="w-5 h-5" />
              </Button>
            )}
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              placeholder={!chatroomId ? "Connecting..." : (partnerLeft && showMatchActions ? "Partner has left - click Skip to find a new match" : inputPlaceholder)}
              className="flex-1 rounded-xl"
              disabled={composerDisabled}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || composerDisabled}
              className="rounded-xl h-12 px-4 md:px-6 bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90 shadow-lg flex-shrink-0"
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

      {/* Gift Picker */}
      {showGiftPicker && (
        <GiftPicker
          balanceMinor={walletBalance ?? 0}
          sendingKey={sendingGiftKey}
          onSelect={handleGiftSelect}
          onClose={() => { setShowGiftPicker(false); setGiftError(''); }}
        />
      )}
      {giftError && showGiftPicker && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-500 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          {giftError}
        </div>
      )}

      {/* Media Lock Dialog */}
      {showMediaLock && pendingMedia && (
        <MediaLockDialog
          mediaType={pendingMedia.mediaType}
          onChoose={handleMediaLockChoice}
          onClose={() => {
            setShowMediaLock(false);
            setPendingMedia(null);
          }}
        />
      )}

      {/* Unlock Confirmation Dialog */}
      {pendingUnlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <CardHeader className="relative pb-2">
              <CardTitle className="text-xl font-bold text-navy flex items-center gap-2">
                <LockOpen className="w-5 h-5 text-emerald-500" />
                Unlock {pendingUnlock.type === 'video' ? 'video' : 'photo'}?
              </CardTitle>
              <p className="text-sm text-navy/60 mt-1">
                This will be charged to your wallet. You can't undo this.
              </p>
              <button
                onClick={() => setPendingUnlock(null)}
                className="absolute top-4 right-4 p-1.5 hover:bg-navy/5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-navy/50" />
              </button>
            </CardHeader>
            <CardContent>
              {(pendingUnlock.mediaPrice?.items || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center mb-3">
                  {(pendingUnlock.mediaPrice?.items || []).map((it) => (
                    <span key={it.key} className="inline-flex items-center gap-0.5 bg-white border border-navy/10 rounded-full px-2 py-0.5 text-[11px] font-medium text-navy">
                      <span>{getGift(it.key)?.emoji}</span> {it.qty}x
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1 bg-amber-400 text-white rounded-full px-2 py-0.5 text-[11px] font-bold">
                    {pendingUnlock.mediaPrice?.priceCoins ?? 0} coins
                  </span>
                </div>
              )}
              {typeof walletBalance === 'number' && (
                <p className="text-sm text-navy/70 mb-4">
                  <Coins className="w-4 h-4 text-amber-500 inline mr-1" />
                  Your balance: <span className="font-semibold">{(walletBalance || 0)} coins</span>
                </p>
              )}
              {pendingUnlock.mediaPreviewUrl && pendingUnlock.type !== 'video' && (
                <img
                  src={pendingUnlock.mediaPreviewUrl}
                  alt="Locked media preview"
                  className="w-full rounded-lg blur-md opacity-80 mb-4 pointer-events-none select-none"
                />
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPendingUnlock(null)}
                  className="flex-1 border-navy/20 text-navy hover:bg-navy/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmUnlock}
                  disabled={unlockingKey === pendingUnlock.id}
                  className="flex-1 bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90"
                >
                  {unlockingKey === pendingUnlock.id ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Unlocking...
                    </span>
                  ) : (
                    <><Lock className="w-4 h-4 mr-1" /> Unlock for {pendingUnlock.mediaPrice?.priceCoins ?? 0} coins</>
                  )}
                </Button>
              </div>
              {unlockError?.id === pendingUnlock.id && (
                <p className="text-xs text-red-500 mt-2 text-center">{unlockError.message}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Save Offer Dialog */}
      {showSaveOfferDialog && pendingSaveOffer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-navy">Save Conversation?</CardTitle>
              <p className="text-navy/70">
                {pendingSaveOffer.offeredBy} wants to save this conversation ({pendingSaveOffer.messageCount} messages).
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="bg-navy/10 rounded-lg p-3">
                  <p className="text-sm text-navy">
                    <Clock className="w-4 h-4 inline mr-1" />
                    If you accept, both of you can:
                  </p>
                  <ul className="text-sm text-navy/70 mt-2 ml-4 list-disc">
                    <li>View this conversation in your inbox</li>
                    <li>Reconnect and continue chatting</li>
                    <li>Keep the conversation history</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => onRespondToSaveOffer?.('accepted')}
                    className="flex-1 bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    onClick={() => onRespondToSaveOffer?.('declined')}
                    variant="outline"
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Block/Report Status Messages */}
      {blockError && (
        <div className="fixed bottom-4 left-4 right-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 shadow-lg">
          {blockError}
        </div>
      )}
      {blockSuccess && (
        <div className="fixed bottom-4 left-4 right-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 shadow-lg">
          {blockSuccess}
        </div>
      )}

      {/* Report User Dialog */}
      {showReportDialog && partner && (
        <ReportUserDialog
          userId={session?.userId}
          reportedUser={partner}
          onClose={() => setShowReportDialog(false)}
          onReportSuccess={() => {
            setShowReportDialog(false);
          }}
        />
      )}
    </div>
  );
}

export default ChatWindow;
