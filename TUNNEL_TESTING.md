# ChatMoo Tunnel Testing Guide

## Setup Instructions

### Prerequisites
- ngrok installed: https://ngrok.com/download
- ngrok authenticated with your auth token
- All services built and ready to run

### Port Configuration
- **Backend**: 3000
- **Frontend**: 3001  
- **Admin**: 3002

### Quick Start

#### Option 1: macOS/Linux
```bash
bash setup-tunnel.sh
```

#### Option 2: Windows
```bash
setup-tunnel.bat
```

#### Option 3: Manual Setup
Open 4 separate terminal windows:

**Terminal 1 - Backend**
```bash
cd backend
npm run start
```

**Terminal 2 - Frontend**
```bash
cd frontend
npm start
```

**Terminal 3 - Admin**
```bash
cd admin
npm start
```

**Terminal 4 - ngrok Tunnel**
```bash
ngrok start --all
```

## Testing Checklist

### Authentication & User Flow
- [ ] Signup as new user (guest)
- [ ] Login with existing account
- [ ] View user profile
- [ ] Logout

### Chat Features
- [ ] Start new random chat
- [ ] Send/receive messages
- [ ] Skip match
- [ ] End conversation
- [ ] Save conversation

### Conversations
- [ ] View saved conversations list
- [ ] Click conversation to view chat
- [ ] See message count and timestamps
- [ ] Delete conversation

### Premium Features
- [ ] View premium purchase modal
- [ ] See pricing tiers (3D, 1W, 1M, 3M, 1Y)
- [ ] Check wallet balance
- [ ] Purchase premium tier
- [ ] See premium badge on profile
- [ ] Setup profile with country/university
- [ ] Test premium filters (country, gender)

### Message Requests
- [ ] Search for users by username
- [ ] Send message request with optional message
- [ ] View incoming requests
- [ ] Accept/reject requests
- [ ] View outgoing requests
- [ ] Cancel sent requests

### Loud Speaker
- [ ] Create campaign
- [ ] Set message, scope, duration
- [ ] View campaign in "Your Campaigns"
- [ ] See campaign stats (impressions, clicks)
- [ ] Cancel scheduled campaign

### Admin Panel
- [ ] Login to admin panel
- [ ] View overview dashboard
- [ ] View wallet stats
- [ ] View users list
- [ ] View transactions
- [ ] View vouchers
- [ ] View premium stats
- [ ] View loud speaker campaigns
- [ ] Manage config settings

### Wallet & Transactions
- [ ] Deposit coins
- [ ] View transaction history
- [ ] Check balance updates
- [ ] Redeem voucher code

### Responsive Design
- [ ] Desktop (1920x1080)
- [ ] Tablet (768px)
- [ ] Mobile (375px)

## Tunnel Access

When ngrok starts, you'll see output like:

```
Session Status                online
Account                       your-account@example.com
Version                       3.x.x
Region                        us (United States)

Forwarding                    https://xxxx-xx-xxx-xx.ngrok.io -> http://localhost:3000
Forwarding                    https://yyyy-yy-yyy-yy.ngrok.io -> http://localhost:3001
Forwarding                    https://zzzz-zz-zzz-zz.ngrok.io -> http://localhost:3002
```

### Access Services
- **Frontend (User)**: https://yyyy-yy-yyy-yy.ngrok.io
- **Admin**: https://zzzz-zz-zzz-zz.ngrok.io
- **Backend API**: https://xxxx-xx-xxx-xx.ngrok.io

## Environment Variables

### Local Testing (.env files)
```
REACT_APP_API_URL=http://localhost:3000
REACT_APP_ADMIN_API_URL=http://localhost:3000
```

### Tunnel Testing (.env.tunnel files)
```
REACT_APP_API_URL=http://localhost:3000
REACT_APP_ADMIN_API_URL=http://localhost:3000
```
(Same as local - API URL points to localhost, but accessed through ngrok tunnel)

## Database & Redis

Make sure you have:
- PostgreSQL running and DATABASE_URL set in backend/.env
- Redis running and REDIS_URL set in backend/.env

## Troubleshooting

### ngrok not found
```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/download
```

### ngrok authentication failed
```bash
# Get auth token from https://dashboard.ngrok.com/auth
ngrok config add-authtoken YOUR_TOKEN
```

### Backend connection refused
- Check PORT=3000 in backend/.env
- Verify backend is running: `npm run start`
- Check if port is already in use: `lsof -i :3000`

### Frontend not connecting to API
- Check REACT_APP_API_URL=http://localhost:3000
- Rebuild: `npm run build`
- Restart dev server: `npm start`

### Admin authentication fails
- Check admin/.env.tunnel has REACT_APP_ADMIN_API_URL
- Verify database has admin user
- Check backend is accessible

## Performance Tips

- Use ngrok's free tier for development
- Monitor ngrok dashboard for quota usage
- ngrok URLs change on restart (save URLs if testing across devices)
- For consistent URLs, upgrade to ngrok pro plan

## Testing from Other Devices

1. Get the ngrok tunnel URLs
2. Share the frontend URL: https://yyyy-yy-yyy-yy.ngrok.io
3. Other devices can test without local setup
4. Works on mobile, tablets, other computers

## Notes

- Tunnel URLs expire when ngrok exits
- All local changes sync automatically (hot reload)
- Check network tab in DevTools if API calls fail
- Backend logs appear in Terminal 1
- Frontend logs appear in Terminal 2 and browser console
- Admin logs appear in Terminal 3 and browser console
