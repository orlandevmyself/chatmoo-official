const SESSION_KEY = 'chatmoo_session';
const GUEST_SESSION_KEY = 'chatmoo_guest_session';
const GUEST_CONVERSATIONS_KEY = 'chatmoo_guest_conversations';

export const sessionManager = {
  // Save authenticated user session
  saveSession(userData) {
    try {
      const sessionData = {
        ...userData,
        timestamp: Date.now(),
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      console.log('[SessionManager] Session saved:', sessionData);
    } catch (error) {
      console.error('[SessionManager] Error saving session:', error);
    }
  },

  // Get authenticated user session
  getSession() {
    try {
      const sessionData = localStorage.getItem(SESSION_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        console.log('[SessionManager] Session retrieved:', session);
        return session;
      }
      return null;
    } catch (error) {
      console.error('[SessionManager] Error getting session:', error);
      return null;
    }
  },

  // Clear authenticated user session
  clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
      console.log('[SessionManager] Session cleared');
    } catch (error) {
      console.error('[SessionManager] Error clearing session:', error);
    }
  },

  // Save guest session
  saveGuestSession(sessionData) {
    try {
      const guestData = {
        ...sessionData,
        timestamp: Date.now(),
      };
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guestData));
      console.log('[SessionManager] Guest session saved:', guestData);
    } catch (error) {
      console.error('[SessionManager] Error saving guest session:', error);
    }
  },

  // Get guest session
  getGuestSession() {
    try {
      const guestData = localStorage.getItem(GUEST_SESSION_KEY);
      if (guestData) {
        const session = JSON.parse(guestData);
        console.log('[SessionManager] Guest session retrieved:', session);
        return session;
      }
      return null;
    } catch (error) {
      console.error('[SessionManager] Error getting guest session:', error);
      return null;
    }
  },

  // Clear guest session
  clearGuestSession() {
    try {
      localStorage.removeItem(GUEST_SESSION_KEY);
      console.log('[SessionManager] Guest session cleared');
    } catch (error) {
      console.error('[SessionManager] Error clearing guest session:', error);
    }
  },

  // Save guest conversation
  saveGuestConversation(conversationData) {
    try {
      const guestConversations = JSON.parse(localStorage.getItem(GUEST_CONVERSATIONS_KEY) || '[]');
      const newConversation = {
        id: Date.now().toString(),
        ...conversationData,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: conversationData.messages?.length || 0,
      };
      guestConversations.unshift(newConversation);
      localStorage.setItem(GUEST_CONVERSATIONS_KEY, JSON.stringify(guestConversations));
      console.log('[SessionManager] Guest conversation saved:', newConversation);
      return newConversation;
    } catch (error) {
      console.error('[SessionManager] Error saving guest conversation:', error);
      return null;
    }
  },

  // Get guest conversations
  getGuestConversations() {
    try {
      const guestConversations = JSON.parse(localStorage.getItem(GUEST_CONVERSATIONS_KEY) || '[]');
      console.log('[SessionManager] Guest conversations retrieved:', guestConversations.length);
      return guestConversations;
    } catch (error) {
      console.error('[SessionManager] Error getting guest conversations:', error);
      return [];
    }
  },

  // Delete guest conversation
  deleteGuestConversation(conversationId) {
    try {
      const guestConversations = JSON.parse(localStorage.getItem(GUEST_CONVERSATIONS_KEY) || '[]');
      const filtered = guestConversations.filter(c => c.id !== conversationId);
      localStorage.setItem(GUEST_CONVERSATIONS_KEY, JSON.stringify(filtered));
      console.log('[SessionManager] Guest conversation deleted:', conversationId);
    } catch (error) {
      console.error('[SessionManager] Error deleting guest conversation:', error);
    }
  },

  // Clear all sessions
  clearAllSessions() {
    this.clearSession();
    this.clearGuestSession();
    localStorage.removeItem(GUEST_CONVERSATIONS_KEY);
  },

  // Check if session is valid (not expired, etc.)
  isSessionValid(session) {
    if (!session) return false;
    
    // Add expiration logic if needed (e.g., 7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const sessionAge = Date.now() - session.timestamp;
    
    return sessionAge < maxAge;
  },
};