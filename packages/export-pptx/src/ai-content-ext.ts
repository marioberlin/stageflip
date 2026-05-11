// packages/export-pptx/src/ai-content-ext.ts
// T-441 — emit PPTX <p:extLst> entries carrying the AI content manifest.
//
// PPTX consumers walk `<p:extLst>` at file-load time per ISO/IEC 29500-1
// §15.1.1; unknown extension URIs are preserved on round-trip and
// ignored on render. The stageflip-namespaced URI lets compliance
// scanners + audit log writers extract the AI-content data without
// touching the visible slide rendering.

import type { AiPptxManifest, AiPptxManifestElement } from './provenance-walk.js';

/**
 * Stageflip-namespaced extension URI carried on the `<p:ext>` element.
 * Vendor extensions in PPTX follow the convention of a vendor URL plus
 * `/v<n>` for schema versioning; the `v1` suffix lets us evolve the
 * manifest shape without breaking older consumers.
 */
export const AI_CONTENT_EXT_URI = 'https://stageflip.dev/extensions/ai-content/v1';

/**
 * Serialize an `AiPptxManifest` into a `<p:extLst>` XML fragment ready
 * to splice into `<p:presentation>` immediately before
 * `</p:presentation>` (OOXML requires `<p:extLst>` at the end of the
 * presentation body content).
 *
 * Empty-input edge case: the function still emits the `<p:extLst>`
 * wrapper but with no `<sf:element>` rows. Upstream callers
 * (`exportPptx`) suppress the entire block when the walker returns
 * `undefined`, so an empty manifest reaching this function only
 * happens when the caller deliberately requests serialization (tests).
 */
export function emitAiContentExtension(manifest: AiPptxManifest): string {
  const rows = manifest.elements.map(emitElementRow).join('');
  const aiContent = `<sf:aiContent xmlns:sf="${AI_CONTENT_EXT_URI}">${rows}</sf:aiContent>`;
  return `<p:extLst><p:ext uri="${AI_CONTENT_EXT_URI}">${aiContent}</p:ext></p:extLst>`;
}

/**
 * Emit one `<sf:element ... />` row. Optional fields (`slideId`,
 * `cacheKey`, `prompt`) are omitted entirely when absent on the row —
 * downstream consumers distinguish "absent" from "empty string".
 */
function emitElementRow(row: AiPptxManifestElement): string {
  const attrs: string[] = [];
  attrs.push(`id="${escapeAttr(row.elementId)}"`);
  attrs.push(`provider="${escapeAttr(row.provider)}"`);
  attrs.push(`modality="${escapeAttr(row.modality)}"`);
  if (row.slideId !== undefined) attrs.push(`slideId="${escapeAttr(row.slideId)}"`);
  if (row.cacheKey !== undefined) attrs.push(`cacheKey="${escapeAttr(row.cacheKey)}"`);
  if (row.prompt !== undefined) attrs.push(`prompt="${escapeAttr(row.prompt)}"`);
  return `<sf:element ${attrs.join(' ')}/>`;
}

/**
 * Escape the four XML attribute-value special characters (`&`, `<`,
 * `>`, `"`). The order matters: `&` must be escaped first so we don't
 * double-escape the entities produced by the other three replacements.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
