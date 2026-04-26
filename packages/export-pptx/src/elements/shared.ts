// packages/export-pptx/src/elements/shared.ts
// Common helpers for element emitters: pixel↔EMU conversion, transform →
// `<a:xfrm>`, `<a:srgbClr>` helpers, and the per-slide emit context.
//
// Pixel ↔ EMU mapping mirrors the import-pptx side: 914400 EMU = 1 inch =
// 96 px → 1 EMU = 1/9525 px → 1 px = 9525 EMU.

import type { LossFlag } from '@stageflip/loss-flags';
import type { Element, SlideLayout, SlideMaster, Transform } from '@stageflip/schema';
import { emitLossFlag } from '../loss-flags.js';

/** Convert px to EMU (PPTX's native unit). Rounds to integer. */
export function pxToEmu(px: number): number {
  return Math.round(px * 9525);
}

/** Inverse of import-pptx's `emuToPx` for completeness. */
export function emuToPx(emu: number): number {
  return emu / 9525;
}

/** Convert a schema rotation (degrees) to OOXML `rot` (60000ths of a degree). */
export function rotationToOoxml(rotationDegrees: number): number {
  return Math.round(rotationDegrees * 60000);
}

/**
 * Per-slide emit context. Threads the slide id (for loss-flag location), the
 * slide's `oocxmlPath` (for loss-flag location), an asset rel allocator
 * (image emitters need to register media rels), and the loss-flag sink.
 *
 * T-253-rider extends the context with `layoutsById` / `mastersById` so
 * element emitters can resolve `inheritsFrom` references and emit
 * `<p:nvSpPr><p:nvPr><p:ph .../></p:nvPr></p:nvSpPr>` block. When the
 * dispatcher is running outside a slide context (e.g., emitting a placeholder
 * element inside a layout part), the maps are passed through but
 * `placeholderEmitMode = 'template'` so the resolver knows to skip the
 * `<p:ph>` reference (placeholders are already at template level).
 */
export interface SlideEmitContext {
  slideId: string;
  oocxmlPath: string;
  /** Pushes a media rel and returns its assigned `rId`. Idempotent on assetId. */
  registerImageRel(assetId: string, mediaPath: string): string;
  /** Sink for loss flags raised during element emission. */
  flags: LossFlag[];
  /** T-253-rider: deck-level layouts indexed by id, for inheritsFrom resolution. */
  layoutsById?: ReadonlyMap<string, SlideLayout>;
  /** T-253-rider: deck-level masters indexed by id. */
  mastersById?: ReadonlyMap<string, SlideMaster>;
  /**
   * T-253-rider: emit mode. `'slide'` (default) lets element emitters resolve
   * `inheritsFrom` and write a `<p:ph>` reference. `'template'` is used while
   * emitting layout / master placeholder parts and suppresses the `<p:ph>`
   * lookup (the element IS the placeholder, not a reference to one).
   */
  emitMode?: 'slide' | 'template';
}

/**
 * Outcome of resolving an element's `inheritsFrom` reference against the
 * deck's layouts + masters. T-253-rider — the element dispatcher uses this
 * to decide between emitting a `<p:ph>` reference (with optional override
 * suppression) and falling back to materialized geometry.
 *
 * - `kind: 'unresolved-layout'`: `templateId` doesn't match any layout or
 *   master. Caller emits `LF-PPTX-EXPORT-LAYOUT-NOT-FOUND` and falls back.
 * - `kind: 'unresolved-placeholder'`: `templateId` resolved but
 *   `placeholderIdx` doesn't match a placeholder on the layout (or
 *   transitively on its master). Caller emits
 *   `LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND` and falls back.
 * - `kind: 'resolved'`: clean resolution. `placeholder` is the resolved
 *   element; `phType` is the OOXML `<p:ph type="...">` discriminant chosen
 *   for the slide-side reference; `phIdx` is the original `placeholderIdx`.
 */
export type InheritsFromResolution =
  | { kind: 'unresolved-layout' }
  | { kind: 'unresolved-placeholder' }
  | { kind: 'resolved'; placeholder: Element; phType: string; phIdx: number };

/**
 * Resolve an element's `inheritsFrom` against the deck's layouts + masters,
 * mirroring T-251's `applyInheritance` walk:
 *   1. Match `templateId` against `layoutsById`.
 *   2. If matched, search the layout's `placeholders` by `placeholderIdx`.
 *   3. If unset on layout, transitively walk to the layout's master.
 *   4. `templateId` may also point directly at a master.
 *
 * T-253-rider AC #10 — transitive resolution: when the layout misses the
 * placeholderIdx but the master has it, the slide-side `<p:ph>` reference
 * still names the LAYOUT id (not the master). The runtime PPTX consumer
 * walks the chain itself.
 */
export function resolveInheritsFrom(
  inheritsFrom: { templateId: string; placeholderIdx: number },
  layoutsById: ReadonlyMap<string, SlideLayout>,
  mastersById: ReadonlyMap<string, SlideMaster>,
): InheritsFromResolution {
  const layout = layoutsById.get(inheritsFrom.templateId);
  if (layout) {
    const onLayout = layout.placeholders[inheritsFrom.placeholderIdx];
    if (onLayout) {
      return {
        kind: 'resolved',
        placeholder: onLayout,
        phType: ooxmlPlaceholderType(onLayout),
        phIdx: inheritsFrom.placeholderIdx,
      };
    }
    // Transitive walk to master.
    const master = mastersById.get(layout.masterId);
    if (master) {
      const onMaster = master.placeholders[inheritsFrom.placeholderIdx];
      if (onMaster) {
        return {
          kind: 'resolved',
          placeholder: onMaster,
          phType: ooxmlPlaceholderType(onMaster),
          phIdx: inheritsFrom.placeholderIdx,
        };
      }
    }
    return { kind: 'unresolved-placeholder' };
  }
  // Direct master reference.
  const master = mastersById.get(inheritsFrom.templateId);
  if (master) {
    const onMaster = master.placeholders[inheritsFrom.placeholderIdx];
    if (onMaster) {
      return {
        kind: 'resolved',
        placeholder: onMaster,
        phType: ooxmlPlaceholderType(onMaster),
        phIdx: inheritsFrom.placeholderIdx,
      };
    }
    return { kind: 'unresolved-placeholder' };
  }
  return { kind: 'unresolved-layout' };
}

/**
 * Pick the OOXML `<p:ph type="...">` enum value for a placeholder. The
 * canonical schema doesn't carry a `placeholderType` field today, so we
 * derive a reasonable default from the element type. The OOXML enum (ECMA-376
 * §19.7.10) includes: title, body, ctrTitle, subTitle, dt, ftr, hdr, obj,
 * chart, tbl, clipArt, dgm, media, sldImg, pic, sldNum.
 */
function ooxmlPlaceholderType(el: Element): string {
  switch (el.type) {
    case 'text':
      return 'body';
    case 'image':
      return 'pic';
    case 'shape':
    case 'group':
      return 'obj';
    case 'video':
    case 'audio':
      return 'media';
    case 'chart':
      return 'chart';
    case 'table':
      return 'tbl';
    default:
      return 'obj';
  }
}

/**
 * T-253-rider: render the `<p:nvPr>` body for a slide-side element. When the
 * element is in `slide` emit-mode AND has a resolved `inheritsFrom`, this
 * inserts the `<p:ph type="..." idx="..."/>` reference. Otherwise it returns
 * an empty `<p:nvPr/>` (base writer behavior).
 */
export function renderNvPr(resolution: InheritsFromResolution | null): string {
  if (resolution === null || resolution.kind !== 'resolved') {
    return '<p:nvPr/>';
  }
  return `<p:nvPr><p:ph type="${resolution.phType}" idx="${resolution.phIdx}"/></p:nvPr>`;
}

/**
 * T-253-rider — resolve and flag-emit `inheritsFrom` for a slide-side
 * element. Returns `null` when the element has no `inheritsFrom` OR when the
 * context isn't in slide-emit mode (so layout/master emitters skip the path).
 *
 * On unresolved-layout / unresolved-placeholder, emits the corresponding
 * loss flag and returns `null` (caller falls back to base behavior).
 */
export function resolveAndFlagInheritsFrom(
  el: Element,
  ctx: SlideEmitContext,
): InheritsFromResolution | null {
  const ifSpec = (el as { inheritsFrom?: { templateId: string; placeholderIdx: number } })
    .inheritsFrom;
  if (ifSpec === undefined) return null;
  if ((ctx.emitMode ?? 'slide') !== 'slide') return null;
  if (ctx.layoutsById === undefined || ctx.mastersById === undefined) return null;
  const r = resolveInheritsFrom(ifSpec, ctx.layoutsById, ctx.mastersById);
  if (r.kind === 'unresolved-layout') {
    ctx.flags.push(
      emitLossFlag({
        code: 'LF-PPTX-EXPORT-LAYOUT-NOT-FOUND',
        location: { slideId: ctx.slideId, elementId: el.id, oocxmlPath: ctx.oocxmlPath },
        message: `inheritsFrom.templateId "${ifSpec.templateId}" did not resolve to any layout or master; falling back to materialized geometry`,
        originalSnippet: ifSpec.templateId,
      }),
    );
    return null;
  }
  if (r.kind === 'unresolved-placeholder') {
    ctx.flags.push(
      emitLossFlag({
        code: 'LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND',
        location: { slideId: ctx.slideId, elementId: el.id, oocxmlPath: ctx.oocxmlPath },
        message: `inheritsFrom.placeholderIdx ${ifSpec.placeholderIdx} did not resolve on layout/master "${ifSpec.templateId}"; falling back to materialized geometry`,
        originalSnippet: `${ifSpec.templateId}#${ifSpec.placeholderIdx}`,
      }),
    );
    return null;
  }
  return r;
}

/** Render an `<a:xfrm>` block from a schema `Transform`. */
export function renderXfrm(t: Transform): string {
  const x = pxToEmu(t.x);
  const y = pxToEmu(t.y);
  const cx = Math.max(1, pxToEmu(t.width));
  const cy = Math.max(1, pxToEmu(t.height));
  const rotAttr = t.rotation === 0 ? '' : ` rot="${rotationToOoxml(t.rotation)}"`;
  return `<a:xfrm${rotAttr}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;
}

/**
 * Convert a schema color value (`#RGB` / `#RRGGBB` / `#RRGGBBAA` / theme ref)
 * to an `<a:srgbClr val="..."/>` literal. Theme refs are flattened to a
 * fallback hex (`000000`); the source-of-truth resolved color lives on the
 * element after `applyInheritance`.
 *
 * For now we drop the alpha channel — OOXML carries it as a child
 * `<a:alpha val="N"/>` of `<a:srgbClr>`; not yet supported by the importer
 * round-trip.
 */
export function emitSrgbClr(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!value.startsWith('#')) {
    // Theme ref — drop to a stable fallback. Resolved theme colors arrive
    // on each element directly post-applyInheritance.
    return '<a:srgbClr val="000000"/>';
  }
  const hex = value.slice(1).toUpperCase();
  let rrggbb = '000000';
  if (hex.length === 3) {
    rrggbb = hex
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (hex.length === 6) {
    rrggbb = hex;
  } else if (hex.length === 8) {
    rrggbb = hex.slice(0, 6);
  }
  return `<a:srgbClr val="${rrggbb}"/>`;
}
