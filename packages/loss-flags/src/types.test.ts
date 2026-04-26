// packages/loss-flags/src/types.test.ts
// AC #2: pins the public export shape of @stageflip/loss-flags. Compile-only
// type assertions surface as `expectTypeOf` checks at runtime; if any export
// disappears or its shape drifts, this file fails to compile (typecheck) or
// the runtime assertion trips.

import { describe, expectTypeOf, it } from 'vitest';
import {
  type EmitLossFlagInput,
  type LossFlag,
  type LossFlagCategory,
  type LossFlagSeverity,
  type LossFlagSource,
  emitLossFlag,
} from './index.js';

describe('@stageflip/loss-flags public export shape (AC #2)', () => {
  it('LossFlagSource is a string alias', () => {
    expectTypeOf<LossFlagSource>().toEqualTypeOf<string>();
  });

  it('LossFlagSeverity is the documented closed union', () => {
    expectTypeOf<LossFlagSeverity>().toEqualTypeOf<'info' | 'warn' | 'error'>();
  });

  it('LossFlagCategory is the documented closed union', () => {
    expectTypeOf<LossFlagCategory>().toEqualTypeOf<
      'shape' | 'animation' | 'font' | 'media' | 'theme' | 'script' | 'other'
    >();
  });

  it('LossFlag has the documented field shape', () => {
    expectTypeOf<LossFlag>().toMatchTypeOf<{
      id: string;
      source: LossFlagSource;
      code: string;
      severity: LossFlagSeverity;
      category: LossFlagCategory;
      location: {
        slideId?: string;
        elementId?: string;
        oocxmlPath?: string;
      };
      message: string;
      recovery?: string;
      originalSnippet?: string;
    }>();
  });

  it('EmitLossFlagInput matches LossFlag minus the derived id', () => {
    expectTypeOf<EmitLossFlagInput>().toMatchTypeOf<{
      source: LossFlagSource;
      code: string;
      severity: LossFlagSeverity;
      category: LossFlagCategory;
      message: string;
      location: LossFlag['location'];
      recovery?: string;
      originalSnippet?: string;
    }>();
  });

  it('emitLossFlag has signature (EmitLossFlagInput) => LossFlag', () => {
    expectTypeOf(emitLossFlag).toEqualTypeOf<(input: EmitLossFlagInput) => LossFlag>();
  });
});
