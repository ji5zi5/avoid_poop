import {z} from 'zod';

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(3).max(24)
});

export const authSessionSchema = z.object({
  authenticated: z.boolean(),
  user: authUserSchema.nullable()
});

export const authCredentialsSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string()
    .min(6)
    .max(72)
});

export const authResponseSchema = z.object({
  user: authUserSchema
});

export const apiErrorSchema = z.object({
  error: z.string()
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
