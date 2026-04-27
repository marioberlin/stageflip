// packages/design-system/src/loss-flags.test.ts
// AC #27, #28: wrapper auto-fills `source: 'design-system'` + every
// DesignSystemLossFlagCode resolves to a CODE_DEFAULTS entry.

import { describe, expect, it } from 'vitest';
import { CODE_DEFAULTS, emitLossFlag } from './loss-flags.js';
import type { DesignSystemLossFlagCode } from './types.js';

describe('design-system loss-flag wrapper', () => {
  it('AC #27: auto-fills source: design-system', () => {
    const flag = emitLossFlag({
      code: 'LF-DESIGN-SYSTEM-FONT-FETCH-FAILED',
      message: 'fetch failed',
      location: { slideId: 's1' },
    });
    expect(flag.source).toBe('design-system');
    expect(flag.code).toBe('LF-DESIGN-SYSTEM-FONT-FETCH-FAILED');
    expect(flag.severity).toBe('error');
    expect(flag.category).toBe('font');
  });

  it('AC #28: every code resolves to a CODE_DEFAULTS entry', () => {
    const codes: DesignSystemLossFlagCode[] = [
      'LF-DESIGN-SYSTEM-FONT-FETCH-FAILED',
      'LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER',
      'LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED',
    ];
    for (const code of codes) {
      expect(CODE_DEFAULTS[code]).toBeDefined();
      expect(CODE_DEFAULTS[code].severity).toMatch(/^(info|warn|error)$/);
      expect(CODE_DEFAULTS[code].category).toMatch(
        /^(shape|font|theme|other|animation|media|script)$/,
      );
    }
  });

  it('respects explicit severity + category overrides', () => {
    const flag = emitLossFlag({
      code: 'LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER',
      message: 'ambiguous',
      location: {},
      severity: 'info',
      category: 'other',
    });
    expect(flag.severity).toBe('info');
    expect(flag.category).toBe('other');
  });

  it('produces deterministic ids', () => {
    const a = emitLossFlag({
      code: 'LF-DESIGN-SYSTEM-FONT-FETCH-FAILED',
      message: 'a',
      location: { slideId: 's1', elementId: 'e1' },
    });
    const b = emitLossFlag({
      code: 'LF-DESIGN-SYSTEM-FONT-FETCH-FAILED',
      message: 'a',
      location: { slideId: 's1', elementId: 'e1' },
    });
    expect(a.id).toBe(b.id);
  });

  it('includes recovery + originalSnippet when provided', () => {
    const flag = emitLossFlag({
      code: 'LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED',
      message: 'merge failed',
      location: {},
      recovery: 'dropped',
      originalSnippet: '<x/>',
    });
    expect(flag.recovery).toBe('dropped');
    expect(flag.originalSnippet).toBe('<x/>');
  });
});
