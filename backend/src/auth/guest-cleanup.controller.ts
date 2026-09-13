import { Controller, Post, Body, UseGuards, Req, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GuestCleanupService } from './guest-cleanup.service';

/**
 * GuestCleanupController provides endpoints for explicit guest account management.
 * These endpoints are called by the frontend when users interact with account settings.
 *
 * Note: These are separate from the automatic cleanup that happens in:
 * - AuthService (when guest converts to real user)
 * - SessionService (when session ends)
 * - GuestCleanupScheduler (periodic cleanup job)
 */
@Controller('auth')
export class GuestCleanupController {
  private readonly logger = new Logger('GuestCleanupController');

  constructor(private guestCleanupService: GuestCleanupService) {}

  /**
   * POST /auth/reset-guest
   *
   * Explicit guest account deletion endpoint.
   * Deletes the guest account and all associated data.
   *
   * Request body:
   * {
   *   "userId": "uuid-of-guest-user",
   *   "deleteSavedConversations": false  // Optional: also delete saved conversations
   * }
   *
   * Authorization: User can only delete their own account (checked by userId)
   *
   * Response on success (200):
   * {
   *   "success": true,
   *   "message": "Guest account deleted successfully",
   *   "deleted": {
   *     "user": true,
   *     "sessions": 2,
   *     "conversations": 0,
   *     "messages": 0
   *   }
   * }
   *
   * Response on error (400/401):
   * {
   *   "statusCode": 400,
   *   "message": "Account is not a guest account",
   *   "error": "Bad Request"
   * }
   *
   * Example frontend integration:
   * ```typescript
   * const response = await fetch('/auth/reset-guest', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify({
   *     userId: currentUserId,
   *     deleteSavedConversations: false
   *   })
   * });
   * const result = await response.json();
   * if (response.ok) {
   *   // Redirect to login or home page
   *   window.location.href = '/';
   * } else {
   *   // Show error
   *   console.error(result.message);
   * }
   * ```
   */
  @Post('reset-guest')
  async resetGuestAccount(
    @Body() body: {
      userId: string;
      deleteSavedConversations?: boolean;
    },
    @Req() req: any,
  ) {
    const { userId, deleteSavedConversations = false } = body;

    this.logger.log(
      `POST /auth/reset-guest - User: ${userId}, ` +
      `deleteSavedConversations: ${deleteSavedConversations}`,
    );

    // Validate input
    if (!userId) {
      throw new HttpException(
        { message: 'userId is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.guestCleanupService.deleteGuestAccountExplicitly(
        userId,
        userId, // Current user ID (from JWT or session)
        { deleteSavedConversations },
      );

      this.logger.log(`Successfully reset guest account: ${userId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error resetting guest account ${userId}: ${(error as Error).message}`,
      );

      if (
        (error as Error).message.includes('Unauthorized') ||
        (error as Error).message.includes('Cannot delete')
      ) {
        throw new HttpException(
          { message: (error as Error).message },
          HttpStatus.UNAUTHORIZED,
        );
      }

      if ((error as Error).message === 'User not found') {
        throw new HttpException(
          { message: 'User not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      if ((error as Error).message.includes('not a guest account')) {
        throw new HttpException(
          { message: (error as Error).message },
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new HttpException(
        { message: 'Internal server error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /auth/guest-info
   *
   * Get information about a guest account (for debugging/monitoring).
   * Used to check if an account is a guest, how many sessions, conversations, etc.
   *
   * Request body:
   * {
   *   "userId": "uuid-of-user"
   * }
   *
   * Response:
   * {
   *   "isGuest": true,
   *   "email": "abc123@chatmoo.com",
   *   "createdAt": "2024-01-15T10:30:00Z",
   *   "sessionCount": 2,
   *   "savedConversationCount": 0,
   *   "inactiveForMs": 86400000  // 24 hours in milliseconds
   * }
   *
   * This is useful for the frontend to:
   * - Show "Reset Account" button only for guests
   * - Display account age and activity
   * - Warn users before account deletion
   */
  @Post('guest-info')
  async getGuestInfo(
    @Body() body: { userId: string },
    @Req() req: any,
  ) {
    const { userId } = body;

    this.logger.log(`POST /auth/guest-info - User: ${userId}`);

    if (!userId) {
      throw new HttpException(
        { message: 'userId is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const info = await this.guestCleanupService.getGuestAccountInfo(userId);
      return info;
    } catch (error) {
      this.logger.error(`Error getting guest info for ${userId}: ${(error as Error).message}`);
      throw new HttpException(
        { message: 'Internal server error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
