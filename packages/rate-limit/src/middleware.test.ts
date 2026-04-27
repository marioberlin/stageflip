// packages/rate-limit/src/middleware.test.ts
// T-263 ACs #11–#14 — middleware request/response shape + idempotency.

import { describe, expect, it } from 'vitest';
import { InMemoryRedis } from './in-memory-redis.js';
import { RateLimiter } from './limiter.js';
import {
  type RateLimitPrincipal,
  type RateLimitRequest,
  type RateLimitResponse,
  checkAndConsume,
  createRateLimitMiddleware,
  principalToInput,
} from './middleware.js';

interface Sink {
  status: number | null;
  body: unknown;
  headers: Record<string, string>;
  res: RateLimitResponse;
}
function recordingResponse(): Sink {
  const sink: Sink = {
    status: null,
    body: null,
    headers: {},
    res: undefined as unknown as RateLimitResponse,
  };
  sink.res = {
    status(code: number) {
      sink.status = code;
      return sink.res;
    },
    json(body: unknown) {
      sink.body = body;
      return sink.res;
    },
    setHeader(name: string, value: string) {
      sink.headers[name] = value;
    },
  };
  return sink;
}

function makeLimiter(now: () => number = () => Date.now()) {
  const redis = new InMemoryRedis(now);
  const limiter = new RateLimiter({
    redis,
    now,
    config: {
      user: { capacity: 1, refillPerSecond: 1 },
      org: { capacity: 100, refillPerSecond: 100 },
      apiKey: { capacity: 1, refillPerSecond: 1 },
    },
  });
  return { redis, limiter };
}

const userPrincipal: RateLimitPrincipal = {
  kind: 'user',
  userId: 'u_alice',
  orgId: 'o_acme',
};

describe('createRateLimitMiddleware — Connect-style shape (AC #11)', () => {
  it('returns a (req, res, next) function', () => {
    const { limiter } = makeLimiter();
    const mw = createRateLimitMiddleware({ limiter });
    expect(typeof mw).toBe('function');
    expect(mw.length).toBe(3);
  });
});

describe('createRateLimitMiddleware — principal reading (AC #12)', () => {
  it('calls next(err) when req.principal is missing', async () => {
    const { limiter } = makeLimiter();
    const mw = createRateLimitMiddleware({ limiter });
    const req: RateLimitRequest = {};
    const sink = recordingResponse();
    let err: unknown = null;
    await mw(req, sink.res, (e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/req.principal missing/);
  });

  it('calls next(err) when principal has no user/apiKey', async () => {
    const { limiter } = makeLimiter();
    const mw = createRateLimitMiddleware({ limiter });
    const req: RateLimitRequest = {
      // Synthetic shape: kind=user but no userId — simulates a malformed principal.
      principal: { kind: 'user', orgId: 'o_only' },
    };
    const sink = recordingResponse();
    let err: unknown = null;
    await mw(req, sink.res, (e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/at least one of user or apiKey required/);
  });
});

describe('createRateLimitMiddleware — allow path (AC #13)', () => {
  it('calls next() with no args when allowed', async () => {
    const { limiter } = makeLimiter();
    const mw = createRateLimitMiddleware({ limiter });
    const req: RateLimitRequest = { principal: userPrincipal };
    const sink = recordingResponse();
    let nextArgs: unknown[] | null = null;
    await mw(req, sink.res, (...args) => {
      nextArgs = args;
    });
    expect(nextArgs).toEqual([]);
    expect(sink.status).toBeNull();
  });
});

describe('createRateLimitMiddleware — reject path (AC #13, AC #16)', () => {
  it('writes 429 + Retry-After header + JSON body when rejected', async () => {
    const now = 0;
    const { limiter } = makeLimiter(() => now);
    const mw = createRateLimitMiddleware({ limiter });
    // Drain the user bucket (capacity 1).
    {
      const sink = recordingResponse();
      await mw({ principal: userPrincipal }, sink.res, () => {});
      expect(sink.status).toBeNull();
    }
    // Second call rejects.
    const sink = recordingResponse();
    let nextCalled = false;
    await mw({ principal: userPrincipal }, sink.res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(sink.status).toBe(429);
    expect(sink.headers['Retry-After']).toBe('1');
    expect(sink.body).toEqual({
      code: 'RATE_LIMITED',
      tier: 'user',
      retryAfterSeconds: 1,
    });
  });

  it('rounds Retry-After up to whole seconds', async () => {
    const now = 0;
    const redis = new InMemoryRedis(() => now);
    const limiter = new RateLimiter({
      redis,
      now: () => now,
      config: {
        user: { capacity: 1, refillPerSecond: 4 }, // 250ms refill
        org: { capacity: 1000, refillPerSecond: 100 },
        apiKey: { capacity: 1, refillPerSecond: 1 },
      },
    });
    const mw = createRateLimitMiddleware({ limiter });
    {
      const sink = recordingResponse();
      await mw({ principal: userPrincipal }, sink.res, () => {});
    }
    const sink = recordingResponse();
    await mw({ principal: userPrincipal }, sink.res, () => {});
    expect(sink.status).toBe(429);
    // 250ms → 1s rounded up.
    expect(sink.headers['Retry-After']).toBe('1');
  });
});

describe('createRateLimitMiddleware — layered idempotency (AC #14)', () => {
  it('two stacked instances each consume from their own (separately-namespaced) buckets', async () => {
    const now = 0;
    const redis = new InMemoryRedis(() => now);
    const innerLimiter = new RateLimiter({
      redis,
      now: () => now,
      namespace: 'inner',
      config: {
        user: { capacity: 1, refillPerSecond: 1 },
        org: { capacity: 100, refillPerSecond: 1 },
        apiKey: { capacity: 1, refillPerSecond: 1 },
      },
    });
    const outerLimiter = new RateLimiter({
      redis,
      now: () => now,
      namespace: 'outer',
      config: {
        user: { capacity: 1, refillPerSecond: 1 },
        org: { capacity: 100, refillPerSecond: 1 },
        apiKey: { capacity: 1, refillPerSecond: 1 },
      },
    });
    const outer = createRateLimitMiddleware({ limiter: outerLimiter });
    const inner = createRateLimitMiddleware({ limiter: innerLimiter });

    // Run outer then inner sequentially (simulating layered routing).
    const req: RateLimitRequest = { principal: userPrincipal };
    const sink1 = recordingResponse();
    await outer(req, sink1.res, () => {});
    await inner(req, sink1.res, () => {});

    // Verify both keys were written.
    const outerKey = await redis.get('outer:user:u_alice');
    const innerKey = await redis.get('inner:user:u_alice');
    expect(outerKey).not.toBeNull();
    expect(innerKey).not.toBeNull();
    // Both buckets started at 1, both were debited once → both at 0.
    expect((JSON.parse(outerKey as string) as { tokens: number }).tokens).toBe(0);
    expect((JSON.parse(innerKey as string) as { tokens: number }).tokens).toBe(0);
  });

  it('a single shared limiter, applied twice in a chain, debits twice (documented behaviour)', async () => {
    // This is the inverse of the namespaced case: when two middleware
    // instances *share the same limiter*, each call consumes a token.
    // Callers wanting "one consume per request" should mount the
    // middleware exactly once. The namespaced case above is the safe
    // pattern for layered routes.
    const now = 0;
    const redis = new InMemoryRedis(() => now);
    const limiter = new RateLimiter({
      redis,
      now: () => now,
      config: {
        user: { capacity: 2, refillPerSecond: 1 },
        org: { capacity: 100, refillPerSecond: 1 },
        apiKey: { capacity: 2, refillPerSecond: 1 },
      },
    });
    const mw = createRateLimitMiddleware({ limiter });
    const req: RateLimitRequest = { principal: userPrincipal };
    const sink = recordingResponse();
    await mw(req, sink.res, () => {});
    await mw(req, sink.res, () => {});
    const raw = await redis.get('ratelimit:user:u_alice');
    expect((JSON.parse(raw as string) as { tokens: number }).tokens).toBe(0);
  });
});

describe('principalToInput', () => {
  it('maps user principal → { user, org }', () => {
    expect(principalToInput({ kind: 'user', userId: 'u', orgId: 'o' })).toEqual({
      user: 'u',
      org: 'o',
    });
  });

  it('maps apiKey principal → { apiKey, org }', () => {
    expect(principalToInput({ kind: 'apiKey', keyId: 'k', orgId: 'o' })).toEqual({
      apiKey: 'k',
      org: 'o',
    });
  });

  it('maps mcp-session principal → { user, org }', () => {
    expect(principalToInput({ kind: 'mcp-session', userId: 'u', orgId: 'o' })).toEqual({
      user: 'u',
      org: 'o',
    });
  });

  it('returns null when no keyable id is present', () => {
    expect(principalToInput({ kind: 'user', orgId: 'o' })).toBeNull();
    expect(principalToInput({ kind: 'apiKey', orgId: 'o' })).toBeNull();
  });
});

describe('checkAndConsume — engine boundary helper (D-T263-4)', () => {
  it('resolves on allow', async () => {
    const { limiter } = makeLimiter();
    await expect(checkAndConsume(limiter, { user: 'u_a' })).resolves.toBeUndefined();
  });

  it('throws RateLimitedError on reject', async () => {
    const now = 0;
    const { limiter } = makeLimiter(() => now);
    await checkAndConsume(limiter, { user: 'u_a' }); // drain
    await expect(checkAndConsume(limiter, { user: 'u_a' })).rejects.toMatchObject({
      name: 'RateLimitedError',
      tier: 'user',
    });
  });

  it('forwards limiter errors (AC #8) unwrapped', async () => {
    const { limiter } = makeLimiter();
    await expect(checkAndConsume(limiter, { org: 'o_only' })).rejects.toThrow(
      /at least one of user or apiKey required/,
    );
  });
});
