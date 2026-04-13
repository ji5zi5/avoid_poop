import {getDb} from '../../db/client.js';

export type DbUser = {
  id: number;
  username: string;
  passwordHash: string;
};

export type DbSession = {
  id: string;
  userId: number;
  expiresAt: string;
};

export function createUser(username: string, passwordHash: string) {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO users (username, password_hash) VALUES (?, ?)
     RETURNING id, username, password_hash AS passwordHash`
  );

  return insert.get(username, passwordHash) as DbUser;
}

export function findUserByUsername(username: string) {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT id, username, password_hash AS passwordHash
     FROM users
     WHERE username = ?`
  );

  return (stmt.get(username) as DbUser | undefined) ?? null;
}

export function findUserById(id: number) {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT id, username, password_hash AS passwordHash
     FROM users
     WHERE id = ?`
  );

  return (stmt.get(id) as DbUser | undefined) ?? null;
}

export function createSession(sessionId: string, userId: number, expiresAt: string) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?)`
  );

  stmt.run(sessionId, userId, expiresAt);
}

export function getSession(sessionId: string) {
  const db = getDb();
  const stmt = db.prepare(
    `SELECT id, user_id AS userId, expires_at AS expiresAt
     FROM sessions
     WHERE id = ?`
  );

  return (stmt.get(sessionId) as DbSession | undefined) ?? null;
}

export function deleteSession(sessionId: string) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function deleteExpiredSessions() {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();
}
