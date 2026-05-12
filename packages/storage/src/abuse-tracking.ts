// packages/storage/src/abuse-tracking.ts
// T-458 — Schemas + types for the AbuseTrackingStore facet per
// ADR-009 §D3 + §D8. The store tracks per-source rate-limit-refusal
// hits over a sliding window and stamps escalating cooldown flags
// when a threshold is crossed:
//   - First flag (level 1): 30 s cooldown.
//   - Second flag within 1 h (level 2): 5 min cooldown.
//   - Third flag within 1 h (level 3): 1 h cooldown.
// `AbuseSource` is a discriminated union so the same store handles
// both per-voter-token + per-IP abuse axes; the two axes are tracked
// independently.

import { z } from 'zod';

/**
 * Identity an abuse counter is keyed on. Discriminated on `kind` so the
 * same store handles per-voter-token + per-IP buckets without collision.
 * `value` is the raw token / IP string; the store does NOT hash or
 * normalize — callers pass whatever bucketing they want.
 */
export const abuseSourceSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('voter-token'),
      value: z.string().min(1),
    }),
    z.object({
      kind: z.literal('ip'),
      value: z.string().min(1),
    }),
  ])
  .readonly();

export type AbuseSource = z.infer<typeof abuseSourceSchema>;

/**
 * Persisted flag for a source. `level` is the escalation step:
 *   - 0 = cleared (no active cooldown).
 *   - 1 = first flag — 30 s cooldown.
 *   - 2 = second flag within 1 h — 5 min cooldown.
 *   - 3 = third flag within 1 h — 1 h cooldown.
 * `expiresAt` is the wall-clock millis at which the cooldown lifts.
 */
export const abuseFlagSchema = z
  .object({
    level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    expiresAt: z.number().int().nonnegative(),
  })
  .strict();

export type AbuseFlag = z.infer<typeof abuseFlagSchema>;

/**
 * Snapshot of a source's hit accumulator. `hits` is the count of
 * rate-limit refusals recorded inside the current sliding window;
 * `windowStart` is the wall-clock millis of the oldest hit still
 * inside the window (or the current `now()` when the window is empty).
 */
export const abuseCounterSchema = z
  .object({
    hits: z.number().int().nonnegative(),
    windowStart: z.number().int().nonnegative(),
  })
  .strict();

export type AbuseCounter = z.infer<typeof abuseCounterSchema>;

/**
 * Cooldown durations in milliseconds, indexed by escalation level.
 * Per ADR-009 §D3 + §D8. Level 0 = no cooldown.
 */
export const ABUSE_COOLDOWN_MS: Readonly<Record<0 | 1 | 2 | 3, number>> = Object.freeze({
  0: 0,
  1: 30 * 1000,
  2: 5 * 60 * 1000,
  3: 60 * 60 * 1000,
});

/**
 * Default sliding-window length for hit accumulation, in milliseconds.
 * 60 s per the T-458 spec implementation notes.
 */
export const DEFAULT_ABUSE_WINDOW_MS = 60 * 1000;

/**
 * Default refusal threshold inside the window before the source is
 * flagged. 10 hits / 60 s per the T-458 spec implementation notes.
 */
export const DEFAULT_ABUSE_THRESHOLD = 10;

/**
 * Window across which prior flags count toward escalation. A new flag
 * issued within `ABUSE_ESCALATION_WINDOW_MS` of the previous flag's
 * `expiresAt` boundary bumps the level; otherwise the source resets to
 * level 1. 1 h per ADR-009 §D3.
 */
export const ABUSE_ESCALATION_WINDOW_MS = 60 * 60 * 1000;
