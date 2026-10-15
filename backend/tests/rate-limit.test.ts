import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter, rateLimitValues } from '../src/rate-limit.js';

describe('local rate limiting', () => {
  it('blocks requests beyond the fixed-window limit and resets after the window', () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter(2, 1_000, () => now);
    expect(limiter.consume('client')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('client')).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume('client')).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
    expect(limiter.consume('other')).toMatchObject({ allowed: true, remaining: 1 });
    now = 2_000;
    expect(limiter.consume('client')).toMatchObject({ allowed: true, remaining: 1 });
  });

  it('uses bounded safe defaults for invalid or excessive configuration', () => {
    expect(rateLimitValues({
      RATE_LIMIT_WINDOW_MS: 'bad', RATE_LIMIT_MAX_REQUESTS: '0',
      RUN_RATE_LIMIT_WINDOW_MS: '99999999', RUN_RATE_LIMIT_MAX_STARTS: '999',
    })).toEqual({
      requestWindowMs: 60_000, maxRequests: 180,
      runWindowMs: 3_600_000, maxRunStarts: 100,
    });
  });
});
