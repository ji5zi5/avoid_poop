import {FastifyPluginAsync, FastifyReply} from 'fastify';
import {ZodError} from 'zod';

import {requireUser} from '../../middleware/authGuard.js';
import {MatchmakingService} from './matchmaking.service.js';
import {
  createRoomPayloadSchema,
  joinRoomPayloadSchema,
  quickJoinPayloadSchema,
  roomCodeParamsSchema
} from './multiplayer.schemas.js';
import {
  RoomAccessError,
  RoomClosedError,
  RoomFullError,
  RoomNotFoundError,
  RoomService,
  RoomStartError
} from './room.service.js';

type MultiplayerRoutesOptions = {
  roomService: RoomService;
  matchmakingService: MatchmakingService;
  leaveRoom: (userId: number) => void;
};

export const multiplayerRoutes: FastifyPluginAsync<MultiplayerRoutesOptions> = async (
  app,
  {roomService, matchmakingService, leaveRoom}
) => {
  app.post('/rooms', {preHandler: requireUser}, async (request, reply) => {
    const parsed = createRoomPayloadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({error: getValidationErrorMessage(parsed.error)});
    }

    try {
      const room = roomService.createRoom(request.user!, parsed.data.options, parsed.data.privatePassword);
      request.log.info(
        {
          event: 'multiplayer_room_created',
          hostUserId: request.user!.id,
          visibility: room.options.visibility,
          difficulty: room.options.difficulty,
        },
        'Created multiplayer room',
      );
      return reply.status(201).send(room);
    } catch (error) {
      return sendRoomError(reply, error);
    }
  });

  app.post('/join', {preHandler: requireUser}, async (request, reply) => {
    const parsed = joinRoomPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({error: getValidationErrorMessage(parsed.error)});
    }

    try {
      const room = roomService.joinRoom(request.user!, parsed.data.roomCode ?? parsed.data.roomId!, parsed.data.privatePassword);
      request.log.info(
        {
          event: 'multiplayer_room_joined',
          userId: request.user!.id,
          visibility: room.options.visibility,
        },
        'Joined multiplayer room',
      );
      return reply.send(room);
    } catch (error) {
      return sendRoomError(reply, error);
    }
  });

  app.get('/rooms', {preHandler: requireUser}, async (_request, reply) => {
    return reply.send(roomService.listRooms());
  });

  app.post('/quick-join', {preHandler: requireUser}, async (request, reply) => {
    const parsed = quickJoinPayloadSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({error: getValidationErrorMessage(parsed.error)});
    }

    const room = matchmakingService.quickJoin(request.user!);
    request.log.info(
      {
        event: 'multiplayer_quick_join',
        userId: request.user!.id,
        visibility: room.options.visibility,
      },
      'Completed multiplayer quick join',
    );
    return reply.send(room);
  });

  app.post('/leave', {preHandler: requireUser}, async (request, reply) => {
    leaveRoom(request.user!.id);
    request.log.info({event: 'multiplayer_leave_http', userId: request.user!.id}, 'Left multiplayer room over HTTP');
    return reply.send({ok: true});
  });

  app.get('/rooms/:roomCode', {preHandler: requireUser}, async (request, reply) => {
    const parsed = roomCodeParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({error: getValidationErrorMessage(parsed.error)});
    }

    try {
      return reply.send(roomService.getRoomForUser(request.user!.id, parsed.data.roomCode));
    } catch (error) {
      return sendRoomError(reply, error);
    }
  });
};

function getValidationErrorMessage(error: ZodError) {
  return error.issues[0]?.message ?? 'Invalid payload.';
}

function sendRoomError(reply: FastifyReply, error: unknown) {
  if (error instanceof RoomNotFoundError) {
    return reply.status(404).send({error: error.message});
  }

  if (error instanceof RoomAccessError) {
    return reply.status(403).send({error: error.message});
  }

  if (error instanceof RoomStartError) {
    return reply.status(400).send({error: error.message});
  }
  if (error instanceof RoomClosedError || error instanceof RoomFullError) {
    return reply.status(409).send({error: error.message});
  }

  throw error;
}
