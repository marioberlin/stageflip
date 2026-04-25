// packages/import-pptx/src/transforms/accumulate.test.ts
// T-241a acceptance tests — written first; stub implementation throws so
// every test below fails until `accumulateGroupTransforms` lands.

import { describe, expect, it } from 'vitest';
import { parsePptx } from '../parsePptx.js';
import { buildGroupFixture } from '../fixtures/builder.js';
import type {
  CanonicalSlideTree,
  ParsedElement,
  ParsedGroupElement,
  ParsedSlide,
} from '../types.js';
import { accumulateGroupTransforms } from './accumulate.js';

/** Build a synthetic tree with a single group and N children at known positions. */
function syntheticTree(args: {
  groupTransform: { x: number; y: number; width: number; height: number; rotation?: number };
  groupOrigin: { x: number; y: number };
  groupExtent: { width: number; height: number };
  children: ParsedElement[];
}): CanonicalSlideTree {
  const group: ParsedGroupElement = {
    id: 'pptx_grp',
    transform: {
      x: args.groupTransform.x,
      y: args.groupTransform.y,
      width: args.groupTransform.width,
      height: args.groupTransform.height,
      rotation: args.groupTransform.rotation ?? 0,
      opacity: 1,
    },
    visible: true,
    locked: false,
    animations: [],
    type: 'group',
    children: args.children,
    clip: false,
    groupOrigin: args.groupOrigin,
    groupExtent: args.groupExtent,
  };
  const slide: ParsedSlide = { id: 'slide_1', elements: [group] };
  return { slides: [slide], layouts: {}, masters: {}, lossFlags: [] };
}

/** Build a leaf shape child at given local coords. */
function leaf(args: {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
}): ParsedElement {
  return {
    id: args.id,
    transform: {
      x: args.x,
      y: args.y,
      width: args.w,
      height: args.h,
      rotation: args.rotation ?? 0,
      opacity: 1,
    },
    visible: true,
    locked: false,
    animations: [],
    type: 'shape',
    shape: 'rect',
  };
}

/** Pull the (only) slide's first element. */
function firstChild(tree: CanonicalSlideTree): ParsedElement {
  const group = tree.slides[0]?.elements[0];
  if (group?.type !== 'group') throw new Error('expected group as first element');
  const child = (group as ParsedGroupElement).children[0];
  if (child === undefined) throw new Error('expected at least one child');
  return child;
}

describe('accumulateGroupTransforms — T-241a acceptance', () => {
  // AC #1
  it('returns a CanonicalSlideTree (pure transform; deterministic)', () => {
    const tree = syntheticTree({
      groupTransform: { x: 0, y: 0, width: 100, height: 100 },
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 100, height: 100 },
      children: [leaf({ id: 'pptx_a', x: 10, y: 10, w: 20, h: 20 })],
    });
    const a = accumulateGroupTransforms(tree);
    const b = accumulateGroupTransforms(tree);
    expect(a).toEqual(b);
    expect(a.slides.length).toBe(1);
  });

  // AC #2 — also covered by the realfixture-based test below.
  it('clears LF-PPTX-NESTED-GROUP-TRANSFORM flags from the tree', async () => {
    const parsed = await parsePptx(buildGroupFixture());
    const accumulated = accumulateGroupTransforms(parsed);
    const codes = accumulated.lossFlags.map((f) => f.code);
    expect(codes).not.toContain('LF-PPTX-NESTED-GROUP-TRANSFORM');
  });

  // AC #3 — single-group accumulation, identity scale.
  it('translates child by group offset when chExt = group.ext, chOff = 0', () => {
    const tree = syntheticTree({
      groupTransform: { x: 100, y: 100, width: 200, height: 200 },
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 200, height: 200 },
      children: [leaf({ id: 'pptx_a', x: 10, y: 10, w: 20, h: 20 })],
    });
    const child = firstChild(accumulateGroupTransforms(tree));
    expect(child.transform.x).toBeCloseTo(110, 5);
    expect(child.transform.y).toBeCloseTo(110, 5);
    expect(child.transform.width).toBeCloseTo(20, 5);
    expect(child.transform.height).toBeCloseTo(20, 5);
  });

  // AC #4 — child-coord scaling.
  it('scales child positions and sizes by group.ext / chExt', () => {
    const tree = syntheticTree({
      groupTransform: { x: 0, y: 0, width: 200, height: 200 },
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 100, height: 100 },
      children: [leaf({ id: 'pptx_a', x: 50, y: 50, w: 10, h: 10 })],
    });
    const child = firstChild(accumulateGroupTransforms(tree));
    // scale 2×: local 50 → world 100; local size 10 → world 20.
    expect(child.transform.x).toBeCloseTo(100, 5);
    expect(child.transform.y).toBeCloseTo(100, 5);
    expect(child.transform.width).toBeCloseTo(20, 5);
    expect(child.transform.height).toBeCloseTo(20, 5);
  });

  // AC #5 — rotation accumulation; position rotated around group center.
  it('sums rotations and rotates child position around group center (180°)', () => {
    const tree = syntheticTree({
      groupTransform: { x: 100, y: 100, width: 200, height: 200, rotation: 180 },
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 200, height: 200 },
      children: [leaf({ id: 'pptx_a', x: 50, y: 50, w: 10, h: 10, rotation: 30 })],
    });
    const child = firstChild(accumulateGroupTransforms(tree));
    // Group center world = (200, 200). Child at world (150, 150) before rotation.
    // 180° rotation around (200, 200) sends (150, 150) → (250, 250).
    expect(child.transform.x).toBeCloseTo(250, 5);
    expect(child.transform.y).toBeCloseTo(250, 5);
    // Rotation sums.
    expect(child.transform.rotation).toBeCloseTo(210, 5);
  });

  // AC #5 (extra) — 0° group rotation passes child rotation through unchanged.
  it('leaves rotation as child.rotation when group.rotation = 0', () => {
    const tree = syntheticTree({
      groupTransform: { x: 0, y: 0, width: 100, height: 100 },
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 100, height: 100 },
      children: [leaf({ id: 'pptx_a', x: 0, y: 0, w: 10, h: 10, rotation: 45 })],
    });
    const child = firstChild(accumulateGroupTransforms(tree));
    expect(child.transform.rotation).toBeCloseTo(45, 5);
  });

  // AC #6 — multi-level (3) nesting.
  it('accumulates across 3 levels of nesting', () => {
    // Innermost: a 10x10 rect at local (5, 5) inside grand-child group.
    const innermost = leaf({ id: 'pptx_inner', x: 5, y: 5, w: 10, h: 10 });
    const midGroup: ParsedGroupElement = {
      id: 'pptx_mid',
      transform: { x: 100, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'group',
      children: [innermost],
      clip: false,
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 100, height: 100 },
    };
    const outerGroup: ParsedGroupElement = {
      id: 'pptx_outer',
      transform: { x: 1000, y: 0, width: 500, height: 500, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'group',
      children: [midGroup],
      clip: false,
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 500, height: 500 },
    };
    const slide: ParsedSlide = { id: 'slide_1', elements: [outerGroup] };
    const tree: CanonicalSlideTree = {
      slides: [slide],
      layouts: {},
      masters: {},
      lossFlags: [],
    };

    const accumulated = accumulateGroupTransforms(tree);
    const outer = accumulated.slides[0]?.elements[0];
    if (outer?.type !== 'group') throw new Error('expected outer group');
    const mid = (outer as ParsedGroupElement).children[0];
    if (mid?.type !== 'group') throw new Error('expected mid group');
    const innerEl = (mid as ParsedGroupElement).children[0];
    if (innerEl === undefined) throw new Error('expected innermost element');

    // Outer group at (1000, 0) ext (500, 500), chExt (500, 500) = identity scale.
    // Mid group inside: local (100, 0), so world (1100, 0). World ext (100, 100).
    // Mid's chExt = (100, 100) → identity scale at this level too.
    // Inner leaf local (5, 5) → world (1105, 5), size 10x10.
    expect(innerEl.transform.x).toBeCloseTo(1105, 5);
    expect(innerEl.transform.y).toBeCloseTo(5, 5);
    expect(innerEl.transform.width).toBeCloseTo(10, 5);
    expect(innerEl.transform.height).toBeCloseTo(10, 5);
  });

  // AC #7 — group node retained; group's own transform stays as-is.
  it('preserves the group node and its own world transform', () => {
    const tree = syntheticTree({
      groupTransform: { x: 100, y: 100, width: 200, height: 200 },
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 200, height: 200 },
      children: [leaf({ id: 'pptx_a', x: 0, y: 0, w: 10, h: 10 })],
    });
    const accumulated = accumulateGroupTransforms(tree);
    const group = accumulated.slides[0]?.elements[0];
    expect(group?.type).toBe('group');
    if (group?.type !== 'group') return;
    // Group's own transform unchanged.
    expect(group.transform.x).toBe(100);
    expect(group.transform.y).toBe(100);
    expect(group.transform.width).toBe(200);
    expect(group.transform.height).toBe(200);
  });

  // AC #9 — idempotence.
  it('is idempotent: f(f(x)) = f(x)', () => {
    const tree = syntheticTree({
      groupTransform: { x: 100, y: 200, width: 200, height: 200, rotation: 45 },
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 100, height: 100 },
      children: [leaf({ id: 'pptx_a', x: 25, y: 25, w: 10, h: 10, rotation: 30 })],
    });
    const once = accumulateGroupTransforms(tree);
    const twice = accumulateGroupTransforms(once);
    expect(twice).toEqual(once);
  });

  // AC #10 — covered by the static `pnpm check-determinism` gate. No
  // forbidden-API uses introduced; verified at CI level.

  // Bonus — non-group elements at slide top level pass through unchanged.
  it('leaves slide-top-level non-group elements untouched', () => {
    const topLeaf = leaf({ id: 'pptx_top', x: 5, y: 5, w: 10, h: 10 });
    const slide: ParsedSlide = { id: 'slide_1', elements: [topLeaf] };
    const tree: CanonicalSlideTree = {
      slides: [slide],
      layouts: {},
      masters: {},
      lossFlags: [],
    };
    const accumulated = accumulateGroupTransforms(tree);
    expect(accumulated.slides[0]?.elements[0]).toEqual(topLeaf);
  });

  // Bonus — layouts and masters are walked too.
  it('walks layouts and masters in addition to slides', () => {
    const groupTree = syntheticTree({
      groupTransform: { x: 100, y: 100, width: 200, height: 200 },
      groupOrigin: { x: 0, y: 0 },
      groupExtent: { width: 200, height: 200 },
      children: [leaf({ id: 'pptx_a', x: 10, y: 10, w: 20, h: 20 })],
    });
    const layoutSlide = groupTree.slides[0];
    if (layoutSlide === undefined) throw new Error('seed slide missing');
    const tree: CanonicalSlideTree = {
      slides: [],
      layouts: { L1: layoutSlide },
      masters: { M1: layoutSlide },
      lossFlags: [],
    };
    const accumulated = accumulateGroupTransforms(tree);
    const layoutGroup = accumulated.layouts.L1?.elements[0];
    const masterGroup = accumulated.masters.M1?.elements[0];
    if (layoutGroup?.type !== 'group') throw new Error('layout group missing');
    if (masterGroup?.type !== 'group') throw new Error('master group missing');
    expect((layoutGroup as ParsedGroupElement).children[0]?.transform.x).toBeCloseTo(110, 5);
    expect((masterGroup as ParsedGroupElement).children[0]?.transform.x).toBeCloseTo(110, 5);
  });
});
