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
      const user = await signup(parsed.data.username, parsed.data.password);
      await establishSession(reply, user.id);
      request.log.info({event: 'auth_signup', userId: user.id, username: user.username}, 'User signed up');
      return authResponseSchema.parse({user: toPublicUser(user)});
    } catch (error) {
      if (error instanceof AuthConflictError) {
        request.log.warn({event: 'auth_signup_conflict', username: parsed.data.username}, 'Signup rejected because username exists');
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
      const user = await login(parsed.data.username, parsed.data.password);
      await establishSession(reply, user.id);
      request.log.info({event: 'auth_login', userId: user.id, username: user.username}, 'User logged in');
      return authResponseSchema.parse({user: toPublicUser(user)});
    } catch (error) {
      if (error instanceof AuthUnauthorizedError) {
        request.log.warn({event: 'auth_login_denied', username: parsed.data.username}, 'Login rejected');
        return reply.status(401).send({error: error.message});
      }
      throw error;
    }
  });

  app.post('/logout', {preHandler: optionalUser}, async (request, reply) => {
    const rawCookie = request.cookies[config.sessionCookieName];
    const unsigned = rawCookie ? request.unsignCookie(rawCookie) : null;
    await clearSession(reply, unsigned?.valid ? unsigned.value : undefined);
    request.log.info({event: 'auth_logout', userId: request.user?.id ?? null}, 'User logged out');
    return reply.send({ok: true});
  });

  app.get('/me', {preHandler: requireUser}, async (request) => {
    return authSessionSchema.parse({
      authenticated: true,
      user: toPublicUser(request.user!)
    });
  });

  app.get('/session', async (request, reply) => {
    const user = await resolveSessionUser(request);
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
