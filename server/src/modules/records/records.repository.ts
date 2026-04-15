import { getDb } from '../../db/client.js';
import { toIsoTimestamp } from '../../utils/timestamps.js';

export type DbRecord = {
  id: number;
  userId: number;
  mode: 'normal' | 'hard';
  score: number;
  reachedRound: number;
  survivalTime: number;
  clear: boolean;
  createdAt: string;
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

export type DbSinglePlayerProfile = {
  totalRuns: number;
  totalClears: number;
  totalScore: number;
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

export async function createRecord(input: Omit<DbRecord, 'id' | 'createdAt'>) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `INSERT INTO records (user_id, mode, score, reached_round, survival_time, clear, verified)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       RETURNING
         id,
         user_id AS userId,
         mode,
         score,
         reached_round AS reachedRound,
         survival_time AS survivalTime,
         clear,
         created_at AS createdAt`,
    );

    const row = stmt.get(
      input.userId,
      input.mode,
      input.score,
      input.reachedRound,
      input.survivalTime,
      input.clear ? 1 : 0,
    ) as Omit<DbRecord, 'clear'> & { clear: number };

    return {
      ...row,
      clear: Boolean(row.clear),
    };
  }

  const [row] = await db.sql<DbRecord[]>`
    INSERT INTO records (user_id, mode, score, reached_round, survival_time, clear, verified)
    VALUES (${input.userId}, ${input.mode}, ${input.score}, ${input.reachedRound}, ${input.survivalTime}, ${input.clear}, false)
    RETURNING
      id,
      user_id AS "userId",
      mode,
      score,
      reached_round AS "reachedRound",
      survival_time AS "survivalTime",
      clear,
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
         mode,
         score,
         reached_round AS reachedRound,
         survival_time AS survivalTime,
         clear,
         created_at AS createdAt
       FROM records
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 10`,
    );

    return stmt.all(userId).map((row) => ({
      ...(row as Omit<DbRecord, 'clear'> & { clear: number }),
      clear: Boolean((row as { clear: number }).clear),
    })) as DbRecord[];
  }

  const rows = await db.sql<DbRecord[]>`
    SELECT
      id,
      user_id AS "userId",
      mode,
      score,
      reached_round AS "reachedRound",
      survival_time AS "survivalTime",
      clear,
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
         mode,
         score,
         reached_round AS reachedRound,
         survival_time AS survivalTime,
         clear,
         created_at AS createdAt
       FROM records
       WHERE user_id = ? AND mode = ?
       ORDER BY score DESC, reached_round DESC, survival_time DESC, id DESC
       LIMIT 1`,
    );

    const row = stmt.get(userId, mode) as (Omit<DbRecord, 'clear'> & { clear: number }) | undefined;
    if (!row) {
      return null;
    }

    return {
      ...row,
      clear: Boolean(row.clear),
    } satisfies DbRecord;
  }

  const [row] = await db.sql<DbRecord[]>`
    SELECT
      id,
      user_id AS "userId",
      mode,
      score,
      reached_round AS "reachedRound",
      survival_time AS "survivalTime",
      clear,
      created_at AS "createdAt"
    FROM records
    WHERE user_id = ${userId} AND mode = ${mode}
    ORDER BY score DESC, reached_round DESC, survival_time DESC, id DESC
    LIMIT 1
  `;

  return row ? normalizeRecordRow(row) : null;
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
