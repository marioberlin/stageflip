// packages/runtimes/blender/src/submit.ts
// Pure (DI) handler for `submitBakeJob({ clipDescriptor })` (T-265 D-T265-5,
// AC #8–#13). The Cloud Function adapter in firebase/functions/src/bake/
// is a thin wrapper that translates Firebase types into this handler's deps.
//
// The handler:
//   1. Requires an authenticated caller with an active org.
//   2. Consumes N tokens (default 10 — bake is expensive) from the limiter.
//   3. Recomputes the inputsHash from the descriptor and rejects mismatches.
//   4. Checks the region-routed bucket for an existing manifest; on hit,
//      returns `{ status: 'ready', bakeId }` without enqueueing.
//   5. On miss, enqueues a BullMQ job and returns `{ status: 'pending', bakeId }`.

import type { Region } from '@stageflip/auth-schema';

import type { BlenderClipElement } from '@stageflip/schema';

import { type BakeBucketReader, bakeKeyPrefix, manifestKey } from './fetch.js';
import { computeInputsHash } from './inputs-hash.js';
import type { BakeJobPayload, BakeQueueProducer } from './queue.js';

/** A subset of `RateLimiter#consume` we depend on. Lets tests use a spy. */
export interface RateLimiterLike {
  consume(input: { user?: string; org?: string; apiKey?: string }): Promise<
    { allowed: true } | { allowed: false; tier: string; retryAfterMs: number }
  >;
}

/** The caller resolved by the auth middleware. */
export interface SubmitCaller {
  readonly uid: string;
  readonly orgId: string | undefined;
  readonly region: Region;
}

/** Per-region routing helpers: read manifest + name the output bucket. */
export interface SubmitRegionRouter {
  /** Read manifest existence for an inputs hash on the caller's region bucket. */
  reader(region: Region): BakeBucketReader;
  /** Bucket name used by the worker for output. */
  outputBucket(region: Region): string;
}

export interface SubmitDeps {
  readonly limiter: RateLimiterLike;
  readonly producer: BakeQueueProducer;
  readonly router: SubmitRegionRouter;
  readonly clock: () => number;
  readonly newBakeId: () => string;
  /** How many tokens a single submission costs. Defaults to 10 (D-T265-5). */
  readonly tokensPerSubmit?: number;
}

export interface SubmitInput {
  readonly clipDescriptor: BlenderClipElement;
}

export type SubmitOutput =
  | { readonly status: 'ready'; readonly bakeId: string; readonly inputsHash: string }
  | { readonly status: 'pending'; readonly bakeId: string; readonly inputsHash: string };

export class SubmitError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = 'SubmitError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Tokens charged per submission. Bake is ~10x more expensive than a normal request. */
export const DEFAULT_TOKENS_PER_SUBMIT = 10;

export async function submitBakeJobHandler(
  deps: SubmitDeps,
  caller: SubmitCaller,
  input: SubmitInput,
): Promise<SubmitOutput> {
  // 1. Auth (T-265 AC #8).
  if (!caller.uid || caller.uid.length === 0) {
    throw new SubmitError('unauthenticated', 'sign-in required', 401);
  }
  if (!caller.orgId) {
    throw new SubmitError('failed-precondition', 'active org required', 412);
  }

  // 2. Rate limit — 10 tokens (T-265 AC #9). Each bake submission consumes
  //    `tokensPerSubmit` tokens against the org bucket. We loop the existing
  //    single-token consume() so the limiter's invariants are preserved; if
  //    any pull fails, we throw the same `rate-limited` shape.
  const tokens = deps.tokensPerSubmit ?? DEFAULT_TOKENS_PER_SUBMIT;
  for (let i = 0; i < tokens; i++) {
    const result = await deps.limiter.consume({ user: caller.uid, org: caller.orgId });
    if (!result.allowed) {
      throw new SubmitError(
        'rate-limited',
        `bake submission throttled (tier=${result.tier}, retryMs=${result.retryAfterMs})`,
        429,
      );
    }
  }

  // 3. Hash verification (T-265 AC #10).
  const expected = computeInputsHash({
    scene: input.clipDescriptor.scene,
    duration: input.clipDescriptor.duration,
  });
  if (expected !== input.clipDescriptor.inputsHash) {
    throw new SubmitError(
      'inputs-hash-mismatch',
      `recomputed inputsHash (${expected}) does not match descriptor (${input.clipDescriptor.inputsHash})`,
      400,
    );
  }

  // 4. Cache check (T-265 AC #11). Region-aware per T-271.
  const reader = deps.router.reader(caller.region);
  const existing = await reader.getText(manifestKey(expected));
  if (existing !== null) {
    return { status: 'ready', bakeId: expected, inputsHash: expected };
  }

  // 5. Cache miss — enqueue (T-265 AC #12, #13, #17).
  const bakeId = deps.newBakeId();
  const payload: BakeJobPayload = {
    bakeId,
    inputsHash: expected,
    scene: input.clipDescriptor.scene,
    duration: input.clipDescriptor.duration,
    outputBucket: deps.router.outputBucket(caller.region),
    region: caller.region,
  };
  await deps.producer.enqueue(payload);
  return { status: 'pending', bakeId, inputsHash: expected };
}

/** Re-export for adapter convenience. */
export { bakeKeyPrefix };
