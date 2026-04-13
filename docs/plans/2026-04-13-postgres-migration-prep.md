# Postgres Migration Prep for Avoid Poop

## Goal
Prepare the project so persistent records, sessions, and ranking queries can move from SQLite to managed Postgres without rewriting product logic under launch pressure.

## Current SQLite-coupled areas
- `server/src/db/client.ts`
- `server/src/db/schema.ts`
- all repository modules that call `getDb().prepare(...)`

## Tables to migrate first
1. `users`
2. `sessions`
3. `records`
4. `multiplayer_matches`
5. `multiplayer_participants`

## Recommended migration order
### Phase 1 — Compatibility prep
- Keep current repository API shapes stable
- Avoid leaking DB-specific row types outside repository layer
- Add env contract for future `DATABASE_URL`
- Document schema ownership and migration steps

### Phase 2 — Driver swap
- Introduce a Postgres client behind `getDb` replacement or repository-local adapter
- Recreate schema with SQL migrations instead of ad-hoc bootstrap only
- Replace SQLite boolean/int casting assumptions

### Phase 3 — Ranking and record validation
- Re-run leaderboard and profile queries against Postgres
- Confirm ordering matches SQLite behavior
- Confirm multiplayer stats aggregation matches existing tests

### Phase 4 — Production cutover
- Export local/dev snapshot if needed
- Seed staging database
- Run smoke tests on auth, save record, room flow, rankings

## Query behaviors to verify in Postgres
- `RETURNING` payload shape
- `ROW_NUMBER()` leaderboard ranking query
- `COUNT / SUM / MIN / MAX` nullability behavior
- timestamp ordering for recent runs

## Recommended future architecture
- Postgres: persistent user/account/record/ranking data
- Redis or equivalent: multiplayer live room state if multi-instance is required
- Keep match result persistence in Postgres after game completion

## Minimum env contract for production
- `PORT`
- `COOKIE_SECRET`
- `DATABASE_URL` (future)
- `APP_ORIGIN`
- optional websocket/session tuning envs

## Non-goals for the first migration
- Do not redesign ranking formulas during DB migration
- Do not combine DB migration with websocket multi-node rollout in one deploy
- Do not add Elo/MMR until existing placement/win metrics are stable in production
