// packages/import-pptx/src/transforms/accumulate.ts
// T-241a — stub. Tests pin the contract; implementation lands in the next
// commit on this branch.

import type { CanonicalSlideTree } from '../types.js';

/**
 * Walk the parser-side group tree and accumulate each group's `<a:xfrm>`
 * transform (including `<a:chOff>` / `<a:chExt>` child-coord scaling and
 * rotation) into descendant transforms so leaf children carry world-space
 * coordinates.
 *
 * Pure: no I/O, no Date, no Math.random. Idempotent: running twice yields
 * the same output as running once.
 */
export function accumulateGroupTransforms(_tree: CanonicalSlideTree): CanonicalSlideTree {
  throw new Error('accumulateGroupTransforms: not implemented (T-241a)');
}
