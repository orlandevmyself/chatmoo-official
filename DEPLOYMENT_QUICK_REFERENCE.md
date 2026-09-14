# Cloud Deployment Quick Reference

## TL;DR: 3 Services to Deploy

| Service | Host | URL Format | Time |
|---------|------|-----------|------|
| Backend (NestJS) | Render | `https://chatmoo-backend.onrender.com` | 3-5 min |
| Frontend (React) | Vercel | `https://chatmoo-frontend.vercel.app` | 1-2 min |
| Admin (React) | Vercel | `https://chatmoo-admin.vercel.app` | 1-2 min |

## Pre-Flight Checklist

- [ ] Repo pushed to GitHub
- [ ] Have your env vars from `backend/.env` ready (DB, Redis, etc)
- [ ] Render + Vercel accounts created and linked to GitHub

## Deployment Checklist

### 1. Render Backend
- [ ] Create Web Service, select repo
- [ ] Set Root Directory: `backend`
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm run start:prod`
- [ ] Copy env vars from `backend/.env`
- [ ] Set `GOOGLE_CALLBACK_URL = https://<your-app>.onrender.com/auth/google/callback`
- [ ] Deploy
- [ ] Note backend URL: `https://<your-app>.onrender.com`

### 2. Vercel Frontend
- [ ] Create project, select repo
- [ ] Root Directory: `frontend`
- [ ] Set `REACT_APP_API_URL` = Render URL
- [ ] Set `REACT_APP_SOCKET_URL` = Render URL
- [ ] Set `REACT_APP_PAYMONGO_PUBLIC_KEY` = `pk_test_...`
- [ ] Deploy
- [ ] Note frontend URL: `https://<frontend-name>.vercel.app`

### 3. Vercel Admin
- [ ] Create **NEW** project, select repo
- [ ] Root Directory: `admin`
- [ ] Set `REACT_APP_ADMIN_API_URL` = Render URL
- [ ] Deploy
- [ ] Note admin URL: `https://<admin-name>.vercel.app`

### 4. Wire It Back
- [ ] Render: set `ALLOWED_ORIGINS` = both Vercel URLs
- [ ] Render: redeploy
- [ ] Google Cloud: add Render callback URL to OAuth credentials
- [ ] PayMongo: set webhook to Render URL + confirm secret

## Test URLs

```
Health Check:
  https://<your-app>.onrender.com/health

Frontend:
  https://<frontend-name>.vercel.app

Admin:
  https://<admin-name>.vercel.app
```

## Common Issues

| Issue | Fix |
|-------|-----|
| "Not allowed by CORS" | Update Render `ALLOWED_ORIGINS`, redeploy |
| OAuth fails | Add callback URL to Google Cloud Console |
| Webhook not received | Confirm PayMongo URL + secret match |
| WebSocket fails | Verify `REACT_APP_SOCKET_URL` is HTTPS (not localhost) |

## Documentation

See `CLOUD_DEPLOYMENT_GUIDE.md` for detailed step-by-step instructions.

---

**Time to fully deployed**: ~20-30 minutes (mostly waiting for builds)
