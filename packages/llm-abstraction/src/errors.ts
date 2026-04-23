// packages/llm-abstraction/src/errors.ts
// Error taxonomy — thin wrappers that normalise provider-specific failures
// so consumers (planner/executor/validator) can branch on cause without
// importing provider SDKs.

import type { LLMProviderName } from './types.js';

export type LLMErrorKind =
  | 'aborted'
  | 'rate_limited'
  | 'authentication'
  | 'invalid_request'
  | 'server_error'
  | 'network'
  | 'unknown';

export interface LLMErrorOptions {
  kind: LLMErrorKind;
  provider: LLMProviderName;
  status?: number;
  retryAfterMs?: number;
  cause?: unknown;
}

export class LLMError extends Error {
  readonly kind: LLMErrorKind;
  readonly provider: LLMProviderName;
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(message: string, options: LLMErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'LLMError';
    this.kind = options.kind;
    this.provider = options.provider;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

/**
 * Narrow an unknown thrown value into an {@link LLMError} using status-code
 * heuristics. Provider adapters pass their observed status code and the
 * original error; this preserves the cause chain.
 */
export function classifyError(provider: LLMProviderName, error: unknown): LLMError {
  if (error instanceof LLMError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const errObj = error as {
    name?: string;
    status?: number;
    statusCode?: number;
    code?: string;
    headers?: Record<string, string>;
  };

  if (errObj?.name === 'AbortError' || errObj?.code === 'ABORT_ERR') {
    return new LLMError(message, { kind: 'aborted', provider, cause: error });
  }

  const status = errObj?.status ?? errObj?.statusCode;
  const retryAfterHeader = errObj?.headers?.['retry-after'];
  const retryAfterMs =
    retryAfterHeader !== undefined ? Number.parseInt(retryAfterHeader, 10) * 1000 : undefined;

  if (status === 401 || status === 403) {
    return new LLMError(message, {
      kind: 'authentication',
      provider,
      status,
      cause: error,
    });
  }
  if (status === 429) {
    return new LLMError(message, {
      kind: 'rate_limited',
      provider,
      status,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
      cause: error,
    });
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return new LLMError(message, {
      kind: 'invalid_request',
      provider,
      status,
      cause: error,
    });
  }
  if (status !== undefined && status >= 500) {
    return new LLMError(message, {
      kind: 'server_error',
      provider,
      status,
      cause: error,
    });
  }

  return new LLMError(message, { kind: 'unknown', provider, cause: error });
}
