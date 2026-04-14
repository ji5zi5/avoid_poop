# Vercel + Render Deploy Steps

## 1. Push the repo

This workspace currently has no Git remote configured, so push the local commits to the GitHub repository you want to deploy from.

Recent deploy-related commits:
- `ce7222e` — hosted-beta hardening
- `b25317b` — websocket hardening regression coverage
- `298cd5d` — split-host Vercel + Render support

## 2. Render (backend)

Create a Render **Web Service** from this repository.

- Blueprint file: `render.yaml`
- Health path: `/api/health`
- Persistent disk mount: `/var/data`
- Start command:

```bash
node server/dist/server/src/index.js
```

Set or confirm:
- `APP_ORIGIN=https://<your-vercel-domain>`
- `COOKIE_SECRET` generated or replaced with your own secret

## 3. Vercel (frontend)

Create a Vercel project from the same repository.

- Root directory: `frontend`
- Config file: `frontend/vercel.json`

Set frontend env:

```env
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
VITE_WS_BASE_URL=wss://<your-render-service>.onrender.com
```

## 4. Final wiring

After Vercel gives you the real frontend URL:

1. Put that URL into Render `APP_ORIGIN`
2. Redeploy Render
3. Confirm signup/login/ranking/multiplayer all work

## 5. Smoke checklist

Run after both services are live:

1. Open the Vercel site
2. Sign up a user
3. Log out and log back in
4. Save a single-player record
5. Open rankings
6. Create/join a public room
7. Create/join a private room
8. Start a multiplayer match
9. Refresh/reconnect during multiplayer
