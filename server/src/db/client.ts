import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

import {config} from '../config.js';
import {resolveDatabaseRuntimeConfig} from './provider.js';
import {postgresSchemaSql, schemaSql} from './schema.js';

let dbInstance: DatabaseSync | null = null;

function migrateRecordsModeSchema(db: DatabaseSync) {
  const createSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'records'")
    .get() as {sql?: string} | undefined;

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

function createSqliteDb() {
  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, {recursive: true});

  const db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schemaSql);
  migrateRecordsModeSchema(db);

  return db;
}

function createPostgresNotReadyError() {
  if (!config.databaseUrl) {
    return new Error('DB_PROVIDER=postgres requires DATABASE_URL to be set.');
  }

  return new Error(
    'DB_PROVIDER=postgres is scaffolded but no Postgres runtime driver is installed yet. ' +
      'Use server/src/db/schema.ts::postgresSchemaSql for migrations and keep DB_PROVIDER=sqlite until the driver/query adapter lands.'
  );
}

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  if (config.databaseProvider === 'postgres') {
    throw createPostgresNotReadyError();
  }

  dbInstance = createSqliteDb();
  return dbInstance;
}

export function getPostgresSchemaSql() {
  return postgresSchemaSql;
}

export function resetDbForTests() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }

  const runtime = resolveDatabaseRuntimeConfig();
  if (runtime.provider === 'sqlite' && fs.existsSync(runtime.dbPath)) {
    fs.unlinkSync(runtime.dbPath);
  }
}
