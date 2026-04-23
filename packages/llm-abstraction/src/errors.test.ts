// packages/llm-abstraction/src/errors.test.ts

import { describe, expect, it } from 'vitest';
import { LLMError, classifyError } from './errors.js';

describe('classifyError', () => {
  it('maps AbortError shape to kind=aborted', () => {
    const source = Object.assign(new Error('cancelled'), {
      name: 'AbortError',
    });
    const err = classifyError('anthropic', source);
    expect(err.kind).toBe('aborted');
    expect(err.provider).toBe('anthropic');
    expect(err.cause).toBe(source);
  });

  it('maps 401 to kind=authentication', () => {
    const source = Object.assign(new Error('unauthorized'), { status: 401 });
    const err = classifyError('google', source);
    expect(err.kind).toBe('authentication');
    expect(err.status).toBe(401);
  });

  it('maps 429 to kind=rate_limited and parses retry-after seconds', () => {
    const source = Object.assign(new Error('too many requests'), {
      status: 429,
      headers: { 'retry-after': '30' },
    });
    const err = classifyError('openai', source);
    expect(err.kind).toBe('rate_limited');
    expect(err.retryAfterMs).toBe(30_000);
  });

  it('maps 4xx (other) to kind=invalid_request', () => {
    const source = Object.assign(new Error('bad request'), { status: 400 });
    const err = classifyError('anthropic', source);
    expect(err.kind).toBe('invalid_request');
  });

  it('maps 5xx to kind=server_error', () => {
    const source = Object.assign(new Error('server down'), { status: 503 });
    const err = classifyError('anthropic', source);
    expect(err.kind).toBe('server_error');
  });

  it('falls back to kind=unknown for un-annotated errors', () => {
    const err = classifyError('anthropic', new Error('mystery'));
    expect(err.kind).toBe('unknown');
  });

  it('passes an existing LLMError through unchanged', () => {
    const original = new LLMError('x', {
      kind: 'rate_limited',
      provider: 'openai',
    });
    expect(classifyError('anthropic', original)).toBe(original);
  });
});
