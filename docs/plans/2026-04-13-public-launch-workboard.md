# Avoid Poop Public Launch Workboard

Date: 2026-04-13  
Status: Draft execution checklist

## Goal
Turn the current "works in dev" state into a trackable public-launch plan with explicit blocker tickets, acceptance criteria, and verification commands.

## Release gate
- `npm run lint`
- `npm test`
- `npm run build`
- auth/session smoke path still works
- `/api/records` still returns personal profile + global leaderboard data
- multiplayer room create/join/socket reconnect flow still passes smoke coverage

## Concrete blocker tickets

### DB-01 — Add a Postgres-ready database seam without breaking SQLite
**Why**
- Current repositories call `getDb().prepare(...)` directly, so the eventual Postgres swap is still high-risk.

**Acceptance**
- repository layer depends on a narrowed DB adapter surface instead of raw SQLite-specific calls
- SQLite remains the default local/dev path
- future `DATABASE_URL` configuration contract is documented and validated

**Verification**
- `npm run lint --workspace server`
- `npm run test --workspace server`
- leaderboard/profile queries still return the same shapes

### DB-02 — Capture SQL migration ownership before production cutover
**Why**
- Schema bootstrap currently lives in `schemaSql` and startup-time migration logic, which is fine for SQLite but brittle for production rollout.

**Acceptance**
- first migration owner is named in docs
- migration order is explicit for `users`, `sessions`, `records`, `multiplayer_matches`, `multiplayer_participants`
- query compatibility checklist exists for `RETURNING`, `ROW_NUMBER()`, aggregate nullability, and timestamp ordering

**Verification**
- docs reviewed against `server/src/db/*`
- staging dry-run checklist written before the first Postgres experiment

### OPS-01 — Decide single-instance vs shared-state multiplayer operations
**Why**
- live room state is still process memory, so a restart or multi-instance rollout can drop active rooms.

**Acceptance**
- one of two launch stances is chosen:
  1. single-instance hosted alpha with explicit restart policy, or
  2. Redis/shared-state follow-up ticket approved before public launch
- reconnect, room lifecycle, and match completion metrics are named

**Verification**
- smoke test includes room create -> join -> start -> reconnect path
- deploy docs call out room-loss risk if still single-instance

### SEC-01 — Add baseline abuse controls before open signup
**Why**
- auth, records writes, and room creation still lack rate limiting / abuse controls.

**Acceptance**
- auth/signup/login throttling ticket exists
- records write throttling ticket exists
- username policy and chat moderation policy are documented

**Verification**
- manual checklist reviewed before closed beta
- production env docs include secret rotation ownership

### PROD-01 — Publish player-facing trust pages
**Why**
- a public leaderboard needs policy/context pages so ranking rules and account handling are explainable.

**Acceptance**
- ranking explanation page ticket exists
- terms/privacy/support route ticket exists
- account deletion / retention policy ticket exists

**Verification**
- routes linked from the app shell before public launch

## Recommended execution order
1. Keep root lint/test/build green after every change set.
2. Land DB seam + env contract work before production hosting experiments.
3. Freeze single-instance multiplayer scope unless shared-state infra is explicitly funded.
4. Add abuse controls before inviting untrusted users.
5. Add policy/support pages before calling the leaderboard public.

## Verification matrix for this repo state
- **Static**: `npm run lint`
- **Unit/integration/e2e**: `npm test`
- **Production build**: `npm run build`
- **Records contract**: verify `/api/records` assertions in `server/src/app.test.ts` and `tests/e2e/run-e2e.mjs`
- **Multiplayer reconnect smoke**: verify `tests/e2e/run-e2e.mjs`
