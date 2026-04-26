// packages/schema/src/roundtrip.test.ts
// Property-based round-trip tests (T-024). For every element type × every
// animation kind × every timing primitive, the property
//     parse(JSON.parse(JSON.stringify(parse(x)))) deep-equals parse(x)
// must hold. fast-check generates arbitraries; each `property` runs ~100
// random instances by default.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  ELEMENT_TYPES,
  SCHEMA_VERSION,
  TIMING_KINDS,
  animationSchema,
  audioElementSchema,
  chartElementSchema,
  clipElementSchema,
  codeElementSchema,
  documentSchema,
  easingSchema,
  embedElementSchema,
  imageElementSchema,
  shapeElementSchema,
  tableElementSchema,
  textElementSchema,
  timingPrimitiveSchema,
  videoElementSchema,
} from './index.js';

/* --------------------------- Arbitraries --------------------------- */

const idArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,30}$/).filter((s) => s.length > 0);
const hexColorArb = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `#${n.toString(16).padStart(6, '0')}`);
const assetRefArb = idArb.map((id) => `asset:${id}`);
/**
 * JSON.stringify(-0) is "0" — the sign is lost. Vitest's toEqual uses Object.is,
 * which distinguishes -0 and +0. Normalize at arbitrary generation so the
 * round-trip property holds without a weaker comparison.
 */
const noNegativeZero = (v: number): number => (Object.is(v, -0) ? 0 : v);
const finiteNumberArb = fc
  .double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })
  .map(noNegativeZero);
const positiveNumberArb = fc.double({
  min: 0.01,
  max: 1e6,
  noNaN: true,
  noDefaultInfinity: true,
});
const unitIntervalArb = fc.double({ min: 0, max: 1, noNaN: true }).map(noNegativeZero);

const transformArb = fc.record({
  x: finiteNumberArb,
  y: finiteNumberArb,
  width: positiveNumberArb,
  height: positiveNumberArb,
  rotation: finiteNumberArb,
  opacity: unitIntervalArb,
});

// --- per-element arbitraries (explicit fields; no spread across fc.record) ---

const textArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('text' as const),
  text: fc.string(),
});

const imageArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('image' as const),
  src: assetRefArb,
});

const videoArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('video' as const),
  src: assetRefArb,
});

const audioArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('audio' as const),
  src: assetRefArb,
});

const shapeArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('shape' as const),
  shape: fc.constantFrom('rect', 'ellipse', 'line', 'polygon', 'star'),
});

const chartArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('chart' as const),
  chartKind: fc.constantFrom('bar', 'line', 'area', 'pie', 'donut', 'scatter', 'combo'),
  data: fc.record({
    labels: fc.array(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 5 }),
    series: fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 12 }),
        values: fc.array(fc.oneof(finiteNumberArb, fc.constant(null)), { maxLength: 5 }),
      }),
      { maxLength: 3 },
    ),
  }),
});

const tableArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('table' as const),
  rows: fc.integer({ min: 1, max: 5 }),
  columns: fc.integer({ min: 1, max: 5 }),
  cells: fc.array(
    fc.record({
      row: fc.integer({ min: 0, max: 4 }),
      col: fc.integer({ min: 0, max: 4 }),
      content: fc.string({ maxLength: 20 }),
    }),
    { maxLength: 5 },
  ),
});

const clipArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('clip' as const),
  runtime: fc.constantFrom('frame-runtime', 'gsap', 'lottie', 'three', 'shader'),
  clipName: idArb,
});

const embedArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('embed' as const),
  src: fc.webUrl(),
});

const codeArb = fc.record({
  id: idArb,
  transform: transformArb,
  type: fc.constant('code' as const),
  code: fc.string({ maxLength: 200 }),
});

/* --------------------------- Timing / Animation arbitraries --------------------------- */

const absoluteTimingArb = fc.record({
  kind: fc.constant('absolute' as const),
  startFrame: fc.integer({ min: 0, max: 10_000 }),
  durationFrames: fc.integer({ min: 1, max: 10_000 }),
});
const relativeTimingArb = fc.record({
  kind: fc.constant('relative' as const),
  offsetFrames: fc.integer({ min: -1000, max: 1000 }),
  durationFrames: fc.integer({ min: 1, max: 10_000 }),
});
const anchoredTimingArb = fc.record({
  kind: fc.constant('anchored' as const),
  anchor: idArb,
  anchorEdge: fc.constantFrom('start', 'end'),
  durationFrames: fc.integer({ min: 1, max: 10_000 }),
});
const beatTimingArb = fc.record({
  kind: fc.constant('beat' as const),
  beat: fc.double({ min: 0.25, max: 128, noNaN: true }),
  durationBeats: fc.double({ min: 0.25, max: 32, noNaN: true }),
});
const eventTimingArb = fc.record({
  kind: fc.constant('event' as const),
  event: idArb,
  durationFrames: fc.integer({ min: 1, max: 10_000 }),
});

const allTimingArb = fc.oneof(
  absoluteTimingArb,
  relativeTimingArb,
  anchoredTimingArb,
  beatTimingArb,
  eventTimingArb,
);

const namedEasingArb = fc.constantFrom<string>(
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'quad-in',
  'cubic-in-out',
  'expo-out',
  'circ-in',
  'back-in',
);
const cubicBezierArb = fc.record({
  kind: fc.constant('cubic-bezier' as const),
  x1: unitIntervalArb,
  y1: finiteNumberArb,
  x2: unitIntervalArb,
  y2: finiteNumberArb,
});
const springEasingArb = fc.record({
  kind: fc.constant('spring' as const),
  mass: positiveNumberArb,
  stiffness: positiveNumberArb,
  damping: fc.double({ min: 0.01, max: 100, noNaN: true }),
});
const stepsArb = fc.record({
  kind: fc.constant('steps' as const),
  steps: fc.integer({ min: 1, max: 20 }),
});
const allEasingArb = fc.oneof(namedEasingArb, cubicBezierArb, springEasingArb, stepsArb);

const fadeAnimArb = fc.record({
  kind: fc.constant('fade' as const),
  from: unitIntervalArb,
  to: unitIntervalArb,
  easing: allEasingArb,
});
const slideAnimArb = fc.record({
  kind: fc.constant('slide' as const),
  direction: fc.constantFrom('up', 'down', 'left', 'right'),
  distance: finiteNumberArb,
  easing: allEasingArb,
});
const scaleAnimArb = fc.record({
  kind: fc.constant('scale' as const),
  from: positiveNumberArb,
  to: positiveNumberArb,
  easing: allEasingArb,
});
const rotateAnimArb = fc.record({
  kind: fc.constant('rotate' as const),
  fromDegrees: finiteNumberArb,
  toDegrees: finiteNumberArb,
  easing: allEasingArb,
});
const allAnimArb = fc.oneof(fadeAnimArb, slideAnimArb, scaleAnimArb, rotateAnimArb);

const animationArb = fc.record({
  id: idArb,
  timing: allTimingArb,
  animation: allAnimArb,
});

/* --------------------------- Properties --------------------------- */

const roundTrip = <T>(schema: { parse: (x: unknown) => T }, value: unknown): T => {
  const parsed = schema.parse(value);
  const serialized = JSON.stringify(parsed);
  return schema.parse(JSON.parse(serialized));
};

const elementPerTypeArb: Record<string, fc.Arbitrary<unknown>> = {
  text: textArb,
  image: imageArb,
  video: videoArb,
  audio: audioArb,
  shape: shapeArb,
  chart: chartArb,
  table: tableArb,
  clip: clipArb,
  embed: embedArb,
  code: codeArb,
};

const ELEMENT_SCHEMA_BY_TYPE = {
  text: textElementSchema,
  image: imageElementSchema,
  video: videoElementSchema,
  audio: audioElementSchema,
  shape: shapeElementSchema,
  chart: chartElementSchema,
  table: tableElementSchema,
  clip: clipElementSchema,
  embed: embedElementSchema,
  code: codeElementSchema,
} as const;

describe('round-trip: every element type survives JSON serialize -> parse', () => {
  // 10 non-group types exercised via per-type schemas (group's recursion is
  // covered by the union test below).
  for (const type of ELEMENT_TYPES) {
    if (type === 'group') continue;
    const arb = elementPerTypeArb[type];
    const schema = ELEMENT_SCHEMA_BY_TYPE[type as keyof typeof ELEMENT_SCHEMA_BY_TYPE];
    if (!arb || !schema) continue;
    it(`${type} round-trips`, () => {
      fc.assert(
        fc.property(arb, (value) => {
          const once = schema.parse(value);
          const twice = roundTrip(schema, once);
          expect(twice).toEqual(once);
        }),
        { numRuns: 50 },
      );
    });
  }
});

describe('round-trip: every (animation kind × timing primitive) combo', () => {
  it('any generated Animation round-trips', () => {
    fc.assert(
      fc.property(animationArb, (a) => {
        const once = animationSchema.parse(a);
        const twice = roundTrip(animationSchema, once);
        expect(twice).toEqual(once);
      }),
      { numRuns: 100 },
    );
  });

  it('TIMING_KINDS has an arbitrary for every kind (sanity)', () => {
    expect(TIMING_KINDS).toHaveLength(5);
  });

  for (const timing of ['absolute', 'relative', 'anchored', 'beat', 'event'] as const) {
    it(`timing kind "${timing}" round-trips`, () => {
      const arb = {
        absolute: absoluteTimingArb,
        relative: relativeTimingArb,
        anchored: anchoredTimingArb,
        beat: beatTimingArb,
        event: eventTimingArb,
      }[timing];
      fc.assert(
        fc.property(arb, (t) => {
          const once = timingPrimitiveSchema.parse(t);
          const twice = roundTrip(timingPrimitiveSchema, once);
          expect(twice).toEqual(once);
        }),
        { numRuns: 40 },
      );
    });
  }
});

describe('round-trip: easings', () => {
  it('every easing variant round-trips', () => {
    fc.assert(
      fc.property(allEasingArb, (e) => {
        const once = easingSchema.parse(e);
        const twice = roundTrip(easingSchema, once);
        expect(twice).toEqual(once);
      }),
      { numRuns: 50 },
    );
  });
});

describe('round-trip: top-level Document', () => {
  const NOW = '2026-04-20T12:00:00.000Z';

  const minDocArb = (mode: 'slide' | 'video' | 'display') =>
    fc.record({
      meta: fc.record({
        id: idArb,
        version: fc.nat({ max: 1000 }),
        createdAt: fc.constant(NOW),
        updatedAt: fc.constant(NOW),
        schemaVersion: fc.constant(SCHEMA_VERSION),
      }),
      theme: fc.constant({ tokens: {} }),
      variables: fc.constant({}),
      components: fc.constant({}),
      content:
        mode === 'slide'
          ? fc.record({
              mode: fc.constant('slide' as const),
              slides: fc.array(fc.record({ id: idArb, elements: fc.constant([]) }), {
                minLength: 1,
                maxLength: 3,
              }),
            })
          : mode === 'video'
            ? fc.record({
                mode: fc.constant('video' as const),
                aspectRatio: fc.constantFrom<'16:9' | '9:16' | '1:1'>('16:9', '9:16', '1:1'),
                durationMs: fc.integer({ min: 100, max: 60_000 }),
                tracks: fc.array(
                  fc.record({
                    id: idArb,
                    kind: fc.constant('visual' as const),
                    elements: fc.constant([]),
                  }),
                  { minLength: 1, maxLength: 3 },
                ),
              })
            : fc.record({
                mode: fc.constant('display' as const),
                sizes: fc.array(
                  fc.record({
                    id: idArb,
                    width: fc.integer({ min: 1, max: 2000 }),
                    height: fc.integer({ min: 1, max: 2000 }),
                  }),
                  { minLength: 1, maxLength: 3 },
                ),
                durationMs: fc.integer({ min: 100, max: 60_000 }),
                budget: fc.record({ totalZipKb: fc.integer({ min: 1, max: 1000 }) }),
                elements: fc.constant([]),
              }),
    });

  for (const mode of ['slide', 'video', 'display'] as const) {
    it(`mode=${mode} Document round-trips`, () => {
      fc.assert(
        fc.property(minDocArb(mode), (doc) => {
          const once = documentSchema.parse(doc);
          const twice = roundTrip(documentSchema, once);
          expect(twice).toEqual(once);
        }),
        { numRuns: 30 },
      );
    });
  }
});

/* --------------------------- T-251 — templates --------------------------- */

describe('round-trip: T-251 deck-level templates + per-element inheritsFrom', () => {
  const NOW = '2026-04-26T00:00:00.000Z';
  const T = { x: 0, y: 0, width: 100, height: 50 };
  const ST = { x: 10, y: 20, width: 200, height: 80 };

  it('AC #1 — back-compat: document with masters: [] / layouts: [] parses', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
    });
    expect(doc.masters).toEqual([]);
    expect(doc.layouts).toEqual([]);
  });

  it('AC #2 — accepts master + layout + slide pointing at the layout', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      masters: [
        {
          id: 'master-1',
          name: 'M',
          placeholders: [
            { id: 'mp-0', type: 'text', transform: T, text: 'Title' },
            { id: 'mp-1', type: 'text', transform: T, text: 'Subtitle' },
          ],
        },
      ],
      layouts: [{ id: 'layout-1', name: 'L', masterId: 'master-1' }],
      content: {
        mode: 'slide',
        slides: [{ id: 's1', layoutId: 'layout-1', elements: [] }],
      },
    });
    expect(doc.masters).toHaveLength(1);
    expect(doc.layouts).toHaveLength(1);
    if (doc.content.mode !== 'slide') throw new Error('mode');
    expect(doc.content.slides[0]?.layoutId).toBe('layout-1');
  });

  it('AC #4 — element with no inheritsFrom parses unchanged (back-compat)', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            elements: [{ id: 'e1', type: 'text', transform: T, text: 'plain' }],
          },
        ],
      },
    });
    if (doc.content.mode !== 'slide') throw new Error('mode');
    const el = doc.content.slides[0]?.elements[0];
    expect(el?.inheritsFrom).toBeUndefined();
  });

  it('AC #5 — element with inheritsFrom round-trips byte-identical', () => {
    const original = {
      meta: {
        id: 'd1',
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
        locale: 'en',
        schemaVersion: SCHEMA_VERSION,
      },
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: {
        mode: 'slide' as const,
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'e1',
                type: 'text' as const,
                transform: { ...ST, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                text: 'hello',
                align: 'left' as const,
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 7 },
              },
            ],
          },
        ],
      },
    };
    const once = documentSchema.parse(original);
    const twice = documentSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    if (twice.content.mode !== 'slide') throw new Error('mode');
    expect(twice.content.slides[0]?.elements[0]?.inheritsFrom).toEqual({
      templateId: 'layout-1',
      placeholderIdx: 7,
    });
  });

  it('AC #7 — Slide.layoutId is optional; existing slides parse unchanged', () => {
    const doc = documentSchema.parse({
      meta: { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW },
      theme: { tokens: {} },
      content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
    });
    if (doc.content.mode !== 'slide') throw new Error('mode');
    expect(doc.content.slides[0]?.layoutId).toBeUndefined();
  });
});
