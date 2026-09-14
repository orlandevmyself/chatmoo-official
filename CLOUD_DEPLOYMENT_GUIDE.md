# Cloud Deployment Guide — Render + Vercel (All Free)

This guide walks you through deploying ChatMoo to production-like cloud hosting **completely free**. The setup supports PayMongo webhooks and Google OAuth callbacks, which require stable public HTTPS URLs.

## Why Cloud Instead of ngrok?

**ngrok** (your existing TUNNEL_TESTING.md setup):
- ✅ Instant, zero-code setup
- ❌ URLs change every restart
- ❌ Sleeps when you close your laptop
- ❌ PayMongo webhooks can't reliably reach you
- ❌ Google OAuth callback URL keeps breaking

**Render + Vercel (this guide)**:
- ✅ Stable URLs forever (`https://your-app.onrender.com`)
- ✅ Always online (even when your PC is off)
- ✅ PayMongo webhooks work reliably
- ✅ Google OAuth callback stays valid
- ❌ Free tier has 15-min inactivity sleep (acceptable for testing)

## Architecture

```
┌─────────────────┐
│   PostgreSQL    │  (Prisma pooled, cloud-hosted)
│   Redis (Upstash)
│   Supabase Files│  No changes needed — already cloud
└─────────────────┘

Render.com (backend — NestJS on free Web Service)
  ├─ /api/* (REST endpoints)
  ├─ /ws/* (WebSocket chat)
  └─ /health (Terminus health check)
       ↑
       │ API calls from:
       ├─ Vercel frontend (User app)
       └─ Vercel admin (Admin panel)
```

## Prerequisites

- **GitHub account** (Render and Vercel deploy from git)
- **Render account** (free, sign up at https://render.com)
- **Vercel account** (free, sign up at https://vercel.com)
- **Code pushed to GitHub** (your ChatMoo repo)

## Step 1: Push to GitHub

If not already done:

```bash
git remote add origin https://github.com/<your-username>/chatmoo.git
git push -u origin main
```

(Or push your current branch if not `main`)

## Step 2: Deploy Backend to Render

### 2.1 Create Render Web Service

1. Go to https://dashboard.render.com/
2. Click **New +** → **Web Service**
3. Connect to GitHub repo (authorize Render to access your repo)
4. **Configure Service:**
   - **Name**: `chatmoo-backend` (or any name)
   - **Repository**: select your ChatMoo repo
   - **Branch**: `main` (or your current branch)
   - **Root Directory**: `backend` (Render will run `npm` from here)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
5. **DO NOT YET click Deploy** — configure env vars first.

### 2.2 Add Environment Variables

Still in the Web Service creation form, scroll down to **Environment**:

```
DATABASE_URL = postgres://... (copy from backend/.env)
UPSTASH_REDIS_REST_URL = https://... (copy from backend/.env)
UPSTASH_REDIS_REST_TOKEN = ... (copy from backend/.env)
SUPABASE_URL = https://... (copy from backend/.env)
SUPABASE_PUBLISHABLE_KEY = sb_... (copy from backend/.env)
SUPABASE_SECRET_KEY = sb_... (copy from backend/.env)
SUPABASE_JWKS_URL = https://... (copy from backend/.env)
SUPABASE_BUCKET = ChatMoo (copy from backend/.env)
GOOGLE_CLIENT_ID = ... (copy from backend/.env)
GOOGLE_CLIENT_SECRET = ... (copy from backend/.env)
GOOGLE_CALLBACK_URL = https://<your-app>.onrender.com/auth/google/callback
  (replace <your-app> with the name you chose, or a unique ID Render gives you)
PAYMONGO_SECRET_KEY = sk_test_... (copy from backend/.env)
PAYMONGO_PUBLIC_KEY = pk_test_... (copy from backend/.env)
PAYMONGO_WEBHOOK_SECRET = whsk_... (copy from backend/.env)
WITHDRAWABLE_PERCENT = 80 (or your value)
ALLOWED_ORIGINS = (leave empty for now, add after frontend deploys)
```

### 2.3 Deploy

Click **Deploy** and wait ~3-5 min for first build.

Once deployed, note your URL: `https://<your-app>.onrender.com` (visible at the top of the Render dashboard).

Test the backend is alive:
```bash
curl https://<your-app>.onrender.com/health
```
Should return a health status JSON.

## Step 3: Deploy Frontend to Vercel

### 3.1 Create Vercel Project

1. Go to https://vercel.com/new
2. Select your GitHub repo → import
3. **Framework Preset**: Create React App (auto-detected)
4. **Root Directory**: `frontend`
5. Click **Deploy**

### 3.2 Add Environment Variables

While the initial deploy runs, go to **Settings** → **Environment Variables** and add:

```
REACT_APP_API_URL = https://<your-app>.onrender.com
REACT_APP_SOCKET_URL = https://<your-app>.onrender.com
REACT_APP_PAYMONGO_PUBLIC_KEY = pk_test_<your-test-public-key>
```

Redeploy (or manually trigger redeploy in dashboard) for env vars to take effect.

After deploy completes, note your frontend URL: `https://<your-frontend>.vercel.app`

## Step 4: Deploy Admin to Vercel (Separate Project)

### 4.1 Create Second Vercel Project

1. Go to https://vercel.com/new
2. Select your GitHub repo again
3. **Framework Preset**: Create React App
4. **Root Directory**: `admin`
5. Click **Deploy**

### 4.2 Add Environment Variable

**Settings** → **Environment Variables**:

```
REACT_APP_ADMIN_API_URL = https://<your-app>.onrender.com
```

Redeploy.

After deploy, note your admin URL: `https://<your-admin>.vercel.app`

## Step 5: Wire Backend CORS to Allow Frontend/Admin

Go back to **Render dashboard** → your backend service → **Settings** → scroll to **Environment**:

Update:
```
ALLOWED_ORIGINS = https://<your-frontend>.vercel.app,https://<your-admin>.vercel.app
```

Click **Save** and the service will auto-redeploy. Wait ~1-2 min.

## Step 6: Register Callback URLs with Third Parties

### 6.1 Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Select your ChatMoo project
3. **APIs & Services** → **Credentials**
4. Edit your OAuth 2.0 Client ID (the one with GOOGLE_CLIENT_ID)
5. Under **Authorized redirect URIs**, add:
   ```
   https://<your-app>.onrender.com/auth/google/callback
   ```
6. **Save**

### 6.2 PayMongo Dashboard

1. Go to https://dashboard.paymongo.com/
2. **Webhooks** section
3. Create/update webhook endpoint:
   ```
   https://<your-app>.onrender.com/paymongo/webhook
   ```
4. Confirm the **Webhook Secret** matches `PAYMONGO_WEBHOOK_SECRET` in Render env vars

## Testing

### Backend health
```bash
curl https://<your-app>.onrender.com/health
```

### Frontend (User App)
1. Open `https://<your-frontend>.vercel.app`
2. Try **Sign In with Google** — confirm OAuth redirects back correctly
3. Start a chat — confirm WebSocket connection works (check Network tab in DevTools)

### Admin
1. Open `https://<your-admin>.vercel.app`
2. Admin login (default username is usually `admin`, password from your DB or seeding)
3. Confirm dashboard loads data from backend API

### PayMongo Webhook
1. Make a test wallet deposit with test card `4242 4242 4242 4242`
2. Check Render backend logs — should see webhook signature verification and wallet credit
3. Confirm wallet balance increases on the frontend

## Important Notes

### Free Tier Limitations

- **Render Web Service sleeps after 15 min of inactivity** and cold-starts on next request (~30-50s delay). Acceptable for dev/testing, not production.
- **Vercel static hosting** (frontend/admin) never sleeps — instant loads always.

### Local Development Still Works

Your local dev setup (`npm run start:dev` in each directory) still works unchanged. Use locally when you want instant hot-reload; push to GitHub and watch Render/Vercel auto-deploy when you commit.

### Updating Backend Code

1. Make changes locally in `backend/src/`
2. `git commit && git push origin main`
3. Render auto-detects the push and redeploys (~3-5 min build time)

### Updating Frontend/Admin Code

Same as backend — commit, push, Vercel auto-deploys.

## Troubleshooting

### "Not allowed by CORS" in browser console

**Cause**: Frontend URL not in Render's `ALLOWED_ORIGINS`.

**Fix**: 
1. Render dashboard → Environment variables
2. Verify `ALLOWED_ORIGINS` includes the Vercel frontend URL
3. Save → redeploy

### Google OAuth callback fails

**Cause**: Callback URL not registered in Google Cloud Console.

**Fix**:
1. Go to Google Cloud Console → OAuth 2.0 Client ID credentials
2. Add `https://<your-app>.onrender.com/auth/google/callback` under **Authorized redirect URIs**
3. Save

### PayMongo webhooks not received

**Cause**: Webhook endpoint URL or secret mismatch.

**Fix**:
1. Render → Environment → confirm `PAYMONGO_WEBHOOK_SECRET` is correct
2. PayMongo dashboard → Webhook endpoint is exactly `https://<your-app>.onrender.com/paymongo/webhook`
3. Redeploy Render

### WebSocket connection fails on Vercel frontend

**Cause**: `REACT_APP_SOCKET_URL` not set or pointing to localhost.

**Fix**:
1. Vercel → Settings → Environment Variables
2. Confirm `REACT_APP_SOCKET_URL = https://<your-app>.onrender.com` (not localhost)
3. Redeploy

## Next Steps

Once everything is working:
- **Share URLs** with testers (e.g., `https://<your-frontend>.vercel.app`)
- **Monitor Render logs** for errors (Render dashboard → Logs tab)
- **Test PayMongo payments** end-to-end with your test API key
- When ready for production, upgrade to **Render Pro** (paid) for always-on backend

---

**Summary**: You now have ChatMoo running on production-like cloud hosting with stable URLs, webhook support, and zero monthly cost (free tier). Enjoy testing!
