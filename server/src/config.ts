import path from 'node:path';

export type DatabaseProvider = 'sqlite' | 'postgres';

function readDatabaseProvider(): DatabaseProvider {
  const provider = process.env.DB_PROVIDER?.trim();

  if (!provider) {
    return 'sqlite';
  }

  if (provider === 'sqlite' || provider === 'postgres') {
    return provider;
  }

  throw new Error(`Unsupported DB_PROVIDER: ${provider}`);
}

export const config = {
  get port() {
    return Number(process.env.PORT ?? 3001);
  },
  get cookieSecret() {
    return process.env.COOKIE_SECRET ?? 'avoid-poop-dev-secret';
  },
  get databaseProvider() {
    return readDatabaseProvider();
  },
  get databaseUrl() {
    return process.env.DATABASE_URL?.trim() || null;
  },
  get dbPath() {
    return process.env.DB_PATH ?? defaultSqlitePath;
  },
  sessionCookieName: 'avoid_poop_session',
  sessionTtlMs: 1000 * 60 * 60 * 24 * 7,
  multiplayerWebSocketPath: '/api/multiplayer/ws',
  multiplayerReconnectGraceMs: 10_000
};
