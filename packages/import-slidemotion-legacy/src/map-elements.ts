// packages/import-slidemotion-legacy/src/map-elements.ts
// Per-type converters from a legacy Element to the canonical schema.

/**
 * The MVP covers five element kinds: `text`, `image`, `shape`, `group`, and
 * a passthrough for anything else (warn + drop). Phase 7 / T-131 extend the
 * coverage set; the signatures here are designed so new kinds slot in
 * without touching `map-slide.ts` or the top-level API.
 *
 * Each mapper returns either a canonical `Element` or `null` (dropped; a
 * warning was emitted). The orchestrator collapses nulls so the resulting
 * slide has a dense element array.
 */

import type { Element, TextElement } from '@stageflip/schema';
import type { LegacyElement } from './legacy-schema.js';
import { normalizeHexColor, toAssetRef } from './sanitize.js';
import type { WarningSink } from './warnings.js';

type Transform = Element['transform'];

function toTransform(frame: LegacyElement['frame']): Transform {
  return {
    x: frame.x,
    y: frame.y,
    width: frame.width > 0 ? frame.width : 1,
    height: frame.height > 0 ? frame.height : 1,
    rotation: frame.rotation ?? 0,
    opacity: 1,
  };
}

function baseFields(
  el: LegacyElement,
  id: string,
): {
  id: string;
  transform: Transform;
  visible: boolean;
  locked: boolean;
  animations: [];
  name?: string;
} {
  const base: {
    id: string;
    transform: Transform;
    visible: boolean;
    locked: boolean;
    animations: [];
    name?: string;
  } = {
    id,
    transform: toTransform(el.frame),
    visible: el.visible ?? true,
    locked: el.locked ?? false,
    animations: [],
  };
  if (typeof el.name === 'string' && el.name.length > 0) base.name = el.name;
  if (typeof el.opacity === 'number') base.transform.opacity = clamp01(el.opacity);
  return base;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Extract a plain-text string from the legacy `TextContent` shape. Legacy
 * `content.value` is either a `string` or `TextRun[]`. We concatenate runs
 * (ignoring inline styling — the canonical schema's `runs` surface is a
 * future-expand). If the structure is entirely missing we drop to empty
 * string so the element still renders (empty but present).
 */
function extractText(raw: unknown): string {
  if (raw === null || typeof raw !== 'object') return '';
  const content = raw as { value?: unknown };
  const value = content.value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((run) =>
        run !== null &&
        typeof run === 'object' &&
        typeof (run as { text?: unknown }).text === 'string'
          ? (run as { text: string }).text
          : '',
      )
      .join('');
  }
  return '';
}

export function mapTextElement(
  el: LegacyElement,
  id: string,
  path: string,
  sink: WarningSink,
): TextElement | null {
  const raw = el as unknown as {
    content?: unknown;
    style?: { color?: unknown; fontFamily?: unknown; fontSize?: unknown };
  };
  const text = extractText(raw.content);
  const result: TextElement = {
    ...baseFields(el, id),
    type: 'text',
    text,
    align: 'left',
  };
  const color = normalizeHexColor(raw.style?.color);
  if (color !== null) result.color = color;
  else if (raw.style?.color !== undefined) {
    sink.add(`${path}/style/color`, 'invalid-color', String(raw.style.color));
  }
  if (typeof raw.style?.fontFamily === 'string') result.fontFamily = raw.style.fontFamily;
  if (typeof raw.style?.fontSize === 'number' && raw.style.fontSize > 0) {
    result.fontSize = raw.style.fontSize;
  }
  return result;
}

export function mapImageElement(
  el: LegacyElement,
  id: string,
  path: string,
  sink: WarningSink,
): Element | null {
  const raw = el as unknown as { assetId?: unknown; fit?: unknown };
  if (typeof raw.assetId !== 'string') {
    sink.add(`${path}/assetId`, 'invalid-asset-reference', 'missing or non-string assetId');
    return null;
  }
  const src = toAssetRef(raw.assetId);
  if (src === null) {
    sink.add(`${path}/assetId`, 'invalid-asset-reference', raw.assetId);
    return null;
  }
  const legacyFit = raw.fit;
  const fit: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down' =
    legacyFit === 'cover' ||
    legacyFit === 'contain' ||
    legacyFit === 'fill' ||
    legacyFit === 'none' ||
    legacyFit === 'scale-down'
      ? legacyFit
      : legacyFit === 'stretch'
        ? 'fill'
        : 'cover';
  return {
    ...baseFields(el, id),
    type: 'image',
    src,
    fit,
  };
}

// Legacy shape kinds → canonical shape kinds. `circle` folds into `ellipse`
// (the element's transform width/height already encodes circularity when
// equal); `path` → `custom-path` (canonical carries the SVG d-string in `path`).
const SHAPE_KIND_MAP: Record<string, 'rect' | 'ellipse' | 'line' | 'polygon' | 'custom-path'> = {
  rectangle: 'rect',
  circle: 'ellipse',
  ellipse: 'ellipse',
  line: 'line',
  polygon: 'polygon',
  path: 'custom-path',
};

export function mapShapeElement(
  el: LegacyElement,
  id: string,
  path: string,
  sink: WarningSink,
): Element | null {
  const raw = el as unknown as {
    shape?: unknown;
    path?: unknown;
    style?: { fillColor?: unknown; strokeColor?: unknown; strokeWidth?: unknown };
  };
  const legacyKind = typeof raw.shape === 'string' ? raw.shape : 'rectangle';
  const shape = SHAPE_KIND_MAP[legacyKind];
  if (!shape) {
    sink.add(`${path}/shape`, 'unsupported-shape-kind', legacyKind);
    return null;
  }
  const result: Element = {
    ...baseFields(el, id),
    type: 'shape',
    shape,
  };
  if (shape === 'custom-path') {
    if (typeof raw.path !== 'string' || raw.path.length === 0) {
      sink.add(`${path}/path`, 'unsupported-shape-kind', 'custom-path missing d-string');
      return null;
    }
    result.path = raw.path;
  }
  const fill = normalizeHexColor(raw.style?.fillColor);
  if (fill !== null) result.fill = fill;
  else if (raw.style?.fillColor !== undefined) {
    sink.add(`${path}/style/fillColor`, 'invalid-color', String(raw.style.fillColor));
  }
  const strokeColor = normalizeHexColor(raw.style?.strokeColor);
  const strokeWidth = typeof raw.style?.strokeWidth === 'number' ? raw.style.strokeWidth : null;
  if (strokeColor !== null && strokeWidth !== null && strokeWidth >= 0) {
    result.stroke = {
      color: strokeColor,
      width: strokeWidth,
      linecap: 'butt',
      linejoin: 'miter',
    };
  }
  return result;
}

/**
 * `mapGroupElement` is recursive; it takes the top-level element mapper as
 * an argument so the two modules don't form a circular import. The
 * orchestrator passes `mapElement` in.
 */
export function mapGroupElement(
  el: LegacyElement,
  id: string,
  path: string,
  _sink: WarningSink,
  mapElement: (child: LegacyElement, childPath: string) => Element | null,
): Element | null {
  const raw = el as unknown as { children?: unknown };
  const rawChildren = Array.isArray(raw.children) ? (raw.children as LegacyElement[]) : [];
  const mapped: Element[] = [];
  rawChildren.forEach((child, i) => {
    const m = mapElement(child, `${path}/children/${i}`);
    if (m !== null) mapped.push(m);
  });
  return {
    ...baseFields(el, id),
    type: 'group',
    children: mapped,
    clip: false,
  };
}

/**
 * Top-level dispatcher. Unknown element types emit a warning and drop.
 */
export function mapElement(
  el: LegacyElement,
  id: string,
  path: string,
  sink: WarningSink,
  dispatchChild: (child: LegacyElement, childPath: string) => Element | null,
): Element | null {
  switch (el.type) {
    case 'text':
      return mapTextElement(el, id, path, sink);
    case 'image':
      return mapImageElement(el, id, path, sink);
    case 'shape':
      return mapShapeElement(el, id, path, sink);
    case 'group':
      return mapGroupElement(el, id, path, sink, dispatchChild);
    default:
      sink.add(`${path}/type`, 'unsupported-element-type', el.type);
      return null;
  }
}
