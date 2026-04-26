// packages/import-pptx/src/loss-flags.test.ts
// AC #6 (T-247-loss-flags): proves the public `@stageflip/import-pptx`
// surface re-exports the canonical LossFlag types + the PPTX emitLossFlag
// wrapper, so existing consumer imports (`from '@stageflip/import-pptx'`)
// continue to compile *and* link at runtime after the extraction.

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type EmitLossFlagInput,
  type LossFlag,
  type LossFlagCategory,
  type LossFlagCode,
  type LossFlagSeverity,
  type LossFlagSource,
  emitLossFlag,
} from './index.js';

describe('@stageflip/import-pptx public re-exports (AC #6)', () => {
  it('type-only re-exports remain importable under their original names', () => {
    expectTypeOf<LossFlagSeverity>().toEqualTypeOf<'info' | 'warn' | 'error'>();
    expectTypeOf<LossFlagCategory>().toEqualTypeOf<
      'shape' | 'animation' | 'font' | 'media' | 'theme' | 'script' | 'other'
    >();
    expectTypeOf<LossFlagSource>().toEqualTypeOf<string>();
    expectTypeOf<LossFlag>().toMatchTypeOf<{ id: string; code: string }>();
    expectTypeOf<LossFlagCode>().toMatchTypeOf<string>();
  });

  it('emitLossFlag is callable at runtime and returns a LossFlag', () => {
    const input: EmitLossFlagInput = {
      code: 'LF-PPTX-CUSTOM-GEOMETRY',
      message: 'sample',
      location: { slideId: 's1', elementId: 'e1', oocxmlPath: 'ppt/slides/slide1.xml' },
      originalSnippet: '<a:custGeom/>',
    };
    const flag = emitLossFlag(input);
    expect(flag.source).toBe('pptx');
    expect(flag.code).toBe('LF-PPTX-CUSTOM-GEOMETRY');
    expect(flag.severity).toBe('warn');
    expect(flag.category).toBe('shape');
    expect(flag.id).toMatch(/^[0-9a-f]{12}$/);
  });

  it('emitLossFlag delegates to the generic emitter — id matches pinned PPTX fixture', () => {
    // Same input/expected as @stageflip/loss-flags AC #7 fixture #1.
    const flag = emitLossFlag({
      code: 'LF-PPTX-CUSTOM-GEOMETRY',
      message: 'Custom geometry with unsupported <a:arcTo>',
      location: { slideId: 'slide-1', elementId: 'el-7', oocxmlPath: 'ppt/slides/slide1.xml' },
      originalSnippet: '<a:arcTo wR="100" hR="50" />',
    });
    expect(flag.id).toBe('9ab4b4748c41');
  });
});
