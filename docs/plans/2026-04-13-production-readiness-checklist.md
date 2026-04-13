# Avoid Poop Production Readiness Checklist

## What exists now
- Account auth with cookie sessions
- Single-player score persistence
- Multiplayer room creation, quick join, private room codes, chat, and reconnect grace
- Global ranking + personal records surface
- Frontend/server/shared test suite and e2e smoke flow

## Biggest gaps before a real public site launch

### 1. Database and durability
- Current storage is SQLite on a single node.
- Good for local/dev and small demos, risky for concurrent real traffic.
- Multiplayer room state is still process memory, so deploy restarts drop live rooms.

**Required before launch**
- Move persistent data to managed Postgres
- Add automated backups and restore drill
- Decide whether live room state stays memory-only or moves to Redis/shared state

### 2. Security and abuse controls
- No rate limiting on auth or write endpoints yet
- No bot/bruteforce protection for signup/login
- No moderation/admin tooling for usernames or abusive chat

**Required before launch**
- Rate limiting on auth, records, multiplayer room creation
- Username validation and moderation policy
- Basic profanity / abuse filter for chat
- Production cookie secret rotation policy

### 3. Multiplayer operations
- WebSocket runtime works, but production readiness needs long-running stability testing
- No multi-instance coordination layer yet
- No operational dashboards for active rooms / stuck matches / socket errors

**Required before launch**
- Decide single-instance vs multi-instance architecture
- Add structured logs for room lifecycle and socket disconnect causes
- Add runtime metrics: active rooms, active sockets, reconnect recoveries, match completions

### 4. Deployment hygiene
- No documented deploy pipeline yet
- No environment template for production
- No health check / smoke runbook documented

**Required before launch**
- Create `.env.example`
- Document deploy and rollback flow
- Add health-check and smoke-test steps to deploy checklist

### 5. Product / policy basics
- Ranking exists, but no public-facing explanation of ranking rules
- No Terms / Privacy / Support route
- No account deletion / data cleanup policy yet

**Required before launch**
- Terms / privacy pages
- Ranking explanation page
- Contact / report abuse route

## Launch recommendation
- **Internal alpha**: possible now with a small trusted group
- **Closed beta**: possible after rate limiting + env hardening + manual ops checklist
- **Public release**: wait for managed DB + multiplayer ops plan + abuse controls

## Suggested rollout stages
1. Local/dev complete
2. Internal hosted alpha on one instance
3. Closed beta with rate limits + monitoring
4. Public launch after Postgres and ops hardening
