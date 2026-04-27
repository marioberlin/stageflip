// packages/export-google-slides/src/plan/preference.ts
// Heuristic for "similar object exists on the target slide" — option (b) in
// the preference order (T-252 spec §5). Same type, bbox center within 50 px,
// text 80% Levenshtein-similar (per spec AC #8).

import type { Element } from '@stageflip/schema';

/**
 * Minimal local mirror of the `ApiPageElement` shape T-244 reads. T-244's
 * type is package-internal (not exported); we copy the strict subset we need
 * to avoid coupling our planner to an unexported symbol.
 */
export interface PreferenceApiPageElement {
  objectId?: string;
  size?: { width?: { magnitude?: number }; height?: { magnitude?: number } };
  transform?: { translateX?: number; translateY?: number };
  shape?: {
    text?: { textElements?: Array<{ textRun?: { content?: string } }> };
  };
  image?: unknown;
  table?: unknown;
  elementGroup?: unknown;
}

/** Default proximity radius in px for bbox-center match. AC #8. */
export const DEFAULT_PROXIMITY_PX = 50;
/** Default Levenshtein-similarity threshold for text. AC #8. */
export const DEFAULT_TEXT_SIMILARITY = 0.8;

export interface SimilarityOptions {
  proximityPx?: number;
  textSimilarity?: number;
}

/**
 * Returns the matching candidate's `objectId` if a similar API page-element
 * exists on the target slide; otherwise undefined. "Similar" = same primitive
 * kind, bbox-center within `proximityPx`, and (for text) Levenshtein
 * similarity above `textSimilarity`.
 *
 * The bbox-center math reads the API element's `transform.translateX/Y` plus
 * `size.width/height` and computes center in EMU space; the canonical-side
 * element carries `transform.{x,y,width,height}` in pixels. The two are
 * not directly comparable, so the caller pre-converts to a common unit
 * (px) before invoking this. We accept pre-converted bboxes via
 * `existingBboxes` to keep the math single-purpose.
 */
export function findSimilarObject(
  canonical: Element,
  existingBboxes: Array<{
    objectId: string;
    kind: 'shape' | 'image' | 'table' | 'group';
    text?: string;
    centerPx: { x: number; y: number };
  }>,
  opts: SimilarityOptions = {},
): string | undefined {
  const proximityPx = opts.proximityPx ?? DEFAULT_PROXIMITY_PX;
  const textSimilarity = opts.textSimilarity ?? DEFAULT_TEXT_SIMILARITY;

  const wantKind = mapKindForSimilarity(canonical);
  if (wantKind === undefined) return undefined;

  const cx = canonical.transform.x + canonical.transform.width / 2;
  const cy = canonical.transform.y + canonical.transform.height / 2;
  const wantText = canonical.type === 'text' ? canonical.text : undefined;

  for (const cand of existingBboxes) {
    if (cand.kind !== wantKind) continue;
    const dx = cand.centerPx.x - cx;
    const dy = cand.centerPx.y - cy;
    if (Math.hypot(dx, dy) > proximityPx) continue;
    if (wantText !== undefined) {
      const candText = cand.text ?? '';
      if (similarity(wantText, candText) < textSimilarity) continue;
    }
    return cand.objectId;
  }
  return undefined;
}

/** Map canonical element type → similarity kind, or undefined for non-applicable. */
function mapKindForSimilarity(el: Element): 'shape' | 'image' | 'table' | 'group' | undefined {
  switch (el.type) {
    case 'text':
      // Text canonical maps onto Slides "shape with text" — same similarity
      // bucket as plain shapes for option (b).
      return 'shape';
    case 'shape':
      return 'shape';
    case 'image':
      return 'image';
    case 'table':
      return 'table';
    case 'group':
      return 'group';
    default:
      return undefined;
  }
}

/**
 * Levenshtein similarity in [0,1]. 1.0 = identical, 0.0 = nothing in common.
 * Uses the standard edit-distance formula; for the threshold-comparison use
 * case here, the cost of full DP on small strings is negligible.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const dist = levenshtein(a, b);
  const longest = Math.max(a.length, b.length);
  return 1 - dist / longest;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = new Array<number>(rows * cols).fill(0);
  for (let i = 0; i < rows; i++) dp[i * cols] = i;
  for (let j = 0; j < cols; j++) dp[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const ca = a.charCodeAt(i - 1);
      const cb = b.charCodeAt(j - 1);
      const sub = (dp[(i - 1) * cols + (j - 1)] ?? 0) + (ca === cb ? 0 : 1);
      const del = (dp[(i - 1) * cols + j] ?? 0) + 1;
      const ins = (dp[i * cols + (j - 1)] ?? 0) + 1;
      dp[i * cols + j] = Math.min(sub, del, ins);
    }
  }
  return dp[rows * cols - 1] ?? 0;
}

/** Helper used by `build-plan` — extract candidate bboxes from the API page. */
export function bboxesFromApi(pageElements: PreferenceApiPageElement[] | undefined): Array<{
  objectId: string;
  kind: 'shape' | 'image' | 'table' | 'group';
  text?: string;
  centerPx: { x: number; y: number };
}> {
  const out: Array<{
    objectId: string;
    kind: 'shape' | 'image' | 'table' | 'group';
    text?: string;
    centerPx: { x: number; y: number };
  }> = [];
  for (const pe of pageElements ?? []) {
    if (!pe.objectId) continue;
    let kind: 'shape' | 'image' | 'table' | 'group' | undefined;
    if (pe.shape) kind = 'shape';
    else if (pe.image) kind = 'image';
    else if (pe.table) kind = 'table';
    else if (pe.elementGroup) kind = 'group';
    if (kind === undefined) continue;
    const tx = pe.transform?.translateX ?? 0;
    const ty = pe.transform?.translateY ?? 0;
    const w = pe.size?.width?.magnitude ?? 0;
    const h = pe.size?.height?.magnitude ?? 0;
    // Slides API EMUs → px at 9525 EMU/px (consistent with renderer-cdp's
    // production wire-up); the importer uses the same conversion. For test
    // fixtures we let callers provide pre-converted EMU; the magnitude here
    // is in EMU so dividing by 9525 yields px.
    const EMU_PER_PX = 9525;
    const centerPx = {
      x: (tx + w / 2) / EMU_PER_PX,
      y: (ty + h / 2) / EMU_PER_PX,
    };
    const entry: {
      objectId: string;
      kind: 'shape' | 'image' | 'table' | 'group';
      text?: string;
      centerPx: { x: number; y: number };
    } = { objectId: pe.objectId, kind, centerPx };
    const text = extractApiText(pe);
    if (text !== undefined) entry.text = text;
    out.push(entry);
  }
  return out;
}

function extractApiText(pe: PreferenceApiPageElement): string | undefined {
  const els = pe.shape?.text?.textElements;
  if (!els) return undefined;
  let buf = '';
  for (const t of els) {
    if (t.textRun?.content) buf += t.textRun.content;
  }
  return buf.length > 0 ? buf : undefined;
}
