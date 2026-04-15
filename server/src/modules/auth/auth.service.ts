import { createHmac, randomUUID } from 'node:crypto';

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
const WS_TICKET_TTL_MS = 30_000;

export function toPublicUser(user: { id: number; username: string }) {
  return {
    id: user.id,
    username: user.username,
  };
}

function normalizeUsername(username: string) {
  return username.normalize('NFC').trim();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signTicketPayload(payload: string) {
  return createHmac('sha256', config.cookieSecret).update(payload).digest('base64url');
}

type WebSocketTicketPayload = {
  exp: number;
  nonce: string;
  userId: number;
};

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

export function createWebSocketTicket(userId: number) {
  const payload = encodeBase64Url(JSON.stringify({
    userId,
    exp: Date.now() + WS_TICKET_TTL_MS,
    nonce: randomUUID(),
  } satisfies WebSocketTicketPayload));
  const signature = signTicketPayload(payload);
  return `${payload}.${signature}`;
}

export async function resolveUserFromWebSocketTicket(ticket: string | undefined) {
  if (!ticket) {
    return null;
  }

  const [payload, signature] = ticket.split('.');
  if (!payload || !signature) {
    return null;
  }

  if (signTicketPayload(payload) !== signature) {
    return null;
  }

  let parsed: WebSocketTicketPayload;
  try {
    parsed = JSON.parse(decodeBase64Url(payload)) as WebSocketTicketPayload;
  } catch {
    return null;
  }

  if (!parsed?.userId || !parsed?.exp || parsed.exp <= Date.now()) {
    return null;
  }

  return findUserById(parsed.userId);
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
