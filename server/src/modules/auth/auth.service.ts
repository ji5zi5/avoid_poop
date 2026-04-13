import {FastifyReply, FastifyRequest} from 'fastify';

import {config} from '../../config.js';
import {createSessionId} from '../../utils/session.js';
import {hashPassword, verifyPassword} from '../../utils/password.js';
import {
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSession,
  findUserById,
  findUserByUsername,
  getSession
} from './auth.repository.js';

export class AuthConflictError extends Error {}
export class AuthUnauthorizedError extends Error {}

export function toPublicUser(user: {id: number; username: string}) {
  return {
    id: user.id,
    username: user.username
  };
}

export function signup(username: string, password: string) {
  const existing = findUserByUsername(username);
  if (existing) {
    throw new AuthConflictError('Username is already taken.');
  }

  return createUser(username, hashPassword(password));
}

export function login(username: string, password: string) {
  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthUnauthorizedError('Invalid username or password.');
  }

  return user;
}

export function establishSession(reply: FastifyReply, userId: number) {
  const sessionId = createSessionId();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs);

  createSession(sessionId, userId, expiresAt.toISOString());

  reply.setCookie(config.sessionCookieName, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    signed: true,
    expires: expiresAt
  });
}

export function clearSession(reply: FastifyReply, sessionId?: string) {
  if (sessionId) {
    deleteSession(sessionId);
  }

  reply.clearCookie(config.sessionCookieName, {
    path: '/'
  });
}

export function resolveSessionUser(request: FastifyRequest) {
  deleteExpiredSessions();

  const rawCookie = request.cookies[config.sessionCookieName];
  if (!rawCookie) {
    return null;
  }

  const unsigned = request.unsignCookie(rawCookie);
  if (!unsigned.valid) {
    return null;
  }

  const session = getSession(unsigned.value);
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    deleteSession(session.id);
    return null;
  }

  return findUserById(session.userId);
}
