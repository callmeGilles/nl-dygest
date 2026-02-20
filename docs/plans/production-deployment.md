# Production Deployment Plan — briefflow.io

**Status:** Not started
**Created:** 2026-02-20

---

## Critical Architecture Decision

**SQLite won't work on most cloud platforms** (Vercel, Railway serverless, etc.) because the filesystem is ephemeral. Two options:

| Option | Pros | Cons |
|--------|------|------|
| **VPS (Recommended for current stack)** | SQLite works as-is, simple, cheap (~$5-7/mo) | Server management required |
| **Switch to Postgres** | Works on any platform (Vercel, etc.) | Migration effort, Drizzle makes it manageable |

Since Briefflow uses better-sqlite3, **a VPS (Hetzner, DigitalOcean, Fly.io) is the simplest path**.

---

## Checklist

### 1. Domain & DNS

- [ ] Buy `briefflow.io`
- [ ] Point DNS A record to server IP (or CNAME to platform)

### 2. Hosting Setup (VPS route)

- [ ] Provision a small VPS (1 GB RAM is enough)
- [ ] Install Node.js
- [ ] Set up PM2 or systemd to run `npm run start`
- [ ] Set up Nginx as reverse proxy
- [ ] Configure SSL with Let's Encrypt / Certbot

### 3. Environment & Config

- [ ] Update `GOOGLE_REDIRECT_URI` to `https://briefflow.io/api/auth/callback`
- [ ] Add `briefflow.io` as authorized redirect URI in Google Cloud Console
- [ ] Set all env vars on the server (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`)
- [ ] Run `npm run build` on the server
- [ ] Run `npm run start`

### 4. Google OAuth Consent Screen

- [ ] Switch from "Testing" to "Production" in Google Cloud Console
- [ ] Prepare for Google verification (sensitive Gmail scopes — can take days/weeks)
- [ ] Add privacy policy URL
- [ ] Add terms of service URL
- [ ] Submit for verification

### 5. Database

- [ ] Run `npm run db:migrate` on the server
- [ ] Set up backup strategy for `briefflow.db` (cron job to object storage)

### 6. Security Hardening

- [ ] Ensure `briefflow-session` cookie has `Secure` flag in production
- [ ] Set `SameSite=Lax` or `Strict` on session cookie
- [ ] Add rate limiting on API routes
- [ ] Review CORS settings

### 7. Multi-user Readiness

If the app should support multiple users (currently designed as single-user):

- [ ] Verify all DB queries are scoped by user/session
- [ ] Verify token storage isolates per-user OAuth tokens
- [ ] Verify edition generation is per-user

---

## Recommended Order of Execution

1. Buy domain
2. Spin up VPS (DigitalOcean / Hetzner, $5-7/mo)
3. Deploy with Nginx + Let's Encrypt + PM2
4. Update Google OAuth settings
5. Submit for Google verification (longest lead time — start early)
