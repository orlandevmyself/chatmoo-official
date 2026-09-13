# Guest Account Cleanup System

A comprehensive system for managing the lifecycle of guest accounts in your NestJS/Prisma application. Automatically deletes temporary guest accounts at key points in their lifecycle while preserving conversation history.

## Overview

Guest accounts are temporary, anonymous user accounts created for unauthenticated users. They:
- Have `role='guest'` in the User model
- Use email format: `{prefix}@chatmoo.com` (e.g., `abc123@chatmoo.com`)
- Cannot authenticate with passwords (anonymous/session-based only)
- Should be cleaned up to prevent database bloat

This system handles cleanup automatically in 4 scenarios:

| Scenario | Trigger | When to Delete | Data Preserved |
|----------|---------|---|---|
| **1: Guest authenticates** | User logs in with Google OAuth | Immediately | Conversation history (with guestId) |
| **2: Session ends** | User leaves chat without saving | When session ends | Account IF they saved conversations |
| **3: Inactive guests** | Scheduled job runs hourly | 24+ hours old with no conversations | Everything (other guests unaffected) |
| **4: Explicit reset** | User clicks "Delete Account" | User-initiated | Optionally conversations |

## Files Created

```
backend/src/auth/
├── guest-cleanup.service.ts        # Core service (4 cleanup scenarios)
├── guest-cleanup.controller.ts     # HTTP endpoints (POST /auth/reset-guest)
├── guest-cleanup.scheduler.ts      # Scheduled cleanup job (hourly)
├── guest-cleanup.types.ts          # TypeScript interfaces
├── guest-cleanup.service.spec.ts   # Unit tests
├── INTEGRATION_GUIDE.md            # Step-by-step integration
├── INTEGRATION_SNIPPETS.md         # Copy-paste code snippets
└── GUEST_CLEANUP_README.md         # This file
```

## Quick Start (5 minutes)

### 1. Copy the files to your project
```bash
cp guest-cleanup.*.ts src/auth/
```

### 2. Install the scheduler dependency
```bash
npm install @nestjs/schedule
```

### 3. Update 5 files
Follow the snippets in `INTEGRATION_SNIPPETS.md`:
- `src/auth/auth.module.ts` - Add imports and providers
- `src/app.module.ts` - Add ScheduleModule
- `src/auth/auth.controller.ts` - Handle guest authentication (optional)
- `src/session/session.service.ts` - Cleanup on session end (optional)
- `src/session/session.module.ts` - Import auth module (optional)

### 4. Test
```bash
# Check database
SELECT COUNT(*) FROM "User" WHERE role = 'guest' AND email LIKE '%@chatmoo.com';

# Test the endpoint
curl -X POST http://localhost:3000/auth/reset-guest \
  -H "Content-Type: application/json" \
  -d '{"userId":"uuid","deleteSavedConversations":false}'
```

## Architecture

### GuestCleanupService

Core service implementing 4 cleanup scenarios:

```typescript
// Scenario 1: Guest authenticates
await guestCleanup.cleanupGuestOnAuthentication(oldGuestId, newUserId);

// Scenario 2: Session ends without saving
await guestCleanup.cleanupSessionlessGuestData(sessionId);

// Scenario 3: Scheduled inactive cleanup (runs hourly)
await guestCleanup.cleanupInactiveGuestAccounts(24 * 60 * 60 * 1000);

// Scenario 4: Explicit user-initiated deletion
await guestCleanup.deleteGuestAccountExplicitly(userId, currentUserId, {
  deleteSavedConversations: false
});

// Utility: Get account info
const info = await guestCleanup.getGuestAccountInfo(userId);
```

### Integration Points

#### 1. Google OAuth Callback (Optional)
When a guest logs in with Google, their old guest account can be deleted:

```typescript
@Get('google/callback')
async googleAuthRedirect(@Req() req, @Res() res) {
  // ... existing code ...
  
  const prevGuestId = req.query?.prevGuestId;
  if (prevGuestId) {
    await this.guestCleanup.cleanupGuestOnAuthentication(prevGuestId, user.id);
  }
  
  // ... rest of code ...
}
```

#### 2. Session Status Update (Optional)
When a session ends, cleanup guest data if no conversations saved:

```typescript
async updateSessionStatus(id: string, status: string) {
  const session = await this.prisma.session.update({ ... });
  
  if (status === 'ended' || status === 'inactive') {
    await this.guestCleanup.cleanupSessionlessGuestData(id, session.userId);
  }
  
  return session;
}
```

#### 3. Scheduled Job (Automatic)
The scheduler runs every hour and cleans up inactive guests (no setup needed after initial integration):

```typescript
// Runs automatically every hour
@Cron('0 0 * * * *')
async cleanupInactiveGuests() {
  await this.guestCleanup.cleanupInactiveGuestAccounts(24 * 60 * 60 * 1000);
}
```

#### 4. HTTP Endpoints (Automatic)
Frontend can call these endpoints directly:

```typescript
// Check if user is guest
POST /auth/guest-info
Body: { "userId": "uuid" }

// Delete guest account
POST /auth/reset-guest
Body: { "userId": "uuid", "deleteSavedConversations": false }
```

## Data Flow

### Scenario 1: Guest → Authenticated User

```
Frontend:
1. Guest creates temporary account (gets guestId@chatmoo.com)
2. Guest joins chatroom, has conversations
3. Guest clicks "Sign in with Google"
4. Frontend sends: POST /auth/google/callback?prevGuestId=guestId

Backend:
1. Google OAuth validated, new User created (real email)
2. GuestCleanupService.cleanupGuestOnAuthentication(oldGuestId)
   - Deletes old guest User record
   - Conversations linked to guestId are PRESERVED
3. New authenticated user can see their conversation history

Result:
- Old guest record deleted ✓
- New authenticated user created ✓
- Conversation history preserved ✓
```

### Scenario 2: Session Ends

```
Frontend:
1. Guest joins chatroom and chats
2. Guest closes tab (no explicit "save conversation")
3. SessionService detects session end
4. Session status changes to 'ended'

Backend:
1. SessionService.updateSessionStatus('ended')
2. GuestCleanupService.cleanupSessionlessGuestData(sessionId)
   - Checks if guest has saved conversations
   - If YES: Delete session, preserve guest user
   - If NO: Delete entire guest user and sessions

Result:
- Unused guest accounts deleted ✓
- Important conversation history preserved ✓
```

### Scenario 3: Scheduled Cleanup

```
Backend (every hour):
1. GuestCleanupScheduler.cleanupInactiveGuests() runs
2. Finds guests older than 24 hours
3. Filters out guests with saved conversations
4. Deletes remaining inactive guests
5. Logs results

Result:
- Old abandoned guest accounts deleted ✓
- Guests with conversations preserved ✓
- Database cleaned automatically ✓
```

### Scenario 4: Explicit Reset

```
Frontend:
1. Guest navigates to Settings > Reset Account
2. Guest confirms deletion
3. Calls: POST /auth/reset-guest

Backend:
1. GuestCleanupController.resetGuestAccount(userId)
2. GuestCleanupService.deleteGuestAccountExplicitly(userId, currentUserId)
   - Validates user is guest
   - Deletes user and sessions
   - Optionally deletes conversations
3. Returns confirmation

Result:
- Guest account deleted immediately ✓
- All associated data removed ✓
```

## Configuration

### Cleanup Thresholds

Edit `guest-cleanup.service.ts` and `guest-cleanup.scheduler.ts` to adjust:

```typescript
// Change inactive threshold (default: 24 hours)
await guestCleanup.cleanupInactiveGuestAccounts(
  12 * 60 * 60 * 1000  // 12 hours instead
);

// Change scheduler frequency
@Cron('0 */30 * * * *')  // Every 30 minutes instead of hourly
async cleanupInactiveGuests() { ... }
```

### Guest Account Pattern

Currently hardcoded as `@chatmoo.com`. To change:

```typescript
// In guest-cleanup.service.ts
private isGuestAccount(email: string, role: string): boolean {
  return (
    role === 'guest' &&
    email.endsWith('@your-domain.com')  // Change here
  );
}
```

## Monitoring & Logging

All operations are logged to the `GuestCleanupService` logger:

```bash
# Watch logs in real-time
docker logs -f <container> | grep GuestCleanup

# Filter by scenario
docker logs -f <container> | grep "Scenario 1"
docker logs -f <container> | grep "Scenario 2"
docker logs -f <container> | grep "Scenario 3"
docker logs -f <container> | grep "Scenario 4"

# Or use your logging service:
# JSON structured logs should show:
{
  "context": "GuestCleanupService",
  "level": "log",
  "message": "[Scenario X] ...",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

## Database Queries

Monitor guest accounts in your database:

```sql
-- Count guest accounts
SELECT COUNT(*) FROM "User" 
WHERE role = 'guest' AND email LIKE '%@chatmoo.com';

-- Find guests eligible for cleanup (24+ hours, no conversations)
SELECT u.id, u.email, u."createdAt", COUNT(sc.id) as conv_count
FROM "User" u
LEFT JOIN "SavedConversation" sc ON u.id = sc."guestId"
WHERE u.role = 'guest'
AND u.email LIKE '%@chatmoo.com'
AND u."createdAt" < NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.email, u."createdAt"
HAVING COUNT(sc.id) = 0
ORDER BY u."createdAt" ASC;

-- Check saved conversations linked to guests
SELECT COUNT(*) FROM "SavedConversation" WHERE "guestId" IS NOT NULL;

-- Verify cascading deletes work
SELECT COUNT(*) FROM "Session" WHERE "userId" = 'deleted-guest-id';
```

## Troubleshooting

### Issue: Scheduler not running

**Check:**
1. `ScheduleModule.forRoot()` is imported in AppModule
2. `GuestCleanupScheduler` is registered as a provider
3. Check logs for `GuestCleanupScheduler` entries

**Fix:**
```typescript
// app.module.ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),  // This must be present
    // ... other imports
  ]
})
```

### Issue: Circular dependency error

See "Handling Circular Dependencies" in `INTEGRATION_SNIPPETS.md` for Option A or B.

### Issue: Guests not being deleted

**Check:**
1. Guest has `role='guest'` and email ends with `@chatmoo.com`
2. Guest is older than 24 hours (for scheduled cleanup)
3. Guest has NO saved conversations (these are preserved)
4. Check database directly to verify data exists

**Test manually:**
```bash
curl -X POST http://localhost:3000/auth/reset-guest \
  -H "Content-Type: application/json" \
  -d '{"userId":"guest-id","deleteSavedConversations":false}'
```

### Issue: Conversations being deleted unexpectedly

**Root cause:** Check `cleanupSessionlessGuestData()` - it only deletes guests with NO saved conversations. If a guest has conversations, they're preserved.

**Verify:**
```sql
SELECT * FROM "SavedConversation" WHERE "guestId" = 'your-guest-id';
```

## Testing

### Unit Tests
```bash
npm run test -- guest-cleanup.service.spec.ts
```

### Integration Tests
```bash
# Create a guest account
POST /session/create
Body: { "username": "guest", "country": "PH" }
Response: { "id": "session-123" }

# Check if guest user was created
GET /auth/user/guest-user-id

# Get guest info
POST /auth/guest-info
Body: { "userId": "guest-user-id" }

# Test explicit deletion
POST /auth/reset-guest
Body: { "userId": "guest-user-id", "deleteSavedConversations": false }

# Verify user is deleted
GET /auth/user/guest-user-id  # Should return 404
```

## Performance Considerations

### Database Indexes
The system uses existing indexes efficiently:
- `User.role` - for finding guests
- `User.createdAt` - for inactive queries
- `SavedConversation.guestId` - for conversation lookup
- `Session.userId` - for session lookup

If you have very large tables, consider adding:
```sql
CREATE INDEX idx_user_role_email ON "User"(role, email);
CREATE INDEX idx_user_created_guest ON "User"(role, "createdAt") WHERE role = 'guest';
```

### Scheduled Job Performance
- Runs hourly (configurable)
- Queries all guests older than 24 hours
- Deletes one at a time to avoid locks
- Logs each deletion for monitoring
- Takes ~100ms-1s per 100 guests depending on database

For high-volume applications (>1000 guest accounts/day), consider:
- Running cleanup more frequently (every 30 minutes)
- Lowering inactivity threshold (12 hours instead of 24)
- Batch deleting accounts (modify service)

## Security Considerations

1. **Authorization**: `/auth/reset-guest` validates user can only delete their own account
2. **Data preservation**: Saved conversations are NEVER deleted unless explicitly requested
3. **Cascading deletes**: Sessions cascade from User, so deleting user cleans up sessions
4. **Audit logging**: All operations logged (see Monitoring section)

## API Reference

### POST /auth/reset-guest
**Delete a guest account**

Request:
```json
{
  "userId": "uuid-of-guest-user",
  "deleteSavedConversations": false
}
```

Response (200):
```json
{
  "success": true,
  "message": "Guest account deleted successfully",
  "deleted": {
    "user": true,
    "sessions": 2,
    "conversations": 0,
    "messages": 0
  }
}
```

### POST /auth/guest-info
**Get guest account information**

Request:
```json
{
  "userId": "uuid-of-guest-user"
}
```

Response:
```json
{
  "isGuest": true,
  "email": "abc123@chatmoo.com",
  "createdAt": "2024-01-15T10:30:00Z",
  "sessionCount": 2,
  "savedConversationCount": 1,
  "inactiveForMs": 3600000
}
```

## Next Steps

1. **Read** `INTEGRATION_GUIDE.md` for detailed step-by-step instructions
2. **Copy** code snippets from `INTEGRATION_SNIPPETS.md` into your files
3. **Test** with a guest account following the testing section
4. **Monitor** logs to verify cleanup is working
5. **Adjust** thresholds based on your usage patterns

## Questions?

- Check the inline comments in service code
- Review test file for usage examples
- See `INTEGRATION_GUIDE.md` for common issues
