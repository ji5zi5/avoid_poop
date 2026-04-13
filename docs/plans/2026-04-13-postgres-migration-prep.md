# Postgres Migration Prep for Avoid Poop

**Status date:** 2026-04-13
**Goal:** prepare the repo so auth/session/records/ranking persistence can move from SQLite to managed Postgres without rewriting product logic during launch hardening.

## Current SQLite-coupled touchpoints

### Runtime / config
- `server/src/config.ts` — no active `DATABASE_URL` handling yet
- `server/src/db/client.ts` — SQLite bootstrap, singleton lifecycle, local file creation, and legacy schema migration
- `server/src/db/schema.ts` — schema is currently emitted as SQLite-flavored bootstrap SQL

### Repository layer
- `server/src/modules/auth/auth.repository.ts`
- `server/src/modules/auth/session.repository.ts`
- `server/src/modules/records/records.repository.ts`
- `server/src/modules/multiplayer/results.repository.ts`

### Behaviors that depend on current SQL semantics
- `RETURNING` usage for inserted rows
- `ROW_NUMBER()` leaderboard query in `records.repository.ts`
- aggregate nullability for wins, best placement, and total score
- ordering ties on `created_at`, `id`, `username`, and score-derived fields

## Migration principle

Keep repository return shapes stable and move database-specific behavior behind a smaller adapter boundary first. The goal is to swap storage without forcing route or UI rewrites.

## Recommended migration phases

### Phase 1 — Interface freeze and env contract

**Outcome**
- Repository callers stop depending on SQLite implementation details.
- Production config explicitly supports `DATABASE_URL`.

**Concrete tasks**
- Add an explicit DB configuration contract that prefers `DATABASE_URL` in production while preserving `DB_PATH` for local/dev.
- Document which repository functions are the stable storage interface.
- Remove assumptions that booleans are always `0/1` until converted at the repository boundary.

**Done when**
- Storage selection is documented.
- No route/service layer code imports SQLite-specific types.
- `.env.example` / deploy docs state which envs are required for Postgres.

### Phase 2 — Migration system and schema parity

**Outcome**
- Schema is reproducible through migrations instead of only bootstrap SQL.

**Concrete tasks**
- Create SQL migrations for `users`, `sessions`, `records`, `multiplayer_matches`, and `multiplayer_participants`.
- Preserve current foreign-key and sort behavior.
- Add a repeatable local/staging migration flow.

**Done when**
- A fresh Postgres database can be created from migrations alone.
- The schema supports every query the repositories currently execute.
- Local/dev bootstrap no longer hides schema drift.

### Phase 3 — Query parity and ranking validation

**Outcome**
- Player-facing records and leaderboard behavior match current expectations.

**Concrete tasks**
- Verify personal best ordering for both single-player modes.
- Verify multiplayer leaderboard ordering: wins desc, best placement asc, best reached round desc, matches played desc, username asc.
- Verify aggregate defaults when a user has no records.
- Verify timestamp ordering for recent runs and recent multiplayer matches.

**Done when**
- Shared/schema tests and repository tests pass on Postgres-backed execution.
- Known ordering examples match SQLite behavior or are intentionally updated and documented.

### Phase 4 — Cutover readiness

**Outcome**
- The team can promote Postgres with a rollback path.

**Concrete tasks**
- Define backup/restore steps.
- Define staging seed or snapshot import path.
- Run smoke tests on signup/login, save record, load rankings, create/join room, and persisted multiplayer results.

**Done when**
- Staging passes smoke checks.
- Rollback path is written down.
- Operators know which data is persistent vs process memory.

## Query validation matrix

| Area | Query behavior to verify | Why it matters |
| --- | --- | --- |
| Records inserts | `RETURNING` payload shape | Route handlers depend on inserted row payloads |
| Single leaderboard | `ROW_NUMBER()` + tie ordering | Public ranks must stay stable and predictable |
| Multiplayer leaderboard | `SUM`, `COUNT`, `MIN`, `MAX` nullability | Stats cards and rankings must not regress |
| Recent history | timestamp + id ordering | Player history should not reorder between DBs |
| Sessions | expiry comparisons and cookie-linked lookups | Login stability depends on it |

## Suggested repo change list

1. Add DB config contract and adapter-selection docs.
2. Add migration directory + migration runner.
3. Refactor repository internals to isolate driver-specific code.
4. Add parity tests for records/multiplayer ranking queries.
5. Add staging smoke checklist for auth + records + multiplayer result persistence.

## Concrete next implementation ticket
1. Add a Postgres runtime client with pooled connections and migrations
2. Introduce a repository adapter layer that hides SQLite/Postgres placeholder syntax differences
3. Add staging smoke tests that run auth + records + multiplayer result persistence against Postgres
4. Document snapshot export/import + restore drill in deploy runbook

## Concrete next implementation ticket
1. Add a Postgres runtime client with pooled connections and migrations
2. Introduce a repository adapter layer that hides SQLite/Postgres placeholder syntax differences
3. Add staging smoke tests that run auth + records + multiplayer result persistence against Postgres
4. Document snapshot export/import + restore drill in deploy runbook

## What this repo now scaffolds
- `DATABASE_PROVIDER=sqlite` remains the safe default in `.env.example`
- `DATABASE_PROVIDER=postgres` is recognized, but runtime intentionally throws before boot so we do not imply production readiness without a real adapter
- Postgres DDL draft exists for table/index review before introducing any new dependency or client library

## Next code steps before real cutover
1. Add a repository-level adapter interface that hides `prepare/get/all/run` SQLite specifics
2. Introduce migrations (or checked-in SQL execution flow) for both SQLite bootstrap parity and Postgres schema ownership
3. Add parity tests that seed both providers and compare leaderboard/profile query ordering
4. Only then wire an actual Postgres client and lift the scaffold-only runtime guard

## Non-goals for the first migration

- Do not redesign ranking formulas during DB migration.
- Do not combine DB migration with multi-instance websocket rollout in one deploy.
- Do not add Elo/MMR or season logic while storage parity is still being established.

## Launch dependency note

Postgres migration reduces the biggest persistence risk, but it does **not** solve live multiplayer room durability by itself. Room state is still process memory and needs an explicit single-instance decision or a shared-state follow-up.
