import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * GuestCleanupService handles the lifecycle and cleanup of guest accounts.
 * Guest accounts are temporary user accounts with:
 * - role: 'guest'
 * - email format: "[prefix]@chatmoo.com"
 * - no password authentication (anonymous/session-based)
 *
 * Cleanup scenarios:
 * 1. Guest converts to authenticated user
 * 2. Session ends without saving conversations
 * 3. Guest account is inactive (24+ hours old)
 * 4. User explicitly resets/leaves (manual cleanup)
 */
@Injectable()
export class GuestCleanupService {
  private readonly logger = new Logger('GuestCleanupService');

  constructor(private prisma: PrismaService) {}

  /**
   * Identifies if a user is a guest account
   * Guest accounts have role='guest' and email matching "@chatmoo.com" pattern
   */
  private isGuestAccount(email: string, role: string): boolean {
    return (
      role === 'guest' &&
      email.endsWith('@chatmoo.com')
    );
  }

  /**
   * Scenario 1: Delete guest account when they authenticate (convert to real user)
   *
   * Called when a guest account upgrades to a real user via Google OAuth.
   * This removes the temporary guest account while preserving their conversation history.
   *
   * Example flow:
   * - Guest creates account, gets assigned guestId="{uuid}@chatmoo.com"
   * - Guest authenticates with Google (email: user@gmail.com)
   * - New User created with email: user@gmail.com
   * - OLD guest User record is deleted via this method
   * - SavedConversations linked to guestId are preserved (not deleted)
   *
   * @param guestUserId - The guest user ID to be deleted
   * @param newAuthenticatedUserId - The new authenticated user ID (optional, for logging)
   * @returns Number of deleted sessions and related data
   */
  async cleanupGuestOnAuthentication(
    guestUserId: string,
    newAuthenticatedUserId?: string,
  ): Promise<{
    guestUserDeleted: boolean;
    sessionsDeleted: number;
    conversationsPreserved: number;
  }> {
    this.logger.log(
      `[Scenario 1] Cleaning up guest ${guestUserId} due to authentication` +
        (newAuthenticatedUserId ? ` (upgrading to ${newAuthenticatedUserId})` : ''),
    );

    try {
      // Verify this is actually a guest account
      const guestUser = await this.prisma.user.findUnique({
        where: { id: guestUserId },
      } as any);

      if (!guestUser || !this.isGuestAccount(guestUser.email, guestUser.role)) {
        this.logger.warn(
          `[Scenario 1] User ${guestUserId} is not a guest account, skipping cleanup`,
        );
        return {
          guestUserDeleted: false,
          sessionsDeleted: 0,
          conversationsPreserved: 0,
        };
      }

      // Count sessions and conversations before deletion
      const sessionsCount = await this.prisma.session.count({
        where: { userId: guestUserId },
      });

      const conversationsCount = await this.prisma.savedConversation.count({
        where: { guestId: guestUserId },
      });

      // Delete the guest user (cascades to sessions, user settings, wallet)
      // SavedConversations with guestId are NOT deleted (preserved for history)
      await this.prisma.user.delete({
        where: { id: guestUserId },
      } as any);

      this.logger.log(
        `[Scenario 1] Successfully deleted guest ${guestUserId}: ` +
          `${sessionsCount} sessions deleted, ${conversationsCount} conversations preserved`,
      );

      return {
        guestUserDeleted: true,
        sessionsDeleted: sessionsCount,
        conversationsPreserved: conversationsCount,
      };
    } catch (error) {
      this.logger.error(
        `[Scenario 1] Error cleaning up guest ${guestUserId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Scenario 2: Delete guest account when session ends without saving conversations
   *
   * Called when a guest's session ends (status: 'ended' or 'inactive') and they haven't
   * saved any conversations. This performs immediate cleanup of temporary data.
   *
   * Example flow:
   * - Guest matches with someone, chatroom is created
   * - Guest leaves chat abruptly (no explicit "save conversation" action)
   * - Session status changes to 'ended' or 'inactive'
   * - This method is called to delete unsaved sessions and temp data
   *
   * @param sessionId - The session ID that is ending
   * @param guestUserId - The guest user ID associated with the session (optional for lookup)
   * @returns Details of what was cleaned up
   */
  async cleanupSessionlessGuestData(
    sessionId: string,
    guestUserId?: string,
  ): Promise<{
    sessionDeleted: boolean;
    savedConversations: number;
    chatrooms: number;
  }> {
    this.logger.log(
      `[Scenario 2] Cleaning up sessionless guest data for session ${sessionId}`,
    );

    try {
      // Get the session to find the user
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        this.logger.warn(`[Scenario 2] Session ${sessionId} not found`);
        return {
          sessionDeleted: false,
          savedConversations: 0,
          chatrooms: 0,
        };
      }

      const userId = guestUserId || session.userId;

      // Verify this is a guest account
      if (!userId) {
        this.logger.warn(
          `[Scenario 2] Session ${sessionId} has no associated user`,
        );
        return {
          sessionDeleted: false,
          savedConversations: 0,
          chatrooms: 0,
        };
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      } as any);

      if (!user || !this.isGuestAccount(user.email, user.role)) {
        this.logger.debug(
          `[Scenario 2] Session ${sessionId} belongs to non-guest user, skipping cleanup`,
        );
        return {
          sessionDeleted: false,
          savedConversations: 0,
          chatrooms: 0,
        };
      }

      // Check if this guest has any saved conversations
      const savedConversations = await this.prisma.savedConversation.findMany({
        where: {
          OR: [
            { userId: userId }, // Saved by authenticated user (won't happen for guest)
            { guestId: userId }, // Saved by guest
          ],
        },
      });

      // If guest has saved conversations, don't delete the user account
      if (savedConversations.length > 0) {
        this.logger.log(
          `[Scenario 2] Guest ${userId} has ${savedConversations.length} saved conversations, ` +
            `only deleting session ${sessionId}`,
        );
        await this.prisma.session.delete({
          where: { id: sessionId },
        });

        return {
          sessionDeleted: true,
          savedConversations: savedConversations.length,
          chatrooms: 0,
        };
      }

      // No saved conversations, so delete the guest account entirely
      // Find chatrooms this guest was in
      const chatroomMembers = await (this.prisma as any).chatroomMember.findMany({
        where: {
          session: { userId },
        },
        select: { chatroomId: true },
      });

      const chatroomIds = [...new Set(chatroomMembers.map(m => m.chatroomId))];

      // Delete the guest user (cascades to sessions, chatroom members, etc.)
      await this.prisma.user.delete({
        where: { id: userId },
      } as any);

      // Mark chatrooms as ended if they now have no members
      let endedChatroomCount = 0;
      for (const chatroomId of chatroomIds) {
        const memberCount = await (this.prisma as any).chatroomMember.count({
          where: { chatroomId },
        });

        if (memberCount === 0) {
          await (this.prisma as any).chatroom.update({
            where: { id: chatroomId },
            data: { status: 'ended' },
          });
          endedChatroomCount++;
          this.logger.log(`[Scenario 2] Marked chatroom ${chatroomId} as ended (no members)`);
        }
      }

      this.logger.log(
        `[Scenario 2] Deleted guest ${userId} with session ${sessionId}: ` +
          `${chatroomIds.length} chatrooms affected, ${endedChatroomCount} marked as ended`,
      );

      return {
        sessionDeleted: true,
        savedConversations: 0,
        chatrooms: chatroomIds.length,
      };
    } catch (error) {
      this.logger.error(
        `[Scenario 2] Error cleaning up session ${sessionId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Scenario 3: Delete inactive guest accounts (older than 24 hours)
   *
   * Called as a scheduled cleanup job (e.g., every hour) to remove stale guest accounts
   * that haven't been active in 24+ hours and have no saved conversations.
   *
   * This is the "garbage collection" pass to prevent database bloat from abandoned guests.
   *
   * @param inactiveThresholdMs - Time in milliseconds (default: 24 hours)
   * @returns Summary of cleanup results
   */
  async cleanupInactiveGuestAccounts(
    inactiveThresholdMs: number = 24 * 60 * 60 * 1000, // 24 hours
  ): Promise<{
    totalGuestAccounts: number;
    deletedForInactivity: number;
    preservedWithConversations: number;
    error?: string;
  }> {
    this.logger.log(
      `[Scenario 3] Starting inactive guest cleanup (threshold: ${inactiveThresholdMs}ms)`,
    );

    try {
      const cutoffTime = new Date(Date.now() - inactiveThresholdMs);

      // Find all guest accounts
      const guestAccounts = await this.prisma.user.findMany({
        where: {
          role: 'guest',
          email: { endsWith: '@chatmoo.com' },
          createdAt: { lt: cutoffTime }, // Created before cutoff
        },
        include: {
          sessions: {
            select: { id: true },
          },
          savedConversations: {
            select: { id: true },
          },
        },
      } as any);

      this.logger.log(
        `[Scenario 3] Found ${guestAccounts.length} guest accounts older than ${inactiveThresholdMs}ms`,
      );

      let deletedCount = 0;
      let preservedCount = 0;

      for (const guest of guestAccounts) {
        // Skip guests with saved conversations
        if ((guest as any).savedConversations.length > 0) {
          this.logger.debug(
            `[Scenario 3] Preserving guest ${guest.id} - has ${((guest as any).savedConversations).length} saved conversations`,
          );
          preservedCount++;
          continue;
        }

        // Delete inactive guest with no saved conversations
        try {
          await this.prisma.user.delete({
            where: { id: guest.id },
          } as any);

          this.logger.debug(
            `[Scenario 3] Deleted inactive guest ${guest.id} (${guest.email})`,
          );
          deletedCount++;
        } catch (deleteError) {
          this.logger.error(
            `[Scenario 3] Failed to delete guest ${guest.id}: ${(deleteError as Error).message}`,
          );
        }
      }

      this.logger.log(
        `[Scenario 3] Completed inactive guest cleanup: ` +
          `${deletedCount} deleted, ${preservedCount} preserved`,
      );

      return {
        totalGuestAccounts: guestAccounts.length,
        deletedForInactivity: deletedCount,
        preservedWithConversations: preservedCount,
      };
    } catch (error) {
      this.logger.error(
        `[Scenario 3] Error during inactive guest cleanup: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        totalGuestAccounts: 0,
        deletedForInactivity: 0,
        preservedWithConversations: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Scenario 4: Delete guest account on explicit reset/leave
   *
   * Called when a guest explicitly requests to delete their account or "leave" the platform.
   * This is an immediate, user-initiated action (not automatic).
   *
   * Example flow:
   * - Guest navigates to Settings > Reset Account
   * - Guest confirms deletion
   * - POST /auth/reset-guest is called
   * - This method permanently deletes the guest account and ALL associated data
   *
   * @param guestUserId - The guest user ID to delete
   * @param userId - Request context (should match guestUserId for authorization)
   * @param options - Optional: delete saved conversations as well
   * @returns Confirmation of deletion
   */
  async deleteGuestAccountExplicitly(
    guestUserId: string,
    userId: string,
    options: { deleteSavedConversations?: boolean } = {},
  ): Promise<{
    success: boolean;
    message: string;
    deleted: {
      user: boolean;
      sessions: number;
      conversations: number;
      messages: number;
    };
  }> {
    this.logger.log(
      `[Scenario 4] Explicit guest account deletion request: ${guestUserId}`,
    );

    // Authorization: user can only delete their own account
    if (guestUserId !== userId) {
      this.logger.warn(
        `[Scenario 4] Unauthorized deletion attempt: ${userId} tried to delete ${guestUserId}`,
      );
      throw new Error('Unauthorized: Cannot delete another user\'s account');
    }

    try {
      // Verify this is a guest account
      const guestUser = await this.prisma.user.findUnique({
        where: { id: guestUserId },
      } as any);

      if (!guestUser) {
        throw new Error('User not found');
      }

      if (!this.isGuestAccount(guestUser.email, guestUser.role)) {
        throw new Error('Account is not a guest account');
      }

      // Count related data
      const sessionCount = await this.prisma.session.count({
        where: { userId: guestUserId },
      });

      const conversationCount = await this.prisma.savedConversation.count({
        where: { guestId: guestUserId },
      });

      // Count messages in those conversations
      let messageCount = 0;
      if (conversationCount > 0 && options.deleteSavedConversations) {
        const conversations = await this.prisma.savedConversation.findMany({
          where: { guestId: guestUserId },
        });

        for (const conv of conversations) {
          const count = await this.prisma.savedMessage.count({
            where: { conversationId: conv.id },
          });
          messageCount += count;
        }
      }

      // Delete the guest account
      // This cascades to: sessions, user settings, wallet, chatroom memberships
      // SavedConversations are NOT automatically deleted by cascade
      await this.prisma.user.delete({
        where: { id: guestUserId },
      } as any);

      // Optionally delete saved conversations and messages
      if (options.deleteSavedConversations) {
        await this.prisma.savedConversation.deleteMany({
          where: { guestId: guestUserId },
        });

        this.logger.log(
          `[Scenario 4] Also deleted ${conversationCount} conversations and ${messageCount} messages`,
        );
      }

      this.logger.log(
        `[Scenario 4] Successfully deleted guest account ${guestUserId}`,
      );

      return {
        success: true,
        message: 'Guest account deleted successfully',
        deleted: {
          user: true,
          sessions: sessionCount,
          conversations: conversationCount,
          messages: messageCount,
        },
      };
    } catch (error) {
      this.logger.error(
        `[Scenario 4] Error deleting guest account ${guestUserId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Utility: Get guest account info for debugging/monitoring
   */
  async getGuestAccountInfo(userId: string): Promise<{
    isGuest: boolean;
    email?: string;
    createdAt?: Date;
    sessionCount?: number;
    savedConversationCount?: number;
    inactiveForMs?: number;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          sessions: { select: { id: true } },
          savedConversations: { select: { id: true } },
        },
      } as any);

      if (!user) {
        return { isGuest: false };
      }

      const isGuest = this.isGuestAccount(user.email, user.role);

      if (!isGuest) {
        return { isGuest: false };
      }

      const inactiveForMs = Date.now() - user.createdAt.getTime();

      return {
        isGuest: true,
        email: user.email,
        createdAt: user.createdAt,
        sessionCount: (user as any).sessions.length,
        savedConversationCount: (user as any).savedConversations.length,
        inactiveForMs,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching guest info for ${userId}: ${(error as Error).message}`,
      );
      return { isGuest: false };
    }
  }
}
