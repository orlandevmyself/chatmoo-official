/**
 * Type definitions and interfaces for the Guest Cleanup System
 */

/**
 * Result of cleaning up a guest when they authenticate
 * (Scenario 1: Guest converts to real user)
 */
export interface AuthenticationCleanupResult {
  guestUserDeleted: boolean;
  sessionsDeleted: number;
  conversationsPreserved: number;
}

/**
 * Result of cleaning up a guest when session ends
 * (Scenario 2: Session ends without saving conversations)
 */
export interface SessionlessGuestCleanupResult {
  sessionDeleted: boolean;
  savedConversations: number;
  chatrooms: number;
}

/**
 * Result of cleaning up inactive guest accounts
 * (Scenario 3: Scheduled cleanup job)
 */
export interface InactiveGuestCleanupResult {
  totalGuestAccounts: number;
  deletedForInactivity: number;
  preservedWithConversations: number;
  error?: string;
}

/**
 * Result of explicitly deleting a guest account
 * (Scenario 4: User-initiated account deletion)
 */
export interface ExplicitGuestDeleteResult {
  success: boolean;
  message: string;
  deleted: {
    user: boolean;
    sessions: number;
    conversations: number;
    messages: number;
  };
}

/**
 * Guest account information retrieved for display/debugging
 */
export interface GuestAccountInfo {
  isGuest: boolean;
  email?: string;
  createdAt?: Date;
  sessionCount?: number;
  savedConversationCount?: number;
  inactiveForMs?: number; // milliseconds since creation
}

/**
 * Request body for POST /auth/reset-guest
 */
export interface ResetGuestRequest {
  userId: string;
  deleteSavedConversations?: boolean;
}

/**
 * Response from POST /auth/reset-guest
 */
export interface ResetGuestResponse extends ExplicitGuestDeleteResult {}

/**
 * Request body for POST /auth/guest-info
 */
export interface GetGuestInfoRequest {
  userId: string;
}

/**
 * Response from POST /auth/guest-info
 */
export interface GetGuestInfoResponse extends GuestAccountInfo {}

/**
 * Options for the cleanupSessionlessGuestData method
 */
export interface SessionCleanupOptions {
  // Can be extended with additional options in the future
}

/**
 * Options for the deleteGuestAccountExplicitly method
 */
export interface ExplicitDeleteOptions {
  deleteSavedConversations?: boolean;
}

/**
 * Guest cleanup statistics (for monitoring/reporting)
 */
export interface GuestCleanupStats {
  totalGuestAccounts: number;
  totalSessions: number;
  totalConversations: number;
  accountsOlderThan24h: number;
  accountsWithoutConversations: number;
  lastCleanupTime?: Date;
  nextCleanupTime?: Date;
}

/**
 * Cleanup event logged to monitoring system
 */
export interface GuestCleanupEvent {
  scenario: 1 | 2 | 3 | 4;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  deletedCount?: number;
  preservedCount?: number;
  errorMessage?: string;
}

/**
 * User model shape (simplified for type safety)
 * This should match your actual Prisma User model
 */
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
  updatedAt: Date;
  banned?: boolean;
  // ... other fields from your User model
}

/**
 * Session model shape (simplified for type safety)
 */
export interface Session {
  id: string;
  userId: string;
  username: string;
  status: 'active' | 'matched' | 'ended' | 'inactive';
  chatroomId?: string;
  createdAt: Date;
  updatedAt: Date;
  // ... other fields from your Session model
}

/**
 * SavedConversation model shape (simplified for type safety)
 */
export interface SavedConversation {
  id: string;
  userId?: string;
  guestId?: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  // ... other fields from your SavedConversation model
}
