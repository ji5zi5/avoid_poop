# Avoid Poop Production Readiness Checklist

**Status date:** 2026-04-13
**Scope:** reality check for taking the current repo from "working demo / internal alpha" to a public hosted launch.

## Repo evidence snapshot

What the repo already has today:

- Account auth with cookie sessions (`server/src/modules/auth/*`)
- Single-player result persistence and personal records (`server/src/modules/records/*`)
- Single + multiplayer leaderboard payloads returned by `/api/records` (`shared/src/contracts/records.ts`, `server/src/modules/records/records.service.ts`)
- Multiplayer room creation, quick join, room codes, lobby chat, reconnect grace, and winner persistence (`server/src/modules/multiplayer/*`, `frontend/src/routes/MultiplayerLobbyPage.tsx`)
- A player-facing records / ranking screen (`frontend/src/routes/RecordsPage.tsx`)
- Health endpoint (`server/src/app.ts` → `/api/health`)
- Workspace verification entrypoints (`npm run lint`, `npm test`, `npm run build`)
- Baseline environment template with future Postgres placeholder (`.env.example`)

## Release readiness verdict

- **Internal alpha:** yes, with trusted users and one operator.
- **Closed beta:** close, but only after auth/write throttling, secret/env hardening, and an explicit operator checklist.
- **Public launch:** **not ready yet**. The main blockers are durability, abuse controls, and operational visibility.

## Public-launch blockers

### 1. Data durability and scaling

**Current evidence**
- Persistent data is still SQLite-backed (`server/src/db/client.ts`, `server/src/db/schema.ts`).
- Live multiplayer room state is process memory in `server/src/modules/multiplayer/room.service.ts`.
- Production env contract mentions `DATABASE_URL` only as a comment today (`.env.example`).

**Why it blocks launch**
- Single-node SQLite is fragile for public traffic, backups, and host replacement.
- Deploy restarts or crashes will drop active multiplayer rooms.
- Current code does not yet prove query parity against Postgres for leaderboard ordering and aggregate stats.

**Required before launch**
- Move persisted data to managed Postgres.
- Add migrations + schema parity verification.
- Decide whether multiplayer remains intentionally single-instance or gets shared room state.
- Add backup + restore drill documentation.

### 2. Security and abuse controls

**Current evidence**
- No request throttling or rate limiting is registered in `server/src/app.ts`.
- `config.cookieSecret` still has a dev fallback (`server/src/config.ts`).
- Lobby chat exists, but there is no profanity/moderation layer in `server/src/modules/multiplayer/room.service.ts` / `socket.gateway.ts`.

**Why it blocks launch**
- Signup/login and room creation are exposed to brute force and spam.
- A missing or weak production cookie secret becomes a direct session risk.
- Public chat and usernames need basic abuse handling before opening the site broadly.

**Required before launch**
- Rate limit auth, records writes, room creation, and socket handshake hot paths.
- Remove unsafe production fallbacks for secrets.
- Add username rules plus basic chat moderation / abuse reporting path.
- Document cookie rotation + incident response steps.

### 3. Operations and observability

**Current evidence**
- Fastify logger is disabled (`server/src/app.ts` → `Fastify({logger: false})`).
- There are no runtime counters or dashboards for active rooms, sockets, reconnects, or match completions.
- There is no documented alert or on-call playbook in `docs/` yet.

**Why it blocks launch**
- Production failures will be hard to triage.
- Multiplayer incidents need room-level visibility, especially around disconnects and reconnect grace.
- Without metrics, it is hard to judge whether the service is healthy during launch.

**Required before launch**
- Enable structured production logging.
- Emit room/socket lifecycle metrics.
- Document smoke checks, incident triage, and rollback triggers.

### 4. Deployment hygiene

**Current evidence**
- `.env.example` exists, but there is no production deployment guide or rollback checklist in `docs/`.
- `/api/health` exists, but there is no documented smoke sequence that exercises auth, records, rankings, and multiplayer flow.

**Why it blocks launch**
- A launch without an operator runbook makes routine deploys and incident rollback too error-prone.
- The health route alone does not verify session auth, DB writes, or websocket gameplay paths.

**Required before launch**
- Document deployment sequence, rollback sequence, and smoke verification.
- Expand the env contract from placeholder values into a release checklist.
- Define staging vs production readiness gates.

### 5. Product / policy surface

**Current evidence**
- Records and rankings exist, but there is no public explanation of how ranks are derived.
- No Terms, Privacy, Support, or report-abuse route is present in the current frontend route set.
- No written account deletion / retention policy exists in `docs/`.

**Why it blocks launch**
- Public users need basic policy and support surfaces.
- Leaderboards need a player-facing explanation before they become a public promise.
- Retention/deletion expectations need to be defined before storing real user accounts.

**Required before launch**
- Add Terms / Privacy / Support entry points.
- Publish a ranking explainer.
- Define data retention and account deletion policy.

## Launch gates

### Gate A — Internal alpha
- One instance is acceptable.
- SQLite is acceptable.
- Manual operator oversight is acceptable.
- Use trusted testers only.

### Gate B — Closed beta
- Add rate limiting and stronger env/secret validation.
- Add deploy + smoke checklist.
- Add basic logs for auth, room lifecycle, and socket disconnect causes.
- Confirm the leaderboard/records UX copy is ready for external testers.

### Gate C — Public launch
- Postgres cutover complete and verified.
- Backup/restore drill documented and rehearsed.
- Abuse controls live for auth, usernames, and chat.
- Structured logs + room/socket metrics available.
- Policy/support pages shipped.

## Execution artifacts for this lane

- `docs/plans/2026-04-13-postgres-migration-prep.md` — DB migration prep and parity checklist
- `docs/plans/2026-04-13-public-launch-ticket-breakdown.md` — concrete ticket list with acceptance criteria

## Recommended sequencing

1. Stabilize storage and env contract.
2. Add abuse/rate-limit controls.
3. Add production logs, metrics, and rollout runbook.
4. Ship policy + support + ranking explanation surfaces.
5. Re-run full lint/test/build/e2e against staging before public traffic.
