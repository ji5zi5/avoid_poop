import {z} from 'zod';

export const ROOM_CODE_LENGTH = 6;
export const ROOM_MAX_PLAYERS = 8;

export const roomCodeValueSchema = z
  .string()
  .trim()
  .length(ROOM_CODE_LENGTH, `Room code must be ${ROOM_CODE_LENGTH} characters.`)
  .regex(/^[a-zA-Z0-9]+$/, 'Room code must contain only letters and numbers.');

export const roomStatusSchema = z.enum(['waiting', 'in_progress']);

export const roomOptionsSchema = z.object({
  bodyBlock: z.boolean(),
  debuffTier: z.union([z.literal(2), z.literal(3)])
});

export const roomOptionsPatchSchema = roomOptionsSchema.partial();

export const createRoomPayloadSchema = z.object({
  options: roomOptionsPatchSchema.optional()
});

export const joinRoomPayloadSchema = z.object({
  roomCode: roomCodeValueSchema
});

export const quickJoinPayloadSchema = z.object({
  options: roomOptionsPatchSchema.optional()
});

export const roomCodeParamsSchema = z.object({
  roomCode: roomCodeValueSchema
});

export const lobbyPlayerSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string().min(1),
  isHost: z.boolean(),
  ready: z.boolean()
});

export const roomSummarySchema = z.object({
  roomCode: z.string().length(ROOM_CODE_LENGTH).regex(/^[A-Z0-9]+$/),
  hostUserId: z.number().int().positive(),
  status: roomStatusSchema,
  maxPlayers: z.literal(ROOM_MAX_PLAYERS),
  playerCount: z.number().int().min(0).max(ROOM_MAX_PLAYERS),
  players: z.array(lobbyPlayerSchema).max(ROOM_MAX_PLAYERS),
  options: roomOptionsSchema
});

export const multiplayerActiveDebuffSchema = z.object({
  expiresAt: z.number().int().nonnegative(),
  type: z.enum(['slow', 'reverse', 'input_delay', 'vision_jam', 'item_lock'])
});

export const multiplayerPlayerSnapshotSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  direction: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  lives: z.number().int().nonnegative(),
  status: z.enum(['alive', 'spectator', 'disconnected']),
  disconnectDeadlineAt: z.number().int().nonnegative().nullable(),
  activeDebuffs: z.array(multiplayerActiveDebuffSchema)
});

export const multiplayerHazardSnapshotSchema = z.object({
  id: z.number().int().positive(),
  owner: z.enum(['wave', 'boss']),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  speed: z.number().nonnegative()
});

export const multiplayerItemSnapshotSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('debuff'),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive()
});

export const multiplayerGameSnapshotSchema = z.object({
  roomCode: z.string().length(ROOM_CODE_LENGTH).regex(/^[A-Z0-9]+$/),
  phase: z.enum(['wave', 'boss', 'complete']),
  round: z.number().int().positive(),
  elapsedInPhase: z.number().nonnegative(),
  options: roomOptionsSchema,
  players: z.array(multiplayerPlayerSnapshotSchema),
  hazards: z.array(multiplayerHazardSnapshotSchema),
  items: z.array(multiplayerItemSnapshotSchema),
  winnerUserId: z.number().int().positive().nullable()
});

export const multiplayerClientEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe_room'),
    roomCode: roomCodeValueSchema
  }),
  z.object({
    type: z.literal('ping')
  }),
  z.object({
    type: z.literal('set_ready'),
    ready: z.boolean()
  }),
  z.object({
    type: z.literal('start_game')
  }),
  z.object({
    type: z.literal('player_input'),
    direction: z.union([z.literal(-1), z.literal(0), z.literal(1)])
  }),
  z.object({
    type: z.literal('leave_room')
  })
]);

export const multiplayerServerEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('connected'),
    reconnectToken: z.string().uuid(),
    reconnectGraceMs: z.number().int().nonnegative(),
    user: z.object({
      id: z.number().int().positive(),
      username: z.string().min(1)
    }),
    reconnected: z.boolean()
  }),
  z.object({
    type: z.literal('room_snapshot'),
    room: roomSummarySchema
  }),
  z.object({
    type: z.literal('game_snapshot'),
    game: multiplayerGameSnapshotSchema
  }),
  z.object({
    type: z.literal('pong')
  }),
  z.object({
    type: z.literal('error'),
    error: z.string().min(1)
  })
]);

export const defaultRoomOptions = roomOptionsSchema.parse({
  bodyBlock: false,
  debuffTier: 2
});

export type RoomOptions = z.infer<typeof roomOptionsSchema>;
export type RoomOptionsPatch = z.infer<typeof roomOptionsPatchSchema>;
export type LobbyPlayer = z.infer<typeof lobbyPlayerSchema>;
export type RoomSummary = z.infer<typeof roomSummarySchema>;
export type MultiplayerClientEvent = z.infer<typeof multiplayerClientEventSchema>;
export type MultiplayerServerEvent = z.infer<typeof multiplayerServerEventSchema>;
