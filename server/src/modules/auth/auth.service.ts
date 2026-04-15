import { FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../../config.js';
import { createSessionId } from '../../utils/session.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSession,
  findUserById,
  findUserByUsername,
  getSession,
} from './auth.repository.js';

export class AuthConflictError extends Error {}
export class AuthUnauthorizedError extends Error {}

const EXPIRED_SESSION_SWEEP_INTERVAL_MS = 60_000;
let lastExpiredSessionSweepAt = 0;

export function toPublicUser(user: { id: number; username: string }) {
  return {
    id: user.id,
    username: user.username,
  };
}

function normalizeUsername(username: string) {
  return username.normalize('NFC').trim();
}

export async function signup(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  const existing = await findUserByUsername(normalizedUsername);
  if (existing) {
    throw new AuthConflictError('Username is already taken.');
  }

  return createUser(normalizedUsername, hashPassword(password));
}

export async function login(username: string, password: string) {
  const user = await findUserByUsername(normalizeUsername(username));
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthUnauthorizedError('Invalid username or password.');
  }

  return user;
}

export async function establishSession(reply: FastifyReply, userId: number) {
  const sessionId = createSessionId();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs);

  await createSession(sessionId, userId, expiresAt.toISOString());

  reply.setCookie(config.sessionCookieName, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    signed: true,
    expires: expiresAt,
  });
}

export async function clearSession(reply: FastifyReply, sessionId?: string) {
  if (sessionId) {
    await deleteSession(sessionId);
  }

  reply.clearCookie(config.sessionCookieName, {
    path: '/',
  });
}

type UnsignCookieResult = {
  valid: boolean;
  value: string | null;
};

export async function resolveSessionUserFromSignedCookie(
  rawCookie: string | undefined,
  unsignCookie: (cookieValue: string) => UnsignCookieResult,
) {
  const now = Date.now();
  if (now - lastExpiredSessionSweepAt >= EXPIRED_SESSION_SWEEP_INTERVAL_MS) {
    await deleteExpiredSessions();
    lastExpiredSessionSweepAt = now;
  }

  if (!rawCookie) {
    return null;
  }

  const unsigned = unsignCookie(rawCookie);
  if (!unsigned.valid || !unsigned.value) {
    return null;
  }

  const session = await getSession(unsigned.value);
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= now) {
    await deleteSession(session.id);
    return null;
  }

  return findUserById(session.userId);
}

export async function resolveSessionUser(request: FastifyRequest) {
  return resolveSessionUserFromSignedCookie(
    request.cookies[config.sessionCookieName],
    (cookieValue) => request.unsignCookie(cookieValue),
  );
}
