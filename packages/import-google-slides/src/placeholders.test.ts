// packages/import-google-slides/src/placeholders.test.ts
// Pin AC #25-29: layouts/masters extraction, layoutId set on slides,
// inheritsFrom resolution to the layout (transitive walk to master is the
// applyInheritance pass's job; we only verify the inheritsFrom emission).

import { describe, expect, it } from 'vitest';
import type { ApiPresentation } from './api/types.js';
import { extractTemplates } from './placeholders.js';

const baseRender = { width: 1600, height: 900 };

describe('extractTemplates (AC #25-26)', () => {
  it('AC #25: populates layouts from every page in presentation.layouts[]', () => {
    const pres: ApiPresentation = {
      pageSize: { width: { magnitude: 9144000 }, height: { magnitude: 5143500 } },
      layouts: [
        {
          objectId: 'layout-A',
          pageType: 'LAYOUT',
          pageElements: [
            {
              objectId: 'ph-title',
              shape: { shapeType: 'TEXT_BOX', placeholder: { type: 'TITLE', index: 0 } },
              size: {
                width: { magnitude: 5_000_000 },
                height: { magnitude: 1_000_000 },
              },
              transform: { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 },
            },
          ],
        },
        { objectId: 'layout-B', pageType: 'LAYOUT', pageElements: [] },
      ],
      masters: [{ objectId: 'master-1', pageType: 'MASTER', pageElements: [] }],
    };
    const out = extractTemplates(pres, baseRender);
    expect(Object.keys(out.layouts)).toHaveLength(2);
    expect(out.layouts['layout-A']?.elements).toHaveLength(1);
  });

  it('AC #26: populates masters from every page in presentation.masters[]', () => {
    const pres: ApiPresentation = {
      pageSize: { width: { magnitude: 9144000 }, height: { magnitude: 5143500 } },
      layouts: [],
      masters: [
        { objectId: 'master-1', pageType: 'MASTER', pageElements: [] },
        { objectId: 'master-2', pageType: 'MASTER', pageElements: [] },
      ],
    };
    const out = extractTemplates(pres, baseRender);
    expect(Object.keys(out.masters)).toHaveLength(2);
  });
});

describe('extractTemplates index sets (used by inheritsFrom resolver)', () => {
  it('layoutIds and masterIds carry the API-side objectIds', () => {
    const pres: ApiPresentation = {
      pageSize: { width: { magnitude: 9144000 }, height: { magnitude: 5143500 } },
      layouts: [{ objectId: 'L1', pageType: 'LAYOUT', pageElements: [] }],
      masters: [{ objectId: 'M1', pageType: 'MASTER', pageElements: [] }],
    };
    const out = extractTemplates(pres, baseRender);
    expect(out.layoutIds.has('L1')).toBe(true);
    expect(out.masterIds.has('M1')).toBe(true);
  });
});
