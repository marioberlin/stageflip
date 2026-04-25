// packages/import-pptx/src/fixtures/fixtures.test.ts
// AC #8 — every programmatic fixture round-trips through parsePptx without
// throwing, and a small set of structural assertions per fixture catches any
// regression in the parser. Vitest snapshots pin per-fixture summaries so
// shape drift is visible in PR diffs.

import { describe, expect, it } from 'vitest';
import { parsePptx } from '../parsePptx.js';
import type { CanonicalSlideTree, ParsedElement } from '../types.js';
import { FIXTURE_BUILDERS, type FixtureName } from './builder.js';

/** Compact summary of a parse — used both for assertions and snapshots. */
function summarise(tree: CanonicalSlideTree): {
  slideCount: number;
  layoutCount: number;
  masterCount: number;
  perSlide: { id: string; elementTypes: string[] }[];
  flagCodes: string[];
} {
  return {
    slideCount: tree.slides.length,
    layoutCount: Object.keys(tree.layouts).length,
    masterCount: Object.keys(tree.masters).length,
    perSlide: tree.slides.map((s) => ({
      id: s.id,
      elementTypes: s.elements.map((e) => elementType(e)),
    })),
    flagCodes: tree.lossFlags.map((f) => f.code).sort(),
  };
}

function elementType(e: ParsedElement): string {
  if (e.type === 'group') {
    const children = (e as { children: ParsedElement[] }).children.map(elementType).join(',');
    return `group[${children}]`;
  }
  return e.type;
}

const expectedSummaries: Record<FixtureName, ReturnType<typeof summarise>> = {
  minimal: {
    slideCount: 1,
    layoutCount: 1,
    masterCount: 1,
    perSlide: [{ id: 'slide_1', elementTypes: ['text'] }],
    flagCodes: [],
  },
  shapes: {
    slideCount: 1,
    layoutCount: 1,
    masterCount: 1,
    perSlide: [
      {
        id: 'slide_1',
        // rect, ellipse, hexagon→polygon, star5→star, cloud→unsupported.
        elementTypes: ['shape', 'shape', 'shape', 'shape', 'unsupported-shape'],
      },
    ],
    flagCodes: ['LF-PPTX-PRESET-GEOMETRY'],
  },
  picture: {
    slideCount: 1,
    layoutCount: 1,
    masterCount: 1,
    perSlide: [{ id: 'slide_1', elementTypes: ['image'] }],
    flagCodes: ['LF-PPTX-UNRESOLVED-ASSET'],
  },
  group: {
    slideCount: 1,
    layoutCount: 1,
    masterCount: 1,
    perSlide: [{ id: 'slide_1', elementTypes: ['group[shape,shape]'] }],
    // T-241a clears the placeholder flag — no remaining group-related codes.
    flagCodes: [],
  },
  'multi-slide': {
    slideCount: 3,
    layoutCount: 1,
    masterCount: 1,
    perSlide: [
      { id: 'slide_1', elementTypes: ['text'] },
      { id: 'slide_2', elementTypes: ['text', 'shape'] },
      { id: 'slide_3', elementTypes: ['unsupported-shape'] },
    ],
    flagCodes: ['LF-PPTX-CUSTOM-GEOMETRY'],
  },
};

describe('AC #8 — programmatic fixtures', () => {
  for (const [name, build] of Object.entries(FIXTURE_BUILDERS)) {
    const fxName = name as FixtureName;
    it(`parses without throwing: ${fxName}`, async () => {
      const tree = await parsePptx(build());
      const summary = summarise(tree);
      expect(summary).toEqual(expectedSummaries[fxName]);
    });
  }

  // Byte-level fixture stability is intentionally not asserted: fflate.zipSync
  // embeds an mtime in each ZIP entry with 2-second DOS-time granularity, so
  // two consecutive build() calls only produce byte-identical output when they
  // land in the same 2-second window. The functional determinism contract
  // (parser output + loss-flag ids) is pinned in parsePptx.test.ts.
});
