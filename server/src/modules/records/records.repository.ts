import { getDb } from '../../db/client.js';
import { toIsoTimestamp } from '../../utils/timestamps.js';

export type DbRecord = {
  id: number;
  userId: number;
  runSessionId: string | null;
  mode: 'normal' | 'hard';
  score: number;
  reachedRound: number;
  survivalTime: number;
  clear: boolean;
  createdAt: string;
  verified: boolean;
};

export type DbSingleLeaderboardEntry = {
  userId: number;
  username: string;
  score: number;
  reachedRound: number;
  survivalTime: number;
  clear: boolean;
  createdAt: string;
};

export type DbSinglePlayerRunSession = {
  id: string;
  userId: number;
  mode: 'normal' | 'hard';
  waveSeed: number;
  bossSeed: number;
  startedAt: string;
  expiresAt: string;
  heartbeatCount: number;
  consumedAt: string | null;
};

export type DbSinglePlayerProfile = {
  totalRuns: number;
  totalClears: number;
  totalScore: number;
};

type SqliteRecordRow = Omit<DbRecord, 'clear' | 'verified'> & {
  clear: number;
  verified: number;
};

function normalizeRecordRow<T extends { createdAt: string | Date }>(row: T) {
  return {
    ...row,
    createdAt: toIsoTimestamp(row.createdAt),
  };
}

function normalizeSingleLeaderboardRow<T extends { createdAt: string | Date; clear: boolean }>(row: T) {
  return {
    ...row,
    createdAt: toIsoTimestamp(row.createdAt),
  };
}

function normalizeRunSessionRow<T extends {
  startedAt: string | Date;
  expiresAt: string | Date;
  consumedAt: string | Date | null;
}>(row: T) {
  return {
    ...row,
    startedAt: toIsoTimestamp(row.startedAt),
    expiresAt: toIsoTimestamp(row.expiresAt),
    consumedAt: row.consumedAt ? toIsoTimestamp(row.consumedAt) : null,
  };
}

export async function createRecord(input: Omit<DbRecord, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `INSERT INTO records (user_id, run_session_id, mode, score, reached_round, survival_time, clear, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING
         id,
         user_id AS userId,
         run_session_id AS runSessionId,
         mode,
         score,
         reached_round AS reachedRound,
         survival_time AS survivalTime,
         clear,
         verified,
         created_at AS createdAt`,
    );

    const row = stmt.get(
      input.userId,
      input.runSessionId,
      input.mode,
      input.score,
      input.reachedRound,
      input.survivalTime,
      input.clear ? 1 : 0,
      input.verified ? 1 : 0,
    ) as unknown as SqliteRecordRow;

    return {
      ...row,
      clear: Boolean(row.clear),
      verified: Boolean(row.verified),
    };
  }

  const [row] = await db.sql<DbRecord[]>`
    INSERT INTO records (user_id, mode, score, reached_round, survival_time, clear, verified)
    VALUES (${input.userId}, ${input.runSessionId}, ${input.mode}, ${input.score}, ${input.reachedRound}, ${input.survivalTime}, ${input.clear}, ${input.verified})
    RETURNING
      id,
      user_id AS "userId",
      run_session_id AS "runSessionId",
      mode,
      score,
      reached_round AS "reachedRound",
      survival_time AS "survivalTime",
      clear,
      verified,
      created_at AS "createdAt"
  `;

  return normalizeRecordRow(row);
}

export async function listRecentRecords(userId: number) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `SELECT
         id,
         user_id AS userId,
         run_session_id AS runSessionId,
         mode,
         score,
         reached_round AS reachedRound,
         survival_time AS survivalTime,
         clear,
         verified,
         created_at AS createdAt
       FROM records
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 10`,
    );

    return stmt.all(userId).map((row) => ({
      ...(row as SqliteRecordRow),
      clear: Boolean((row as SqliteRecordRow).clear),
      verified: Boolean((row as SqliteRecordRow).verified),
    })) as DbRecord[];
  }

  const rows = await db.sql<DbRecord[]>`
    SELECT
      id,
      user_id AS "userId",
      run_session_id AS "runSessionId",
      mode,
      score,
      reached_round AS "reachedRound",
      survival_time AS "survivalTime",
      clear,
      verified,
      created_at AS "createdAt"
    FROM records
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT 10
  `;

  return rows.map(normalizeRecordRow);
}

export async function findBestRecordByMode(userId: number, mode: 'normal' | 'hard') {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `SELECT
         id,
         user_id AS userId,
         run_session_id AS runSessionId,
         mode,
         score,
         reached_round AS reachedRound,
         survival_time AS survivalTime,
         clear,
         verified,
         created_at AS createdAt
       FROM records
       WHERE user_id = ? AND mode = ?
       ORDER BY score DESC, reached_round DESC, survival_time DESC, id DESC
       LIMIT 1`,
    );

    const row = stmt.get(userId, mode) as unknown as SqliteRecordRow | undefined;
    if (!row) {
      return null;
    }

    return {
      ...row,
      clear: Boolean(row.clear),
      verified: Boolean(row.verified),
    } satisfies DbRecord;
  }

  const [row] = await db.sql<DbRecord[]>`
    SELECT
      id,
      user_id AS "userId",
      run_session_id AS "runSessionId",
      mode,
      score,
      reached_round AS "reachedRound",
      survival_time AS "survivalTime",
      clear,
      verified,
      created_at AS "createdAt"
    FROM records
    WHERE user_id = ${userId} AND mode = ${mode}
    ORDER BY score DESC, reached_round DESC, survival_time DESC, id DESC
    LIMIT 1
  `;

  return row ? normalizeRecordRow(row) : null;
}

export async function createSinglePlayerRunSession(input: Omit<DbSinglePlayerRunSession, 'heartbeatCount' | 'consumedAt'>) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `INSERT INTO single_player_run_sessions (id, user_id, mode, wave_seed, boss_seed, started_at, expires_at, heartbeat_count, consumed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)
       RETURNING
         id,
         user_id AS userId,
         mode,
         wave_seed AS waveSeed,
         boss_seed AS bossSeed,
         started_at AS startedAt,
         expires_at AS expiresAt,
         heartbeat_count AS heartbeatCount,
         consumed_at AS consumedAt`,
    );

    return stmt.get(
      input.id,
      input.userId,
      input.mode,
      input.waveSeed,
      input.bossSeed,
      input.startedAt,
      input.expiresAt,
    ) as DbSinglePlayerRunSession;
  }

  const [row] = await db.sql<DbSinglePlayerRunSession[]>`
    INSERT INTO single_player_run_sessions (id, user_id, mode, wave_seed, boss_seed, started_at, expires_at, heartbeat_count, consumed_at)
    VALUES (${input.id}, ${input.userId}, ${input.mode}, ${input.waveSeed}, ${input.bossSeed}, ${input.startedAt}, ${input.expiresAt}, 0, NULL)
    RETURNING
      id,
      user_id AS "userId",
      mode,
      wave_seed AS "waveSeed",
      boss_seed AS "bossSeed",
      started_at AS "startedAt",
      expires_at AS "expiresAt",
      heartbeat_count AS "heartbeatCount",
      consumed_at AS "consumedAt"
  `;

  return normalizeRunSessionRow(row);
}

export async function getSinglePlayerRunSession(runSessionId: string) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `SELECT
         id,
         user_id AS userId,
         mode,
         wave_seed AS waveSeed,
         boss_seed AS bossSeed,
         started_at AS startedAt,
         expires_at AS expiresAt,
         heartbeat_count AS heartbeatCount,
         consumed_at AS consumedAt
       FROM single_player_run_sessions
       WHERE id = ?`,
    );

    return (stmt.get(runSessionId) as DbSinglePlayerRunSession | undefined) ?? null;
  }

  const [row] = await db.sql<DbSinglePlayerRunSession[]>`
    SELECT
      id,
      user_id AS "userId",
      mode,
      wave_seed AS "waveSeed",
      boss_seed AS "bossSeed",
      started_at AS "startedAt",
      expires_at AS "expiresAt",
      heartbeat_count AS "heartbeatCount",
      consumed_at AS "consumedAt"
    FROM single_player_run_sessions
    WHERE id = ${runSessionId}
  `;

  return row ? normalizeRunSessionRow(row) : null;
}

export async function touchSinglePlayerRunSession(runSessionId: string, userId: number) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `UPDATE single_player_run_sessions
       SET heartbeat_count = heartbeat_count + 1
       WHERE id = ? AND user_id = ? AND consumed_at IS NULL`,
    );

    return stmt.run(runSessionId, userId).changes > 0;
  }

  const rows = await db.sql<Array<{ id: string }>>`
    UPDATE single_player_run_sessions
    SET heartbeat_count = heartbeat_count + 1
    WHERE id = ${runSessionId} AND user_id = ${userId} AND consumed_at IS NULL
    RETURNING id
  `;

  return rows.length > 0;
}

export async function consumeSinglePlayerRunSession(runSessionId: string, userId: number, consumedAt: string) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `UPDATE single_player_run_sessions
       SET consumed_at = ?
       WHERE id = ? AND user_id = ? AND consumed_at IS NULL`,
    );

    return stmt.run(consumedAt, runSessionId, userId).changes > 0;
  }

  const rows = await db.sql<Array<{ id: string }>>`
    UPDATE single_player_run_sessions
    SET consumed_at = ${consumedAt}
    WHERE id = ${runSessionId} AND user_id = ${userId} AND consumed_at IS NULL
    RETURNING id
  `;

  return rows.length > 0;
}

export async function getSinglePlayerProfile(userId: number) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const row = db.db.prepare(
      `SELECT
         COUNT(*) AS totalRuns,
         COALESCE(SUM(clear), 0) AS totalClears,
         COALESCE(SUM(score), 0) AS totalScore
       FROM records
       WHERE user_id = ?`,
    ).get(userId) as DbSinglePlayerProfile;

    return row;
  }

  const [row] = await db.sql<DbSinglePlayerProfile[]>`
    SELECT
      COUNT(*)::int AS "totalRuns",
      COALESCE(SUM(clear::int), 0)::int AS "totalClears",
      COALESCE(SUM(score), 0)::int AS "totalScore"
    FROM records
    WHERE user_id = ${userId}
  `;

  return row;
}

export async function listSingleLeaderboard(mode: 'normal' | 'hard', limit = 20) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const rows = db.db.prepare(
      `WITH ranked AS (
         SELECT
           r.user_id AS userId,
           u.username AS username,
           r.score AS score,
           r.reached_round AS reachedRound,
           r.survival_time AS survivalTime,
           r.clear AS clear,
           r.created_at AS createdAt,
         ROW_NUMBER() OVER (
             PARTITION BY r.user_id
             ORDER BY r.score DESC, r.reached_round DESC, r.survival_time DESC, r.id DESC
           ) AS rowNumber
         FROM records r
         JOIN users u ON u.id = r.user_id
         WHERE r.mode = ? AND r.verified = 1
       )
       SELECT userId, username, score, reachedRound, survivalTime, clear, createdAt
       FROM ranked
       WHERE rowNumber = 1
       ORDER BY score DESC, reachedRound DESC, survivalTime DESC, userId ASC
       LIMIT ?`,
    ).all(mode, limit) as Array<Omit<DbSingleLeaderboardEntry, 'clear'> & { clear: number }>;

    return rows.map((row) => ({
      ...row,
      clear: Boolean(row.clear),
    })) as DbSingleLeaderboardEntry[];
  }

  const rows = await db.sql<DbSingleLeaderboardEntry[]>`
    WITH ranked AS (
      SELECT
        r.user_id AS "userId",
        u.username AS username,
        r.score AS score,
        r.reached_round AS "reachedRound",
        r.survival_time AS "survivalTime",
        r.clear AS clear,
        r.created_at AS "createdAt",
        ROW_NUMBER() OVER (
          PARTITION BY r.user_id
          ORDER BY r.score DESC, r.reached_round DESC, r.survival_time DESC, r.id DESC
        ) AS "rowNumber"
      FROM records r
      JOIN users u ON u.id = r.user_id
      WHERE r.mode = ${mode} AND r.verified = true
    )
    SELECT "userId", username, score, "reachedRound", "survivalTime", clear, "createdAt"
    FROM ranked
    WHERE "rowNumber" = 1
    ORDER BY score DESC, "reachedRound" DESC, "survivalTime" DESC, "userId" ASC
    LIMIT ${limit}
  `;

  return rows.map(normalizeSingleLeaderboardRow);
}
