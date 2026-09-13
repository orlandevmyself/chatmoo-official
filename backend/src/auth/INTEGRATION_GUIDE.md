# Guest Cleanup System Integration Guide

This document shows exactly where and how to integrate the guest cleanup system into your existing NestJS backend.

## Files Created

1. **guest-cleanup.service.ts** - Core service with cleanup logic for all 4 scenarios
2. **guest-cleanup.controller.ts** - HTTP endpoints for explicit guest reset
3. **guest-cleanup.scheduler.ts** - Scheduled cleanup job (runs periodically)
4. **INTEGRATION_GUIDE.md** - This file

## Integration Steps

### Step 1: Update AuthModule

Update `src/auth/auth.module.ts` to include the new services:

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { GuestCleanupService } from './guest-cleanup.service';
import { GuestCleanupController } from './guest-cleanup.controller';
import { GuestCleanupScheduler } from './guest-cleanup.scheduler';
import { SessionModule } from '../session/session.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'google' }), SessionModule, PrismaModule],
  controllers: [AuthController, GuestCleanupController],  // ADD GuestCleanupController
  providers: [
    AuthService,
    GoogleStrategy,
    GuestCleanupService,           // ADD
    GuestCleanupScheduler,         // ADD
  ],
  exports: [AuthService, GuestCleanupService],  // ADD GuestCleanupService to exports
})
export class AuthModule {}
```

### Step 2: Enable @nestjs/schedule in AppModule

Update `src/app.module.ts` to enable scheduled tasks:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';  // ADD THIS IMPORT
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
// ... other imports

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),  // ADD THIS
    PrismaModule,
    RedisModule,
    // ... other modules
  ],
})
export class AppModule {}
```

Also install the package if not already installed:
```bash
npm install @nestjs/schedule
```

### Step 3: Integrate into Google OAuth Callback (Scenario 1)

When a guest authenticates and converts to a real user, delete the old guest account.

Update `src/auth/auth.controller.ts` - modify the `googleAuthRedirect` method:

```typescript
import { Controller, Get, Req, Res, UseGuards, Post, Put, Body, Inject } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { GuestCleanupService } from './guest-cleanup.service';  // ADD

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject(GuestCleanupService) private guestCleanup: GuestCleanupService,  // ADD
  ) {}

  // ... existing methods ...

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    console.log('[Auth] Google callback received:', req.user);
    
    const { user } = req;
    
    if (!user) {
      return res.redirect('http://localhost:3001?error=auth_failed');
    }

    // SCENARIO 1: If user was previously a guest, clean them up
    // Check if there's a previous guest session in the request/cookies
    // Example: frontend sends prevGuestId in query params or headers
    const prevGuestId = req.query?.prevGuestId || req.headers?.['x-prev-guest-id'];
    if (prevGuestId && prevGuestId !== user.id) {
      try {
        await this.guestCleanup.cleanupGuestOnAuthentication(prevGuestId, user.id);
        console.log(`[Auth] Cleaned up previous guest account: ${prevGuestId}`);
      } catch (error) {
        console.error(`[Auth] Error cleaning up guest account: ${error.message}`);
        // Don't fail the entire auth flow if cleanup fails
      }
    }
    
    // ... rest of existing code ...
    const nameString = typeof user.name === 'object' ? 
      `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim() : 
      (user.name || user.email?.split('@')[0] || 'User');
    
    const redirectUrl = `http://localhost:3001/auth/callback?userId=${user.id}&email=${encodeURIComponent(user.email || '')}&name=${encodeURIComponent(nameString)}&profileComplete=${user.profileComplete}`;
    console.log('[Auth] Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  }
}
```

### Step 4: Integrate into Session Cleanup (Scenario 2)

When a session ends without saved conversations, cleanup the guest account.

Update `src/session/session.service.ts` to call guest cleanup:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GuestCleanupService } from '../auth/guest-cleanup.service';  // ADD

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private guestCleanup: GuestCleanupService,  // ADD
  ) {}

  // ... existing methods ...

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

        // SCENARIO 2: If this is a guest session, cleanup
        try {
          await this.guestCleanup.cleanupSessionlessGuestData(id, session.userId);
        } catch (error) {
          console.error(`[SessionService] Error cleaning up guest data: ${error.message}`);
          // Don't fail session update if cleanup fails
        }
      }

      return session;
    } catch (error: any) {
      if (error.code === 'P2025') {
        console.log(`[SessionService] Session ${id} not found, skipping status update`);
        const redisClient = this.redis.getClient();
        await redisClient.del(`queue:${id}`);
        await redisClient.del(`searching:${id}`);
        return null;
      }
      throw error;
    }
  }

  // ... rest of existing code ...
}
```

Also update the SessionModule to export GuestCleanupService:

```typescript
import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';  // ADD - but be careful of circular deps

@Module({
  imports: [PrismaModule, RedisModule, AuthModule],  // ADD AuthModule
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
```

**Note:** If you get a circular dependency error (SessionModule imports AuthModule, and AuthModule imports SessionModule), you have two options:

**Option A: Move GuestCleanupService to a shared module**
```typescript
// Create: src/auth/guest-cleanup/guest-cleanup.module.ts
import { Module } from '@nestjs/common';
import { GuestCleanupService } from './guest-cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GuestCleanupService],
  exports: [GuestCleanupService],
})
export class GuestCleanupModule {}

// Then update AuthModule to import GuestCleanupModule
// And SessionModule to import GuestCleanupModule (no circular dep)
```

**Option B: Use lazy imports**
```typescript
// In SessionService, inject the GuestCleanupService lazily via ModuleRef
import { ModuleRef } from '@nestjs/core';

// Later in the service:
const guestCleanup = this.moduleRef.get(GuestCleanupService);
```

### Step 5: Scheduled Cleanup (Scenario 3)

The scheduler is already enabled when you complete Step 2 (add ScheduleModule to AppModule).

The `GuestCleanupScheduler` will automatically run every hour and clean up inactive guests.

To change the frequency, edit `guest-cleanup.scheduler.ts` and modify the cron expression:
- `'0 0 * * * *'` = every hour
- `'0 0 0 * * *'` = every day at midnight
- `'0 */30 * * * *'` = every 30 minutes

### Step 6: Frontend Integration (Scenario 4)

The endpoints are already created in `GuestCleanupController`:

- **POST /auth/reset-guest** - Delete guest account
- **POST /auth/guest-info** - Get guest account info

Example frontend code (React):

```typescript
// Check if user is guest
const checkIfGuest = async (userId: string) => {
  const response = await fetch('/auth/guest-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  const info = await response.json();
  return info.isGuest;
};

// Show "Reset Account" button only for guests
const isGuest = await checkIfGuest(currentUserId);
if (isGuest) {
  showResetButton();
}

// Handle reset button click
const handleResetAccount = async () => {
  const confirmed = window.confirm(
    'Are you sure you want to permanently delete your account? This cannot be undone.'
  );
  
  if (confirmed) {
    const response = await fetch('/auth/reset-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        deleteSavedConversations: false  // or true if you want to delete saved conversations too
      })
    });

    if (response.ok) {
      // Logout and redirect to home
      localStorage.removeItem('userId');
      window.location.href = '/';
    } else {
      const error = await response.json();
      alert(`Error: ${error.message}`);
    }
  }
};
```

## Deployment Checklist

- [ ] Install @nestjs/schedule: `npm install @nestjs/schedule`
- [ ] Copy the 3 service/controller/scheduler files to src/auth/
- [ ] Update AuthModule with new controllers and providers
- [ ] Update AppModule with ScheduleModule.forRoot()
- [ ] Update SessionService to call guest cleanup (or use option A/B for circular deps)
- [ ] Update auth.controller.ts to handle prevGuestId cleanup
- [ ] Update SessionModule imports (carefully handling circular deps)
- [ ] Test with a guest account → create session → end session
- [ ] Test with a guest account → authenticate with Google
- [ ] Monitor logs to verify scheduler runs hourly
- [ ] Check database for old guest records being cleaned up

## Monitoring & Debugging

The service logs to the `GuestCleanupService` logger. Monitor these logs:

```bash
# Watch for cleanup operations
docker logs -f <container> | grep GuestCleanup

# Or check specific scenario logs:
docker logs -f <container> | grep "Scenario 1"
docker logs -f <container> | grep "Scenario 2"
docker logs -f <container> | grep "Scenario 3"
docker logs -f <container> | grep "Scenario 4"
```

## Database Query Examples

Check how many guest accounts you have:

```sql
SELECT COUNT(*) as guest_count, COUNT(DISTINCT CREATED_AT) as unique_dates
FROM "User"
WHERE role = 'guest'
AND email LIKE '%@chatmoo.com';
```

Find guest accounts older than 24 hours with no saved conversations:

```sql
SELECT u.id, u.email, u."createdAt", COUNT(s.id) as session_count, COUNT(sc.id) as conversation_count
FROM "User" u
LEFT JOIN "Session" s ON u.id = s."userId"
LEFT JOIN "SavedConversation" sc ON u.id = sc."guestId"
WHERE u.role = 'guest'
AND u.email LIKE '%@chatmoo.com'
AND u."createdAt" < NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.email, u."createdAt"
HAVING COUNT(sc.id) = 0
ORDER BY u."createdAt" ASC;
```

## Troubleshooting

### Circular dependency error
See Option A or B in Step 4 above.

### Scheduler not running
- Verify `ScheduleModule.forRoot()` is in AppModule
- Check logs for `GuestCleanupScheduler` entries
- Verify `@Cron()` decorator is present in the scheduler

### Guests not being deleted
- Check the cleanup service logs
- Verify guest accounts have role='guest' and email ends with '@chatmoo.com'
- Check if guests have saved conversations (these are preserved)
- Manually call the cleanup endpoint to test: `POST /auth/reset-guest`

### Frontend can't call endpoints
- Verify GuestCleanupController is registered in AuthModule
- Check CORS settings if frontend is on different domain
- Verify userId is being sent correctly in request body
