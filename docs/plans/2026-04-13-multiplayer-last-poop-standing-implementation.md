# Multiplayer Last-Poop-Standing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a login-only, real-time 8-player multiplayer survival mode with lobby flow, room code + quick join, spectator mode, reconnect grace period, debuff items, and server-authoritative round/boss gameplay, while also refreshing single-player boss patterns.

**Architecture:** Keep the existing single-player client engine for solo mode, but add a separate server-authoritative multiplayer runtime. Reuse shared rendering/copy assets where possible, move multiplayer state and fairness-critical rules to the Fastify server, and add shared contracts for lobby/socket/result payloads.

**Tech Stack:** React 19, TypeScript, Vite, Fastify, Zod, existing cookie auth/session flow, shared contracts package, server-side multiplayer room/game services, WebSocket transport (requires explicit dependency approval before implementation if using `@fastify/websocket` or `ws`).

---

## Preconditions
- Confirm whether adding one WebSocket dependency is allowed before Task 5.
- Do not edit generated `.js` siblings by hand; implement in `.ts` / `.tsx` source files.
- Keep current single-player auth/records flow working throughout.

### Task 1: Refresh single-player boss patterns before multiplayer work

**Files:**
- Modify: `frontend/src/game/systems/bossPatterns.ts`
- Modify: `frontend/src/game/engine.test.ts`
- Modify: `frontend/src/game/systems/bossPatterns.test.ts`

**Step 1: Write failing/adjusted tests for desired pattern set**
- Add tests that prove:
  - normal mode pattern pool excludes hard-only patterns
  - normal and hard queues differ in length and/or family pressure
  - removed patterns are no longer referenced, added patterns are selectable

**Step 2: Run frontend tests to capture current baseline**
Run: `npm test --workspace frontend`
Expected: existing tests pass before edits.

**Step 3: Change the pattern registry minimally**
- Remove boring/redundant definitions from `definitions`
- Add replacement patterns with readable telegraphs and fair gaps
- Keep `buildBossPatternQueue()` family anti-streak protection intact
- Keep generic boss warning UI behavior (no pattern names shown)

**Step 4: Re-run focused tests**
Run: `npm test --workspace frontend`
Expected: updated engine/pattern tests pass.

### Task 2: Introduce shared multiplayer contracts

**Files:**
- Create: `shared/src/contracts/multiplayer.ts`
- Modify: `shared/src/contracts/index.ts`
- Create: `shared/src/contracts/multiplayer.test.ts`

**Step 1: Write failing shared-schema tests**
Define tests for:
- room summary schema
- room options schema
- socket event discriminated unions
- multiplayer result schema

**Step 2: Run only shared tests**
Run: `npm run test --workspace shared`
Expected: fail because new schemas are missing.

**Step 3: Add minimal shared contracts**
Add exact types/schemas for:
- `RoomOptions`
- `LobbyPlayer`
- `LobbyRoomSummary`
- `CreateRoomPayload`
- `JoinRoomPayload`
- `QuickJoinPayload`
- `ClientSocketEvent`
- `ServerSocketEvent`
- `MultiplayerMatchResult`

**Step 4: Export from index**
Update `shared/src/contracts/index.ts` to re-export multiplayer types.

**Step 5: Re-run shared tests**
Run: `npm run test --workspace shared`
Expected: pass.

### Task 3: Split app shell into single vs multiplayer entry flows

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/content/copy.ts`
- Modify: `frontend/src/routes/MenuPage.tsx`
- Modify: `frontend/src/styles/base.css`
- Test: `frontend/src/routes/MenuPage.test.tsx` (create if needed)

**Step 1: Add screen-flow test coverage**
Test that menu exposes single/multi entry and that multiplayer navigation states render correctly.

**Step 2: Add new screen states to `App.tsx`**
Extend `Screen` to include, at minimum:
- `multiplayer-home`
- `multiplayer-lobby`
- `multiplayer-game`
- `multiplayer-results`

**Step 3: Update menu UI**
Make `MenuPage` route to either current single flow or multiplayer home.

**Step 4: Add copy keys**
Add copy for:
- multiplayer buttons
- lobby labels
- spectator labels
- reconnect status
- debuff item labels

**Step 5: Re-run frontend tests**
Run: `npm test --workspace frontend`
Expected: menu navigation tests pass.

### Task 4: Add multiplayer lobby pages and API client surface

**Files:**
- Create: `frontend/src/routes/MultiplayerHomePage.tsx`
- Create: `frontend/src/routes/MultiplayerLobbyPage.tsx`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/multiplayerClient.ts`
- Modify: `frontend/src/styles/base.css`
- Test: `frontend/src/routes/MultiplayerLobbyPage.test.tsx`

**Step 1: Write UI tests**
Cover:
- create room button
- quick join button
- join by code form
- host start button disabled until valid
- player ready toggle

**Step 2: Add API methods**
Extend `api.ts` with placeholders for:
- `createRoom`
- `joinRoom`
- `quickJoin`
- `getRoom`

**Step 3: Add socket client wrapper**
Create a small wrapper around WebSocket usage for:
- connect
- send event
- subscribe to room/game state
- disconnect

**Step 4: Build lobby screens**
Show:
- room code
- player list
- ready state
- host-only start button
- room options (`bodyBlock`, `debuffTier`)

**Step 5: Re-run frontend tests**
Run: `npm test --workspace frontend`
Expected: lobby tests pass.

### Task 5: Add multiplayer HTTP routes and room state on the server

**Files:**
- Create: `server/src/modules/multiplayer/multiplayer.schemas.ts`
- Create: `server/src/modules/multiplayer/multiplayer.routes.ts`
- Create: `server/src/modules/multiplayer/room.service.ts`
- Create: `server/src/modules/multiplayer/matchmaking.service.ts`
- Modify: `server/src/app.ts`
- Test: `server/src/modules/multiplayer/multiplayer.routes.test.ts`

**Step 1: Write failing server tests**
Cover:
- auth required for all multiplayer endpoints
- room creation returns room code and host assignment
- join by code adds a player
- quick join fills an existing waiting room or creates one

**Step 2: Add schemas and routes**
Implement endpoints such as:
- `POST /api/multiplayer/rooms`
- `POST /api/multiplayer/join`
- `POST /api/multiplayer/quick-join`
- `GET /api/multiplayer/rooms/:roomCode`

**Step 3: Add in-memory room state**
`room.service.ts` should manage:
- room code
- host id
- players
- ready state
- options
- game status

**Step 4: Register routes in app**
Update `server/src/app.ts` to mount multiplayer HTTP routes.

**Step 5: Re-run server tests**
Run: `npm run test --workspace server`
Expected: multiplayer route tests pass.

### Task 6: Add WebSocket gateway for authenticated room/game events

**Files:**
- Create: `server/src/modules/multiplayer/socket.gateway.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/config.ts`
- Test: `server/src/modules/multiplayer/socket.gateway.test.ts`

**Step 1: Add gateway tests**
Cover:
- authenticated connect only
- room subscribe/broadcast
- reconnect token reuse within grace period

**Step 2: Add transport**
Implement WebSocket upgrade/registration.

**Important constraint:**
If a dependency is required here, stop and explicitly record that `@fastify/websocket` or `ws` approval is required before continuing implementation.

**Step 3: Emit typed server events**
Broadcast:
- room snapshot
- countdown/start
- game state delta/full snapshot
- elimination
- reconnect grace countdown
- final results

**Step 4: Re-run server tests**
Run: `npm run test --workspace server`
Expected: gateway tests pass.

### Task 7: Build the server-authoritative multiplayer engine

**Files:**
- Create: `server/src/modules/multiplayer/game.service.ts`
- Create: `server/src/modules/multiplayer/game.types.ts`
- Create: `server/src/modules/multiplayer/game.tick.test.ts`
- Modify: `server/src/modules/multiplayer/room.service.ts`
- Reuse/reference: `frontend/src/game/systems/bossPatterns.ts` for pattern ideas only

**Step 1: Write engine tests first**
Cover:
- shared map state for 2+ players
- last player alive wins
- dead players become spectators
- reconnect within 10 seconds preserves slot
- round → boss transition works

**Step 2: Create multiplayer runtime state**
Include:
- room players
- alive/spectator/disconnected states
- hazards/items
- round/boss phase
- reconnect deadlines
- winner/result snapshot

**Step 3: Implement server tick loop**
Server owns:
- player movement resolution
- hazard movement
- item pickup
- elimination checks
- round/boss progression

**Step 4: Integrate with room service**
Room start should create a runtime and begin ticking.

**Step 5: Re-run server tests**
Run: `npm run test --workspace server`
Expected: engine tick tests pass.

### Task 8: Add debuff items and room-option gameplay rules

**Files:**
- Modify: `server/src/modules/multiplayer/game.service.ts`
- Create: `server/src/modules/multiplayer/debuff.service.ts`
- Create: `server/src/modules/multiplayer/debuff.service.test.ts`
- Modify: `shared/src/contracts/multiplayer.ts`

**Step 1: Write failing tests**
Cover:
- debuff item spawns in multiplayer only
- random alive target is chosen
- spectators/dead players are excluded
- `bodyBlock` ON changes player collision resolution
- `debuffTier` 2 vs 3 changes allowed debuff pool

**Step 2: Implement debuff item flow**
Add debuff-only item variants and random target application.

**Step 3: Implement room options**
- `bodyBlock = false`: players overlap freely
- `bodyBlock = true`: players collide
- `debuffTier = 2`: mild/medium set
- `debuffTier = 3`: extended set

**Step 4: Re-run tests**
Run: `npm run test --workspace server`
Expected: debuff and room-option tests pass.

### Task 9: Build multiplayer gameplay client and spectator mode

**Files:**
- Create: `frontend/src/routes/MultiplayerGamePage.tsx`
- Create: `frontend/src/game/multiplayer/renderMultiplayerGame.ts`
- Create: `frontend/src/game/multiplayer/useMultiplayerRoom.ts`
- Modify: `frontend/src/styles/base.css`
- Test: `frontend/src/routes/MultiplayerGamePage.test.tsx`

**Step 1: Write UI tests**
Cover:
- alive player HUD
- spectator banner after death
- remaining player count
- reconnect status message

**Step 2: Render shared map**
Show:
- all players
- nicknames
- alive/dead state
- shared hazards/items
- round/boss UI

**Step 3: Add spectator behavior**
When dead:
- disable controls
- keep live view
- mark local player as spectator

**Step 4: Re-run frontend tests**
Run: `npm test --workspace frontend`
Expected: multiplayer game page tests pass.

### Task 10: Persist multiplayer results and records

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/db/client.ts`
- Create: `server/src/modules/multiplayer/results.repository.ts`
- Create: `server/src/modules/multiplayer/results.service.ts`
- Modify: `frontend/src/routes/RecordsPage.tsx`
- Modify: `shared/src/contracts/multiplayer.ts`
- Test: `server/src/modules/multiplayer/results.service.test.ts`

**Step 1: Write failing persistence tests**
Cover:
- match result storage
- participant placement storage
- per-user stats lookup

**Step 2: Extend schema**
Add exact tables for:
- `multiplayer_matches`
- `multiplayer_participants`

**Step 3: Save results on match end**
Persist:
- room id/code snapshot
- winner id
- placements
- timestamps

**Step 4: Expose multiplayer records to frontend**
Either extend existing records endpoint carefully or add dedicated multiplayer records endpoint.

**Step 5: Re-run tests**
Run: `npm run test --workspace server`
Expected: persistence tests pass.

### Task 11: End-to-end integration and hardening

**Files:**
- Modify: `tests/e2e/run-e2e.mjs`
- Create: `tests/e2e/multiplayer-smoke.mjs` (if the current harness becomes too crowded)
- Optionally create: `frontend/src/routes/MultiplayerHomePage.test.tsx`

**Step 1: Add smoke coverage**
Minimum flows:
- authenticated user creates room
- second user joins room
- ready/start transitions broadcast
- result snapshot generated at match end

**Step 2: Run full workspace verification**
Run:
- `npm run lint`
- `npm test`
- `npm run build`

Expected:
- all pass cleanly

**Step 3: Manual local verification checklist**
- start two browser sessions with two accounts
- create room by code
- join and ready
- host starts match
- kill one player and verify spectator mode
- disconnect one player and reconnect within 10 seconds
- verify winner and results

## Suggested delivery phases
- **Phase A:** Task 1 only (single-player pattern refresh)
- **Phase B:** Tasks 2-5 (multiplayer contracts + lobby + HTTP)
- **Phase C:** Tasks 6-9 (real-time gameplay)
- **Phase D:** Tasks 10-11 (results + hardening)

## Verification commands
- Frontend only: `npm test --workspace frontend`
- Server only: `npm run test --workspace server`
- Shared only: `npm run test --workspace shared`
- Whole repo: `npm run lint && npm test && npm run build`

## Risks to watch during implementation
- Avoid letting single-player logic leak into multiplayer authority code.
- Do not let disconnected players remain targetable for debuffs.
- Do not add WebSocket dependencies silently; record the approval requirement explicitly if needed.
- Keep generated `.js` siblings out of manual edits.
