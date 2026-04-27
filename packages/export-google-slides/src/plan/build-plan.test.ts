// packages/export-google-slides/src/plan/build-plan.test.ts
// Pins plan emission preference order (T-252 spec §5, ACs #7-#11).

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { buildPlan } from './build-plan.js';

function makeDoc(overrides: Partial<Document> = {}): Document {
  const base: Document = {
    meta: {
      id: 'doc1',
      version: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    layouts: [],
    masters: [],
    content: {
      mode: 'slide',
      slides: [
        {
          id: 'slide_1',
          elements: [],
        },
      ],
    },
    ...overrides,
  };
  return base;
}

describe('buildPlan — AC #7-#11', () => {
  it('AC #7: inheritsFrom-aware text placeholder emits InsertText only (option a, no shape-props reset)', () => {
    const doc = makeDoc({
      layouts: [
        {
          id: 'layout1',
          name: 'Title',
          masterId: 'master1',
          placeholders: [
            {
              id: 'ph1',
              type: 'text',
              text: 'Title placeholder',
              transform: { x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1 },
              visible: true,
              locked: false,
              animations: [],
              align: 'left',
            },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            layoutId: 'layout1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                text: 'My Title',
                transform: { x: 10, y: 20, width: 200, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                align: 'left',
                inheritsFrom: { templateId: 'layout1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const plan = buildPlan(doc, {
      existingPages: { slide_1: [] },
      slideObjectIdBySlideId: { slide_1: 'slide_1' },
    });
    expect(plan).toHaveLength(1);
    expect(plan[0]?.strategiesByElement.e1).toBe('placeholder-update');
    const reqs = plan[0]?.requests.map((r) => Object.keys(r.request)[0]);
    // Spec §5(a): we do NOT emit `updateShapeProperties` here — that would
    // reset the inherited theme bindings on the placeholder. We only push
    // the canonical text into the placeholder's body via `insertText`.
    expect(reqs).toContain('insertText');
    expect(reqs?.includes('updateShapeProperties')).toBe(false);
    expect(reqs?.includes('createShape')).toBe(false);
  });

  it('AC #7 (corollary): inheritsFrom-aware non-text placeholder emits zero requests (theme inherit)', () => {
    const doc = makeDoc({
      layouts: [
        {
          id: 'layout1',
          name: 'BgRect',
          masterId: 'master1',
          placeholders: [
            {
              id: 'phRect',
              type: 'shape',
              shape: 'rect',
              transform: { x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1 },
              visible: true,
              locked: false,
              animations: [],
            },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            layoutId: 'layout1',
            elements: [
              {
                id: 'eRect',
                type: 'shape',
                shape: 'rect',
                transform: { x: 10, y: 20, width: 200, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                inheritsFrom: { templateId: 'layout1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    });
    const plan = buildPlan(doc, {
      existingPages: { slide_1: [] },
      slideObjectIdBySlideId: { slide_1: 'slide_1' },
    });
    expect(plan[0]?.strategiesByElement.eRect).toBe('placeholder-update');
    // The inherited shape already exists on the layout — no mutations needed.
    expect(plan[0]?.requests).toHaveLength(0);
  });

  it('AC #8: similar object on target slide emits DuplicateObjectRequest', () => {
    const doc = makeDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                text: 'Hello world',
                // Center at (200, 125) px
                transform: { x: 100, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                align: 'left',
              },
            ],
          },
        ],
      },
    });
    const plan = buildPlan(doc, {
      existingPages: {
        slide_1: [
          {
            objectId: 'apiObj1',
            size: {
              width: { magnitude: 200 * 9525 },
              height: { magnitude: 50 * 9525 },
            },
            transform: {
              translateX: 100 * 9525,
              translateY: 100 * 9525,
            },
            shape: {
              text: { textElements: [{ textRun: { content: 'Hello world' } }] },
            },
          },
        ],
      },
      slideObjectIdBySlideId: { slide_1: 'slide_1' },
    });
    expect(plan[0]?.strategiesByElement.e1).toBe('duplicate-similar');
    const reqs = plan[0]?.requests.map((r) => Object.keys(r.request)[0]);
    expect(reqs).toContain('duplicateObject');
    expect(reqs).toContain('updatePageElementTransform');
    expect(reqs).toContain('insertText');
    expect(reqs?.includes('createShape')).toBe(false);
  });

  it('AC #9: no inheritsFrom + no similar emits CreateShapeRequest', () => {
    const doc = makeDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            elements: [
              {
                id: 'e1',
                type: 'shape',
                shape: 'rect',
                transform: { x: 10, y: 20, width: 100, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
              },
            ],
          },
        ],
      },
    });
    const plan = buildPlan(doc, {
      existingPages: { slide_1: [] },
      slideObjectIdBySlideId: { slide_1: 'slide_1' },
    });
    expect(plan[0]?.strategiesByElement.e1).toBe('create-from-scratch');
    const reqs = plan[0]?.requests.map((r) => Object.keys(r.request)[0]);
    expect(reqs?.[0]).toBe('createShape');
  });

  it('AC #10: GroupElement emits N child creates FIRST then GroupObjectsRequest', () => {
    const doc = makeDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            elements: [
              {
                id: 'g1',
                type: 'group',
                clip: false,
                transform: { x: 0, y: 0, width: 400, height: 300, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                children: [
                  {
                    id: 'c1',
                    type: 'shape',
                    shape: 'rect',
                    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
                    visible: true,
                    locked: false,
                    animations: [],
                  },
                  {
                    id: 'c2',
                    type: 'shape',
                    shape: 'ellipse',
                    transform: { x: 200, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
                    visible: true,
                    locked: false,
                    animations: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const plan = buildPlan(doc, {
      existingPages: { slide_1: [] },
      slideObjectIdBySlideId: { slide_1: 'slide_1' },
    });
    const reqs = plan[0]?.requests ?? [];
    // First two requests are the child createShapes; last is groupObjects.
    expect(Object.keys(reqs[0]?.request ?? {})[0]).toBe('createShape');
    expect(Object.keys(reqs[1]?.request ?? {})[0]).toBe('createShape');
    expect(Object.keys(reqs[reqs.length - 1]?.request ?? {})[0]).toBe('groupObjects');
    const groupReq = reqs[reqs.length - 1]?.request as {
      groupObjects: { childrenObjectIds: string[] };
    };
    expect(groupReq.groupObjects.childrenObjectIds).toHaveLength(2);
  });

  it('image element emits CreateImageRequest', () => {
    const doc = makeDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            elements: [
              {
                id: 'i1',
                type: 'image',
                src: 'asset:abc-def',
                fit: 'cover',
                transform: { x: 0, y: 0, width: 200, height: 100, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
              },
            ],
          },
        ],
      },
    });
    const plan = buildPlan(doc, {
      existingPages: { slide_1: [] },
      slideObjectIdBySlideId: { slide_1: 'slide_1' },
    });
    const types = plan[0]?.requests.map((r) => Object.keys(r.request)[0]) ?? [];
    expect(types).toContain('createImage');
  });

  it('every shape kind maps to a Slides shapeType', () => {
    for (const kind of ['rect', 'ellipse', 'line', 'polygon', 'star', 'custom-path'] as const) {
      const doc = makeDoc({
        content: {
          mode: 'slide',
          slides: [
            {
              id: 'slide_1',
              elements: [
                {
                  id: 's1',
                  type: 'shape',
                  shape: kind,
                  ...(kind === 'custom-path' ? { path: 'M0 0 L1 1' } : {}),
                  transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
                  visible: true,
                  locked: false,
                  animations: [],
                },
              ],
            },
          ],
        },
      });
      const plan = buildPlan(doc, {
        existingPages: { slide_1: [] },
        slideObjectIdBySlideId: { slide_1: 'slide_1' },
      });
      // Expect at least a createShape with a valid shapeType.
      const csReq = plan[0]?.requests.find((r) => 'createShape' in r.request)?.request as
        | { createShape: { shapeType: string } }
        | undefined;
      expect(csReq).toBeDefined();
      expect(csReq?.createShape.shapeType.length).toBeGreaterThan(0);
    }
  });

  it('AC #11: TableElement M×N emits 1 CreateTable + (M*N) InsertText + per-merged MergeTableCells', () => {
    const doc = makeDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 'slide_1',
            elements: [
              {
                id: 't1',
                type: 'table',
                rows: 2,
                columns: 3,
                headerRow: true,
                transform: { x: 0, y: 0, width: 600, height: 200, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                cells: [
                  { row: 0, col: 0, content: 'A', align: 'left', colspan: 1, rowspan: 1 },
                  { row: 0, col: 1, content: 'B', align: 'left', colspan: 2, rowspan: 1 },
                  { row: 1, col: 0, content: 'C', align: 'left', colspan: 1, rowspan: 1 },
                ],
              },
            ],
          },
        ],
      },
    });
    const plan = buildPlan(doc, {
      existingPages: { slide_1: [] },
      slideObjectIdBySlideId: { slide_1: 'slide_1' },
    });
    const types = plan[0]?.requests.map((r) => Object.keys(r.request)[0]) ?? [];
    expect(types[0]).toBe('createTable');
    // 2 × 3 = 6 InsertText calls (one per cell).
    const insertCount = types.filter((t) => t === 'insertText').length;
    expect(insertCount).toBe(6);
    // 1 MergeTableCells call (the colspan=2 cell).
    const mergeCount = types.filter((t) => t === 'mergeTableCells').length;
    expect(mergeCount).toBe(1);
  });
});
