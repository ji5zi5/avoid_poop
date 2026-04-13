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

export const recordsResponseSchema = z.object({
  best: z.object({
    normal: recordEntrySchema.optional(),
    hard: recordEntrySchema.optional()
  }),
  recent: z.array(recordEntrySchema)
});

export type GameMode = z.infer<typeof gameModeSchema>;
export type RunResultPayload = z.infer<typeof runResultPayloadSchema>;
export type RecordEntry = z.infer<typeof recordEntrySchema>;
export type RecordsResponse = z.infer<typeof recordsResponseSchema>;
