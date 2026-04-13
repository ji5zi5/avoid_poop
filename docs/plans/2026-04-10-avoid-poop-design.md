# Avoid Poop Design

Date: 2026-04-10
Status: Approved

## Overview

`Avoid Poop` is a browser game where the player moves left and right to dodge falling poop. The first version targets a pixel-art presentation, round-based progression with intermittent boss-pattern sections, persistent accounts, and saved results.

## Product Direction

- Platform: web browser
- Input: left/right arrow keys
- Visual style: pixel-art
- Core mode: round progression with escalating hazard density and boss-pattern phases
- Secondary mode: endless survival with separate records
- Lives: 3, with recovery opportunities on round clear and via items
- Items:
  - temporary invincibility
  - temporary movement speed boost
  - life recovery
  - temporary slow motion
  - screen clear
- Persistence: required
- Authentication: first release includes signup/login

## Architecture

The product is split into a browser frontend and a lightweight backend API with a database.

- Frontend responsibilities:
  - game loop
  - keyboard input
  - collision and item resolution
  - round progression
  - boss-pattern orchestration
  - in-game HUD and post-game result screens
- Backend responsibilities:
  - signup/login
  - session validation
  - user profile and record storage
  - mode-specific result queries
- Database responsibilities:
  - users
  - session metadata
  - run history
  - mode-specific best records

## Screen Flow

1. Auth screen: signup and login
2. Main menu: round mode, endless mode, records, logout
3. Game screen: player, falling hazards, items, lives, score, round, boss warnings
4. Result screen: clear/fail state, score, time, reached round, replay/menu actions
5. Records screen: best scores and recent runs

Primary loop:

`login -> menu -> choose mode -> play -> save result -> result screen -> replay or return to menu`

## Gameplay Rules

- The player moves only on the horizontal axis.
- Falling poop collisions consume one life.
- Round mode increases speed, density, and pattern complexity over time.
- Boss sections interrupt normal waves with more structured attack patterns.
- Round clears can grant recovery opportunities.
- Items spawn randomly and are resolved client-side.
- Final results are submitted to the backend after the run ends.

## Persistence Model

The first version stores the minimum data needed to support records and history.

- account id
- mode
- score
- reached round
- survival time
- clear flag
- created timestamp

## Authentication Direction

- The first release uses local username/password signup and login.
- Auth state is maintained with signed HTTP-only session cookies rather than browser-stored bearer tokens.
- Protected screens redirect to login when the session is missing or invalid.

## Error Handling Direction

- Login and signup failures show inline errors.
- Record save failures are recoverable from the result screen.
- Game runtime decisions stay client-side so play remains responsive when network latency exists.

## Testing Direction

- Frontend tests focus on pure game rules and state transitions.
- Backend tests focus on auth and result APIs.
- End-to-end tests cover signup/login, gameplay completion, and result persistence.
