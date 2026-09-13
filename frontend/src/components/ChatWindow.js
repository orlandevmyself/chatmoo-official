import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Send, X, User, GraduationCap, Venus, Mars, Transgender, MoreVertical, Forward, Image as ImageIcon, Heart, MessageCircle, Bookmark, Clock, Check, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { getAvatarUrl, getDisplayName, getFlagUrl } from '../utils/conversationHelpers';
import { getAppSettings, CHAT_THEMES, FONT_SIZE_CLASSES } from '../utils/appSettings';

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
      if (chatroomId) {
        await onSendImage?.({
          imageUrl,
          replyTo: replyingTo ? {
            id: replyingTo.id,
            content: replyingTo.content,
            senderId: replyingTo.senderId,
          } : null,
        });
      }

      setReplyingTo(null);
    } catch (error) {
      console.error('[ChatWindow] Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
              </>
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
                          {message.type === 'image' && message.imageUrl ? (
                            <img
                              src={message.imageUrl}
                              alt="Shared image"
                              className="max-w-full rounded-lg mb-2"
                            />
                          ) : (
                            <p className={cn("font-medium", FONT_SIZE_CLASSES[prefs.fontSize])}>{message.content}</p>
                          )}
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
              onChange={handleImageUpload}
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={composerDisabled}
              variant="outline"
              className="rounded-xl h-12 px-3 md:px-4 border-navy/20 text-navy hover:bg-navy/5 flex-shrink-0"
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
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
    </div>
  );
}

export default ChatWindow;
