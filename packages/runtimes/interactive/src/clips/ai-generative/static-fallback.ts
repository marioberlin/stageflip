// packages/runtimes/interactive/src/clips/ai-generative/static-fallback.ts
// `defaultAiGenerativeStaticFallback` — deterministic Element[]
// generator for the `family: 'ai-generative'` clip's `staticFallback`
// default per T-396 D-T396-2 + D-T396-3. When the harness routes to
// the static path AND the clip's authored `staticFallback` is empty,
// the harness substitutes the result of this function: a single
// `ImageElement` filling the canvas with `src = curatedExample.src`
// (a data: URL baked at authoring time). When `curatedExample` is
// absent, a single placeholder TextElement (empty text, `id` ending
// in `-placeholder`) is emitted instead.
//
// DETERMINISM (AC #6 / #14): byte-for-byte equality across calls is
// the architectural floor. The function uses ONLY:
//   - Pure object construction with verbatim pass-through of the
//     example URL.
// No `Math.random`, no `Date.now`, no `performance.now`, no fetch.
// Same posture as `defaultAiChatStaticFallback` (T-390),
// `defaultLiveDataStaticFallback` (T-392), `defaultVoiceStaticFallback`
// (T-388), and `defaultWebEmbedStaticFallback` (T-394).
//
// PRIVACY (AC #11): the generator wrapper's telemetry attributes
// carry an integer length only — `exampleSrcLength`, plus a
// `hasExample` boolean. The example URL string itself is NEVER
// attached (a 50KB inline data URL would balloon every telemetry
// event).
//
// Browser-safe AND Node-safe: pure object construction. No DOM, no
// canvas, no Node-only imports. The src cast `as ImageElement['src']`
// follows the same posture as `defaultVoiceStaticFallback` (T-388)
// and `defaultWebEmbedStaticFallback` (T-394) — the schema-level
// `AssetRef` regex is bypassed because the data URL is the
// authoring-time bake, not a storage-resolved asset reference.

import type {
  AiGenerativeCuratedExample,
  Element,
  ImageElement,
  TextElement,
  Transform,
} from '@stageflip/schema';

import type { StaticFallbackGenerator } from '../../static-fallback-registry.js';

/**
 * Args to {@link defaultAiGenerativeStaticFallback}. Width / height
 * are required; `curatedExample` is optional (absent →
 * placeholder).
 */
export interface DefaultAiGenerativeStaticFallbackArgs {
  /** Bounding-box width (canvas px). */
  width: number;
  /** Bounding-box height (canvas px). */
  height: number;
  /**
   * Pre-captured curated example. Absent → a single placeholder
   * TextElement (empty text) is emitted.
   */
  curatedExample?: AiGenerativeCuratedExample;
}

/**
 * Build the default `staticFallback` Element[] for a `family:
 * 'ai-generative'` clip. See file header for the determinism contract
 * (AC #6 + AC #14) and D-T396-2 for the layout shape.
 *
 * Returns an Element[] (typed at the TypeScript layer) — NOT round-
 * tripped through Zod. The harness's `renderStaticFallback` consumes
 * the array directly.
 */
export function defaultAiGenerativeStaticFallback(
  args: DefaultAiGenerativeStaticFallbackArgs,
): Element[] {
  const { width, height } = args;

  // Absent / undefined curatedExample → single placeholder
  // TextElement. Mirrors T-390 / T-392 / T-394 placeholder semantics.
  if (args.curatedExample === undefined) {
    const placeholderTransform: Transform = {
      x: 0,
      y: 0,
      width,
      height,
      rotation: 0,
      opacity: 1,
    };
    const placeholderElement: TextElement = {
      id: 'ai-generative-static-fallback-placeholder',
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

  // Present curatedExample → single ImageElement filling the
  // canvas. Layout is trivial (D-T396-2) — there is only one
  // element either way; no vertical-stacking discipline like
  // T-390 / T-392.
  const imageTransform: Transform = {
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    opacity: 1,
  };
  const imageElement: ImageElement = {
    id: 'ai-generative-static-fallback-example',
    transform: imageTransform,
    visible: true,
    locked: false,
    animations: [],
    type: 'image',
    // The schema-level `AssetRef` regex (`^asset:<id>$`) does not
    // accept data: URLs; the cast bypasses it because the data URL
    // is the authoring-time bake, not a storage-resolved asset
    // reference. Same posture as defaultVoiceStaticFallback (T-388)
    // and defaultWebEmbedStaticFallback (T-394).
    src: args.curatedExample.src as ImageElement['src'],
    fit: 'cover',
  };
  return [imageElement];
}

/**
 * `StaticFallbackGenerator` wrapper for `family: 'ai-generative'`
 * per T-388a D-T388a-2 / T-396 D-T396-5. Reads `curatedExample`
 * from `clip.liveMount.props`, calls
 * `defaultAiGenerativeStaticFallback` with the clip's transform-
 * derived dimensions, and emits the
 * `ai-generative-clip.static-fallback.rendered` telemetry event
 * with the documented attribute shape (AC #11).
 *
 * Privacy posture (D-T396-4 + AC #11): telemetry attributes are
 * `hasExample` boolean + `exampleSrcLength` integer only. The
 * example URL string is NEVER attached. Same posture as T-390
 * D-T390-4 / T-392 D-T392-4 / T-393 D-T393-8 / T-394 D-T394-4.
 *
 * Exported so `clips/ai-generative/index.ts` (the production side-
 * effect registration site) and tests share the same wrapper — no
 * drift between the registered behaviour and what tests assert
 * against.
 */
export const aiGenerativeStaticFallbackGenerator: StaticFallbackGenerator = ({
  clip,
  reason,
  emitTelemetry,
}) => {
  const props = (clip.liveMount.props ?? {}) as { curatedExample?: unknown };
  const curatedExample = readCuratedExample(props.curatedExample);

  const generated = defaultAiGenerativeStaticFallback({
    width: clip.transform.width,
    height: clip.transform.height,
    ...(curatedExample !== undefined ? { curatedExample } : {}),
  });

  emitTelemetry('ai-generative-clip.static-fallback.rendered', {
    family: clip.family,
    reason,
    width: clip.transform.width,
    height: clip.transform.height,
    // Privacy posture (D-T396-4 + AC #11): boolean + integer length only.
    hasExample: curatedExample !== undefined,
    exampleSrcLength: curatedExample?.src.length ?? 0,
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
function readCuratedExample(raw: unknown): AiGenerativeCuratedExample | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.src !== 'string' || r.src.length === 0) return undefined;
  const result: AiGenerativeCuratedExample = { src: r.src };
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
