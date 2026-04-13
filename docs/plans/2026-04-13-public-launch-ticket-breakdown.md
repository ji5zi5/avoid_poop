# Public Launch Ticket Breakdown

**Status date:** 2026-04-13
**Purpose:** turn the production-readiness review into concrete, mergeable work items with acceptance criteria.

## Prioritization rule

- **P0:** must land before a public launch
- **P1:** should land before public launch unless scope is explicitly reduced
- **P2:** acceptable for post-launch follow-up or a later scale pass

## P0 launch blockers

### DB-01 — Add explicit production DB configuration and storage boundary
- **Priority:** P0
- **Why:** current config is still SQLite-first and `DATABASE_URL` is only documented as a comment.
- **Touchpoints:** `server/src/config.ts`, `server/src/db/*`, repository modules under `server/src/modules/**/**/*.repository.ts`, `.env.example`
- **Acceptance criteria:**
  - production env contract clearly supports Postgres configuration
  - storage selection is documented and testable
  - route/service layers do not depend on SQLite-specific types

### DB-02 — Add reproducible SQL migrations and schema parity checks
- **Priority:** P0
- **Why:** launch should not depend on implicit SQLite bootstrap behavior.
- **Touchpoints:** migration directory/tooling, `server/src/db/schema.ts`, repository tests
- **Acceptance criteria:**
  - fresh database can be created from migrations
  - tables for users, sessions, records, multiplayer matches, participants are covered
  - schema parity is verified in CI or release checks

### DB-03 — Prove records / leaderboard parity on Postgres
- **Priority:** P0
- **Why:** `/api/records` is now a player-facing surface and ranking errors are launch-breaking.
- **Touchpoints:** `server/src/modules/records/*`, `server/src/modules/multiplayer/results.repository.ts`, shared contracts/tests
- **Acceptance criteria:**
  - personal best ordering matches expected tie-break rules
  - multiplayer leaderboard ordering is covered by tests
  - empty-stat and nullability cases are verified

### SEC-01 — Add auth and write-path throttling
- **Priority:** P0
- **Why:** signup/login, records writes, room creation, and socket handshake paths are currently unthrottled.
- **Touchpoints:** `server/src/app.ts`, auth routes, records routes, multiplayer routes/socket handshake
- **Acceptance criteria:**
  - rate limiting exists for auth endpoints
  - write-heavy endpoints are protected
  - operators can tune limits per environment

### SEC-02 — Remove unsafe production secret fallbacks
- **Priority:** P0
- **Why:** `COOKIE_SECRET` still falls back to a dev string.
- **Touchpoints:** `server/src/config.ts`, deploy/env docs
- **Acceptance criteria:**
  - production boot fails fast when required secrets are missing
  - secret rotation guidance is documented

### OPS-01 — Turn on structured production logging for server and socket lifecycle
- **Priority:** P0
- **Why:** `Fastify({logger: false})` leaves no durable signal during incidents.
- **Touchpoints:** `server/src/app.ts`, multiplayer room/socket modules, deploy docs
- **Acceptance criteria:**
  - request/server logs are available in production
  - room create/join/start/end/disconnect paths emit structured events
  - reconnect expiry and forced leave reasons are logged

### OPS-02 — Write deploy, rollback, and smoke-test runbook
- **Priority:** P0
- **Why:** health checks exist, but there is no operator playbook.
- **Touchpoints:** `docs/` (new runbook or checklist docs), `.env.example`
- **Acceptance criteria:**
  - deploy sequence is documented
  - rollback trigger + steps are documented
  - smoke list covers auth, records, rankings, room join, and multiplayer completion

## P1 launch work

### SEC-03 — Add username/chat abuse guardrails
- **Priority:** P1
- **Why:** public usernames and lobby chat need basic moderation before open launch.
- **Touchpoints:** auth validation, multiplayer room/socket flow, frontend lobby copy, support docs
- **Acceptance criteria:**
  - username rules are documented and enforced
  - chat profanity/spam baseline exists
  - report-abuse path is defined

### OPS-03 — Add runtime metrics for active rooms and sockets
- **Priority:** P1
- **Why:** logs alone are not enough for launch-day visibility.
- **Touchpoints:** multiplayer room service, socket gateway, deploy/ops docs
- **Acceptance criteria:**
  - active rooms, active sockets, reconnect recoveries, and match completions are observable
  - metrics are available in staging before launch

### WEB-01 — Add policy / support surface
- **Priority:** P1
- **Why:** no Terms, Privacy, Support, or account-deletion guidance is visible today.
- **Touchpoints:** frontend routes, copy/content, docs
- **Acceptance criteria:**
  - users can reach Terms, Privacy, and Support pages
  - retention/deletion expectations are written down
  - abuse-report contact path is live

### WEB-02 — Publish ranking and records explainer
- **Priority:** P1
- **Why:** the public leaderboard needs transparent player-facing rules.
- **Touchpoints:** `frontend/src/routes/RecordsPage.tsx`, copy/content, docs
- **Acceptance criteria:**
  - ranking tie-break rules are visible to players
  - multiplayer win/placement metrics are explained
  - support/docs copy matches server behavior

## P2 scale follow-up

### MP-01 — Decide long-lived architecture for live room state
- **Priority:** P2 unless public launch targets multi-instance infra immediately
- **Why:** Postgres does not solve process-memory multiplayer rooms.
- **Touchpoints:** `server/src/modules/multiplayer/room.service.ts`, infra docs
- **Acceptance criteria:**
  - the team explicitly chooses single-instance with constraints, or
  - shared room state / coordination design is documented and scheduled

## Suggested execution order

1. `DB-01`
2. `DB-02`
3. `DB-03`
4. `SEC-01`
5. `SEC-02`
6. `OPS-01`
7. `OPS-02`
8. `SEC-03`
9. `OPS-03`
10. `WEB-01`
11. `WEB-02`
12. `MP-01`

## Exit criteria for the docs/review lane

This lane is complete when:
- the blockers are written down against current repo evidence
- launch work is broken into concrete tickets
- Postgres migration prep is explicit enough that implementation can start without rediscovering scope
