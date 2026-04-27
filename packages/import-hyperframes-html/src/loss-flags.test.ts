// packages/import-hyperframes-html/src/loss-flags.test.ts
// Tests for the Hyperframes-HTML loss-flag wrapper. AC #26 + #27 pinned here.

import { describe, expect, it } from 'vitest';
import { CODE_DEFAULTS, emitLossFlag } from './loss-flags.js';
import type { HfhtmlLossFlagCode } from './types.js';

describe('emitLossFlag (hyperframes-html wrapper)', () => {
  it('AC #26: auto-fills source = "hyperframes-html"', () => {
    const flag = emitLossFlag({
      code: 'LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST',
      message: 'styled element',
      location: { elementId: 'el_1' },
    });
    expect(flag.source).toBe('hyperframes-html');
    expect(flag.code).toBe('LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST');
    expect(flag.severity).toBe('warn');
    expect(flag.category).toBe('theme');
  });

  it('AC #27: every HfhtmlLossFlagCode variant resolves in CODE_DEFAULTS', () => {
    const codes: HfhtmlLossFlagCode[] = [
      'LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST',
      'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED',
      'LF-HYPERFRAMES-HTML-CAPTIONS-UNRECOGNIZED',
      'LF-HYPERFRAMES-HTML-UNSUPPORTED-ELEMENT',
      'LF-HYPERFRAMES-HTML-DIMENSION-INFERRED',
      'LF-HYPERFRAMES-HTML-ASSET-MISSING',
    ];
    for (const code of codes) {
      const defaults = CODE_DEFAULTS[code];
      expect(defaults).toBeDefined();
      expect(defaults.severity).toMatch(/^(info|warn|error)$/);
      const flag = emitLossFlag({ code, message: 'msg', location: {} });
      expect(flag.code).toBe(code);
      expect(flag.source).toBe('hyperframes-html');
    }
  });

  it('honors severity and category overrides', () => {
    const flag = emitLossFlag({
      code: 'LF-HYPERFRAMES-HTML-DIMENSION-INFERRED',
      message: 'm',
      location: {},
      severity: 'warn',
      category: 'other',
    });
    expect(flag.severity).toBe('warn');
    expect(flag.category).toBe('other');
  });

  it('produces deterministic ids: same inputs => same id', () => {
    const a = emitLossFlag({
      code: 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED',
      message: 'msg-A',
      location: { slideId: 'track_1', elementId: 'el_1' },
    });
    const b = emitLossFlag({
      code: 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED',
      message: 'msg-B', // message excluded from id formula
      location: { slideId: 'track_1', elementId: 'el_1' },
    });
    expect(a.id).toBe(b.id);
  });
});
