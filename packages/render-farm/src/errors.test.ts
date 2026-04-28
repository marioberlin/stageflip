// packages/render-farm/src/errors.test.ts
// Render-farm error type unit tests.

import { describe, expect, it } from 'vitest';

import {
  NotImplementedError,
  RenderFarmJobNotFoundError,
  RenderFarmSubmitError,
} from './errors.js';

describe('NotImplementedError', () => {
  it('captures message and name', () => {
    const err = new NotImplementedError('use docs/ops/render-farm-vendors.md');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NotImplementedError');
    expect(err.message).toBe('use docs/ops/render-farm-vendors.md');
  });
});

describe('RenderFarmJobNotFoundError', () => {
  it('formats jobId into message and exposes property', () => {
    const err = new RenderFarmJobNotFoundError('jid-7');
    expect(err.name).toBe('RenderFarmJobNotFoundError');
    expect(err.jobId).toBe('jid-7');
    expect(err.message).toContain('jid-7');
  });
});

describe('RenderFarmSubmitError', () => {
  it('preserves cause', () => {
    const cause = new Error('inner');
    const err = new RenderFarmSubmitError('outer', cause);
    expect(err.name).toBe('RenderFarmSubmitError');
    expect(err.message).toBe('outer');
    expect(err.cause).toBe(cause);
  });
});
