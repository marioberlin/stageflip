// packages/import-pptx/src/elements/video.ts
// T-243b — Convert a `<p:sp>` whose `<p:nvSpPr><p:nvPr>` carries a
// `<p:videoFile>` child into a `ParsedVideoElement` with a
// `ParsedAssetRef.unresolved`. The walker (`parts/sp-tree.ts`) decides
// whether to dispatch a `<p:sp>` to `parseShape` or `parseVideo` based on
// the presence of `<p:videoFile>` and the relationship's `TargetMode`;
// `parseVideo` itself is pure and assumes the caller already verified
// that this sp carries an in-ZIP video relationship.

import type { OrderedXmlNode } from '../opc.js';
import type { LossFlag, ParsedVideoElement } from '../types.js';
import type { ElementContext } from './shared.js';

/**
 * Parse a `<p:sp>` carrying a `<p:videoFile>` extension. Returns a
 * `ParsedVideoElement` plus an `LF-PPTX-UNRESOLVED-VIDEO` flag pointing at
 * the resolved part path. The caller (walker) is responsible for
 * disambiguating `TargetMode="External"` (which should not reach this
 * function) from in-ZIP relationships.
 *
 * Stub for the tests-first scaffolding pass.
 */
export function parseVideo(
  _sp: OrderedXmlNode | undefined,
  _ctx: ElementContext,
): { element?: ParsedVideoElement; flags: LossFlag[] } {
  return { flags: [] };
}
