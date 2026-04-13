import {FastifyInstance} from 'fastify';

import {authResponseSchema, authSessionSchema} from '../../../../shared/src/contracts/auth.js';
import {config} from '../../config.js';
import {optionalUser, requireUser} from '../../middleware/authGuard.js';
import {
  AuthConflictError,
  AuthUnauthorizedError,
  clearSession,
  establishSession,
  login,
  resolveSessionUser,
  signup,
  toPublicUser
} from './auth.service.js';
import {authCredentialsSchema} from './auth.schemas.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/signup', async (request, reply) => {
    const parsed = authCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({error: parsed.error.issues[0]?.message ?? 'Invalid payload.'});
    }

    try {
      const user = signup(parsed.data.username, parsed.data.password);
      establishSession(reply, user.id);
      return authResponseSchema.parse({user: toPublicUser(user)});
    } catch (error) {
      if (error instanceof AuthConflictError) {
        return reply.status(409).send({error: error.message});
      }
      throw error;
    }
  });

  app.post('/login', async (request, reply) => {
    const parsed = authCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({error: parsed.error.issues[0]?.message ?? 'Invalid payload.'});
    }

    try {
      const user = login(parsed.data.username, parsed.data.password);
      establishSession(reply, user.id);
      return authResponseSchema.parse({user: toPublicUser(user)});
    } catch (error) {
      if (error instanceof AuthUnauthorizedError) {
        return reply.status(401).send({error: error.message});
      }
      throw error;
    }
  });

  app.post('/logout', {preHandler: optionalUser}, async (request, reply) => {
    const rawCookie = request.cookies[config.sessionCookieName];
    const unsigned = rawCookie ? request.unsignCookie(rawCookie) : null;
    clearSession(reply, unsigned?.valid ? unsigned.value : undefined);
    return reply.send({ok: true});
  });

  app.get('/me', {preHandler: requireUser}, async (request) => {
    return authSessionSchema.parse({
      authenticated: true,
      user: toPublicUser(request.user!)
    });
  });

  app.get('/session', async (request, reply) => {
    const user = resolveSessionUser(request);
    if (!user) {
      return reply.send({
        authenticated: false,
        user: null
      });
    }
    return authSessionSchema.parse({
      authenticated: true,
      user: toPublicUser(user)
    });
  });
}
