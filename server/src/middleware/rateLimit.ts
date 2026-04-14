import type { FastifyRequest, FastifyReply } from 'fastify';

import type { RateLimitBucket } from '../config.js';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(private readonly bucket: RateLimitBucket) {}

  consume(key: string, now = Date.now()): RateLimitResult {
    const existing = this.entries.get(key);
    if (!existing || existing.resetAt <= now) {
      this.entries.set(key, {
        count: 1,
        resetAt: now + this.bucket.windowMs,
      });
      return {
        allowed: true,
        remaining: Math.max(0, this.bucket.max - 1),
        retryAfterMs: this.bucket.windowMs,
      };
    }

    if (existing.count >= this.bucket.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, existing.resetAt - now),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.bucket.max - existing.count),
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }
}

function identifyRequester(request: FastifyRequest) {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

export function limitRequest(reply: FastifyReply, result: RateLimitResult) {
  reply.header('Retry-After', Math.max(1, Math.ceil(result.retryAfterMs / 1000)));
  reply.header('X-RateLimit-Remaining', result.remaining);
  return reply.status(429).send({ error: 'Too many requests. Try again later.' });
}

export function enforceRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  limiter: FixedWindowRateLimiter,
  bucketName: string,
) {
  const requester = identifyRequester(request);
  const result = limiter.consume(`${bucketName}:${requester}`);
  if (!result.allowed) {
    request.log.warn(
      {
        event: 'rate_limit_exceeded',
        bucket: bucketName,
        ip: requester,
      },
      'Rejected rate-limited request',
    );
    return limitRequest(reply, result);
  }
  reply.header('X-RateLimit-Remaining', result.remaining);
  return null;
}

export function identifySocketRequester(
  remoteAddress: string | undefined,
  forwardedForHeader: string | string[] | undefined,
  trustProxy: boolean,
) {
  if (trustProxy && typeof forwardedForHeader === 'string' && forwardedForHeader.trim()) {
    return forwardedForHeader.split(',')[0]!.trim();
  }
  if (trustProxy && Array.isArray(forwardedForHeader) && forwardedForHeader[0]?.trim()) {
    return forwardedForHeader[0].split(',')[0]!.trim();
  }
  return remoteAddress || 'unknown';
}
