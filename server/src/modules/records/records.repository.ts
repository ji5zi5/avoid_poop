import {getDb} from '../../db/client.js';

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

export function createRecord(input: Omit<DbRecord, 'id' | 'createdAt'>) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO records (user_id, mode, score, reached_round, survival_time, clear)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING
       id,
       user_id AS userId,
       mode,
       score,
       reached_round AS reachedRound,
       survival_time AS survivalTime,
       clear,
       created_at AS createdAt`
  );

  const row = stmt.get(
    input.userId,
    input.mode,
    input.score,
    input.reachedRound,
    input.survivalTime,
    input.clear ? 1 : 0
  ) as Omit<DbRecord, 'clear'> & {clear: number};

  return {
    ...row,
    clear: Boolean(row.clear)
  };
}

export function listRecentRecords(userId: number) {
  const db = getDb();
  const stmt = db.prepare(
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
     LIMIT 10`
  );

  return stmt.all(userId).map((row) => ({
    ...(row as Omit<DbRecord, 'clear'> & {clear: number}),
    clear: Boolean((row as {clear: number}).clear)
  })) as DbRecord[];
}

export function findBestRecordByMode(userId: number, mode: 'normal' | 'hard') {
  const db = getDb();
  const stmt = db.prepare(
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
     LIMIT 1`
  );

  const row = stmt.get(userId, mode) as (Omit<DbRecord, 'clear'> & {clear: number}) | undefined;
  if (!row) {
    return null;
  }

  return {
    ...row,
    clear: Boolean(row.clear)
  } satisfies DbRecord;
}

export function getSinglePlayerProfile(userId: number) {
  const db = getDb();
  const row = db.prepare(
    `SELECT
       COUNT(*) AS totalRuns,
       COALESCE(SUM(clear), 0) AS totalClears,
       COALESCE(SUM(score), 0) AS totalScore
     FROM records
     WHERE user_id = ?`
  ).get(userId) as DbSinglePlayerProfile;

  return row;
}

export function listSingleLeaderboard(mode: 'normal' | 'hard', limit = 20) {
  const db = getDb();
  const rows = db.prepare(
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
       WHERE r.mode = ?
     )
     SELECT userId, username, score, reachedRound, survivalTime, clear, createdAt
     FROM ranked
     WHERE rowNumber = 1
     ORDER BY score DESC, reachedRound DESC, survivalTime DESC, userId ASC
     LIMIT ?`
  ).all(mode, limit) as Array<Omit<DbSingleLeaderboardEntry, 'clear'> & {clear: number}>;

  return rows.map((row) => ({
    ...row,
    clear: Boolean(row.clear)
  })) as DbSingleLeaderboardEntry[];
}
