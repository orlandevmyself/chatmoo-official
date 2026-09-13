import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GuestCleanupService } from './guest-cleanup.service';

/**
 * GuestCleanupScheduler runs periodic background jobs to clean up inactive guest accounts.
 *
 * This scheduler:
 * 1. Runs automatically based on cron schedule
 * 2. Deletes guest accounts that are inactive for 24+ hours (with no saved conversations)
 * 3. Logs results for monitoring
 *
 * To enable this scheduler, add '@nestjs/schedule' to your project:
 * npm install @nestjs/schedule
 *
 * And import ScheduleModule in your app.module.ts:
 * ```typescript
 * import { ScheduleModule } from '@nestjs/schedule';
 *
 * @Module({
 *   imports: [
 *     ScheduleModule.forRoot(),
 *     // ... other modules
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Injectable()
export class GuestCleanupScheduler {
  private readonly logger = new Logger('GuestCleanupScheduler');

  constructor(private guestCleanupService: GuestCleanupService) {}

  // Cleanup job that runs every hour (top of every hour)
  // This checks for guest accounts that are older than 24 hours with NO saved conversations
  // Change the @Cron expression to adjust frequency:
  // - 0 0 * * * * for every hour
  // - 0 0 */6 * * for every 6 hours (use /6 for step)
  // - 0 0 0 * * * for every day at midnight
  // - 0 */30 * * * for every 30 minutes (use /30 for step)
  // See crontab.guru for more info
  @Cron('0 0 * * * *')
  async cleanupInactiveGuests() {
    this.logger.log(
      '[GuestCleanupScheduler] Starting scheduled cleanup of inactive guest accounts',
    );

    try {
      const result = await this.guestCleanupService.cleanupInactiveGuestAccounts(
        24 * 60 * 60 * 1000, // 24 hours
      );

      this.logger.log(
        `[GuestCleanupScheduler] Cleanup completed: ` +
          `Total guests: ${result.totalGuestAccounts}, ` +
          `Deleted: ${result.deletedForInactivity}, ` +
          `Preserved: ${result.preservedWithConversations}`,
      );
    } catch (error) {
      this.logger.error(
        `[GuestCleanupScheduler] Error during scheduled cleanup: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Note: Don't rethrow - let the scheduler continue
    }
  }

  /**
   * Alternative job for more aggressive cleanup (every 30 minutes, shorter threshold)
   *
   * Uncomment and adjust if you want more frequent cleanup with stricter thresholds.
   *
   * Example use case:
   * - If you have high volume of short-lived guest sessions
   * - Want to delete guests inactive for just 12 hours instead of 24
   * - Run cleanup more frequently to keep DB smaller
   */
  // @Cron('0 */30 * * * *')
  // async aggressiveCleanup() {
  //   this.logger.debug('[GuestCleanupScheduler] Running aggressive cleanup (12 hour threshold)');
  //   await this.guestCleanupService.cleanupInactiveGuestAccounts(12 * 60 * 60 * 1000);
  // }
}
