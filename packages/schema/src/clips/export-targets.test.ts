// packages/schema/src/clips/export-targets.test.ts
// Tests for ExportTarget enum + EXPORT_MATRIX + resolveClipPath (T-305 ACs
// #10–#14). Pins ADR-003 §D3 routing exactly: 8 targets × {static, live}.

import { describe, expect, it } from 'vitest';

import {
  EXPORT_MATRIX,
  type ExportTarget,
  type ResolvedClipPath,
  exportTargetSchema,
  resolveClipPath,
} from './export-targets.js';
import { type InteractiveClip } from './interactive.js';

const ANY_CLIP: InteractiveClip = {
  id: 'el_int1',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'interactive-clip',
  family: 'shader',
  staticFallback: [
    {
      id: 'el_1',
      transform: { x: 0, y: 0, width: 1280, height: 720 },
      type: 'text',
      text: 'fallback',
    },
  ] as never,
  liveMount: {
    component: { module: 'pkg#ShaderClip' },
    props: {},
    permissions: [],
  },
};

/** ADR-003 §D3 routing table — pinned. */
const ADR_003_D3_TABLE: ReadonlyArray<readonly [ExportTarget, ResolvedClipPath]> = [
  ['mp4', 'static'],
  ['image-sequence', 'static'],
  ['pptx-flat', 'static'],
  ['html-slides', 'live'],
  ['live-presentation', 'live'],
  ['display-pre-rendered', 'static'],
  ['display-interactive', 'live'],
  ['on-device-player', 'live'],
];

describe('exportTargetSchema (T-305 AC #10)', () => {
  it('accepts mp4', () => {
    expect(exportTargetSchema.parse('mp4')).toBe('mp4');
  });
  it('rejects an unknown target', () => {
    expect(() => exportTargetSchema.parse('unknown')).toThrow();
  });
  it('accepts every member of the locked enum', () => {
    for (const [target] of ADR_003_D3_TABLE) {
      expect(exportTargetSchema.parse(target)).toBe(target);
    }
  });
});

describe('EXPORT_MATRIX (T-305 AC #11)', () => {
  it('has an entry for every member of exportTargetSchema.options', () => {
    for (const target of exportTargetSchema.options) {
      expect(EXPORT_MATRIX[target]).toBeDefined();
    }
  });
  it('every value is "static" or "live"', () => {
    for (const target of exportTargetSchema.options) {
      const value = EXPORT_MATRIX[target];
      expect(['static', 'live']).toContain(value);
    }
  });
});

describe('resolveClipPath (T-305 ACs #12–#14)', () => {
  it('AC #12 — mp4 resolves to static', () => {
    expect(resolveClipPath('mp4', ANY_CLIP)).toBe('static');
  });
  it('AC #13 — html-slides resolves to live', () => {
    expect(resolveClipPath('html-slides', ANY_CLIP)).toBe('live');
  });
  it('AC #14 — every target matches ADR-003 §D3 exactly', () => {
    for (const [target, expected] of ADR_003_D3_TABLE) {
      expect(resolveClipPath(target, ANY_CLIP)).toBe(expected);
    }
  });
});
