import {config} from '../config.js';
import {postgresSchemaSql} from './schema.postgres.js';
import {sqliteSchemaSql} from './schema.js';

export type DatabaseRuntimeConfig =
  | {
      provider: 'sqlite';
      dbPath: string;
      bootstrapSql: string;
      migrationState: 'runtime-ready';
    }
  | {
      provider: 'postgres';
      databaseUrl: string | null;
      bootstrapSql: string;
      migrationState: 'scaffold-only';
    };

export function resolveDatabaseRuntimeConfig(): DatabaseRuntimeConfig {
  if (config.databaseProvider === 'postgres') {
    return {
      provider: 'postgres',
      databaseUrl: config.databaseUrl,
      bootstrapSql: postgresSchemaSql,
      migrationState: 'scaffold-only'
    };
  }

  return {
    provider: 'sqlite',
    dbPath: config.dbPath,
    bootstrapSql: sqliteSchemaSql,
    migrationState: 'runtime-ready'
  };
}

export function assertSupportedDatabaseRuntime() {
  const runtime = resolveDatabaseRuntimeConfig();

  if (runtime.provider === 'postgres') {
    throw new Error(
      'DATABASE_PROVIDER=postgres is scaffolded for schema planning only. Keep SQLite runtime enabled until a real Postgres runtime adapter and migration path are implemented.'
    );
  }

  return runtime;
}
