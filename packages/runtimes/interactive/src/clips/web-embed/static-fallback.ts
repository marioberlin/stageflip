// packages/runtimes/interactive/src/clips/web-embed/static-fallback.ts
// `defaultWebEmbedStaticFallback` — deterministic Element[] generator
// for the `family: 'web-embed'` clip's `staticFallback` default per
// T-394 D-T394-2 + D-T394-3. When the harness routes to the static
// path AND the clip's authored `staticFallback` is empty, the harness
// substitutes the result of this function: a single `ImageElement`
// filling the canvas with `src = posterImage.src` (a data: URL baked
// at authoring time). When `posterImage` is absent, a single
// placeholder TextElement (empty text, `id` ending in `-placeholder`)
// is emitted instead.
//
// DETERMINISM (AC #6 / #14): byte-for-byte equality across calls is
// the architectural floor. The function uses ONLY:
//   - Pure object construction with verbatim pass-through of the
//     poster URL.
// No `Math.random`, no `Date.now`, no `performance.now`, no fetch.
// Same posture as `defaultAiChatStaticFallback` (T-390 D-T390-3),
// `defaultLiveDataStaticFallback` (T-392 D-T392-3), and
// `defaultVoiceStaticFallback` (T-388 D-T388-3).
//
// PRIVACY (AC #11): the generator wrapper's telemetry attributes
// carry an integer length only — `posterSrcLength`, plus a `hasPoster`
// boolean. The poster URL string itself is NEVER attached (a 50KB
// inline data URL would balloon every telemetry event).
//
// Browser-safe AND Node-safe: pure object construction. No DOM, no
// canvas, no Node-only imports. The src cast `as ImageElement['src']`
// follows the same posture as `defaultVoiceStaticFallback` — the
// schema-level `AssetRef` regex is bypassed because the data URL is
// the authoring-time bake, not a storage-resolved asset reference.

import type {
  Element,
  ImageElement,
  TextElement,
  Transform,
  WebEmbedPosterImage,
} from '@stageflip/schema';

import type { StaticFallbackGenerator } from '../../static-fallback-registry.js';

/**
 * Args to {@link defaultWebEmbedStaticFallback}. Width / height are
 * required; `posterImage` is optional (absent → placeholder).
 */
export interface DefaultWebEmbedStaticFallbackArgs {
  /** Bounding-box width (canvas px). */
  width: number;
  /** Bounding-box height (canvas px). */
  height: number;
  /**
   * Pre-captured poster image. Absent → a single placeholder
   * TextElement (empty text) is emitted.
   */
  posterImage?: WebEmbedPosterImage;
}

/**
 * Build the default `staticFallback` Element[] for a `family:
 * 'web-embed'` clip. See file header for the determinism contract
 * (AC #6 + AC #14) and D-T394-2 for the layout shape.
 *
 * Returns an Element[] (typed at the TypeScript layer) — NOT round-
 * tripped through Zod. The harness's `renderStaticFallback` consumes
 * the array directly.
 */
export function defaultWebEmbedStaticFallback(args: DefaultWebEmbedStaticFallbackArgs): Element[] {
  const { width, height } = args;

  // Absent / undefined posterImage → single placeholder TextElement.
  // Mirrors T-390 / T-392 placeholder semantics.
  if (args.posterImage === undefined) {
    const placeholderTransform: Transform = {
      x: 0,
      y: 0,
      width,
      height,
      rotation: 0,
      opacity: 1,
    };
    const placeholderElement: TextElement = {
      id: 'web-embed-static-fallback-placeholder',
      transform: placeholderTransform,
      visible: true,
      locked: false,
      animations: [],
      type: 'text',
      text: '',
      align: 'left',
    };
    return [placeholderElement];
  }

  // Present posterImage → single ImageElement filling the canvas.
  // Layout is trivial (D-T394-2) — there is only one element either
  // way; no vertical-stacking discipline like T-390 / T-392.
  const imageTransform: Transform = {
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    opacity: 1,
  };
  const imageElement: ImageElement = {
    id: 'web-embed-static-fallback-poster',
    transform: imageTransform,
    visible: true,
    locked: false,
    animations: [],
    type: 'image',
    // The schema-level `AssetRef` regex (`^asset:<id>$`) does not
    // accept data: URLs; the cast bypasses it because the data URL is
    // the authoring-time bake, not a storage-resolved asset reference.
    // Same posture as `defaultVoiceStaticFallback` (T-388).
    src: args.posterImage.src as ImageElement['src'],
    fit: 'cover',
  };
  return [imageElement];
}

/**
 * `StaticFallbackGenerator` wrapper for `family: 'web-embed'` per
 * T-388a D-T388a-2 / T-394 D-T394-5. Reads `posterImage` from
 * `clip.liveMount.props`, calls `defaultWebEmbedStaticFallback` with
 * the clip's transform-derived dimensions, and emits the
 * `web-embed-clip.static-fallback.rendered` telemetry event with the
 * documented attribute shape (AC #11).
 *
 * Privacy posture (D-T394-4 + AC #11): telemetry attributes are
 * `hasPoster` boolean + `posterSrcLength` integer only. The poster
 * URL string is NEVER attached. Same posture as T-390 D-T390-4 /
 * T-392 D-T392-4 / T-393 D-T393-8.
 *
 * Exported so `clips/web-embed/index.ts` (the production side-effect
 * registration site) and tests share the same wrapper — no drift
 * between the registered behaviour and what tests assert against.
 */
export const webEmbedStaticFallbackGenerator: StaticFallbackGenerator = ({
  clip,
  reason,
  emitTelemetry,
}) => {
  const props = (clip.liveMount.props ?? {}) as { posterImage?: unknown };
  const posterImage = readPosterImage(props.posterImage);

  const generated = defaultWebEmbedStaticFallback({
    width: clip.transform.width,
    height: clip.transform.height,
    ...(posterImage !== undefined ? { posterImage } : {}),
  });

  emitTelemetry('web-embed-clip.static-fallback.rendered', {
    family: clip.family,
    reason,
    width: clip.transform.width,
    height: clip.transform.height,
    // Privacy posture (D-T394-4 + AC #11): boolean + integer length only.
    hasPoster: posterImage !== undefined,
    posterSrcLength: posterImage?.src.length ?? 0,
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
function readPosterImage(raw: unknown): WebEmbedPosterImage | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.src !== 'string' || r.src.length === 0) return undefined;
  const result: WebEmbedPosterImage = { src: r.src };
  if (
    typeof r.contentType === 'string' &&
    (r.contentType === 'image/png' ||
      r.contentType === 'image/jpeg' ||
      r.contentType === 'image/webp')
  ) {
    result.contentType = r.contentType;
  }
  return result;
}
