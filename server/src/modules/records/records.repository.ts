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
