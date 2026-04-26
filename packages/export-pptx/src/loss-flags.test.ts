// packages/export-pptx/src/loss-flags.test.ts
import { describe, expect, it } from 'vitest';
import { CODE_DEFAULTS, emitLossFlag } from './loss-flags.js';
import type { ExportPptxLossFlagCode } from './types.js';

describe('loss-flags', () => {
  it('every ExportPptxLossFlagCode resolves to a CODE_DEFAULTS entry', () => {
    const codes: ExportPptxLossFlagCode[] = [
      'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT',
      'LF-PPTX-EXPORT-ASSET-MISSING',
      'LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED',
      'LF-PPTX-EXPORT-ANIMATIONS-DROPPED',
      'LF-PPTX-EXPORT-NOTES-DROPPED',
      'LF-PPTX-EXPORT-THEME-FLATTENED',
      'LF-PPTX-EXPORT-IMAGE-BACKGROUND-FALLBACK',
    ];
    for (const c of codes) {
      expect(CODE_DEFAULTS[c]).toBeDefined();
      expect(['info', 'warn', 'error']).toContain(CODE_DEFAULTS[c].severity);
    }
  });

  it('auto-fills source: pptx-export', () => {
    const flag = emitLossFlag({
      code: 'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT',
      message: 'msg',
      location: { slideId: 's1' },
    });
    expect(flag.source).toBe('pptx-export');
    expect(flag.code).toBe('LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT');
  });

  it('uses code-default severity unless overridden', () => {
    const flag = emitLossFlag({
      code: 'LF-PPTX-EXPORT-ASSET-MISSING',
      message: 'm',
      location: {},
    });
    expect(flag.severity).toBe('error');
  });

  it('produces deterministic ids for the same input', () => {
    const a = emitLossFlag({
      code: 'LF-PPTX-EXPORT-NOTES-DROPPED',
      message: 'm',
      location: { slideId: 's' },
      originalSnippet: 'x',
    });
    const b = emitLossFlag({
      code: 'LF-PPTX-EXPORT-NOTES-DROPPED',
      message: 'm',
      location: { slideId: 's' },
      originalSnippet: 'x',
    });
    expect(a.id).toBe(b.id);
  });
});
