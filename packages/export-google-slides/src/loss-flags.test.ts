// packages/export-google-slides/src/loss-flags.test.ts
// Pins the gslides-export loss-flags wrapper: source auto-fill, defaults
// table coverage, severity overrides. AC #22 / #23.

import { describe, expect, it } from 'vitest';
import { CODE_DEFAULTS, emitLossFlag } from './loss-flags.js';
import type { GSlidesExportLossFlagCode } from './types.js';

const ALL_CODES: GSlidesExportLossFlagCode[] = [
  'LF-GSLIDES-EXPORT-FALLBACK',
  'LF-GSLIDES-EXPORT-API-ERROR',
  'LF-GSLIDES-EXPORT-CONVERGENCE-STALLED',
  'LF-GSLIDES-EXPORT-ANIMATIONS-DROPPED',
  'LF-GSLIDES-EXPORT-NOTES-DROPPED',
  'LF-GSLIDES-EXPORT-FONT-SUBSTITUTED',
  'LF-GSLIDES-EXPORT-TABLE-ROTATION-LOST',
  'LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED',
];

describe('emitLossFlag (gslides-export wrapper)', () => {
  it('AC #22: auto-fills source: "gslides"', () => {
    const flag = emitLossFlag({
      code: 'LF-GSLIDES-EXPORT-FALLBACK',
      message: 'fallback',
      location: { slideId: 'slide_1', elementId: 'e1' },
    });
    expect(flag.source).toBe('gslides');
    expect(flag.code).toBe('LF-GSLIDES-EXPORT-FALLBACK');
    expect(flag.severity).toBe('warn');
    expect(flag.category).toBe('media');
    expect(flag.id).toMatch(/^[0-9a-f]{12}$/);
  });

  it('AC #23: every GSlidesExportLossFlagCode resolves to a CODE_DEFAULTS entry', () => {
    expect(ALL_CODES.length).toBe(8);
    for (const code of ALL_CODES) {
      expect(CODE_DEFAULTS[code]).toBeDefined();
      const flag = emitLossFlag({ code, message: 'x', location: {} });
      expect(flag.severity).toBe(CODE_DEFAULTS[code].severity);
      expect(flag.category).toBe(CODE_DEFAULTS[code].category);
    }
  });

  it('LF-GSLIDES-EXPORT-API-ERROR is severity=error', () => {
    const flag = emitLossFlag({
      code: 'LF-GSLIDES-EXPORT-API-ERROR',
      message: 'HTTP 500',
      location: {},
    });
    expect(flag.severity).toBe('error');
  });

  it('severity override is honored', () => {
    const flag = emitLossFlag({
      code: 'LF-GSLIDES-EXPORT-FALLBACK',
      severity: 'info',
      message: 'x',
      location: {},
    });
    expect(flag.severity).toBe('info');
  });

  it('id is deterministic for identical input', () => {
    const a = emitLossFlag({
      code: 'LF-GSLIDES-EXPORT-FALLBACK',
      message: 'crop',
      location: { slideId: 's1', elementId: 'e1' },
    });
    const b = emitLossFlag({
      code: 'LF-GSLIDES-EXPORT-FALLBACK',
      message: 'crop',
      location: { slideId: 's1', elementId: 'e1' },
    });
    expect(a.id).toBe(b.id);
  });
});
