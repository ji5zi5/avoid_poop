import { getDb } from '../../db/client.js';

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

export async function createUser(username: string, passwordHash: string) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const insert = db.db.prepare(
      `INSERT INTO users (username, password_hash) VALUES (?, ?)
       RETURNING id, username, password_hash AS passwordHash`,
    );

    return insert.get(username, passwordHash) as DbUser;
  }

  const [user] = await db.sql<DbUser[]>`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${passwordHash})
    RETURNING id, username, password_hash AS "passwordHash"
  `;
  return user;
}

export async function findUserByUsername(username: string) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `SELECT id, username, password_hash AS passwordHash
       FROM users
       WHERE username = ?`,
    );

    return (stmt.get(username) as DbUser | undefined) ?? null;
  }

  const [user] = await db.sql<DbUser[]>`
    SELECT id, username, password_hash AS "passwordHash"
    FROM users
    WHERE username = ${username}
  `;
  return user ?? null;
}

export async function findUserById(id: number) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `SELECT id, username, password_hash AS passwordHash
       FROM users
       WHERE id = ?`,
    );

    return (stmt.get(id) as DbUser | undefined) ?? null;
  }

  const [user] = await db.sql<DbUser[]>`
    SELECT id, username, password_hash AS "passwordHash"
    FROM users
    WHERE id = ${id}
  `;
  return user ?? null;
}

export async function createSession(sessionId: string, userId: number, expiresAt: string) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `INSERT INTO sessions (id, user_id, created_at, expires_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
    );

    stmt.run(sessionId, userId, expiresAt);
    return;
  }

  await db.sql`
    INSERT INTO sessions (id, user_id, created_at, expires_at)
    VALUES (${sessionId}, ${userId}, NOW(), ${expiresAt})
  `;
}

export async function getSession(sessionId: string) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const stmt = db.db.prepare(
      `SELECT id, user_id AS userId, expires_at AS expiresAt
       FROM sessions
       WHERE id = ?`,
    );

    return (stmt.get(sessionId) as DbSession | undefined) ?? null;
  }

  const [session] = await db.sql<DbSession[]>`
    SELECT id, user_id AS "userId", expires_at AS "expiresAt"
    FROM sessions
    WHERE id = ${sessionId}
  `;
  return session ?? null;
}

export async function deleteSession(sessionId: string) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    db.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return;
  }

  await db.sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}

export async function deleteExpiredSessions() {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    db.db.prepare('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();
    return;
  }

  await db.sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
}
