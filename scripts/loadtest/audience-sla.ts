// scripts/loadtest/audience-sla.ts
// T-477 — Pure helpers used by `audience-sla.k6.ts`. Hosted separately
// from the K6 script so vitest can cover them without standing up K6's
// Goja runtime. The K6 script itself is `k6 inspect`-validated at PR
// review, not in workspace CI.
//
// Two exports:
//   1. `parseThresholds(spec)` — parses a CLI threshold spec like
//      `"p(95)<500,p(99)<1000"` into K6 threshold expressions.
//   2. `synthesizeBatchSnapshot(voterCount, sessionId)` — deterministic
//      synthetic voter taps used to seed each K6 VU iteration. Pure
//      function: same `(voterCount, sessionId)` produces same output.

import type { VotePayload } from '@stageflip/audience-contract';

/**
 * K6 threshold expression. K6's `options.thresholds[metricName]` accepts
 * an array of strings of the form `"p(95)<500"` / `"avg<200"` / etc. This
 * type narrows the shape we emit from {@link parseThresholds}.
 */
export interface K6Threshold {
  /** Aggregate function. K6 supports `p(N)`, `avg`, `min`, `max`, `med`, `count`, `rate`. */
  readonly aggregate: string;
  /** Comparison operator. K6 supports `<`, `<=`, `>`, `>=`. */
  readonly op: '<' | '<=' | '>' | '>=';
  /** Numeric threshold value (milliseconds for latency metrics). */
  readonly value: number;
  /** The K6-compatible serialized form (e.g., `"p(95)<500"`). */
  readonly expression: string;
}

const THRESHOLD_PATTERN =
  /^(p\(\d+(?:\.\d+)?\)|avg|min|max|med|count|rate)(<=|>=|<|>)(\d+(?:\.\d+)?)$/;

/**
 * Parse a CLI threshold spec into a list of K6 threshold descriptors.
 *
 * @example
 * parseThresholds('p(95)<500,p(99)<1000')
 * // returns:
 * // [
 * //   { aggregate: 'p(95)', op: '<', value: 500, expression: 'p(95)<500' },
 * //   { aggregate: 'p(99)', op: '<', value: 1000, expression: 'p(99)<1000' },
 * // ]
 *
 * @throws if any segment fails to parse — invalid aggregate, op, or value.
 */
export function parseThresholds(spec: string): K6Threshold[] {
  const trimmed = spec.trim();
  if (trimmed === '') {
    return [];
  }
  const out: K6Threshold[] = [];
  for (const raw of trimmed.split(',')) {
    const segment = raw.trim();
    if (segment === '') {
      continue;
    }
    const match = THRESHOLD_PATTERN.exec(segment);
    if (!match) {
      throw new Error(`invalid threshold segment: "${segment}"`);
    }
    const aggregate = match[1];
    const op = match[2];
    const valueStr = match[3];
    if (aggregate === undefined || op === undefined || valueStr === undefined) {
      throw new Error(`invalid threshold segment: "${segment}"`);
    }
    const value = Number.parseFloat(valueStr);
    if (!Number.isFinite(value)) {
      throw new Error(`non-finite threshold value in: "${segment}"`);
    }
    if (op !== '<' && op !== '<=' && op !== '>' && op !== '>=') {
      throw new Error(`invalid op in: "${segment}"`);
    }
    out.push({
      aggregate,
      op,
      value,
      expression: `${aggregate}${op}${value}`,
    });
  }
  return out;
}

/** One synthetic voter tap — voter-token paired with the vote payload it sends. */
export interface SyntheticVoterTap {
  readonly voterToken: string;
  readonly payload: VotePayload;
}

/**
 * Deterministic synthetic voter-tap batch. Used by the K6 script to seed
 * per-VU iterations with realistic-shaped vote payloads. Pure: same
 * `(voterCount, sessionId)` always produces same output.
 *
 * Voter token format: `loadvoter-<sessionId>-<index>` — fixed-length,
 * sortable, distinct across sessions. NOT real ULIDs (those would
 * require non-determinism); the load-test backend accepts arbitrary
 * voter tokens via the `/join` mint endpoint, so token shape is only
 * load on the WebSocket dispatcher.
 *
 * Payload mix: rotates across the four cheap, fixed-size vote
 * discriminants (`live-poll-multiple-choice`, `live-poll-rating`,
 * `reaction-stream`, `heatmap`) so the backend exercises its dispatcher
 * branches uniformly. Variable-width discriminants (`live-poll-open-text`,
 * `word-cloud`, `survey`) are excluded — they would amplify variance in
 * the latency Trend and obscure the SLA signal.
 *
 * @throws if `voterCount < 1` or `sessionId` is empty.
 */
export function synthesizeBatchSnapshot(
  voterCount: number,
  sessionId: string,
): SyntheticVoterTap[] {
  if (!Number.isInteger(voterCount) || voterCount < 1) {
    throw new Error(`voterCount must be a positive integer; received ${voterCount}`);
  }
  if (sessionId.trim() === '') {
    throw new Error('sessionId must be non-empty');
  }
  const taps: SyntheticVoterTap[] = [];
  for (let i = 0; i < voterCount; i++) {
    taps.push({
      voterToken: `loadvoter-${sessionId}-${i.toString().padStart(6, '0')}`,
      payload: rotatePayload(i),
    });
  }
  return taps;
}

/** Reaction-stream palette — stable, fixed-length so determinism holds. */
const REACTION_EMOJIS: readonly string[] = ['heart', 'thumbs-up', 'fire', 'laugh', 'wow'];

/** Cycles through four cheap, fixed-size vote discriminants. */
function rotatePayload(index: number): VotePayload {
  const bucket = index % 4;
  switch (bucket) {
    case 0:
      return { kind: 'live-poll-multiple-choice', optionIndex: index % 4 };
    case 1:
      return { kind: 'live-poll-rating', score: (index % 5) + 1 };
    case 2: {
      const emoji = REACTION_EMOJIS[index % REACTION_EMOJIS.length] ?? 'heart';
      return { kind: 'reaction-stream', emojiId: emoji };
    }
    case 3:
      return {
        kind: 'heatmap',
        x: ((index * 37) % 1000) / 1000,
        y: ((index * 53) % 1000) / 1000,
      };
    /* c8 ignore next 2 */
    default:
      throw new Error(`unreachable bucket ${bucket}`);
  }
}
