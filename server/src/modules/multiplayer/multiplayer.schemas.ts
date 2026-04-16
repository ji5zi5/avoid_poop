import {z} from 'zod';

export const ROOM_CODE_LENGTH = 6;
export const ROOM_MAX_PLAYERS = 8;
export const ROOM_MIN_PLAYERS = 2;

export const roomCodeValueSchema = z
  .string()
  .trim()
  .length(ROOM_CODE_LENGTH, `Room code must be ${ROOM_CODE_LENGTH} characters.`)
  .regex(/^[a-zA-Z0-9]+$/, 'Room code must contain only letters and numbers.');

export const roomBrowseIdSchema = z.string().uuid();
export const roomMaxPlayersSchema = z.number().int().min(ROOM_MIN_PLAYERS).max(ROOM_MAX_PLAYERS);

export const privatePasswordValueSchema = z
  .string()
  .trim()
  .min(1, 'Private room password is required.')
  .max(32, 'Private room password must be at most 32 characters.');

export const roomStatusSchema = z.enum(['waiting', 'starting', 'in_progress']);
export const roomDifficultySchema = z.enum(['normal', 'hard']);
export const roomVisibilitySchema = z.enum(['public', 'private']);
export const lobbyNoticeToneSchema = z.enum(['success', 'accent', 'danger']);

export const roomOptionsSchema = z.object({
  difficulty: roomDifficultySchema,
  visibility: roomVisibilitySchema,
  bodyBlock: z.boolean(),
  debuffTier: z.union([z.literal(2), z.literal(3)])
});

export const roomOptionsPatchSchema = roomOptionsSchema.partial();

export const createRoomPayloadSchema = z.object({
  options: roomOptionsPatchSchema.optional(),
  maxPlayers: roomMaxPlayersSchema.optional(),
  privatePassword: privatePasswordValueSchema.optional()
}).superRefine((value, ctx) => {
  const visibility = value.options?.visibility ?? defaultRoomOptions.visibility;
  if (visibility === 'private' && !value.privatePassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Private rooms require a password.',
      path: ['privatePassword']
    });
  }
});

export const updateRoomSettingsPayloadSchema = z.object({
  options: roomOptionsPatchSchema.optional(),
  maxPlayers: roomMaxPlayersSchema.optional(),
  privatePassword: privatePasswordValueSchema.optional()
}).superRefine((value, ctx) => {
  if (!value.options && value.maxPlayers === undefined && value.privatePassword === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide at least one room setting to update.',
      path: ['options']
    });
  }
});

export const joinRoomPayloadSchema = z.object({
  roomCode: roomCodeValueSchema.optional(),
  roomId: roomBrowseIdSchema.optional(),
  privatePassword: privatePasswordValueSchema.optional()
}).superRefine((value, ctx) => {
  if (!value.roomCode && !value.roomId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide a room identifier.',
      path: ['roomCode']
    });
  }
  if (value.roomCode && value.roomId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Choose either roomCode or roomId, not both.',
      path: ['roomId']
    });
  }
});

export const quickJoinPayloadSchema = z.object({});

export const roomCodeParamsSchema = z.object({
  roomCode: roomCodeValueSchema
});

export const lobbyPlayerSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string().min(1),
  isHost: z.boolean(),
  ready: z.boolean()
});

export const roomChatMessageSchema = z.object({
  id: z.string().uuid(),
  userId: z.number().int().positive(),
  username: z.string().min(1),
  message: z.string().trim().min(1).max(240),
  createdAt: z.string().datetime()
});

export const roomSummarySchema = z.object({
  roomCode: z.string().length(ROOM_CODE_LENGTH).regex(/^[A-Z0-9]+$/),
  hostUserId: z.number().int().positive(),
  status: roomStatusSchema,
  maxPlayers: roomMaxPlayersSchema,
  playerCount: z.number().int().min(0).max(ROOM_MAX_PLAYERS),
  players: z.array(lobbyPlayerSchema).max(ROOM_MAX_PLAYERS),
  options: roomOptionsSchema,
  chatMessages: z.array(roomChatMessageSchema).max(80)
}).superRefine((room, ctx) => {
  if (room.playerCount > room.maxPlayers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Player count cannot exceed max players.',
      path: ['playerCount'],
    });
  }
  if (room.players.length > room.maxPlayers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Roster cannot exceed max players.',
      path: ['players'],
    });
  }
});

export const roomListEntrySchema = z.object({
  roomId: roomBrowseIdSchema,
  hostUsername: z.string().min(1),
  status: roomStatusSchema,
  maxPlayers: roomMaxPlayersSchema,
  playerCount: z.number().int().min(0).max(ROOM_MAX_PLAYERS),
  options: roomOptionsSchema,
}).superRefine((room, ctx) => {
  if (room.playerCount > room.maxPlayers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Player count cannot exceed max players.',
      path: ['playerCount'],
    });
  }
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
  airborneUntil: z.number().int().nonnegative().nullable(),
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

export const roomCountdownSchema = z.object({
  roomCode: z.string().length(ROOM_CODE_LENGTH).regex(/^[A-Z0-9]+$/),
  secondsRemaining: z.number().int().positive().max(9),
});

export const lobbyNoticeSchema = z.object({
  roomCode: z.string().length(ROOM_CODE_LENGTH).regex(/^[A-Z0-9]+$/),
  tone: lobbyNoticeToneSchema,
  message: z.string().min(1).max(120),
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
    type: z.literal('jump')
  }),
  z.object({
    type: z.literal('leave_room')
  }),
  z.object({
    type: z.literal('send_chat'),
    message: z.string().trim().min(1).max(240)
  }),
  z.object({
    type: z.literal('kick_player'),
    targetUserId: z.number().int().positive()
  }),
  z.object({
    type: z.literal('transfer_host'),
    targetUserId: z.number().int().positive()
  }),
  z.object({
    type: z.literal('update_room_settings'),
    settings: updateRoomSettingsPayloadSchema
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
    type: z.literal('room_countdown'),
    countdown: roomCountdownSchema
  }),
  z.object({
    type: z.literal('game_snapshot'),
    game: multiplayerGameSnapshotSchema
  }),
  z.object({
    type: z.literal('chat_message'),
    roomCode: z.string().length(ROOM_CODE_LENGTH).regex(/^[A-Z0-9]+$/),
    chatMessage: roomChatMessageSchema
  }),
  z.object({
    type: z.literal('room_departed'),
    roomCode: z.string().length(ROOM_CODE_LENGTH).regex(/^[A-Z0-9]+$/),
    reason: z.literal('kicked'),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal('lobby_notice'),
    notice: lobbyNoticeSchema
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
  difficulty: 'normal',
  visibility: 'public',
  bodyBlock: false,
  debuffTier: 2
});

export type RoomOptions = z.infer<typeof roomOptionsSchema>;
export type RoomOptionsPatch = z.infer<typeof roomOptionsPatchSchema>;
export type RoomSettingsPatch = z.infer<typeof updateRoomSettingsPayloadSchema>;
export type LobbyPlayer = z.infer<typeof lobbyPlayerSchema>;
export type RoomChatMessage = z.infer<typeof roomChatMessageSchema>;
export type RoomSummary = z.infer<typeof roomSummarySchema>;
export type RoomListEntry = z.infer<typeof roomListEntrySchema>;
export type RoomCountdown = z.infer<typeof roomCountdownSchema>;
export type LobbyNotice = z.infer<typeof lobbyNoticeSchema>;
export type MultiplayerClientEvent = z.infer<typeof multiplayerClientEventSchema>;
export type MultiplayerServerEvent = z.infer<typeof multiplayerServerEventSchema>;
