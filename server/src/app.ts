import cookie from '@fastify/cookie';
import Fastify from 'fastify';

import {config, resolveConfig, type RuntimeConfig} from './config.js';
import {registerErrorHandler} from './middleware/errorHandler.js';
import {enforceRateLimit, FixedWindowRateLimiter} from './middleware/rateLimit.js';
import {authRoutes} from './modules/auth/auth.routes.js';
import {MatchmakingService} from './modules/multiplayer/matchmaking.service.js';
import {multiplayerRoutes} from './modules/multiplayer/multiplayer.routes.js';
import {RoomService} from './modules/multiplayer/room.service.js';
import {MultiplayerSocketGateway} from './modules/multiplayer/socket.gateway.js';
import {recordsRoutes} from './modules/records/records.routes.js';

function applyCorsHeaders(reply: { header: (name: string, value: string) => void }, origin: string) {
  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  reply.header('Vary', 'Origin');
}

function mergeRuntimeConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  const base = resolveConfig();
  return {
    ...base,
    ...overrides,
    rateLimits: {
      auth: {
        ...base.rateLimits.auth,
        ...overrides.rateLimits?.auth,
      },
      writes: {
        ...base.rateLimits.writes,
        ...overrides.rateLimits?.writes,
      },
      websocket: {
        ...base.rateLimits.websocket,
        ...overrides.rateLimits?.websocket,
      },
    },
  };
}

export async function createApp(overrides: Partial<RuntimeConfig> = {}) {
  const runtimeConfig = mergeRuntimeConfig(overrides);
  const app = Fastify({
    logger: runtimeConfig.logEnabled ? {level: runtimeConfig.logLevel} : false,
    trustProxy: runtimeConfig.trustProxy,
  });
  const roomService = new RoomService();
  const matchmakingService = new MatchmakingService(roomService);
  const authLimiter = new FixedWindowRateLimiter(runtimeConfig.rateLimits.auth);
  const writeLimiter = new FixedWindowRateLimiter(runtimeConfig.rateLimits.writes);
  const websocketLimiter = new FixedWindowRateLimiter(runtimeConfig.rateLimits.websocket);
  const multiplayerSocketGateway = new MultiplayerSocketGateway(app, {
    roomService,
    rateLimiter: websocketLimiter,
    runtimeConfig,
  });

  await app.register(cookie, {
    secret: runtimeConfig.cookieSecret
  });

  app.addHook('onRequest', async (request, reply) => {
    const pathname = new URL(request.raw.url ?? request.url, 'http://localhost').pathname;
    const requestOrigin = request.headers.origin?.trim();

    if (runtimeConfig.appOrigin && requestOrigin === runtimeConfig.appOrigin) {
      applyCorsHeaders(reply, requestOrigin);
      if (request.method === 'OPTIONS') {
        return reply.status(204).send();
      }
    }

    if (runtimeConfig.appOrigin && request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
      if (requestOrigin && requestOrigin !== runtimeConfig.appOrigin) {
        request.log.warn(
          {
            event: 'origin_rejected',
            origin: requestOrigin,
            expectedOrigin: runtimeConfig.appOrigin,
            path: request.url,
          },
          'Rejected cross-origin state-changing request',
        );
        return reply.status(403).send({error: 'Origin not allowed.'});
      }
    }

    if (request.method === 'POST' && (pathname === '/api/auth/signup' || pathname === '/api/auth/login')) {
      return enforceRateLimit(request, reply, authLimiter, 'auth');
    }

    if (
      request.method === 'POST'
      && (
        pathname === '/api/records'
        || pathname === '/api/multiplayer/rooms'
        || pathname === '/api/multiplayer/join'
        || pathname === '/api/multiplayer/quick-join'
      )
    ) {
      return enforceRateLimit(request, reply, writeLimiter, 'writes');
    }

    return undefined;
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    return payload;
  });

  multiplayerSocketGateway.register();

  app.get('/api/health', async () => ({ok: true}));

  await app.register(async (authScope) => {
    await authScope.register(authRoutes, {prefix: '/api/auth'});
    await authScope.register(recordsRoutes, {prefix: '/api/records'});
    await authScope.register(multiplayerRoutes, {
      prefix: '/api/multiplayer',
      roomService,
      matchmakingService,
      leaveRoom: (userId: number) => multiplayerSocketGateway.leaveUser(userId)
    });
  });

  registerErrorHandler(app);

  return app;
}
