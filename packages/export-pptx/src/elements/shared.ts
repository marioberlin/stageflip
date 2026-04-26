// packages/export-pptx/src/elements/shared.ts
// Common helpers for element emitters: pixel↔EMU conversion, transform →
// `<a:xfrm>`, `<a:srgbClr>` helpers, and the per-slide emit context.
//
// Pixel ↔ EMU mapping mirrors the import-pptx side: 914400 EMU = 1 inch =
// 96 px → 1 EMU = 1/9525 px → 1 px = 9525 EMU.

import type { LossFlag } from '@stageflip/loss-flags';
import type { Transform } from '@stageflip/schema';

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
 */
export interface SlideEmitContext {
  slideId: string;
  oocxmlPath: string;
  /** Pushes a media rel and returns its assigned `rId`. Idempotent on assetId. */
  registerImageRel(assetId: string, mediaPath: string): string;
  /** Sink for loss flags raised during element emission. */
  flags: LossFlag[];
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
