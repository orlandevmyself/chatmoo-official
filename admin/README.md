# Chatmoo Admin Panel

Separate React app for platform administration.

## Setup

```bash
cd admin
npm install
```

## Running

```bash
# Start admin app on port 3001
npm start
```

Admin runs on `http://localhost:3001/admin` (or just `http://localhost:3001` locally).

## Login

1. Email-based login: Enter an admin account email
2. Google OAuth: Uses same OAuth as main app (requires admin role)

Admin users are identified by `role === 'admin'` in the User model.

## Features

- **Overview Dashboard** — user signups, active sessions, chat counts, revenue
- **Users Management** — list, search, filter, ban/unban, promote to admin
- **Transactions Report** — filterable table with CSV export, payment oversight
- **Gift Catalog** — add/edit/disable gifts, update coins/prices
- **Platform Config** — earn rate, withdrawable %, min/max transaction amounts

## Architecture

- `src/lib/api.js` — API client for `/admin/*` endpoints
- `src/context/AdminAuthContext.js` — admin user state
- `src/components/` — page components (dashboard, tables, forms)

All admin routes pass `userId` (admin's ID) in the query string to gate access server-side.

## Notes

- Backend expects admin routes at `/admin/*` (already implemented in admin.controller.ts)
- Config keys: `withdrawablePercent`, `minDepositMinor`, `minWithdrawMinor`, `maxTxMinor`
- Gifts are seeded from `backend/src/wallet/gift-catalog.ts` on first boot
- Transactions can be filtered by type (deposit/withdraw), status, method
