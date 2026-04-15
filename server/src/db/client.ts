import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import postgres, { type Sql } from 'postgres';

import { config } from '../config.js';
import { resolveDatabaseRuntimeConfig } from './provider.js';
import { postgresSchemaSql, schemaSql } from './schema.js';

export type SqliteDatabaseClient = {
  provider: 'sqlite';
  db: DatabaseSync;
};

export type PostgresDatabaseClient = {
  provider: 'postgres';
  sql: Sql;
};

export type DatabaseClient = SqliteDatabaseClient | PostgresDatabaseClient;

let databaseClientPromise: Promise<DatabaseClient> | null = null;

function migrateRecordsModeSchema(db: DatabaseSync) {
  const createSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'records'")
    .get() as { sql?: string } | undefined;

  if (!createSql?.sql || createSql.sql.includes("'normal', 'hard'")) {
    return;
  }

  db.exec(`
    ALTER TABLE records RENAME TO records_legacy;

    CREATE TABLE records (
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

    INSERT INTO records (id, user_id, mode, score, reached_round, survival_time, clear, created_at)
    SELECT
      id,
      user_id,
      CASE mode
        WHEN 'round' THEN 'normal'
        WHEN 'endless' THEN 'hard'
        ELSE 'normal'
      END,
      score,
      reached_round,
      survival_time,
      clear,
      created_at
    FROM records_legacy;

    DROP TABLE records_legacy;

    CREATE INDEX IF NOT EXISTS idx_records_user_mode_created_at
    ON records(user_id, mode, created_at DESC);
  `);
}

function migrateRecordsVerificationSchema(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(records)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === 'verified')) {
    return;
  }

  db.exec(`
    ALTER TABLE records ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
  `);
}

function migrateRecordsRunSessionSchema(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(records)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === 'run_session_id')) {
    return;
  }

  db.exec(`
    ALTER TABLE records ADD COLUMN run_session_id TEXT REFERENCES single_player_run_sessions(id) ON DELETE SET NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_records_run_session_id ON records(run_session_id) WHERE run_session_id IS NOT NULL;
  `);
}

function createSqliteDb() {
  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schemaSql);
  migrateRecordsModeSchema(db);
  migrateRecordsVerificationSchema(db);
  migrateRecordsRunSessionSchema(db);

  return db;
}

function shouldRequirePostgresSsl(databaseUrl: string) {
  return /supabase\.co|supabase\.in|pooler\.supabase\.com/i.test(databaseUrl);
}

function shouldDisablePreparedStatements(databaseUrl: string) {
  return /pooler\.supabase\.com|:6543(?:\/|$|\?)/i.test(databaseUrl);
}

async function createPostgresDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    ssl: shouldRequirePostgresSsl(databaseUrl) ? 'require' : 'prefer',
    prepare: !shouldDisablePreparedStatements(databaseUrl),
    idle_timeout: 20,
    connect_timeout: 30,
    max: 10,
    transform: postgres.camel,
  });

  try {
    await sql.unsafe(postgresSchemaSql);
    await sql.unsafe('ALTER TABLE records ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;');
    await sql.unsafe('ALTER TABLE records ADD COLUMN IF NOT EXISTS run_session_id TEXT UNIQUE REFERENCES single_player_run_sessions(id) ON DELETE SET NULL;');
  } catch (error) {
    await sql.end({ timeout: 0 }).catch(() => undefined);
    throw error;
  }

  return sql;
}

function createPostgresConfigurationError() {
  return new Error('DB_PROVIDER=postgres requires DATABASE_URL to be set.');
}

async function createDatabaseClient(): Promise<DatabaseClient> {
  if (config.databaseProvider === 'postgres') {
    if (!config.databaseUrl) {
      throw createPostgresConfigurationError();
    }

    return {
      provider: 'postgres',
      sql: await createPostgresDb(config.databaseUrl),
    };
  }

  return {
    provider: 'sqlite',
    db: createSqliteDb(),
  };
}

export async function closeDbConnection() {
  if (!databaseClientPromise) {
    return;
  }

  const client = await databaseClientPromise.catch(() => null);
  if (client?.provider === 'sqlite') {
    client.db.close();
  } else if (client?.provider === 'postgres') {
    await client.sql.end({ timeout: 0 }).catch(() => undefined);
  }

  databaseClientPromise = null;
}

export async function getDb(): Promise<DatabaseClient> {
  if (!databaseClientPromise) {
    databaseClientPromise = createDatabaseClient().catch((error) => {
      databaseClientPromise = null;
      throw error;
    });
  }

  return databaseClientPromise;
}

export function getPostgresSchemaSql() {
  return postgresSchemaSql;
}

export async function resetDbForTests() {
  const runtime = resolveDatabaseRuntimeConfig();

  await closeDbConnection();

  if (runtime.provider === 'sqlite' && fs.existsSync(runtime.dbPath)) {
    fs.unlinkSync(runtime.dbPath);
  }
}
