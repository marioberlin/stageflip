// packages/import-hyperframes-html/src/elements/shared.ts
// Shared element-emission helpers. Pulls inline-style declarations off a
// parse5 element, decodes them through `parseInlineStyle` + `parseTransform`,
// and assembles the canonical schema-shaped `transform` per T-247 AC #19/#20:
//
// - Center-anchor CSS (`translate(-50%, -50%)`) converts to top-left math
//   (the schema's `transformSchema` has only `{x, y, width, height, rotation,
//   opacity}` — NO `anchor` field).
// - Non-identity scale on a static element is treated as a GSAP initial
//   state and dropped (the importer emits an animations-dropped flag).
// - Rotation flows to `transform.rotation` (the only sub-property the
//   schema models).
// - `style="opacity: 0"` is normalized to 1 when GSAP context is present
//   (animations-dropped flag emitted by the caller).

import type { Transform } from '@stageflip/schema';
import { getAttr } from '../dom/attrs.js';
import {
  type ParsedTransform,
  parseInlineStyle,
  parsePxLength,
  parseTransform,
} from '../dom/inline-style.js';
import type { Element } from '../dom/walk.js';

/** Output of `extractTransform` plus annotations the caller acts on. */
export interface ExtractedTransform {
  /** Canonical schema-shaped transform. */
  transform: Transform;
  /** True if `transform: scale(N)` with N != 1 was observed and dropped. */
  scaleDropped: boolean;
  /** True if `opacity: 0` with sibling GSAP context was normalized to 1. */
  opacityNormalized: boolean;
  /** True if width/height were absent and inferred from a fallback. */
  dimensionsInferred: boolean;
  /** Raw inline-style record (unconsumed properties retained). */
  rawStyle: Record<string, string>;
  /** Parsed transform shorthand, for diagnostics. */
  parsedTransform: ParsedTransform;
}

/**
 * Extract a canonical `Transform` from a parse5 element's inline `style`
 * attribute. `gsapContext` true marks compositions whose `<script>` block
 * contains a GSAP timeline — under that condition `opacity: 0` is treated as
 * a GSAP initial state and normalized to 1.
 *
 * `fallbackWidth` / `fallbackHeight` are used when the element has no inline
 * `width` / `height` declaration — typically the composition's master-root
 * dimensions for top-level elements. The caller supplies them so the
 * inference policy stays at the element level.
 */
export function extractTransform(
  el: Element,
  opts: {
    gsapContext: boolean;
    fallbackWidth: number;
    fallbackHeight: number;
  },
): ExtractedTransform {
  const styleAttr = getAttr(el, 'style') ?? '';
  const raw = parseInlineStyle(styleAttr);
  const parsed = parseTransform(raw.transform);

  const left = parsePxLength(raw.left);
  const top = parsePxLength(raw.top);
  const width = parsePxLength(raw.width);
  const height = parsePxLength(raw.height);

  let dimensionsInferred = false;
  let resolvedWidth: number;
  let resolvedHeight: number;
  if (width === undefined) {
    resolvedWidth = opts.fallbackWidth;
    dimensionsInferred = true;
  } else {
    resolvedWidth = width;
  }
  if (height === undefined) {
    resolvedHeight = opts.fallbackHeight;
    dimensionsInferred = true;
  } else {
    resolvedHeight = height;
  }

  let resolvedX = left ?? 0;
  let resolvedY = top ?? 0;
  if (parsed.centerAnchor) {
    resolvedX = (left ?? 0) - resolvedWidth / 2;
    resolvedY = (top ?? 0) - resolvedHeight / 2;
  } else if (parsed.translateX !== undefined && parsed.translateY !== undefined) {
    resolvedX = (left ?? 0) + parsed.translateX;
    resolvedY = (top ?? 0) + parsed.translateY;
  }

  // Opacity: if the element has `opacity: 0` and we're inside a GSAP-bearing
  // composition, normalize to 1 (the 0 was a GSAP starting state). Otherwise
  // honor the literal value when present.
  let opacity = 1;
  let opacityNormalized = false;
  const opRaw = raw.opacity;
  if (opRaw !== undefined) {
    const opNum = Number(opRaw);
    if (Number.isFinite(opNum)) {
      if (opNum === 0 && opts.gsapContext) {
        opacity = 1;
        opacityNormalized = true;
      } else if (opNum >= 0 && opNum <= 1) {
        opacity = opNum;
      }
    }
  }

  // Scale: any non-identity scale on a static element is a dropped animation
  // initial state. The width/height we already resolved above stay absolute.
  const scaleDropped = parsed.scale !== undefined && parsed.scale !== 1;

  // Defensive: schema requires positive width/height. If both inputs and
  // fallbacks are zero (degenerate input), use 1px to keep schema validation
  // alive — the loss flag for inferred dimensions is the user-visible signal.
  if (resolvedWidth <= 0) resolvedWidth = 1;
  if (resolvedHeight <= 0) resolvedHeight = 1;

  const transform: Transform = {
    x: resolvedX,
    y: resolvedY,
    width: resolvedWidth,
    height: resolvedHeight,
    rotation: parsed.rotation ?? 0,
    opacity,
  };

  return {
    transform,
    scaleDropped,
    opacityNormalized,
    dimensionsInferred,
    rawStyle: raw,
    parsedTransform: parsed,
  };
}

/**
 * True iff the element carries a non-empty `class` attribute that hints at
 * styling not derivable from inline style declarations. T-247 v1 emits
 * `LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST` per such element. Empty `class`
 * attributes (e.g. `class=""`) and missing attributes both return false.
 */
export function hasClassStyleLoss(el: Element): boolean {
  const cls = getAttr(el, 'class');
  if (cls === undefined) return false;
  const trimmed = cls.trim();
  if (trimmed.length === 0) return false;
  // No inline-style props that would override the class? Then the class
  // styling is lost. T-247 §"Out of scope" #1 deliberately keeps this
  // conservative: the v1 heuristic emits one flag per styled element rather
  // than diffing against a CSS engine.
  const styleAttr = getAttr(el, 'style');
  if (styleAttr === undefined || styleAttr.trim().length === 0) return true;
  const props = parseInlineStyle(styleAttr);
  // If no font / color / weight / background props are inline, treat as lost.
  // Position-only inline styles don't override class typography.
  for (const k of Object.keys(props)) {
    if (
      k === 'font-size' ||
      k === 'color' ||
      k === 'font-weight' ||
      k === 'font-family' ||
      k === 'background-color'
    ) {
      return false;
    }
  }
  return true;
}

/** True iff `<script>` source contains a GSAP timeline marker. */
export function hasGsapTimeline(scriptText: string): boolean {
  return /gsap\s*\.\s*timeline\s*\(/.test(scriptText);
}
