export const postgresSchemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_session_id TEXT UNIQUE REFERENCES single_player_run_sessions(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK(mode IN ('normal', 'hard')),
  score INTEGER NOT NULL,
  reached_round INTEGER NOT NULL,
  survival_time DOUBLE PRECISION NOT NULL,
  clear BOOLEAN NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS single_player_run_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('normal', 'hard')),
  wave_seed INTEGER NOT NULL,
  boss_seed INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  heartbeat_count INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS multiplayer_matches (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_code TEXT NOT NULL,
  winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  total_players INTEGER NOT NULL,
  reached_round INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multiplayer_participants (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  placement INTEGER NOT NULL,
  total_players INTEGER NOT NULL,
  reached_round INTEGER NOT NULL,
  won BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_records_user_mode_created_at
ON records(user_id, mode, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_single_player_run_sessions_user_started_at
ON single_player_run_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_multiplayer_participants_user_created_at
ON multiplayer_participants(user_id, created_at DESC);
`;
