// packages/pack-trial/src/watermark.test.ts

import { describe, expect, it } from 'vitest';

import { WATERMARK_TEXT, defaultWatermarkRequest } from './watermark.js';

describe('WATERMARK_TEXT', () => {
  it('is the canonical trial-mode watermark string', () => {
    expect(WATERMARK_TEXT).toBe('StageFlip trial — purchase for production use');
  });
});

describe('defaultWatermarkRequest', () => {
  it('returns a frozen object (caller cannot mutate the policy)', () => {
    const req = defaultWatermarkRequest();
    expect(Object.isFrozen(req)).toBe(true);
  });

  it('defaults to bottom-right position', () => {
    expect(defaultWatermarkRequest().position).toBe('bottom-right');
  });

  it('defaults opacity to 0.18', () => {
    expect(defaultWatermarkRequest().opacity).toBe(0.18);
  });

  it('carries the canonical WATERMARK_TEXT', () => {
    expect(defaultWatermarkRequest().text).toBe(WATERMARK_TEXT);
  });

  it('returns a fresh object on each call', () => {
    expect(defaultWatermarkRequest()).not.toBe(defaultWatermarkRequest());
  });
});
