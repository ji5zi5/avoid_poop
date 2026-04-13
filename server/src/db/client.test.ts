import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {getDb, getPostgresSchemaSql, resetDbForTests} from './client.js';

const dbPath = path.join(process.cwd(), 'data', 'avoid-poop-db-client-test.sqlite');
const originalDbProvider = process.env.DB_PROVIDER;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDbPath = process.env.DB_PATH;

test.afterEach(() => {
  resetDbForTests();

  if (originalDbProvider === undefined) {
    delete process.env.DB_PROVIDER;
  } else {
    process.env.DB_PROVIDER = originalDbProvider;
  }

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }

  if (originalDbPath === undefined) {
    delete process.env.DB_PATH;
  } else {
    process.env.DB_PATH = originalDbPath;
  }

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

test('sqlite remains the default database provider and boots the local schema', () => {
  delete process.env.DB_PROVIDER;
  delete process.env.DATABASE_URL;
  process.env.DB_PATH = dbPath;

  const db = getDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as Array<{name: string}>;

  assert.deepEqual(
    tables.map((table) => table.name),
    ['multiplayer_matches', 'multiplayer_participants', 'records', 'sessions', 'sqlite_sequence', 'users']
  );
});

test('postgres provider fails fast with a migration-focused message until the runtime driver is added', () => {
  process.env.DB_PROVIDER = 'postgres';
  process.env.DATABASE_URL = 'postgres://avoid-poop:test@localhost:5432/avoid_poop';
  process.env.DB_PATH = dbPath;

  assert.throws(
    () => getDb(),
    /DB_PROVIDER=postgres is scaffolded but no Postgres runtime driver is installed yet/
  );
  assert.match(getPostgresSchemaSql(), /CREATE TABLE IF NOT EXISTS records/);
  assert.match(getPostgresSchemaSql(), /TIMESTAMPTZ/);
  assert.match(getPostgresSchemaSql(), /BOOLEAN NOT NULL DEFAULT FALSE/);
});

test('postgres provider requires DATABASE_URL', () => {
  process.env.DB_PROVIDER = 'postgres';
  delete process.env.DATABASE_URL;
  process.env.DB_PATH = dbPath;

  assert.throws(() => getDb(), /DB_PROVIDER=postgres requires DATABASE_URL to be set/);
});
