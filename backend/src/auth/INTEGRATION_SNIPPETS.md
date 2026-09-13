# Quick Integration Code Snippets

Copy-paste these snippets into your existing files.

## 1. auth.module.ts - Add imports and providers

```typescript
// ADD these imports at top
import { GuestCleanupService } from './guest-cleanup.service';
import { GuestCleanupController } from './guest-cleanup.controller';
import { GuestCleanupScheduler } from './guest-cleanup.scheduler';

// MODIFY the @Module decorator
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'google' }), SessionModule, PrismaModule],
  controllers: [AuthController, GuestCleanupController],  // ADD GuestCleanupController
  providers: [
    AuthService,
    GoogleStrategy,
    GuestCleanupService,    // ADD
    GuestCleanupScheduler,  // ADD
  ],
  exports: [AuthService, GuestCleanupService],  // ADD GuestCleanupService
})
```

## 2. app.module.ts - Enable scheduling

```typescript
// ADD this import
import { ScheduleModule } from '@nestjs/schedule';

// MODIFY the @Module decorator imports
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),  // ADD THIS LINE
    PrismaModule,
    RedisModule,
    // ... rest of imports
  ],
})
```

## 3. auth.controller.ts - Handle guest authentication

```typescript
// ADD import
import { GuestCleanupService } from './guest-cleanup.service';
import { Inject } from '@nestjs/common';  // If not already imported

// MODIFY constructor
constructor(
  private authService: AuthService,
  @Inject(GuestCleanupService) private guestCleanup: GuestCleanupService,  // ADD
) {}

// MODIFY googleAuthRedirect method
@Get('google/callback')
@UseGuards(AuthGuard('google'))
async googleAuthRedirect(@Req() req, @Res() res: Response) {
  console.log('[Auth] Google callback received:', req.user);
  
  const { user } = req;
  
  if (!user) {
    return res.redirect('http://localhost:3001?error=auth_failed');
  }

  // ADD THIS BLOCK - Cleanup previous guest account
  const prevGuestId = req.query?.prevGuestId || req.headers?.['x-prev-guest-id'];
  if (prevGuestId && prevGuestId !== user.id) {
    try {
      await this.guestCleanup.cleanupGuestOnAuthentication(prevGuestId, user.id);
      console.log(`[Auth] Cleaned up previous guest account: ${prevGuestId}`);
    } catch (error) {
      console.error(`[Auth] Error cleaning up guest account: ${error.message}`);
    }
  }
  
  // ... rest of existing code ...
}
```

## 4. session.service.ts - Cleanup guest on session end

```typescript
// ADD import
import { GuestCleanupService } from '../auth/guest-cleanup.service';

// MODIFY constructor
constructor(
  private prisma: PrismaService,
  private redis: RedisService,
  private guestCleanup: GuestCleanupService,  // ADD
) {}

// MODIFY updateSessionStatus method
async updateSessionStatus(id: string, status: string) {
  try {
    const session = await this.prisma.session.update({
      where: { id },
      data: { status },
    });

    // Remove from queue if ended or inactive
    if (status === 'ended' || status === 'inactive') {
      const redisClient = this.redis.getClient();
      await redisClient.del(`queue:${id}`);
      await redisClient.del(`searching:${id}`);

      // ADD THIS BLOCK - Cleanup guest data
      try {
        await this.guestCleanup.cleanupSessionlessGuestData(id, session.userId);
      } catch (error) {
        console.error(`[SessionService] Error cleaning up guest data: ${error.message}`);
      }
    }

    return session;
  } catch (error: any) {
    // ... existing error handling ...
  }
}
```

## 5. session.module.ts - Import auth module

```typescript
// ADD import
import { AuthModule } from '../auth/auth.module';

// MODIFY @Module
@Module({
  imports: [PrismaModule, RedisModule, AuthModule],  // ADD AuthModule (watch for circular deps)
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
```

## 6. package.json - Install dependency

```bash
npm install @nestjs/schedule
```

Or add to package.json:
```json
{
  "dependencies": {
    "@nestjs/schedule": "^4.0.0"
  }
}
```

## Handling Circular Dependencies

If you get a circular dependency error, use this approach:

### Option A: Create separate GuestCleanupModule

Create: `src/auth/guest-cleanup/guest-cleanup.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { GuestCleanupService } from './guest-cleanup.service';
import { GuestCleanupController } from './guest-cleanup.controller';
import { GuestCleanupScheduler } from './guest-cleanup.scheduler';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GuestCleanupController],
  providers: [GuestCleanupService, GuestCleanupScheduler],
  exports: [GuestCleanupService],
})
export class GuestCleanupModule {}
```

Then update:
- **auth.module.ts**: imports: [GuestCleanupModule, ...]
- **session.module.ts**: imports: [PrismaModule, RedisModule, GuestCleanupModule, ...]

### Option B: Lazy injection in SessionService

Instead of injecting in constructor:

```typescript
import { ModuleRef } from '@nestjs/core';
import { GuestCleanupService } from '../auth/guest-cleanup.service';

export class SessionService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private moduleRef: ModuleRef,  // ADD
  ) {}

  async updateSessionStatus(id: string, status: string) {
    try {
      const session = await this.prisma.session.update({
        where: { id },
        data: { status },
      });

      if (status === 'ended' || status === 'inactive') {
        const redisClient = this.redis.getClient();
        await redisClient.del(`queue:${id}`);
        await redisClient.del(`searching:${id}`);

        // Lazy get GuestCleanupService
        try {
          const guestCleanup = this.moduleRef.get(GuestCleanupService);
          await guestCleanup.cleanupSessionlessGuestData(id, session.userId);
        } catch (error) {
          console.error(`[SessionService] Error cleaning up guest data: ${error.message}`);
        }
      }

      return session;
    } catch (error: any) {
      // ... existing error handling ...
    }
  }
}
```

## Testing

### Test Scenario 1: Guest converts to authenticated user

```bash
# Call the cleanup endpoint directly
curl -X POST http://localhost:3000/auth/reset-guest \
  -H "Content-Type: application/json" \
  -d '{"userId":"old-guest-uuid"}'
```

### Test Scenario 2: Session ends

```bash
# Update session status (triggers guest cleanup via SessionService)
# In your chat gateway or session controller:
await this.sessionService.updateSessionStatus(sessionId, 'ended');
```

### Test Scenario 3: Scheduled cleanup

```bash
# Check logs for scheduler output (every hour)
# Or manually trigger via endpoint in a test controller:
@Post('test/cleanup-guests')
async testCleanup() {
  return this.guestCleanup.cleanupInactiveGuestAccounts(24 * 60 * 60 * 1000);
}
```

### Test Scenario 4: Explicit reset

```bash
# Call the reset endpoint from frontend
curl -X POST http://localhost:3000/auth/reset-guest \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"current-user-uuid",
    "deleteSavedConversations":false
  }'
```

## Database Verification

```sql
-- Check guest accounts
SELECT COUNT(*) FROM "User" WHERE role = 'guest' AND email LIKE '%@chatmoo.com';

-- Find guests eligible for cleanup (24+ hours old, no saved conversations)
SELECT u.id, u.email, u."createdAt"
FROM "User" u
LEFT JOIN "SavedConversation" sc ON u.id = sc."guestId"
WHERE u.role = 'guest'
AND u.email LIKE '%@chatmoo.com'
AND u."createdAt" < NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.email, u."createdAt"
HAVING COUNT(sc.id) = 0;

-- Check saved conversations linked to guest accounts
SELECT COUNT(*) FROM "SavedConversation" WHERE "guestId" IS NOT NULL;
```
