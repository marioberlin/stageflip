// packages/parity/src/thresholds.test.ts

import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, resolveThresholds } from './thresholds';

describe('resolveThresholds', () => {
  it('returns defaults when called without overrides', () => {
    expect(resolveThresholds()).toEqual(DEFAULT_THRESHOLDS);
  });

  it('merges a partial override over the defaults', () => {
    const merged = resolveThresholds({ minPsnr: 40 });
    expect(merged).toEqual({
      ...DEFAULT_THRESHOLDS,
      minPsnr: 40,
    });
  });

  it('accepts zero values for all fields', () => {
    const merged = resolveThresholds({ minPsnr: 0, minSsim: 0, maxFailingFrames: 0 });
    expect(merged).toEqual({ minPsnr: 0, minSsim: 0, maxFailingFrames: 0 });
  });

  it('rejects NaN minPsnr', () => {
    expect(() => resolveThresholds({ minPsnr: Number.NaN })).toThrow(/minPsnr/);
  });

  it('rejects negative minPsnr', () => {
    expect(() => resolveThresholds({ minPsnr: -1 })).toThrow(/minPsnr/);
  });

  it('rejects minSsim outside [0, 1]', () => {
    expect(() => resolveThresholds({ minSsim: 1.5 })).toThrow(/minSsim/);
    expect(() => resolveThresholds({ minSsim: -0.1 })).toThrow(/minSsim/);
  });

  it('rejects non-integer maxFailingFrames', () => {
    expect(() => resolveThresholds({ maxFailingFrames: 1.5 })).toThrow(/maxFailingFrames/);
  });

  it('rejects negative maxFailingFrames', () => {
    expect(() => resolveThresholds({ maxFailingFrames: -1 })).toThrow(/maxFailingFrames/);
  });
});
