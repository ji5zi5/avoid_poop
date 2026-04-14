# Avoid Poop Hosted Beta Deploy Runbook

**Status date:** 2026-04-14  
**Audience:** one operator shipping a hosted beta / limited public test.

## What this runbook assumes

- You are still on the current single-instance architecture.
- Persistent data is still SQLite.
- Live multiplayer rooms are still process memory.
- The repo now enforces:
  - explicit production secret/origin validation
  - structured logging
  - basic rate limiting for auth and write-heavy paths
  - websocket handshake throttling

## Required environment

Minimum production env:

```env
NODE_ENV=production
PORT=3001
COOKIE_SECRET=<long-random-secret>
COOKIE_SAME_SITE=none
APP_ORIGIN=https://your-domain.example
TRUST_PROXY=true
LOG_ENABLED=true
LOG_LEVEL=info
DB_PROVIDER=sqlite
DB_PATH=server/data/avoid-poop.sqlite
RATE_LIMIT_AUTH_MAX=12
RATE_LIMIT_AUTH_WINDOW_MS=60000
RATE_LIMIT_WRITES_MAX=40
RATE_LIMIT_WRITES_WINDOW_MS=60000
RATE_LIMIT_WS_MAX=40
RATE_LIMIT_WS_WINDOW_MS=60000
```

## Vercel + Render split-host note

If the frontend is served from Vercel and the backend is served from Render:

- `APP_ORIGIN` on the backend must equal the Vercel origin.
- `COOKIE_SAME_SITE=none` is required so auth cookies can be sent cross-site.
- frontend env should point at the Render backend:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com
VITE_WS_BASE_URL=wss://your-render-service.onrender.com
```

- the backend now responds with credentialed CORS headers for the configured `APP_ORIGIN`.
- websocket upgrades from other origins are rejected.

## Pre-deploy checklist

1. Pull latest main branch.
2. Confirm secrets are set and not using defaults.
3. Confirm deployment host has a persistent writable volume for `DB_PATH`.
4. Confirm only one app instance is serving multiplayer traffic.
5. Run:
   - `npm run lint`
   - `npm test`
   - `npm run build`

## Deploy sequence

1. Provision/update env vars.
2. Ensure the SQLite data directory exists on persistent storage.
3. Start the server behind HTTPS / reverse proxy.
4. Verify boot logs show no config validation failure.

## Smoke test sequence

Run these against the deployed site in order:

1. `GET /api/health` returns `200`.
2. Sign up a fresh user.
3. Log out and log back in.
4. Save one normal and one hard run.
5. Open ranking page and confirm leaderboard/profile data loads.
6. Create a public room and join it from a second browser.
7. Create a private room and confirm wrong password fails, correct password joins.
8. Start a multiplayer match and confirm reconnect works within grace period.

## Rollback triggers

Rollback immediately if:

- production boot fails due to env validation
- auth/signup/login starts returning `429` for normal usage patterns
- ranking/records writes fail
- websocket connect/join flow is unstable after deploy

## Rollback steps

1. Stop the new process.
2. Start the previous known-good build with the same persistent `DB_PATH`.
3. Re-run the smoke test sequence.
4. Capture logs around:
   - `rate_limit_exceeded`
   - `origin_rejected`
   - `multiplayer_ws_rate_limited`
   - `multiplayer_socket_*`

## Known beta limitations

- SQLite is still the persistent store.
- Active multiplayer rooms are lost on process restart.
- This is suitable for a hosted beta, not a large public launch.
