# Guest Cleanup Frontend Integration Guide

The guest cleanup system has been fully implemented on the backend. Here's how to integrate it into the frontend.

## Overview of 4 Cleanup Scenarios

| # | Scenario | Trigger | Action | When |
|---|----------|---------|--------|------|
| 1 | **Auth Conversion** | Guest logs in with Google | Auto cleanup (backend) | After successful Google auth |
| 2 | **Session Ends** | Guest leaves without saving | Auto cleanup (backend) | When session marked as `ended`/`inactive` |
| 3 | **Inactivity** | 24+ hours old, no saved conversations | Auto cleanup (scheduled job) | Every hour, backend cron |
| 4 | **Explicit Reset** | User clicks "Delete Account" | API call to backend | User-initiated |

## Frontend Integration Points

### 1. Google Authentication Callback

When redirecting from Google auth, include the previous guest ID so the backend can clean it up:

```javascript
// In your LandingPage.js or GoogleAuthButton component
const handleGoogleSuccess = (response) => {
  const { user } = response;
  const prevGuestId = localStorage.getItem('guestUserId');
  
  // Call backend with prevGuestId
  const redirectUrl = new URL('http://localhost:3000/auth/google/callback');
  if (prevGuestId && prevGuestId !== user.id) {
    redirectUrl.searchParams.set('prevGuestId', prevGuestId);
  }
  
  // Or send via header if using fetch:
  fetch('http://localhost:3000/auth/google/callback', {
    method: 'GET',
    headers: {
      'x-prev-guest-id': prevGuestId,
    },
  });
};
```

**Backend handles this automatically** in `auth.controller.ts` - no frontend code needed if using standard OAuth flow.

---

### 2. Session End Cleanup

When a guest leaves the chat or closes the connection, the backend automatically cleans up if:
- Session is marked as `ended` or `inactive`
- Guest has NO saved conversations

**No frontend code needed** - SessionService handles this automatically via `updateSessionStatus()`.

---

### 3. Scheduled Inactivity Cleanup

The backend runs an automatic cleanup job every hour that deletes:
- Guest accounts older than 24 hours
- With NO saved conversations

**No frontend code needed** - GuestCleanupScheduler handles this automatically.

---

### 4. Explicit Guest Account Deletion

Add a "Delete Account" or "Reset Identity" button to your guest user interface:

```javascript
// In your UserDashboard.js or AccountSettings component
import { userApi } from '../lib/api';

function GuestAccountSettings() {
  const [isDeleting, setIsDeleting] = useState(false);
  const userId = localStorage.getItem('userId');

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure? This will delete your guest account.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch('http://localhost:3000/auth/reset-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          deleteSavedConversations: true, // Set to false to preserve chats
        }),
      });

      if (!response.ok) throw new Error('Failed to delete account');

      // Redirect to landing page
      localStorage.removeItem('userId');
      localStorage.removeItem('guestUserId');
      window.location.href = '/';
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDeleteAccount} 
      disabled={isDeleting}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      {isDeleting ? 'Deleting...' : 'Delete Guest Account'}
    </button>
  );
}

export default GuestAccountSettings;
```

---

### 5. Optional: Check Guest Account Status

You can fetch guest account info (for debugging or UI purposes):

```javascript
const getGuestInfo = async (userId) => {
  const response = await fetch('http://localhost:3000/auth/guest-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) throw new Error('Failed to fetch guest info');
  return response.json();
};

// Usage
const guestInfo = await getGuestInfo(userId);
console.log('Guest account is inactive:', guestInfo.isInactive);
console.log('Hours old:', guestInfo.hoursOld);
console.log('Saved conversations:', guestInfo.savedConversations);
```

Response format:
```json
{
  "id": "uuid",
  "email": "abc123@chatmoo.com",
  "role": "guest",
  "isGuest": true,
  "createdAt": "2026-09-14T10:30:00Z",
  "hoursOld": 5.5,
  "sessions": 1,
  "savedConversations": 2,
  "walletBalance": 0,
  "isInactive": false
}
```

---

## API Endpoints Summary

### POST `/auth/reset-guest` - Explicit deletion

Delete a guest account and optionally preserve conversations.

**Request:**
```bash
curl -X POST http://localhost:3000/auth/reset-guest \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "deleteSavedConversations": false
  }'
```

**Response:**
```json
{
  "deleted": true,
  "guestId": "user-uuid",
  "conversationsPreserved": false
}
```

---

### POST `/auth/guest-info` - Check account status

Fetch guest account information (debugging only).

**Request:**
```bash
curl -X POST http://localhost:3000/auth/guest-info \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid"}'
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "abc123@chatmoo.com",
  "role": "guest",
  "isGuest": true,
  "createdAt": "2026-09-14T10:30:00Z",
  "hoursOld": 5.5,
  "sessions": 1,
  "savedConversations": 2,
  "walletBalance": 0,
  "isInactive": false
}
```

---

## Backend Integration Summary

✅ **Automatically Handled:**
- Scenario 1: Guest converts to authenticated user (GoogleAuthCallback)
- Scenario 2: Session ends without saving (SessionService.updateSessionStatus)
- Scenario 3: Inactivity cleanup (GuestCleanupScheduler hourly job)

⚠️ **Requires Frontend:**
- Scenario 4: Explicit deletion (add button + call POST /auth/reset-guest)

---

## Testing Checklist

- [ ] Guest account created with `role: 'guest'` and email like `abc123@chatmoo.com`
- [ ] Google auth callback cleanup: Previous guest deleted after login
- [ ] Session end cleanup: Verify guest deleted when session marked `ended` (if no saved conversations)
- [ ] Scheduled cleanup: Check logs every hour for cleanup results
- [ ] Explicit deletion: Add "Delete Account" button, test POST /auth/reset-guest
- [ ] Preservation: Test that saved conversations are preserved/deleted based on `deleteSavedConversations` flag
- [ ] Logs: Check backend logs for cleanup operation details

---

## Configuration

To adjust the inactivity threshold or cleanup frequency, edit:

**File:** `backend/src/auth/guest-cleanup.service.ts`
```typescript
private readonly GUEST_INACTIVITY_HOURS = 24; // Change here
```

**File:** `backend/src/auth/guest-cleanup.scheduler.ts`
```typescript
@Cron('0 0 * * * *') // Change cron expression here
async cleanupInactiveGuests() { ... }
```

Common cron expressions:
- `'0 0 * * * *'` = every hour
- `'0 0 */6 * * *'` = every 6 hours
- `'0 0 0 * * *'` = daily at midnight
- `'0 */30 * * * *'` = every 30 minutes

See [crontab.guru](https://crontab.guru) for more examples.

---

## Logging & Monitoring

All cleanup operations are logged to the backend. Check console/logs for:

```
[Auth] Cleaned up previous guest account: uuid-123
[SessionService] Error cleaning up guest data: ...
[GuestCleanupScheduler] Starting scheduled cleanup of inactive guest accounts
[GuestCleanupScheduler] Cleanup completed: Total guests: 42, Deleted: 5, Preserved: 37
```

---

## Troubleshooting

### Guest account not deleted on authentication
- Check that `prevGuestId` is being passed in auth redirect
- Check backend logs for errors
- Verify guest user has `role: 'guest'` in database

### Scheduled cleanup not running
- Verify `@nestjs/schedule` is installed: `npm list @nestjs/schedule`
- Verify `ScheduleModule.forRoot()` is imported in `app.module.ts`
- Check backend logs for scheduler startup message

### Circular dependency error
- The integration uses `ModuleRef.get(GuestCleanupService)` with lazy injection
- If you still get circular dependency errors, try Option B in the integration guide

---

## Summary

- **Automatic cleanup** happens in 3 scenarios (auth, session end, scheduled)
- **Manual cleanup** available via POST /auth/reset-guest endpoint
- **No breaking changes** to existing auth flow
- **Fully logged** for monitoring and debugging
