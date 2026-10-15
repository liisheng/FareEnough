import type { FastifyReply, FastifyRequest } from 'fastify';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Small in-memory limiter for the single-process local demo. It deliberately
 * stores only caller buckets, never authorization tokens or request bodies.
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Rate limit must be a positive integer');
    if (!Number.isSafeInteger(windowMs) || windowMs < 1000) throw new Error('Rate-limit window must be at least one second');
  }

  consume(key: string): RateLimitResult {
    const current = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    const allowed = bucket.count <= this.limit;
    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)),
    };
  }

  clear(): void { this.buckets.clear(); }
}

function boundedPositiveInt(value: string, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function rateLimitValues(env: {
  RATE_LIMIT_WINDOW_MS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  RUN_RATE_LIMIT_WINDOW_MS: string;
  RUN_RATE_LIMIT_MAX_STARTS: string;
}) {
  return {
    requestWindowMs: boundedPositiveInt(env.RATE_LIMIT_WINDOW_MS, 60_000, 3_600_000),
    maxRequests: boundedPositiveInt(env.RATE_LIMIT_MAX_REQUESTS, 180, 10_000),
    runWindowMs: boundedPositiveInt(env.RUN_RATE_LIMIT_WINDOW_MS, 600_000, 3_600_000),
    maxRunStarts: boundedPositiveInt(env.RUN_RATE_LIMIT_MAX_STARTS, 6, 100),
  };
}

export function callerKey(request: FastifyRequest): string {
  // Fastify's request.ip respects the server's trustProxy setting. The local
  // demo does not trust forwarded headers, preventing caller-controlled keys.
  return request.ip || 'unknown-local-client';
}

export function applyRateLimitHeaders(reply: FastifyReply, result: RateLimitResult): void {
  reply.header('RateLimit-Limit', String(result.limit));
  reply.header('RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) reply.header('Retry-After', String(result.retryAfterSeconds));
}
