import { z } from 'zod';
import { authUsernameSchema } from '../../../../shared/src/contracts/auth.js';

const usernameSchema = authUsernameSchema;

export const loginCredentialsSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(72),
});

export const signupCredentialsSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(72),
});
