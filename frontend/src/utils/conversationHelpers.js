export const getAvatarUrl = (username, avatarStyle, avatarSeed) => {
  const style = avatarStyle || 'adventurer';
  const seed = avatarSeed || username || 'default';
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
};

export const getFlagUrl = (countryCode) => {
  if (!countryCode) return null;
  return `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`;
};

export const parsePartnerInfo = (partnerInfo) => {
  try {
    return partnerInfo ? JSON.parse(partnerInfo) : {};
  } catch {
    return {};
  }
};

// Display rules:
// - Authenticated person -> displayName (live, it can change any time),
//   username stays the stable identity.
// - Guest -> username from the guest form (guests have no displayName).
export const getDisplayName = (person) =>
  person?.displayName || person?.username || 'Anonymous';

// Viewer-relative partner: a shared AUTH <-> AUTH conversation is stored once
// (owner = userId, partner = partnerUserId). When the partner side views it,
// the "partner" to display is the owner, and vice versa.
export const getConversationPartner = (conversation, meUserId) => {
  if (!conversation) return null;
  const info = parsePartnerInfo(conversation.partnerInfo);
  const iAmOwner = !!meUserId && !!conversation.userId && conversation.userId === meUserId;

  if (iAmOwner) {
    // Live auth-partner profile (conversation.partnerUser) wins over the
    // save-time snapshot so displayName updates are reflected.
    const live = conversation.partnerUser || null;
    const username = live?.username || conversation.partnerUsername || 'Anonymous';
    return {
      username,
      displayName: live?.displayName || info.displayName || username,
      country: info.country,
      countryCode: info.countryCode,
      university: info.university,
      gender: info.gender,
      avatar: info.avatar || 'adventurer',
      avatarSeed: info.avatarSeed,
      userId: conversation.partnerUserId || undefined,
      sessionId: conversation.partnerGuestId || undefined,
      isAuthenticated: !!conversation.partnerUserId,
    };
  }

  const owner = conversation.user || {};
  const ownerUsername = owner.username || owner.displayName || conversation.partnerUsername || 'Anonymous';
  return {
    username: ownerUsername,
    displayName: owner.displayName || ownerUsername,
    country: undefined,
    countryCode: undefined,
    university: undefined,
    gender: undefined,
    avatar: owner.avatar || 'adventurer',
    avatarSeed: owner.avatarSeed,
    userId: conversation.userId || undefined,
    sessionId: undefined,
    isAuthenticated: true,
  };
};

// Merge incoming messages into the current list, deduping by id and sorting by time
export const mergeMessagesById = (prev, incoming) => {
  const map = new Map();
  for (const m of [...(prev || []), ...(incoming || [])]) {
    if (m && m.id) map.set(m.id, m);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
};

// Map raw SavedMessages (replyToId only) to the live chat message shape
// (replyTo object), so history renders instantly without waiting for a socket.
export const mapSavedToChat = (saved, chatroomId, conversationId) => {
  const list = saved || [];
  const byId = new Map(list.map((m) => [m.id, m]));
  return list.map((m) => {
    const replied = m.replyToId ? byId.get(m.replyToId) : null;
    return {
      id: m.id,
      chatroomId: chatroomId || null,
      conversationId: conversationId || null,
      senderId: m.senderId,
      senderUsername: m.senderUsername,
      content: m.content,
      imageUrl: m.imageUrl,
      type: m.type || 'text',
      replyTo: replied
        ? { id: replied.id, content: replied.content, senderId: replied.senderId }
        : null,
      createdAt: m.createdAt,
    };
  });
};

// Sender ids that belong to the viewer. Old sessions are recognized via the
// viewer's username; session ids are only trusted for the viewer's own side
// (owner: currentUserId, guest viewing own row: matching guest session id).
export const computeOwnSenderIds = (conversation, myUsername, mySessionId, meUserId) => {
  const set = new Set();
  if (mySessionId) set.add(mySessionId);
  const iAmOwner = !!meUserId && !!conversation?.userId && conversation.userId === meUserId;
  if (iAmOwner && conversation?.currentUserId) set.add(conversation.currentUserId);
  if (conversation?.guestId && conversation.guestId === mySessionId) set.add(conversation.guestId);
  if (conversation?.partnerGuestId && conversation.partnerGuestId === mySessionId) {
    set.add(conversation.partnerGuestId);
  }
  for (const m of conversation?.messages || []) {
    if (m.senderUsername && myUsername && m.senderUsername === myUsername) {
      set.add(m.senderId);
    }
  }
  return Array.from(set);
};
