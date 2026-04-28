// tests/load/retry-after.d.ts
// Hand-authored types for retry-after.js (consumed by retry-after.test.ts).

export const MAX_RETRIES: number;
export const MIN_SLEEP_SECONDS: number;
export const MAX_SLEEP_SECONDS: number;

export interface ComputeRetryAfterInput {
  header?: string | undefined;
  body?: string | null | undefined;
}

export function computeRetryAfter(input: ComputeRetryAfterInput): number;
