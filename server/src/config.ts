import path from 'node:path';

export const config = {
  get port() {
    return Number(process.env.PORT ?? 3001);
  },
  get cookieSecret() {
    return process.env.COOKIE_SECRET ?? 'avoid-poop-dev-secret';
  },
  get dbPath() {
    return process.env.DB_PATH ?? path.join(process.cwd(), 'server', 'data', 'avoid-poop.sqlite');
  },
  sessionCookieName: 'avoid_poop_session',
  sessionTtlMs: 1000 * 60 * 60 * 24 * 7,
  multiplayerWebSocketPath: '/api/multiplayer/ws',
  multiplayerReconnectGraceMs: 10_000
};
