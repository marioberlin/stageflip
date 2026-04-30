// packages/runtimes/interactive/src/clips/live-data/static-fallback.ts
// `defaultLiveDataStaticFallback` — deterministic Element[] generator
// for the `family: 'live-data'` clip's `staticFallback` default per
// T-392 D-T392-2 + D-T392-3. When the harness routes to the static
// path AND the clip's authored `staticFallback` is empty, the harness
// substitutes the result of this function: a header TextElement
// summarising the cached snapshot's metadata (endpoint + status +
// capturedAt) plus a body TextElement carrying the JSON-pretty-
// printed body. When `cachedSnapshot` is absent, a single placeholder
// TextElement (empty text, `id` ending in `-placeholder`) is emitted.
//
// DETERMINISM (AC #5 / #14): byte-for-byte equality across calls is
// the architectural floor. The function uses ONLY:
//   - Pure string + integer arithmetic to derive transforms.
//   - `JSON.stringify(body, null, 2)` for the pretty-print (V8 /
//     SpiderMonkey / JSC implementations are spec-deterministic).
//   - `String.prototype.slice` for header / body truncation.
// No `Math.random`, no `Date.now`, no `performance.now`. Same posture
// as `defaultAiChatStaticFallback` (T-390 D-T390-3) and
// `defaultVoiceStaticFallback` (T-388 D-T388-3).
//
// PRIVACY (AC #13): the generator wrapper's telemetry attributes carry
// integer lengths only — `bodyByteLength`, plus a `hasSnapshot`
// boolean. The response body is NEVER attached to telemetry.
//
// Browser-safe AND Node-safe: pure string + integer arithmetic. No
// DOM, no canvas, no Node-only imports.

import type { Element, LiveDataCachedSnapshot, TextElement, Transform } from '@stageflip/schema';

import type { StaticFallbackGenerator } from '../../static-fallback-registry.js';

/**
 * Args to {@link defaultLiveDataStaticFallback}. Width / height +
 * endpoint are required; `cachedSnapshot` is optional (absent →
 * placeholder).
 */
export interface DefaultLiveDataStaticFallbackArgs {
  /** Bounding-box width (canvas px). */
  width: number;
  /** Bounding-box height (canvas px). */
  height: number;
  /** Endpoint URL the live mount would have fetched. Rendered in the header. */
  endpoint: string;
  /**
   * Pre-captured response snapshot. Absent → a single placeholder
   * TextElement (empty text) is emitted.
   */
  cachedSnapshot?: LiveDataCachedSnapshot;
}

/** Maximum header summary length (chars) — D-T392-2 documented cap. */
const HEADER_MAX_CHARS = 200;
/** Maximum body pretty-print length (chars) — D-T392-2 documented cap. */
const BODY_MAX_CHARS = 4000;
/** Truncation marker appended when text is sliced. */
const TRUNCATION_MARKER = '…';
/** Vertical padding (px) above the header band. */
const TOP_PADDING_PX = 8;
/** Vertical gap (px) between header and body. */
const ROW_GAP_PX = 4;
/** Horizontal padding (px) around every row. */
const HORIZONTAL_PADDING_PX = 8;
/** Fraction of the canvas height reserved for the header band. */
const HEADER_HEIGHT_FRACTION = 0.18;
/** Minimum row height (px) — floor for tiny canvases. */
const MIN_ROW_HEIGHT_PX = 12;

/**
 * Build the default `staticFallback` Element[] for a `family:
 * 'live-data'` clip. See file header for the determinism contract
 * (AC #5 + AC #14) and D-T392-2 for the layout shape.
 *
 * Returns an Element[] (typed at the TypeScript layer) — NOT round-
 * tripped through Zod. The harness's `renderStaticFallback` consumes
 * the array directly.
 */
export function defaultLiveDataStaticFallback(args: DefaultLiveDataStaticFallbackArgs): Element[] {
  const { width, height, endpoint } = args;
  const elements: Element[] = [];

  // 1. Absent / undefined snapshot → single placeholder TextElement.
  //    Mirrors T-390's empty-transcript placeholder semantics.
  if (args.cachedSnapshot === undefined) {
    const placeholderHeight = Math.max(
      MIN_ROW_HEIGHT_PX,
      Math.floor(height * HEADER_HEIGHT_FRACTION),
    );
    const placeholderTransform: Transform = {
      x: HORIZONTAL_PADDING_PX,
      y: TOP_PADDING_PX,
      width: Math.max(0, width - HORIZONTAL_PADDING_PX * 2),
      height: Math.min(placeholderHeight, Math.max(0, height - TOP_PADDING_PX)),
      rotation: 0,
      opacity: 1,
    };
    const placeholderElement: TextElement = {
      id: 'live-data-static-fallback-placeholder',
      transform: placeholderTransform,
      visible: true,
      locked: false,
      animations: [],
      type: 'text',
      text: '',
      align: 'left',
    };
    elements.push(placeholderElement);
    return elements;
  }

  const snapshot = args.cachedSnapshot;

  // 2. Header summary band — sized to a fraction of the canvas
  //    height; pinned by AC #11 to fit within (width, height).
  const headerHeight = Math.max(MIN_ROW_HEIGHT_PX, Math.floor(height * HEADER_HEIGHT_FRACTION));
  const headerTransform: Transform = {
    x: HORIZONTAL_PADDING_PX,
    y: TOP_PADDING_PX,
    width: Math.max(0, width - HORIZONTAL_PADDING_PX * 2),
    height: headerHeight,
    rotation: 0,
    opacity: 1,
  };
  const headerText = truncate(
    `${endpoint} · status ${snapshot.status} · captured ${snapshot.capturedAt}`,
    HEADER_MAX_CHARS,
  );
  const headerElement: TextElement = {
    id: 'live-data-static-fallback-header',
    transform: headerTransform,
    visible: true,
    locked: false,
    animations: [],
    type: 'text',
    text: headerText,
    align: 'left',
  };
  elements.push(headerElement);

  // 3. Body — pretty-printed JSON. Drop the body element when
  //    overflowing per AC #11 overflow-guard discipline (mirrors
  //    T-390 D-T390-2 / fix C-1).
  const bodyY = TOP_PADDING_PX + headerHeight + ROW_GAP_PX;
  if (bodyY >= height) return elements;
  const remaining = height - bodyY;
  const bodyHeight = Math.min(Math.max(MIN_ROW_HEIGHT_PX, remaining), remaining);
  const bodyText = truncate(safeStringify(snapshot.body), BODY_MAX_CHARS);
  const bodyTransform: Transform = {
    x: HORIZONTAL_PADDING_PX,
    y: bodyY,
    width: Math.max(0, width - HORIZONTAL_PADDING_PX * 2),
    height: bodyHeight,
    rotation: 0,
    opacity: 1,
  };
  const bodyElement: TextElement = {
    id: 'live-data-static-fallback-body',
    transform: bodyTransform,
    visible: true,
    locked: false,
    animations: [],
    type: 'text',
    text: bodyText,
    align: 'left',
  };
  elements.push(bodyElement);

  return elements;
}

/** Truncate a string to `max` chars with an ellipsis marker. Pure transformation. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`;
}

/**
 * `JSON.stringify(value, null, 2)` with a defensive try/catch — a
 * malformed snapshot.body could in principle be a circular structure
 * (the schema accepts `unknown`), in which case we fall back to a
 * sentinel rather than throw out of a deterministic generator.
 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '<unserializable>';
  }
}

/**
 * `StaticFallbackGenerator` wrapper for `family: 'live-data'` per
 * T-388a D-T388a-2 / T-392 D-T392-5. Reads `endpoint` and
 * `cachedSnapshot` from `clip.liveMount.props`, calls
 * `defaultLiveDataStaticFallback` with the clip's transform-derived
 * dimensions, and emits the `live-data-clip.static-fallback.rendered`
 * telemetry event with the documented attribute shape (AC #13).
 *
 * Privacy posture (D-T392-4 + AC #13): telemetry attributes are
 * `hasSnapshot` boolean + `bodyByteLength` integer only. The response
 * body is NEVER attached to telemetry. Same posture as T-390
 * D-T390-4 / T-391 D-T391-8.
 *
 * Exported so `clips/live-data/index.ts` (the production side-effect
 * registration site) and tests share the same wrapper — no drift
 * between the registered behaviour and what tests assert against.
 */
export const liveDataStaticFallbackGenerator: StaticFallbackGenerator = ({
  clip,
  reason,
  emitTelemetry,
}) => {
  const props = (clip.liveMount.props ?? {}) as {
    endpoint?: unknown;
    cachedSnapshot?: unknown;
  };
  const endpoint = typeof props.endpoint === 'string' ? props.endpoint : '';
  const cachedSnapshot = readCachedSnapshot(props.cachedSnapshot);

  const generated = defaultLiveDataStaticFallback({
    width: clip.transform.width,
    height: clip.transform.height,
    endpoint,
    ...(cachedSnapshot !== undefined ? { cachedSnapshot } : {}),
  });

  const bodyByteLength = cachedSnapshot ? safeStringify(cachedSnapshot.body).length : 0;

  emitTelemetry('live-data-clip.static-fallback.rendered', {
    family: clip.family,
    reason,
    width: clip.transform.width,
    height: clip.transform.height,
    // Privacy posture (D-T392-4 + AC #13): boolean + integer length only.
    hasSnapshot: cachedSnapshot !== undefined,
    bodyByteLength,
  });

  return generated;
};

/**
 * Defensive narrowing — the generator runs against
 * `clip.liveMount.props` whose shape has been validated at clip-
 * creation time, but we still re-read defensively because in-test
 * fixtures may supply ad-hoc props (and a leaked telemetry attribute
 * from a malformed payload would be a regression). Returns
 * `undefined` for any non-object, missing, or malformed value.
 */
function readCachedSnapshot(raw: unknown): LiveDataCachedSnapshot | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.capturedAt !== 'string' || r.capturedAt.length === 0) return undefined;
  if (typeof r.status !== 'number' || !Number.isInteger(r.status)) return undefined;
  return { capturedAt: r.capturedAt, status: r.status, body: r.body };
}
