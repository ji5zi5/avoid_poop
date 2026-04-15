import {z} from 'zod';

export const gameModeSchema = z.enum(['normal', 'hard']);

export const runResultPayloadSchema = z.object({
  mode: gameModeSchema,
  score: z.number().int().nonnegative(),
  reachedRound: z.number().int().positive(),
  survivalTime: z.number().nonnegative(),
  clear: z.boolean()
});

export const singlePlayerRunSessionSchema = z.object({
  id: z.string().uuid(),
  mode: gameModeSchema,
  waveSeed: z.number().int().positive(),
  bossSeed: z.number().int().positive(),
  startedAt: z.string(),
});

export const recordEntrySchema = runResultPayloadSchema.extend({
  id: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
  verified: z.boolean().default(false),
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

export const singlePlayerProfileSchema = z.object({
  totalRuns: z.number().int().nonnegative(),
  totalClears: z.number().int().nonnegative(),
  totalScore: z.number().int().nonnegative()
});

export const singleLeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: z.number().int().positive(),
  username: z.string().min(1),
  score: z.number().int().nonnegative(),
  reachedRound: z.number().int().positive(),
  survivalTime: z.number().nonnegative(),
  clear: z.boolean(),
  createdAt: z.string()
});

export const multiplayerLeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: z.number().int().positive(),
  username: z.string().min(1),
  wins: z.number().int().nonnegative(),
  matchesPlayed: z.number().int().nonnegative(),
  bestPlacement: z.number().int().positive().nullable(),
  bestReachedRound: z.number().int().positive().nullable()
});

export const recordsResponseSchema = z.object({
  profile: singlePlayerProfileSchema,
  best: z.object({
    normal: recordEntrySchema.optional(),
    hard: recordEntrySchema.optional()
  }),
  recent: z.array(recordEntrySchema),
  multiplayer: z.object({
    stats: multiplayerStatsSchema,
    recent: z.array(multiplayerRecordEntrySchema)
  }),
  leaderboard: z.object({
    normal: z.array(singleLeaderboardEntrySchema),
    hard: z.array(singleLeaderboardEntrySchema),
    multiplayer: z.array(multiplayerLeaderboardEntrySchema)
  })
});

export type GameMode = z.infer<typeof gameModeSchema>;
export type RunResultPayload = z.infer<typeof runResultPayloadSchema>;
export type SinglePlayerRunSession = z.infer<typeof singlePlayerRunSessionSchema>;
export type RecordEntry = z.infer<typeof recordEntrySchema>;
export type MultiplayerRecordEntry = z.infer<typeof multiplayerRecordEntrySchema>;
export type MultiplayerStats = z.infer<typeof multiplayerStatsSchema>;
export type SinglePlayerProfile = z.infer<typeof singlePlayerProfileSchema>;
export type SingleLeaderboardEntry = z.infer<typeof singleLeaderboardEntrySchema>;
export type MultiplayerLeaderboardEntry = z.infer<typeof multiplayerLeaderboardEntrySchema>;
export type RecordsResponse = z.infer<typeof recordsResponseSchema>;
