import {z} from 'zod';

export const authUsernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(/^[\p{Script=Hangul}a-zA-Z0-9_]+$/u);

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  username: authUsernameSchema
});

export const authSessionSchema = z.object({
  authenticated: z.boolean(),
  user: authUserSchema.nullable()
});

export const authCredentialsSchema = z.object({
  username: authUsernameSchema,
  password: z.string()
    .min(6)
    .max(72)
});

export const authResponseSchema = z.object({
  user: authUserSchema,
  sessionToken: z.string().min(1),
});

export const authWebSocketTicketSchema = z.object({
  token: z.string().min(1),
});

export const apiErrorSchema = z.object({
  error: z.string()
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type AuthWebSocketTicket = z.infer<typeof authWebSocketTicketSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
