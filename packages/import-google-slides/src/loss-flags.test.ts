// packages/import-google-slides/src/loss-flags.test.ts
// Pins the Google-Slides loss-flags wrapper: source auto-fill, defaults table
// coverage, deterministic id formula. AC #21 / #22.

import { describe, expect, it } from 'vitest';
import { CODE_DEFAULTS, emitLossFlag } from './loss-flags.js';
import type { GSlidesLossFlagCode } from './types.js';

describe('emitLossFlag (gslides wrapper)', () => {
  it('AC #21: auto-fills source: "gslides" and resolves severity/category from defaults', () => {
    const flag = emitLossFlag({
      code: 'LF-GSLIDES-PADDING-INFERRED',
      message: 'inferred padding=8px',
      location: { slideId: 'slide_1', elementId: 'e1' },
    });
    expect(flag.source).toBe('gslides');
    expect(flag.code).toBe('LF-GSLIDES-PADDING-INFERRED');
    expect(flag.severity).toBe('info');
    expect(flag.category).toBe('shape');
    expect(flag.id).toMatch(/^[0-9a-f]{12}$/);
  });

  it('AC #22: every GSlidesLossFlagCode resolves to a CODE_DEFAULTS entry', () => {
    const codes: GSlidesLossFlagCode[] = [
      'LF-GSLIDES-PADDING-INFERRED',
      'LF-GSLIDES-FONT-SUBSTITUTED',
      'LF-GSLIDES-IMAGE-FALLBACK',
      'LF-GSLIDES-LOW-MATCH-CONFIDENCE',
      'LF-GSLIDES-PLACEHOLDER-INLINED',
      'LF-GSLIDES-TABLE-MERGE-LOST',
    ];
    for (const code of codes) {
      expect(CODE_DEFAULTS[code]).toBeDefined();
      const flag = emitLossFlag({ code, message: 'x', location: {} });
      expect(flag.severity).toBe(CODE_DEFAULTS[code].severity);
      expect(flag.category).toBe(CODE_DEFAULTS[code].category);
    }
  });

  it('LF-GSLIDES-TABLE-MERGE-LOST is severity=error', () => {
    const flag = emitLossFlag({
      code: 'LF-GSLIDES-TABLE-MERGE-LOST',
      message: 'overlapping spans',
      location: {},
    });
    expect(flag.severity).toBe('error');
  });

  it('severity override is honored', () => {
    const flag = emitLossFlag({
      code: 'LF-GSLIDES-PADDING-INFERRED',
      severity: 'warn',
      message: 'x',
      location: {},
    });
    expect(flag.severity).toBe('warn');
  });

  it('id is deterministic for identical input', () => {
    const a = emitLossFlag({
      code: 'LF-GSLIDES-FONT-SUBSTITUTED',
      message: 'Helvetica → system stack',
      location: { slideId: 's1', elementId: 'e1' },
    });
    const b = emitLossFlag({
      code: 'LF-GSLIDES-FONT-SUBSTITUTED',
      message: 'Helvetica → system stack',
      location: { slideId: 's1', elementId: 'e1' },
    });
    expect(a.id).toBe(b.id);
  });
});
