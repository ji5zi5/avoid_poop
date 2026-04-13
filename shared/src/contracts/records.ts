import {z} from 'zod';

export const gameModeSchema = z.enum(['normal', 'hard']);

export const runResultPayloadSchema = z.object({
  mode: gameModeSchema,
  score: z.number().int().nonnegative(),
  reachedRound: z.number().int().positive(),
  survivalTime: z.number().nonnegative(),
  clear: z.boolean()
});

export const recordEntrySchema = runResultPayloadSchema.extend({
  id: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
  createdAt: z.string()
});

export const multiplayerRecordEntrySchema = z.object({
  matchId: z.number().int().positive(),
  placement: z.number().int().positive(),
  totalPlayers: z.number().int().positive(),
  reachedRound: z.number().int().positive(),
  won: z.boolean(),
  createdAt: z.string()
});

export const multiplayerStatsSchema = z.object({
  matchesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  bestPlacement: z.number().int().positive().nullable()
});

export const recordsResponseSchema = z.object({
  best: z.object({
    normal: recordEntrySchema.optional(),
    hard: recordEntrySchema.optional()
  }),
  recent: z.array(recordEntrySchema),
  multiplayer: z.object({
    stats: multiplayerStatsSchema,
    recent: z.array(multiplayerRecordEntrySchema)
  })
});

export type GameMode = z.infer<typeof gameModeSchema>;
export type RunResultPayload = z.infer<typeof runResultPayloadSchema>;
export type RecordEntry = z.infer<typeof recordEntrySchema>;
export type MultiplayerRecordEntry = z.infer<typeof multiplayerRecordEntrySchema>;
export type MultiplayerStats = z.infer<typeof multiplayerStatsSchema>;
export type RecordsResponse = z.infer<typeof recordsResponseSchema>;
