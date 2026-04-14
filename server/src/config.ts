import path from 'node:path';

export type DatabaseProvider = 'sqlite' | 'postgres';
export type RuntimeEnvironment = 'development' | 'test' | 'production';

export type RateLimitBucket = {
  max: number;
  windowMs: number;
};

export type RuntimeConfig = {
  environment: RuntimeEnvironment;
  isProduction: boolean;
  isTest: boolean;
  port: number;
  cookieSecret: string;
  cookieSecure: boolean;
  appOrigin: string | null;
  logEnabled: boolean;
  logLevel: string;
  trustProxy: boolean;
  databaseProvider: DatabaseProvider;
  databaseUrl: string | null;
  dbPath: string;
  sessionCookieName: string;
  sessionTtlMs: number;
  multiplayerWebSocketPath: string;
  multiplayerReconnectGraceMs: number;
  rateLimits: {
    auth: RateLimitBucket;
    writes: RateLimitBucket;
    websocket: RateLimitBucket;
  };
};

const defaultSqlitePath = path.join(process.cwd(), 'server', 'data', 'avoid-poop.sqlite');
const defaultCookieSecret = 'avoid-poop-dev-secret';

function parseEnvironment(value: string | undefined): RuntimeEnvironment {
  const normalized = value?.trim() ?? 'development';
  if (normalized === 'development' || normalized === 'test' || normalized === 'production') {
    return normalized;
  }
  throw new Error(`Unsupported NODE_ENV: ${normalized}`);
}

function parseDatabaseProvider(value: string | undefined): DatabaseProvider {
  const normalized = value?.trim();
  if (!normalized) {
    return 'sqlite';
  }
  if (normalized === 'sqlite' || normalized === 'postgres') {
    return normalized;
  }
  throw new Error(`Unsupported DB_PROVIDER: ${normalized}`);
}

function parsePositiveInteger(name: string, rawValue: string | undefined, fallback: number) {
  if (!rawValue?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value?.trim()) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  throw new Error(`Boolean env value must be one of true/false/1/0/on/off, got: ${value}`);
}

function parseOptionalUrl(name: string, rawValue: string | undefined) {
  const normalized = rawValue?.trim() ?? '';
  if (!normalized) {
    return null;
  }
  try {
    return new URL(normalized).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const environment = parseEnvironment(env.NODE_ENV);
  const appOrigin = parseOptionalUrl('APP_ORIGIN', env.APP_ORIGIN);
  const cookieSecret = env.COOKIE_SECRET?.trim() || defaultCookieSecret;
  const databaseProvider = parseDatabaseProvider(env.DB_PROVIDER);
  const databaseUrl = env.DATABASE_URL?.trim() || null;

  if (environment === 'production') {
    if (!env.COOKIE_SECRET?.trim() || cookieSecret === defaultCookieSecret) {
      throw new Error('COOKIE_SECRET must be set to a non-default value in production.');
    }
    if (!appOrigin) {
      throw new Error('APP_ORIGIN must be set in production.');
    }
  }

  return {
    environment,
    isProduction: environment === 'production',
    isTest: environment === 'test',
    port: parsePositiveInteger('PORT', env.PORT, 3001),
    cookieSecret,
    cookieSecure: environment === 'production',
    appOrigin,
    logEnabled: parseBoolean(env.LOG_ENABLED, environment !== 'test'),
    logLevel: env.LOG_LEVEL?.trim() || (environment === 'production' ? 'info' : 'debug'),
    trustProxy: parseBoolean(env.TRUST_PROXY, environment === 'production'),
    databaseProvider,
    databaseUrl,
    dbPath: env.DB_PATH ?? defaultSqlitePath,
    sessionCookieName: 'avoid_poop_session',
    sessionTtlMs: 1000 * 60 * 60 * 24 * 7,
    multiplayerWebSocketPath: '/api/multiplayer/ws',
    multiplayerReconnectGraceMs: 10_000,
    rateLimits: {
      auth: {
        max: parsePositiveInteger('RATE_LIMIT_AUTH_MAX', env.RATE_LIMIT_AUTH_MAX, 12),
        windowMs: parsePositiveInteger('RATE_LIMIT_AUTH_WINDOW_MS', env.RATE_LIMIT_AUTH_WINDOW_MS, 60_000),
      },
      writes: {
        max: parsePositiveInteger('RATE_LIMIT_WRITES_MAX', env.RATE_LIMIT_WRITES_MAX, 40),
        windowMs: parsePositiveInteger('RATE_LIMIT_WRITES_WINDOW_MS', env.RATE_LIMIT_WRITES_WINDOW_MS, 60_000),
      },
      websocket: {
        max: parsePositiveInteger('RATE_LIMIT_WS_MAX', env.RATE_LIMIT_WS_MAX, 40),
        windowMs: parsePositiveInteger('RATE_LIMIT_WS_WINDOW_MS', env.RATE_LIMIT_WS_WINDOW_MS, 60_000),
      },
    },
  };
}

function current() {
  return resolveConfig(process.env);
}

export const config = {
  get environment() {
    return current().environment;
  },
  get isProduction() {
    return current().isProduction;
  },
  get isTest() {
    return current().isTest;
  },
  get port() {
    return current().port;
  },
  get cookieSecret() {
    return current().cookieSecret;
  },
  get cookieSecure() {
    return current().cookieSecure;
  },
  get appOrigin() {
    return current().appOrigin;
  },
  get logEnabled() {
    return current().logEnabled;
  },
  get logLevel() {
    return current().logLevel;
  },
  get trustProxy() {
    return current().trustProxy;
  },
  get databaseProvider() {
    return current().databaseProvider;
  },
  get databaseUrl() {
    return current().databaseUrl;
  },
  get dbPath() {
    return current().dbPath;
  },
  get sessionCookieName() {
    return current().sessionCookieName;
  },
  get sessionTtlMs() {
    return current().sessionTtlMs;
  },
  get multiplayerWebSocketPath() {
    return current().multiplayerWebSocketPath;
  },
  get multiplayerReconnectGraceMs() {
    return current().multiplayerReconnectGraceMs;
  },
  get rateLimits() {
    return current().rateLimits;
  },
} satisfies RuntimeConfig;
