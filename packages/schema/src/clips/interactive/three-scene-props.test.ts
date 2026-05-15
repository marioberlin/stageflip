// packages/schema/src/clips/interactive/three-scene-props.test.ts
// T-384 ACs #1–#4 — threeSceneClipPropsSchema parsing.

import { describe, expect, it } from 'vitest';

import { threeSceneClipPropsSchema } from './three-scene-props.js';

const VALID_REF = '@stageflip/runtimes-interactive/clips/three-scene#ThreeSceneClip';

describe('threeSceneClipPropsSchema (T-384 AC #1)', () => {
  it('AC #1 — accepts a complete three-scene-props payload', () => {
    const parsed = threeSceneClipPropsSchema.parse({
      setupRef: { module: '@author/scene#MySetup' },
      width: 1280,
      height: 720,
      setupProps: { color: 'red', count: 42 },
      posterFrame: 12,
      prngSeed: 42,
    });
    expect(parsed.setupRef.module).toBe('@author/scene#MySetup');
    expect(parsed.width).toBe(1280);
    expect(parsed.height).toBe(720);
    expect(parsed.posterFrame).toBe(12);
    expect(parsed.prngSeed).toBe(42);
    expect(parsed.setupProps).toEqual({ color: 'red', count: 42 });
  });

  it('AC #1 — setupProps defaults to {}', () => {
    const parsed = threeSceneClipPropsSchema.parse({
      setupRef: { module: VALID_REF },
      width: 100,
      height: 100,
    });
    expect(parsed.setupProps).toEqual({});
  });

  it('AC #1 — posterFrame defaults to 0', () => {
    const parsed = threeSceneClipPropsSchema.parse({
      setupRef: { module: VALID_REF },
      width: 100,
      height: 100,
    });
    expect(parsed.posterFrame).toBe(0);
  });

  it('AC #4 — prngSeed defaults to 0 if omitted', () => {
    const parsed = threeSceneClipPropsSchema.parse({
      setupRef: { module: VALID_REF },
      width: 100,
      height: 100,
    });
    expect(parsed.prngSeed).toBe(0);
  });

  it('AC #2 — invalid setupRef.module regex throws', () => {
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: 'just-a-string' },
        width: 100,
        height: 100,
      }),
    ).toThrow();
  });

  it('AC #2 — setupRef regex requires PascalCase symbol after #', () => {
    // componentRefSchema (T-305) constrains the symbol to PascalCase. Setup
    // callbacks therefore must be exported with a PascalCase identifier
    // (e.g. `MySetup`) — a deviation from common camelCase function naming
    // but a deliberate alignment with the existing component-ref shape.
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: '@author/scene#mySetup' },
        width: 100,
        height: 100,
      }),
    ).toThrow();
  });

  it('AC #3 — width=0 throws', () => {
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: 0,
        height: 100,
      }),
    ).toThrow(/width/);
  });

  it('AC #3 — width=-1 throws', () => {
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: -1,
        height: 100,
      }),
    ).toThrow(/width/);
  });

  it('AC #3 — height=0 throws', () => {
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: 100,
        height: 0,
      }),
    ).toThrow(/height/);
  });

  it('AC #3 — non-integer width throws', () => {
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: 1.5,
        height: 100,
      }),
    ).toThrow();
  });

  it('AC #4 — negative prngSeed throws', () => {
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: 100,
        height: 100,
        prngSeed: -1,
      }),
    ).toThrow();
  });

  it('AC #4 — non-integer prngSeed throws', () => {
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: 100,
        height: 100,
        prngSeed: 1.5,
      }),
    ).toThrow();
  });

  it('rejects extra top-level fields (strict)', () => {
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: 100,
        height: 100,
        sneaky: true,
      }),
    ).toThrow();
  });

  it('rejects negative posterFrame', () => {
    expect(() =>
      threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: 100,
        height: 100,
        posterFrame: -1,
      }),
    ).toThrow();
  });

  // T-403 R-7 — memoryBudgetMb DoS protection.
  describe('memoryBudgetMb (T-403 R-7)', () => {
    it('accepts a valid memoryBudgetMb', () => {
      const parsed = threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: 100,
        height: 100,
        memoryBudgetMb: 512,
      });
      expect(parsed.memoryBudgetMb).toBe(512);
    });

    it('omits memoryBudgetMb when not supplied (optional)', () => {
      const parsed = threeSceneClipPropsSchema.parse({
        setupRef: { module: VALID_REF },
        width: 100,
        height: 100,
      });
      expect(parsed.memoryBudgetMb).toBeUndefined();
    });

    it('rejects memoryBudgetMb > 2048 (DoS ceiling)', () => {
      expect(() =>
        threeSceneClipPropsSchema.parse({
          setupRef: { module: VALID_REF },
          width: 100,
          height: 100,
          memoryBudgetMb: 4096,
        }),
      ).toThrow(/at most 2048/);
    });

    it('rejects memoryBudgetMb < 16 (sane lower bound)', () => {
      expect(() =>
        threeSceneClipPropsSchema.parse({
          setupRef: { module: VALID_REF },
          width: 100,
          height: 100,
          memoryBudgetMb: 8,
        }),
      ).toThrow(/at least 16/);
    });

    it('rejects non-integer memoryBudgetMb', () => {
      expect(() =>
        threeSceneClipPropsSchema.parse({
          setupRef: { module: VALID_REF },
          width: 100,
          height: 100,
          memoryBudgetMb: 64.5,
        }),
      ).toThrow();
    });
  });
});
