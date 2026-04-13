import cookie from '@fastify/cookie';
import Fastify from 'fastify';

import {config} from './config.js';
import {registerErrorHandler} from './middleware/errorHandler.js';
import {authRoutes} from './modules/auth/auth.routes.js';
import {MatchmakingService} from './modules/multiplayer/matchmaking.service.js';
import {multiplayerRoutes} from './modules/multiplayer/multiplayer.routes.js';
import {RoomService} from './modules/multiplayer/room.service.js';
import {MultiplayerSocketGateway} from './modules/multiplayer/socket.gateway.js';
import {recordsRoutes} from './modules/records/records.routes.js';

export async function createApp() {
  const app = Fastify({logger: false});
  const roomService = new RoomService();
  const matchmakingService = new MatchmakingService(roomService);
  const multiplayerSocketGateway = new MultiplayerSocketGateway(app, {
    roomService
  });

  await app.register(cookie, {
    secret: config.cookieSecret
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
