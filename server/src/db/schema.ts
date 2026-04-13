export const sqliteSchemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('normal', 'hard')),
  score INTEGER NOT NULL,
  reached_round INTEGER NOT NULL,
  survival_time REAL NOT NULL,
  clear INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS multiplayer_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  winner_user_id INTEGER,
  total_players INTEGER NOT NULL,
  reached_round INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(winner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS multiplayer_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  placement INTEGER NOT NULL,
  total_players INTEGER NOT NULL,
  reached_round INTEGER NOT NULL,
  won INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_records_user_mode_created_at
ON records(user_id, mode, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_multiplayer_participants_user_created_at
ON multiplayer_participants(user_id, created_at DESC);
`;

export const postgresSchemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK(mode IN ('normal', 'hard')),
  score INTEGER NOT NULL,
  reached_round INTEGER NOT NULL,
  survival_time DOUBLE PRECISION NOT NULL,
  clear BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multiplayer_matches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_code TEXT NOT NULL,
  winner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  total_players INTEGER NOT NULL,
  reached_round INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multiplayer_participants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  placement INTEGER NOT NULL,
  total_players INTEGER NOT NULL,
  reached_round INTEGER NOT NULL,
  won BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_records_user_mode_created_at
ON records(user_id, mode, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_multiplayer_participants_user_created_at
ON multiplayer_participants(user_id, created_at DESC);
`;

export const schemaSql = sqliteSchemaSql;
