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
      migrationState: 'runtime-ready';
    };

export function resolveDatabaseRuntimeConfig(): DatabaseRuntimeConfig {
  if (config.databaseProvider === 'postgres') {
    return {
      provider: 'postgres',
      databaseUrl: config.databaseUrl,
      bootstrapSql: postgresSchemaSql,
      migrationState: 'runtime-ready'
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
  return resolveDatabaseRuntimeConfig();
}
