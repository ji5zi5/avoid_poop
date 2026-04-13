import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

import {config} from '../config.js';
import {schemaSql} from './schema.js';

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

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, {recursive: true});

  dbInstance = new DatabaseSync(config.dbPath);
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec(schemaSql);
  migrateRecordsModeSchema(dbInstance);

  return dbInstance;
}

export function resetDbForTests() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  if (fs.existsSync(config.dbPath)) {
    fs.unlinkSync(config.dbPath);
  }
}
