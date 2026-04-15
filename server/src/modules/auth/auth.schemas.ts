import { z } from 'zod';

const usernameSchema = z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/);

export const loginCredentialsSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(72),
});

export const signupCredentialsSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(72),
});
