// scripts/check-preset-integrity.ts
// CI gate (CLAUDE.md §3, ADR-004 §D6) for the seven preset-integrity invariants.
// Consumes T-304's loader (`@stageflip/schema/presets/node`) and T-307's
// `parseFontLicenseExpression` to enforce, on every push:
//
//   1. Every preset has valid frontmatter.
//   2. Every preset's `clipKind` exists in the clip registry (script-internal set).
//   3. Every preset referencing a bespoke font has `fallbackFont` populated.
//   4. Every preset with an interactive-family clipKind has non-empty `staticFallback`.
//   5. Every preset in clusters A/B/D/F/G has `signOff.typeDesign` populated.
//   6. Every preset has `signOff.parityFixture` populated (warning until cluster merge).
//   7. Every preset's `source` resolves to a real anchor in the compass file.
//
// Aggregates violations: a single run reports every error across every preset,
// matching the T-304 loader's aggregating posture. Mirrors the script style of
// `check-licenses.ts` and `check-determinism.ts` (per-check progress lines +
// final PASS/FAIL).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import { PNG } from 'pngjs';

import { aiChatClipPropsSchema } from '../packages/schema/src/clips/interactive/ai-chat-props.js';
import { aiGenerativeClipPropsSchema } from '../packages/schema/src/clips/interactive/ai-generative-props.js';
import { liveDataClipPropsSchema } from '../packages/schema/src/clips/interactive/live-data-props.js';
import { shaderClipPropsSchema } from '../packages/schema/src/clips/interactive/shader-props.js';
import { webEmbedClipPropsSchema } from '../packages/schema/src/clips/interactive/web-embed-props.js';
import { threeSceneClipPropsSchema } from '../packages/schema/src/clips/interactive/three-scene-props.js';
import { voiceClipPropsSchema } from '../packages/schema/src/clips/interactive/voice-props.js';
import { PresetRegistryLoadError } from '../packages/schema/src/presets/errors.js';
import { parseFontLicenseExpression } from '../packages/schema/src/presets/font-license.js';
import {
  type Preset,
  loadAllPresets,
  resetLoaderCache,
} from '../packages/schema/src/presets/loader.js';

// ---------- script-level constants ----------

const PRESETS_ROOT_DEFAULT = 'skills/stageflip/presets';
const COMPASS_PATH_DEFAULT = 'docs/compass.md';

/**
 * Root directory holding signed parity goldens — `parity-fixtures/<cluster>/<preset-id>/golden-frame-*.png`.
 * Resolved relative to the workspace root unless overridden via {@link RunOpts.parityFixturesRoot}.
 * T-348b D-T348b-1: only `signed:*` presets are scanned; `pending-user-review`
 * + `na` are skipped.
 */
const PARITY_FIXTURES_ROOT_DEFAULT = 'parity-fixtures';

/**
 * T-348b non-blank invariant — two-stage detection (D-T348b-2).
 *
 * Quantize each pixel into a 5-bit-per-channel color bucket (32^3 = 32_768
 * cells total). Scan every pixel (no stride) so tiny elements reliably
 * contribute pixels to non-background buckets.
 *
 * Fire ONLY when BOTH:
 *   1. fewer than {@link NON_BLANK_MIN_SIGNIFICANT_BUCKETS} significant
 *      buckets (i.e. only 1 bucket holds at least
 *      {@link NON_BLANK_SIGNIFICANT_BUCKET_FRACTION} of pixels), AND
 *   2. the dominant-bucket fraction exceeds
 *      {@link NON_BLANK_BLANK_DOMINANCE_THRESHOLD} (i.e. essentially the
 *      ENTIRE image is the dominant color — anti-aliasing fringe accounts
 *      for less than 0.05 % of pixels).
 *
 * **Why two criteria**: small-element-on-flat-canvas presets sit between
 * legitimate and blank in the most-obvious metrics:
 *   - `coinbase-dvd-qr` (small QR on solid black) → 2 significant buckets
 *     (background + QR white); clears stage 1 immediately.
 *   - `tiktok-follow-pulse` (faded pulse circle on white at frame 30) →
 *     1 significant bucket (the pulse is anti-aliased across ~28 colors,
 *     none individually clearing 0.05 %), 99.94 % dominance — clears
 *     stage 2 because dominance < 99.95 % indicates ~0.06 % of pixels
 *     ARE non-modal real content.
 *   - Cluster D regression goldens (5 affected) → 1 significant bucket,
 *     ≥ 99.99 % dominance (essentially the whole image was the modal
 *     tint, with only stray fringe pixels). FAIL on both criteria.
 *
 * The 0.05 % gap between `NON_BLANK_BLANK_DOMINANCE_THRESHOLD` (99.95 %)
 * and `NON_BLANK_SIGNIFICANT_BUCKET_FRACTION` (0.05 %) is intentional:
 * a golden that has > 0.05 % non-modal pixels EITHER concentrates them
 * in one bucket (clears stage 1) OR spreads them across many micro-fringe
 * buckets (the dominance is < 99.95 %, clearing stage 2).
 */
export const NON_BLANK_QUANTIZE_BITS = 5;
/**
 * A bucket counts as "significant" when it holds at least this fraction of
 * total pixels. 0.0005 = 0.05 % = ~1_037 pixels on a 1080p canvas — small
 * enough to credit ~32x32-px legitimate elements, large enough to reject
 * anti-aliased fringe noise around an otherwise-uniform image.
 */
export const NON_BLANK_SIGNIFICANT_BUCKET_FRACTION = 0.0005;
/** Minimum number of significant buckets required to skip the dominance check. */
export const NON_BLANK_MIN_SIGNIFICANT_BUCKETS = 2;
/**
 * Single-bucket dominance threshold used as the second-stage criterion when
 * `significantBuckets < 2`. 0.9995 = 99.95 % — passes
 * `tiktok-follow-pulse` (99.94 % dominance, 1 sig bucket) while still
 * catching pure-blank / near-pure-blank goldens (≥ 99.99 % dominance, 1
 * sig bucket). Tightening below 99.95 % would risk false positives on
 * legitimate small-element-on-flat-canvas presets at frame boundaries.
 */
export const NON_BLANK_BLANK_DOMINANCE_THRESHOLD = 0.9995;

/**
 * The set of valid `clipKind` strings a preset may declare. Per ADR-004 §D6
 * invariant 2, this is the "clip registry" the gate enforces. New clip kinds
 * (or a new interactive-family addition) update this set + INTERACTIVE_CLIP_KINDS.
 *
 * The list is a script-internal contract — if a stub uses a kind outside this
 * set, the gate fails. Per T-308 §D-T308-5 the spec call is "ship hardcoded".
 */
export const VALID_CLIP_KINDS = new Set<string>([
  // Cluster A — news
  'lowerThird',
  'breakingBanner',
  // Cluster B — sports
  'scoreBug',
  'newsTicker',
  'standings',
  // Cluster C — weather
  'weatherMap',
  'stormTracker',
  // Cluster D — titles
  'titleSequence',
  'grain', // T-321a — atmospheric effect carve-out (film-grain noise overlay)
  'photographicOverlay', // T-321d — film-grade tonal overlay carve-out (sepia / cross-process / cinematic-lut / fade)
  // Cluster E — data
  'bigNumber',
  'fullScreen',
  // Cluster F — captions
  'caption',
  'lyrics',
  // Cluster G — CTAs
  'socialMedia',
  'subscribeButton',
  'followPrompt',
  'qrCodeBounce',
  // Cluster H — AR
  'arOverlay',
  // Interactive family (frontier — clipKind references the family per ADR-005).
  'shader',
  'three-scene',
  'voice',
  'ai-chat',
  'live-data',
  'web-embed',
  'ai-generative',
  'webgl',
  // Generic element kinds — not a preset target today, but reserved.
  'text',
  'image',
  'shape',
  'group',
  'table',
  'blender-clip',
  'interactive-clip',
]);

/**
 * Subset of {@link VALID_CLIP_KINDS} that are "interactive" per ADR-003 D2.
 * Invariant 4 applies only to these. New entries must also live in
 * VALID_CLIP_KINDS.
 */
export const INTERACTIVE_CLIP_KINDS = new Set<string>([
  'shader',
  'three-scene',
  'voice',
  'ai-chat',
  'live-data',
  'web-embed',
  'ai-generative',
  'webgl',
  'interactive-clip',
]);

/**
 * Clusters A/B/D/F/G — per ADR-004 D4, the type-design-consultant batch
 * sign-off applies only to these. Clusters C (weather), E (data), H (AR) are
 * exempt because they don't carry bespoke broadcaster fonts at the cluster level.
 */
const TYPE_DESIGN_REQUIRED_CLUSTERS = new Set<string>([
  'news',
  'sports',
  'titles',
  'captions',
  'ctas',
]);

/**
 * Bespoke license atoms — invariant 3 fires when a preset's preferredFont uses
 * any of these and has no `fallbackFont`. Per T-308 D-T308-3.
 */
const BESPOKE_LICENSE_ATOMS = new Set(['proprietary-byo', 'commercial-byo']);

// ---------- types ----------

export type CheckResult =
  | { ok: true }
  | { ok: false; message: string }
  | { ok: false; severity: 'warning'; message: string };

export interface CompassAnchors {
  filePath: string;
  anchors: Set<string>;
}

interface InvariantBucket {
  errors: Array<{ presetId: string; filePath: string; message: string }>;
  warnings: Array<{ presetId: string; filePath: string; message: string }>;
}

const INVARIANT_KEYS = [
  'frontmatter',
  'clipKind',
  'bespoke-fallback',
  'interactive-staticFallback',
  'shader-props',
  'three-scene-props',
  'voice-props',
  'ai-chat-props',
  'live-data-props',
  'web-embed-props',
  'ai-generative-props',
  'typeDesign-signOff',
  'parityFixture-signOff',
  'compass-anchor',
  // T-348b — Phase 4 of Cluster D regression remediation. Asserts every
  // signed parity golden is positively content-bearing (non-blank).
  'parityFixture-non-blank',
] as const;

type InvariantKey = (typeof INVARIANT_KEYS)[number];

export interface IntegrityReport {
  scannedPresets: number;
  scannedClusters: number;
  byInvariant: Record<InvariantKey, InvariantBucket>;
  compassSkipped: boolean;
  compassPath: string;
  loaderError: string | undefined;
  exitCode: 0 | 1;
}

// ---------- per-invariant checks ----------

/**
 * Invariant 1 — re-validate frontmatter for the file. The loader has already
 * validated; this function is exposed for direct synthetic-test use (AC #1).
 * Returns ok unless the file's frontmatter cannot be parsed at all.
 */
export function checkFrontmatter(args: { filePath: string; raw: string }): CheckResult {
  // Light defensive parse — the heavy lifting is in `loadAllPresets`. Used by
  // tests to drive the synthetic AC #1 case.
  if (!args.raw.startsWith('---')) {
    return { ok: false, message: `${args.filePath}: missing frontmatter delimiter` };
  }
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(args.raw);
  } catch (err) {
    return {
      ok: false,
      message: `${args.filePath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const data = parsed.data as Record<string, unknown>;
  // Required field smoke-test — exact validation lives in the loader's Zod schema.
  for (const field of [
    'id',
    'cluster',
    'clipKind',
    'source',
    'status',
    'preferredFont',
    'signOff',
  ]) {
    if (data[field] === undefined) {
      return {
        ok: false,
        message: `${args.filePath}: missing required frontmatter field '${field}'`,
      };
    }
  }
  return { ok: true };
}

/** Invariant 2 — clipKind must be in the registry (AC #2). */
export function checkClipKindExists(args: { clipKind: string; presetId: string }): CheckResult {
  if (VALID_CLIP_KINDS.has(args.clipKind)) return { ok: true };
  return {
    ok: false,
    message: `clipKind '${args.clipKind}' not in the registry. Add it to VALID_CLIP_KINDS in scripts/check-preset-integrity.ts if intentional.`,
  };
}

/**
 * Invariant 3 — bespoke-font presets must declare a `fallbackFont` (AC #3, #4).
 * A bespoke font is one whose preferredFont license expression includes
 * `proprietary-byo` or `commercial-byo` per T-308 D-T308-3.
 */
export function checkBespokeFontHasFallback(args: {
  presetId: string;
  preferredFontFamily: string;
  preferredFontLicense: string;
  hasFallback: boolean;
}): CheckResult {
  let isBespoke: boolean;
  try {
    const expr = parseFontLicenseExpression(args.preferredFontLicense);
    isBespoke = expr.atoms.some((atom) => BESPOKE_LICENSE_ATOMS.has(atom));
  } catch {
    // Parser failure surfaces in the font-license CI gate (check-licenses.ts).
    // Skip here so we don't double-report.
    return { ok: true };
  }
  if (!isBespoke) return { ok: true };
  if (args.hasFallback) return { ok: true };
  return {
    ok: false,
    message: `preferredFont '${args.preferredFontFamily}' is ${args.preferredFontLicense} but no fallbackFont declared`,
  };
}

/**
 * Invariant 4 — interactive-family presets must have a non-empty `staticFallback`
 * field in their raw frontmatter (AC #5). Reads raw frontmatter because the
 * Zod loader schema is `.strict()` and doesn't currently include the field.
 */
export function checkInteractiveStaticFallback(args: {
  presetId: string;
  clipKind: string;
  raw: Record<string, unknown>;
}): CheckResult {
  if (!INTERACTIVE_CLIP_KINDS.has(args.clipKind)) return { ok: true };
  const sf = args.raw.staticFallback;
  if (sf === undefined || sf === null) {
    return {
      ok: false,
      message: `interactive clipKind '${args.clipKind}' requires a non-empty staticFallback (ADR-003 D2)`,
    };
  }
  if (typeof sf === 'string' && sf.trim().length === 0) {
    return {
      ok: false,
      message: `interactive clipKind '${args.clipKind}' has empty staticFallback (ADR-003 D2)`,
    };
  }
  if (Array.isArray(sf) && sf.length === 0) {
    return {
      ok: false,
      message: `interactive clipKind '${args.clipKind}' has empty staticFallback array (ADR-003 D2)`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 8 — when `family: 'shader'` is declared in raw frontmatter, the
 * accompanying `liveMount.props` must parse against `shaderClipPropsSchema`
 * (T-383 D-T383-3, AC #4 + #5). The dispatch is keyed on `family`; future
 * Phase γ frontier families (T-384+) extend this switch with their own
 * per-family schemas. Missing `liveMount` or `liveMount.props` while
 * `family: 'shader'` is declared is a violation: a shader-family preset
 * without props is malformed.
 */
export function checkShaderProps(args: {
  presetId: string;
  raw: Record<string, unknown>;
}): CheckResult {
  const family = args.raw.family;
  if (family !== 'shader') return { ok: true };
  const liveMount = args.raw.liveMount;
  if (liveMount === undefined || liveMount === null || typeof liveMount !== 'object') {
    return {
      ok: false,
      message: `family 'shader' requires a 'liveMount' field with shader props (T-383)`,
    };
  }
  const lm = liveMount as Record<string, unknown>;
  const props = lm.props;
  if (props === undefined) {
    return {
      ok: false,
      message: `family 'shader' requires 'liveMount.props' parseable as shaderClipPropsSchema (T-383)`,
    };
  }
  const parsed = shaderClipPropsSchema.safeParse(props);
  if (!parsed.success) {
    return {
      ok: false,
      message: `family 'shader' liveMount.props failed shaderClipPropsSchema: ${parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ')}`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 9 — when `family: 'three-scene'` is declared in raw frontmatter,
 * the accompanying `liveMount.props` must parse against
 * `threeSceneClipPropsSchema` (T-384 D-T384-3, AC #5). Mirrors the shader
 * dispatch at invariant 8. Future Phase γ frontier families extend this
 * pattern with their own per-family schemas — no new gate per family.
 */
export function checkThreeSceneProps(args: {
  presetId: string;
  raw: Record<string, unknown>;
}): CheckResult {
  const family = args.raw.family;
  if (family !== 'three-scene') return { ok: true };
  const liveMount = args.raw.liveMount;
  if (liveMount === undefined || liveMount === null || typeof liveMount !== 'object') {
    return {
      ok: false,
      message: `family 'three-scene' requires a 'liveMount' field with three-scene props (T-384)`,
    };
  }
  const lm = liveMount as Record<string, unknown>;
  const props = lm.props;
  if (props === undefined) {
    return {
      ok: false,
      message: `family 'three-scene' requires 'liveMount.props' parseable as threeSceneClipPropsSchema (T-384)`,
    };
  }
  const parsed = threeSceneClipPropsSchema.safeParse(props);
  if (!parsed.success) {
    return {
      ok: false,
      message: `family 'three-scene' liveMount.props failed threeSceneClipPropsSchema: ${parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ')}`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 10 — when `family: 'voice'` is declared in raw frontmatter, the
 * accompanying `liveMount.props` must parse against `voiceClipPropsSchema`
 * (T-387 D-T387-2, AC #4). Mirrors the dispatch pattern set by invariants
 * 8 (shader) and 9 (three-scene). Future Phase γ frontier families extend
 * this pattern with their own per-family schemas — no new gate per family.
 */
export function checkVoiceProps(args: {
  presetId: string;
  raw: Record<string, unknown>;
}): CheckResult {
  const family = args.raw.family;
  if (family !== 'voice') return { ok: true };
  const liveMount = args.raw.liveMount;
  if (liveMount === undefined || liveMount === null || typeof liveMount !== 'object') {
    return {
      ok: false,
      message: `family 'voice' requires a 'liveMount' field with voice props (T-387)`,
    };
  }
  const lm = liveMount as Record<string, unknown>;
  const props = lm.props;
  if (props === undefined) {
    return {
      ok: false,
      message: `family 'voice' requires 'liveMount.props' parseable as voiceClipPropsSchema (T-387)`,
    };
  }
  const parsed = voiceClipPropsSchema.safeParse(props);
  if (!parsed.success) {
    return {
      ok: false,
      message: `family 'voice' liveMount.props failed voiceClipPropsSchema: ${parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ')}`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 11 — when `family: 'ai-chat'` is declared in raw frontmatter, the
 * accompanying `liveMount.props` must parse against `aiChatClipPropsSchema`
 * (T-389 D-T389-2, AC #5). Mirrors the dispatch pattern set by invariants
 * 8 (shader), 9 (three-scene), 10 (voice). Future Phase γ frontier
 * families extend this pattern with their own per-family schemas — no
 * new gate per family.
 */
export function checkAiChatProps(args: {
  presetId: string;
  raw: Record<string, unknown>;
}): CheckResult {
  const family = args.raw.family;
  if (family !== 'ai-chat') return { ok: true };
  const liveMount = args.raw.liveMount;
  if (liveMount === undefined || liveMount === null || typeof liveMount !== 'object') {
    return {
      ok: false,
      message: `family 'ai-chat' requires a 'liveMount' field with ai-chat props (T-389)`,
    };
  }
  const lm = liveMount as Record<string, unknown>;
  const props = lm.props;
  if (props === undefined) {
    return {
      ok: false,
      message: `family 'ai-chat' requires 'liveMount.props' parseable as aiChatClipPropsSchema (T-389)`,
    };
  }
  const parsed = aiChatClipPropsSchema.safeParse(props);
  if (!parsed.success) {
    return {
      ok: false,
      message: `family 'ai-chat' liveMount.props failed aiChatClipPropsSchema: ${parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ')}`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 12 — when `family: 'live-data'` is declared in raw frontmatter, the
 * accompanying `liveMount.props` must parse against `liveDataClipPropsSchema`
 * (T-391 D-T391-2, AC #5). Mirrors the dispatch pattern set by invariants
 * 8 (shader), 9 (three-scene), 10 (voice), 11 (ai-chat).
 */
export function checkLiveDataProps(args: {
  presetId: string;
  raw: Record<string, unknown>;
}): CheckResult {
  const family = args.raw.family;
  if (family !== 'live-data') return { ok: true };
  const liveMount = args.raw.liveMount;
  if (liveMount === undefined || liveMount === null || typeof liveMount !== 'object') {
    return {
      ok: false,
      message: `family 'live-data' requires a 'liveMount' field with live-data props (T-391)`,
    };
  }
  const lm = liveMount as Record<string, unknown>;
  const props = lm.props;
  if (props === undefined) {
    return {
      ok: false,
      message: `family 'live-data' requires 'liveMount.props' parseable as liveDataClipPropsSchema (T-391)`,
    };
  }
  const parsed = liveDataClipPropsSchema.safeParse(props);
  if (!parsed.success) {
    return {
      ok: false,
      message: `family 'live-data' liveMount.props failed liveDataClipPropsSchema: ${parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ')}`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 13 — when `family: 'web-embed'` is declared in raw frontmatter, the
 * accompanying `liveMount.props` must parse against `webEmbedClipPropsSchema`
 * (T-393 D-T393-2, AC #5). Mirrors the dispatch pattern set by invariants
 * 8 (shader), 9 (three-scene), 10 (voice), 11 (ai-chat), 12 (live-data).
 */
export function checkWebEmbedProps(args: {
  presetId: string;
  raw: Record<string, unknown>;
}): CheckResult {
  const family = args.raw.family;
  if (family !== 'web-embed') return { ok: true };
  const liveMount = args.raw.liveMount;
  if (liveMount === undefined || liveMount === null || typeof liveMount !== 'object') {
    return {
      ok: false,
      message: `family 'web-embed' requires a 'liveMount' field with web-embed props (T-393)`,
    };
  }
  const lm = liveMount as Record<string, unknown>;
  const props = lm.props;
  if (props === undefined) {
    return {
      ok: false,
      message: `family 'web-embed' requires 'liveMount.props' parseable as webEmbedClipPropsSchema (T-393)`,
    };
  }
  const parsed = webEmbedClipPropsSchema.safeParse(props);
  if (!parsed.success) {
    return {
      ok: false,
      message: `family 'web-embed' liveMount.props failed webEmbedClipPropsSchema: ${parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ')}`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 14 — when `family: 'ai-generative'` is declared in raw frontmatter,
 * the accompanying `liveMount.props` must parse against
 * `aiGenerativeClipPropsSchema` (T-395 D-T395-2, AC #6). Mirrors the dispatch
 * pattern set by invariants 8/9/10/11/12/13.
 */
export function checkAiGenerativeProps(args: {
  presetId: string;
  raw: Record<string, unknown>;
}): CheckResult {
  const family = args.raw.family;
  if (family !== 'ai-generative') return { ok: true };
  const liveMount = args.raw.liveMount;
  if (liveMount === undefined || liveMount === null || typeof liveMount !== 'object') {
    return {
      ok: false,
      message: `family 'ai-generative' requires a 'liveMount' field with ai-generative props (T-395)`,
    };
  }
  const lm = liveMount as Record<string, unknown>;
  const props = lm.props;
  if (props === undefined) {
    return {
      ok: false,
      message: `family 'ai-generative' requires 'liveMount.props' parseable as aiGenerativeClipPropsSchema (T-395)`,
    };
  }
  const parsed = aiGenerativeClipPropsSchema.safeParse(props);
  if (!parsed.success) {
    return {
      ok: false,
      message: `family 'ai-generative' liveMount.props failed aiGenerativeClipPropsSchema: ${parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ')}`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 5 — clusters A/B/D/F/G must have `signOff.typeDesign` populated
 * (AC #6, #7). The clusters scoping is the most common bug class: invariant 5
 * does NOT apply to weather, data, ar.
 *
 * Refinement (T-308 D-T308-2 follow-up): invariant 5 is conditional on the
 * preset having a typographic identity. Presets whose `preferredFont.license`
 * is the `na` sentinel (text-free presets — e.g., the Coinbase Super Bowl
 * QR-code CTA) are exempt: ADR-004 D4 frames the type-design batch as
 * "broadcaster bespoke-font review," which has no purchase on a font-free
 * preset. The exemption is narrow (license atom 'na' only) and visible in code
 * to keep the spec's intent legible.
 */
export function checkTypeDesignSignOff(args: {
  presetId: string;
  cluster: string;
  typeDesign: string;
  preferredFontLicense: string;
}): CheckResult {
  if (!TYPE_DESIGN_REQUIRED_CLUSTERS.has(args.cluster)) return { ok: true };
  // Text-free preset (license: 'na') — type-design review does not apply.
  if (args.preferredFontLicense === 'na') return { ok: true };
  if (args.typeDesign === 'na') {
    return {
      ok: false,
      message: `cluster '${args.cluster}' requires signOff.typeDesign to be 'pending-cluster-batch' or 'signed:YYYY-MM-DD' (ADR-004 D4); got 'na'`,
    };
  }
  // Loader enforces the regex (pending-cluster-batch | signed:YYYY-MM-DD | na);
  // anything else would have failed schema validation upstream.
  return { ok: true };
}

/**
 * Invariant 6 — `signOff.parityFixture` populated (AC #8). Per T-308
 * D-T308-2: we ship this as a WARNING (not error) at gate time. Cluster-merge
 * enforcement is a separate operational gate.
 */
export function checkParityFixtureSignOff(args: {
  presetId: string;
  parityFixture: string;
}): CheckResult {
  if (args.parityFixture === 'pending-user-review') {
    return {
      ok: false,
      severity: 'warning',
      message: 'parityFixture is pending-user-review (non-blocking pre-cluster-merge)',
    };
  }
  return { ok: true };
}

/**
 * Invariant 7 — preset's `source` resolves to a real anchor in the compass
 * file (AC #9, #10). External https URLs pass without verification. Missing
 * compass file -> invariant 7 globally skipped (handled by caller).
 */
export function checkCompassAnchor(args: {
  presetId: string;
  source: string;
  compass: CompassAnchors | undefined;
}): CheckResult {
  // External URL — no verification at this gate.
  if (/^https?:\/\//i.test(args.source)) return { ok: true };
  // Compass not loaded — caller handles the global skip-with-warning. Treating
  // it as ok at the per-preset level is a defense-in-depth measure.
  if (args.compass === undefined) return { ok: true };

  // Parse out the anchor (after first `#`).
  const hashIdx = args.source.indexOf('#');
  if (hashIdx < 0) {
    return {
      ok: false,
      message: `source '${args.source}' has no anchor; expected '<path>#<anchor>'`,
    };
  }
  const anchor = args.source.slice(hashIdx + 1).toLowerCase();
  if (anchor.length === 0) {
    return { ok: false, message: `source '${args.source}' has empty anchor` };
  }
  if (!args.compass.anchors.has(anchor)) {
    return {
      ok: false,
      message: `source '${args.source}' anchor '#${anchor}' not found in ${args.compass.filePath}`,
    };
  }
  return { ok: true };
}

// ---------- T-348b parity-golden non-blank check ----------

export interface NonBlankMetrics {
  /** Distinct quantized color buckets observed across all pixels. */
  distinctBuckets: number;
  /**
   * Number of buckets holding at least
   * {@link NON_BLANK_SIGNIFICANT_BUCKET_FRACTION} of total pixels. The
   * primary discriminator — `>= 2` clears the gate.
   */
  significantBuckets: number;
  /** Fraction of pixels in the single most-populated bucket (informational). */
  maxBucketFraction: number;
  /** Total pixels examined (= width * height; no stride). */
  totalPixels: number;
}

/**
 * Decode a PNG and compute significant-bucket blank-detection metrics
 * (D-T348b-2). Synchronous via `pngjs.PNG.sync.read` (D-T348b-5). Scans
 * every pixel — no stride — so even ~15-px-square elements reliably
 * contribute to their own bucket. Cost on a 1080p canvas: ~50 ms typical
 * (~2 MP @ ~50ns / pixel for the 5-bit quantize + Map increment).
 */
export function decodeNonBlankMetrics(pngBytes: Uint8Array): NonBlankMetrics {
  const png = PNG.sync.read(Buffer.from(pngBytes));
  const data = png.data; // RGBA Buffer, length = width * height * 4
  const totalPixels = png.width * png.height;
  if (totalPixels === 0) {
    return { distinctBuckets: 0, significantBuckets: 0, maxBucketFraction: 1, totalPixels: 0 };
  }
  const shift = 8 - NON_BLANK_QUANTIZE_BITS;
  const buckets = new Map<number, number>();
  for (let p = 0; p < totalPixels; p += 1) {
    const byteOffset = p * 4;
    const r = (data[byteOffset] ?? 0) >> shift;
    const g = (data[byteOffset + 1] ?? 0) >> shift;
    const b = (data[byteOffset + 2] ?? 0) >> shift;
    const key = (r << (NON_BLANK_QUANTIZE_BITS * 2)) | (g << NON_BLANK_QUANTIZE_BITS) | b;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const significanceThreshold = totalPixels * NON_BLANK_SIGNIFICANT_BUCKET_FRACTION;
  let significantBuckets = 0;
  let maxBucket = 0;
  for (const count of buckets.values()) {
    if (count >= significanceThreshold) significantBuckets += 1;
    if (count > maxBucket) maxBucket = count;
  }
  return {
    distinctBuckets: buckets.size,
    significantBuckets,
    maxBucketFraction: maxBucket / totalPixels,
    totalPixels,
  };
}

/**
 * Invariant 15 — every signed parity golden is positively content-bearing.
 * Skips presets where `signOff.parityFixture` is `pending-user-review` or
 * `na`. Fires when the golden file is missing OR fails the dual-criterion
 * blank check (D-T348b-2). Returns ok-but-no-op when the file is missing
 * AND the preset's parityFixture is not signed (the pending-* case is
 * already covered by invariant 6's warning).
 */
export function checkParityGoldenNonBlank(args: {
  presetId: string;
  goldenPath: string;
}): CheckResult {
  if (!existsSync(args.goldenPath)) {
    return {
      ok: false,
      message: `signed parity golden file does not exist: ${args.goldenPath}`,
    };
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(args.goldenPath);
  } catch (err) {
    return {
      ok: false,
      message: `failed to read parity golden ${args.goldenPath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  let metrics: NonBlankMetrics;
  try {
    metrics = decodeNonBlankMetrics(bytes);
  } catch (err) {
    return {
      ok: false,
      message: `failed to decode parity golden ${args.goldenPath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const { significantBuckets, distinctBuckets, maxBucketFraction } = metrics;
  if (
    significantBuckets < NON_BLANK_MIN_SIGNIFICANT_BUCKETS &&
    maxBucketFraction > NON_BLANK_BLANK_DOMINANCE_THRESHOLD
  ) {
    return {
      ok: false,
      message: `parity golden ${args.goldenPath} appears blank — only ${significantBuckets} significant color bucket(s) (≥${NON_BLANK_MIN_SIGNIFICANT_BUCKETS} required, where a "significant" bucket holds ≥${(NON_BLANK_SIGNIFICANT_BUCKET_FRACTION * 100).toFixed(2)}% of pixels) AND ${(maxBucketFraction * 100).toFixed(2)}% of pixels concentrated in the dominant bucket (gate fires above ${(NON_BLANK_BLANK_DOMINANCE_THRESHOLD * 100).toFixed(2)}%). Total distinct buckets: ${distinctBuckets}. Phase 4 two-stage gate per docs/handover-cluster-d-regression.md.`,
    };
  }
  return { ok: true };
}

/**
 * Walk `parity-fixtures/<cluster>/<preset-id>/` and return every PNG that
 * looks like a golden frame (`golden-frame-*.png`). Returns an empty array
 * if the directory does not exist (caller's invariant decides whether that's
 * a hard error — for signed presets it IS, since the sign-off claims the
 * golden exists; for `pending-*` presets the directory may legitimately
 * be missing).
 */
export function listGoldenPngs(args: {
  parityFixturesRoot: string;
  cluster: string;
  presetId: string;
}): string[] {
  const dir = join(args.parityFixturesRoot, args.cluster, args.presetId);
  if (!existsSync(dir)) return [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.startsWith('golden-frame-') && name.endsWith('.png'))
    .map((name) => join(dir, name))
    .sort();
}

// ---------- compass loading ----------

/**
 * Read the compass file and extract every Markdown heading slug. Returns
 * undefined when the file is missing — the gate degrades gracefully and skips
 * invariant 7 (T-308 D-T308-4, AC #10).
 */
export function loadCompassAnchors(filePath: string): CompassAnchors | undefined {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  const anchors = new Set<string>();
  // Accept ATX headings (one to six `#`s followed by a space).
  // Strip leading `#`s + whitespace, lowercase, replace whitespace runs with hyphens,
  // strip non-alphanumeric/hyphen characters, collapse hyphens.
  for (const line of raw.split('\n')) {
    const m = /^#{1,6}\s+(.+?)\s*#*$/.exec(line.trim());
    if (!m || m[1] === undefined) continue;
    const slug = m[1]
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (slug.length > 0) anchors.add(slug);
  }
  return { filePath, anchors };
}

// ---------- aggregation ----------

function emptyBuckets(): Record<InvariantKey, InvariantBucket> {
  const buckets = {} as Record<InvariantKey, InvariantBucket>;
  for (const k of INVARIANT_KEYS) {
    buckets[k] = { errors: [], warnings: [] };
  }
  return buckets;
}

interface RunOpts {
  presetsRoot: string;
  compassPath?: string;
  /**
   * Workspace-relative root for parity goldens (T-348b). Defaults to
   * {@link PARITY_FIXTURES_ROOT_DEFAULT}. Tests pass a per-case temp dir.
   */
  parityFixturesRoot?: string;
}

/**
 * Run every invariant against every preset under {@link RunOpts.presetsRoot}.
 * Returns a structured report; never throws (loader errors are folded into
 * `loaderError` + the frontmatter bucket).
 */
export function runIntegrityChecks(opts: RunOpts): IntegrityReport {
  const buckets = emptyBuckets();
  const compassPath = opts.compassPath ?? COMPASS_PATH_DEFAULT;
  const compass = loadCompassAnchors(compassPath);

  resetLoaderCache();
  let presets: Preset[] = [];
  let scannedClusters = 0;
  let loaderError: string | undefined;

  try {
    const registry = loadAllPresets(opts.presetsRoot);
    presets = registry.list();
    scannedClusters = registry.clusters().length;
  } catch (err) {
    if (err instanceof PresetRegistryLoadError) {
      loaderError = err.message;
      for (const issue of err.issues) {
        buckets.frontmatter.errors.push({
          presetId: issue.filePath,
          filePath: issue.filePath,
          message: issue.error.message,
        });
      }
    } else {
      loaderError = err instanceof Error ? err.message : String(err);
      buckets.frontmatter.errors.push({
        presetId: opts.presetsRoot,
        filePath: opts.presetsRoot,
        message: loaderError,
      });
    }
  }

  for (const preset of presets) {
    const fm = preset.frontmatter;
    const id = fm.id;
    const filePath = preset.filePath;

    // Invariant 2.
    {
      const r = checkClipKindExists({ clipKind: fm.clipKind, presetId: id });
      if (!r.ok) buckets.clipKind.errors.push({ presetId: id, filePath, message: r.message });
    }

    // Invariant 3.
    {
      const r = checkBespokeFontHasFallback({
        presetId: id,
        preferredFontFamily: fm.preferredFont.family,
        preferredFontLicense: fm.preferredFont.license,
        hasFallback: fm.fallbackFont !== undefined,
      });
      if (!r.ok)
        buckets['bespoke-fallback'].errors.push({ presetId: id, filePath, message: r.message });
    }

    // Invariant 4 — read raw frontmatter (loader strips unknown keys via .strict()
    // schema, so we re-parse to inspect staticFallback if present).
    {
      let raw: Record<string, unknown> = {};
      try {
        const parsed = matter(readFileSync(filePath, 'utf8'));
        raw = (parsed.data as Record<string, unknown>) ?? {};
      } catch {
        // If we can't reread, the loader path would have caught it; safe to skip.
      }
      const r = checkInteractiveStaticFallback({
        presetId: id,
        clipKind: fm.clipKind,
        raw,
      });
      if (!r.ok)
        buckets['interactive-staticFallback'].errors.push({
          presetId: id,
          filePath,
          message: r.message,
        });

      // Invariant 8 — shader-props parsing (T-383). Co-located with invariant 4
      // because both peek at raw frontmatter; the family dispatch lets us avoid
      // a second `matter()` parse per preset.
      const shaderResult = checkShaderProps({ presetId: id, raw });
      if (!shaderResult.ok) {
        buckets['shader-props'].errors.push({
          presetId: id,
          filePath,
          message: shaderResult.message,
        });
      }

      // Invariant 9 — three-scene-props parsing (T-384). Same dispatch
      // pattern; family discriminator routes to the per-family schema.
      const threeSceneResult = checkThreeSceneProps({ presetId: id, raw });
      if (!threeSceneResult.ok) {
        buckets['three-scene-props'].errors.push({
          presetId: id,
          filePath,
          message: threeSceneResult.message,
        });
      }

      // Invariant 10 — voice-props parsing (T-387). Same dispatch.
      const voiceResult = checkVoiceProps({ presetId: id, raw });
      if (!voiceResult.ok) {
        buckets['voice-props'].errors.push({
          presetId: id,
          filePath,
          message: voiceResult.message,
        });
      }

      // Invariant 11 — ai-chat-props parsing (T-389). Same dispatch.
      const aiChatResult = checkAiChatProps({ presetId: id, raw });
      if (!aiChatResult.ok) {
        buckets['ai-chat-props'].errors.push({
          presetId: id,
          filePath,
          message: aiChatResult.message,
        });
      }

      // Invariant 12 — live-data-props parsing (T-391). Same dispatch.
      const liveDataResult = checkLiveDataProps({ presetId: id, raw });
      if (!liveDataResult.ok) {
        buckets['live-data-props'].errors.push({
          presetId: id,
          filePath,
          message: liveDataResult.message,
        });
      }

      // Invariant 13 — web-embed-props parsing (T-393). Same dispatch.
      const webEmbedResult = checkWebEmbedProps({ presetId: id, raw });
      if (!webEmbedResult.ok) {
        buckets['web-embed-props'].errors.push({
          presetId: id,
          filePath,
          message: webEmbedResult.message,
        });
      }

      // Invariant 14 — ai-generative-props parsing (T-395). Same dispatch.
      const aiGenerativeResult = checkAiGenerativeProps({ presetId: id, raw });
      if (!aiGenerativeResult.ok) {
        buckets['ai-generative-props'].errors.push({
          presetId: id,
          filePath,
          message: aiGenerativeResult.message,
        });
      }
    }

    // Invariant 5.
    {
      const r = checkTypeDesignSignOff({
        presetId: id,
        cluster: fm.cluster,
        typeDesign: fm.signOff.typeDesign,
        preferredFontLicense: fm.preferredFont.license,
      });
      if (!r.ok)
        buckets['typeDesign-signOff'].errors.push({ presetId: id, filePath, message: r.message });
    }

    // Invariant 6 (warning).
    {
      const r = checkParityFixtureSignOff({
        presetId: id,
        parityFixture: fm.signOff.parityFixture,
      });
      if (!r.ok) {
        buckets['parityFixture-signOff'].warnings.push({
          presetId: id,
          filePath,
          message: r.message,
        });
      }
    }

    // Invariant 7.
    {
      const r = checkCompassAnchor({ presetId: id, source: fm.source, compass });
      if (!r.ok)
        buckets['compass-anchor'].errors.push({ presetId: id, filePath, message: r.message });
    }

    // Invariant 15 (T-348b) — every signed parity golden is non-blank.
    // Only runs for presets where `signOff.parityFixture` matches `signed:*`;
    // pending-user-review + na are skipped (D-T348b-1).
    if (/^signed:/.test(fm.signOff.parityFixture)) {
      const goldens = listGoldenPngs({
        parityFixturesRoot: opts.parityFixturesRoot ?? PARITY_FIXTURES_ROOT_DEFAULT,
        cluster: fm.cluster,
        presetId: id,
      });
      if (goldens.length === 0) {
        buckets['parityFixture-non-blank'].errors.push({
          presetId: id,
          filePath,
          message: `signOff.parityFixture is '${fm.signOff.parityFixture}' but no golden PNGs found under parity-fixtures/${fm.cluster}/${id}/`,
        });
      } else {
        for (const goldenPath of goldens) {
          const r = checkParityGoldenNonBlank({ presetId: id, goldenPath });
          if (!r.ok) {
            buckets['parityFixture-non-blank'].errors.push({
              presetId: id,
              filePath,
              message: r.message,
            });
          }
        }
      }
    }
  }

  const hasErrors =
    Object.values(buckets).some((b) => b.errors.length > 0) || loaderError !== undefined;

  return {
    scannedPresets: presets.length,
    scannedClusters,
    byInvariant: buckets,
    compassSkipped: compass === undefined,
    compassPath,
    loaderError,
    exitCode: hasErrors ? 1 : 0,
  };
}

// ---------- CLI entry ----------

function formatPassFail(bucket: InvariantBucket): string {
  if (bucket.errors.length > 0) return `FAIL (${bucket.errors.length} error)`;
  if (bucket.warnings.length > 0) return `WARN (${bucket.warnings.length} pending)`;
  return 'PASS';
}

/**
 * Render a {@link IntegrityReport} into the user-facing stdout/stderr text.
 * Pure function — no I/O — so the formatting logic can be unit-tested.
 */
export function formatReport(report: IntegrityReport): { stdout: string; stderr: string } {
  let stdout = '';
  let stderr = '';

  stdout += `check-preset-integrity: ${report.scannedPresets} presets, ${report.scannedClusters} clusters scanned\n`;

  if (report.compassSkipped) {
    stdout += `check-preset-integrity [compass-anchor]: SKIP (${report.compassPath} not found - invariant 7 disabled per T-308 D-T308-4)\n`;
  }

  for (const key of INVARIANT_KEYS) {
    if (key === 'compass-anchor' && report.compassSkipped) continue;
    stdout += `check-preset-integrity [${key}]: ${formatPassFail(report.byInvariant[key])}\n`;
  }

  for (const key of INVARIANT_KEYS) {
    const bucket = report.byInvariant[key];
    if (bucket.errors.length === 0 && bucket.warnings.length === 0) continue;
    if (bucket.errors.length > 0) {
      stderr += `\ncheck-preset-integrity [${key}]: FAIL\n`;
      for (const e of bucket.errors) {
        stderr += `  - ${e.filePath}: ${e.message}\n`;
      }
    }
    if (bucket.warnings.length > 0) {
      stdout += `\ncheck-preset-integrity [${key}]: WARN\n`;
      for (const w of bucket.warnings) {
        stdout += `  - ${w.filePath}: ${w.message}\n`;
      }
    }
  }

  if (report.exitCode === 0) {
    stdout += '\ncheck-preset-integrity: PASS\n';
  } else {
    const totalErrors = Object.values(report.byInvariant).reduce(
      (acc, b) => acc + b.errors.length,
      0,
    );
    stderr += `\ncheck-preset-integrity: FAIL (${totalErrors} violation${totalErrors === 1 ? '' : 's'})\n`;
  }

  return { stdout, stderr };
}

/* v8 ignore start */
// `main()` + CLI guard run only when the script is invoked as a process. The
// subprocess CLI test (AC #11, #12) exercises the surface; in-process v8
// coverage does NOT record subprocess execution, so these blocks would
// otherwise depress the script's coverage to under 85%.
function main(): void {
  const presetsRoot = PRESETS_ROOT_DEFAULT;
  process.stdout.write(`check-preset-integrity: scanning ${presetsRoot}/...\n`);
  const report = runIntegrityChecks({ presetsRoot });
  const { stdout, stderr } = formatReport(report);
  if (stdout.length > 0) process.stdout.write(stdout);
  if (stderr.length > 0) process.stderr.write(stderr);
  process.exit(report.exitCode);
}

// CLI guard — only run main when invoked directly. Lets tests import the
// module without triggering process.exit. Mirrors backup-restore.ts pattern.
const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'check-preset-integrity.ts')
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`check-preset-integrity: crashed: ${String(err)}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
    process.exit(2);
  }
}
/* v8 ignore stop */
