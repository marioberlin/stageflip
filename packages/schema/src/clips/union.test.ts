// packages/schema/src/clips/union.test.ts
// Element-union integration tests for InteractiveClip (T-305 ACs #15–#17).
// Pins that adding `interactive-clip` to the element union is additive — the
// existing branches (text, image, blender-clip, etc.) still parse, and the
// new `type: 'interactive-clip'` branch is accepted via the union.

import { describe, expect, it } from 'vitest';

import { ELEMENT_TYPES, elementSchema } from '../elements/index.js';
import type { InteractiveClip } from './interactive.js';

const VALID: InteractiveClip = {
  id: 'el_int_union',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'interactive-clip',
  family: 'shader',
  staticFallback: [
    {
      id: 'el_static_1',
      transform: { x: 0, y: 0, width: 1280, height: 720 },
      type: 'text',
      text: 'static fallback',
    },
  ] as never,
  liveMount: {
    component: { module: 'pkg#ShaderClip' },
    props: {},
    permissions: [],
  },
};

describe('elementSchema (T-305 ACs #15–#17)', () => {
  it('AC #15 — accepts an InteractiveClip via the union', () => {
    const parsed = elementSchema.parse(VALID);
    expect(parsed.type).toBe('interactive-clip');
  });
  it('AC #16 — text still parses unchanged', () => {
    expect(() =>
      elementSchema.parse({
        id: 'el_text_1',
        transform: { x: 0, y: 0, width: 100, height: 100 },
        type: 'text',
        text: 'hi',
      }),
    ).not.toThrow();
  });
  it('AC #16 — image still parses unchanged', () => {
    expect(() =>
      elementSchema.parse({
        id: 'el_image_1',
        transform: { x: 0, y: 0, width: 100, height: 100 },
        type: 'image',
        src: 'asset:img_x',
      }),
    ).not.toThrow();
  });
  it('AC #17 — unknown clip type throws', () => {
    expect(() =>
      elementSchema.parse({
        id: 'el_unknown',
        transform: { x: 0, y: 0, width: 100, height: 100 },
        type: 'mystery-clip',
      } as never),
    ).toThrow();
  });
  it("ELEMENT_TYPES contains 'interactive-clip'", () => {
    expect(ELEMENT_TYPES).toContain('interactive-clip');
  });
});
