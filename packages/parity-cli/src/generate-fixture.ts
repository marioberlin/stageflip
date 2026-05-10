// packages/parity-cli/src/generate-fixture.ts
// Production-renderer binding for the parity-fixture generator (T-359a).
//
// `scripts/generate-preset-parity-fixture.ts` ships a `bindProductionRenderer`
// hook (T-359a D-T359a-3) that accepts a `FixtureRenderer` impl. This module
// builds that impl by composing:
//
//   1. A `clipKindResolver` that maps a preset's `clipKind` (e.g. `bigNumber`)
//      to a concrete render plan: runtime id + clip name + a per-variant
//      props builder. v1 wires the `bigNumber → animated-value` binding
//      documented in `skills/stageflip/presets/data/f1-sector-purple-green.md`
//      (T-359a D-T359a-4). The formal clipKind dispatcher is a future task.
//
//   2. A `renderFrame` callback that builds an `RIRDocument` from the
//      resolver's plan and hands it to a `PrimeRenderFn` (the puppeteer/CDP
//      pipeline already used by `stageflip-parity prime`).
//
// The renderer is Node-only — it imports from `@stageflip/rir`,
// `@stageflip/runtimes-frame-runtime-bridge`, and (lazily) puppeteer-side
// machinery. `packages/parity-cli` is already a Node-only package; no new
// browser-bundle exposure (T-359a D-T359a-9, browser-bundle hazard memo).
//
// Follow-up: T-359b runs this prod-bound generator on T-359
// (`f1-sector-purple-green`) to flip its `signOff.parityFixture` from
// `pending-user-review` → `signed:<date>`, closing the carve-out from
// T-359a D-T359a-6. See `docs/ops/parity-fixture-signoff.md`
// §"Pending follow-up tasks".

import { type RIRDocument, rirDocumentSchema } from '@stageflip/rir';

import type { PrimeRenderFn } from './prime.js';

// ---------- types ----------

/** A preset description sufficient for the generator script's render call. */
export interface PresetForRender {
  readonly frontmatter: {
    readonly id: string;
    readonly cluster: string;
    readonly clipKind: string;
  };
}

/** Composition the renderer targets. Mirrors `DEFAULT_COMPOSITION` in the script. */
export interface FixtureComposition {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

/** Args to the generator-script-side `FixtureRenderer.render`. */
export interface FixtureRenderArgs {
  readonly preset: PresetForRender;
  readonly composition: FixtureComposition;
  readonly frame: number;
  readonly variant?: string;
}

/**
 * Concrete render plan a `clipKindResolver` returns. The resolver maps a
 * preset's `clipKind` (semantic, frontmatter-level) to a runtime + clip-kind
 * pair the renderer can mount, plus a function that builds props from the
 * declared variant name (D-T359a-1 + D-T359a-4).
 */
export interface ClipKindBinding {
  /** Runtime id (matches `ClipRuntime.id` — e.g. `'frame-runtime'`). */
  readonly runtimeId: string;
  /** Clip kind within that runtime (matches `ClipDefinition.kind`). */
  readonly clipName: string;
  /**
   * Build the props object for this clip given the variant name (or undefined
   * for single-variant invocations). Pure — no I/O. The returned object is
   * placed directly into the RIR clip element's `params`.
   */
  buildProps(variant: string | undefined): Record<string, unknown>;
  /**
   * Optional secondary atmospheric overlays composed above the parent clip
   * in declaration order = z-order (T-348 D-T348-1). Each overlay renders
   * at the same `transform` (full-canvas) and `timing` (full-duration) as
   * the parent; the parent renders at `zIndex: 0`, overlays at
   * `zIndex: 1, 2, 3, ...` in array order. Single-clip presets omit this
   * field; existing 25 single-clip bindings (24 in `PRESET_ID_BINDINGS` +
   * the clipKind-default arms) remain unchanged.
   *
   * v1 scope (T-348 D-T348-1): full-canvas + full-duration only. Per-overlay
   * `transform` / `timing` overrides + per-overlay blend-mode declarations
   * are out-of-scope; primitives bake their own blend modes (e.g.
   * `light-leak` uses `mixBlendMode: 'screen'`; `photographic-overlay` uses
   * SVG filter primitives).
   */
  readonly overlays?: ReadonlyArray<{
    readonly runtimeId: string;
    readonly clipName: string;
    buildProps(variant: string | undefined): Record<string, unknown>;
  }>;
}

/**
 * Resolver hook the generator uses to find the render plan for a preset's
 * `clipKind`. Returns `undefined` for unknown clipKinds; the renderer
 * surfaces this as a clean `RenderUnavailableError` (D-T359a-4 / AC #10).
 *
 * The optional second `presetId` argument (T-360 D-T360-2) lets the resolver
 * choose a per-preset binding when multiple presets share a `clipKind` —
 * e.g., `f1-sector-purple-green` and `big-number-stat-impact` both bind to
 * `bigNumber` but parameterize `animated-value` differently. Resolvers that
 * don't need per-preset specialization simply ignore the argument; T-359
 * callers that pass no `presetId` continue to fall through to the
 * clipKind-only path.
 */
export type ClipKindResolver = (clipKind: string, presetId?: string) => ClipKindBinding | undefined;

/** Marker error mirroring the script's `RenderUnavailableError`. Re-thrown by the binding. */
export class GenerateFixtureUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerateFixtureUnavailableError';
  }
}

// ---------- v1 clipKind → component resolver ----------

/**
 * Default v1 clipKind → component map (T-359a D-T359a-4). Intentionally
 * small: only `bigNumber` is wired today (the binding documented in T-359's
 * preset). Cluster owners extend this map as their cluster's first preset
 * reaches sign-off — the convention is one entry per concrete React clip,
 * NOT per semantic alias.
 *
 * The `bigNumber → animated-value` binding mirrors the prose contract in
 * `skills/stageflip/presets/data/f1-sector-purple-green.md` § Rules ("Bound
 * primitive: `animated-value` from `@stageflip/runtimes-frame-runtime-bridge`").
 *
 * Variant → state-prop-color comes from the same preset doc:
 *   - sessionBest → '#6F2E9E' (purple)
 *   - personalBest → '#00B54A' (green)
 *   - neutral → '#F0C800' (yellow)
 *
 * Single-variant invocations (no `variant`) default to neutral so the
 * resolver is total over the variant axis.
 */
export const F1_SECTOR_STATE_COLORS: Readonly<Record<string, string>> = {
  sessionBest: '#6F2E9E',
  personalBest: '#00B54A',
  neutral: '#F0C800',
};

const DEFAULT_BIG_NUMBER_VALUE = 21.412;
const DEFAULT_BIG_NUMBER_FONT_SIZE = 360;

const bigNumberBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'animated-value',
  buildProps(variant) {
    const color = variant !== undefined ? F1_SECTOR_STATE_COLORS[variant] : undefined;
    return {
      value: DEFAULT_BIG_NUMBER_VALUE,
      decimals: 3,
      fontSize: DEFAULT_BIG_NUMBER_FONT_SIZE,
      fontWeight: 700,
      ...(color !== undefined ? { color } : {}),
    };
  },
};

/**
 * Cricket ball-by-ball outcome → chip color mapping (T-358). Universal cricket
 * broadcast canon documented in `skills/stageflip/presets/data/cricket-ball-by-ball-dots.md`
 * § Visual tokens. Keys are outcome glyphs as they appear on a scorecard:
 * `'.'` (or `0`) for a dot ball, `'1'`/`'2'`/`'3'` for runs, `'4'`/`'6'` for
 * boundaries, `'W'` for a wicket. The mapping is preset-defining; do NOT
 * re-theme even for tenant brand contrast.
 */
export const CRICKET_OUTCOME_COLORS: Readonly<Record<string, string>> = {
  '.': '#666666',
  '0': '#666666',
  '1': '#FFFFFF',
  '2': '#00B4D8',
  '3': '#00B4D8',
  '4': '#00B54A',
  '5': '#00B4D8',
  '6': '#FFCD00',
  W: '#CC0000',
};

// Canonical six-ball over per T-358 D-T358-3 — one mid-hold variant exposing
// all six outcome colors in a single frame: single (white), dot (gray), four
// (green), six (gold), wicket (red), two (cyan). All six chip colors from
// the cricket canon palette appear in this single frame.
const CRICKET_CANONICAL_OVER: ReadonlyArray<string> = ['1', '.', '4', '6', 'W', '2'];

const scoreBugDotsBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'outcome-row',
  buildProps() {
    // Single-variant per D-T358-3: variant axis is unused.
    return {
      chips: CRICKET_CANONICAL_OVER.map((outcome) => ({
        color: CRICKET_OUTCOME_COLORS[outcome] ?? '#666666',
        label: outcome,
      })),
      shape: 'circle',
      chipSize: 'large',
      outlineColor: '#0E0E12',
      background: '#0E0E12',
    };
  },
};

/**
 * `big-number-stat-impact` (T-360) — second `bigNumber`-clipKind preset, bound
 * to the same `animated-value` primitive as T-359 but parameterized for the
 * universal "stat impact" beat (`87.4%` mid-hold per D-T360-3 + heavy-weight
 * font register per D-T360-5). The underdamped spring's natural settle IS
 * the impact beat (D-T360-4 — no scale-pulse).
 */
const bigNumberStatImpactBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'animated-value',
  buildProps() {
    return {
      value: 87.4,
      decimals: 1,
      suffix: '%',
      fontSize: 360,
      fontWeight: 800,
    };
  },
};

/**
 * `bloomberg-ticker` (T-356) — first `newsTicker`-clipKind preset, bound to
 * the `news-ticker-bar` primitive shipped by T-356a. The cached snapshot
 * substitutes for the live market-data endpoint per ADR-003 §D2 (the
 * `staticFallback` render path); `LiveDataClip`'s wrapper is bypassed and
 * `news-ticker-bar` is mounted directly with the snapshot inlined as props
 * (D-T356-11). Bloomberg-canonical six-token mix of equities + crypto + ▲/▼
 * deltas exercises both color paths in the single mid-hold golden.
 */
export const BLOOMBERG_CANONICAL_SNAPSHOT: ReadonlyArray<{
  readonly symbol: string;
  readonly price: string;
  readonly delta: string;
  readonly direction: 'up' | 'down' | 'flat';
}> = [
  { symbol: 'AAPL', price: '230.45', delta: '+1.2%', direction: 'up' },
  { symbol: 'MSFT', price: '412.10', delta: '-0.4%', direction: 'down' },
  { symbol: 'GOOGL', price: '178.92', delta: '+0.8%', direction: 'up' },
  { symbol: 'NVDA', price: '925.34', delta: '+2.7%', direction: 'up' },
  { symbol: 'TSLA', price: '252.18', delta: '-1.1%', direction: 'down' },
  { symbol: 'BTC-USD', price: '67,234', delta: '+2.1%', direction: 'up' },
];

const NEWS_TICKER_DEFAULT_SCROLL_SPEED = 60; // px/sec — middle of the stub's 50–80 range
const NEWS_TICKER_DEFAULT_CHIP_GAP = 60;
const NEWS_TICKER_DEFAULT_BAND_HEIGHT = 60;

const newsTickerBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'news-ticker-bar',
  buildProps() {
    return {
      entries: BLOOMBERG_CANONICAL_SNAPSHOT.map((e) => ({ ...e })),
      scrollSpeed: NEWS_TICKER_DEFAULT_SCROLL_SPEED,
      chipGap: NEWS_TICKER_DEFAULT_CHIP_GAP,
      bandHeight: NEWS_TICKER_DEFAULT_BAND_HEIGHT,
      bandPosition: 'bottom',
      background: '#0A0A0A',
      foreground: '#FFFFFF',
      upColor: '#00D26A',
      downColor: '#FF3C3C',
      flatColor: '#999999',
    };
  },
};

/**
 * `olympic-medal-tracker` (T-357) — first `standings`-clipKind preset, bound
 * to the `standings-table` primitive shipped by T-357a. The cached snapshot
 * substitutes for the live medal-table endpoint per ADR-003 §D2 (the
 * `staticFallback` render path); `LiveDataClip`'s wrapper is bypassed and
 * `standings-table` is mounted directly with the snapshot inlined as props
 * (D-T357-12; same posture as T-356 D-T356-11). Five-row top-5 leaderboard
 * (USA / CHN / JPN / AUS / GBR) with mixed up / down / flat deltas exercises
 * all three rank-arrow color paths plus the medal-color column tints in the
 * single mid-hold golden (D-T357-4).
 */
export const OLYMPIC_CANONICAL_STANDINGS: ReadonlyArray<{
  readonly rank: number;
  readonly code: string;
  readonly gold: number;
  readonly silver: number;
  readonly bronze: number;
  readonly total: number;
  readonly delta: 'up' | 'down' | 'flat';
}> = [
  { rank: 1, code: 'USA', gold: 28, silver: 22, bronze: 19, total: 69, delta: 'flat' },
  { rank: 2, code: 'CHN', gold: 24, silver: 19, bronze: 16, total: 59, delta: 'flat' },
  { rank: 3, code: 'JPN', gold: 14, silver: 11, bronze: 13, total: 38, delta: 'up' },
  { rank: 4, code: 'AUS', gold: 12, silver: 10, bronze: 14, total: 36, delta: 'down' },
  { rank: 5, code: 'GBR', gold: 11, silver: 16, bronze: 15, total: 42, delta: 'up' },
];

const STANDINGS_DEFAULT_ROW_HEIGHT = 64;
const STANDINGS_DEFAULT_HEADER_HEIGHT = 48;
const STANDINGS_DEFAULT_STAGGER_MS = 80;

const standingsBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'standings-table',
  buildProps() {
    return {
      rows: OLYMPIC_CANONICAL_STANDINGS.map((r) => ({
        rank: r.rank,
        code: r.code,
        values: [r.gold, r.silver, r.bronze],
        total: r.total,
        delta: r.delta,
      })),
      columns: [
        { key: 'rank', label: '#', kind: 'rank', width: 56 },
        { key: 'code', label: 'NOC', kind: 'label', flex: 2 },
        { key: 'gold', label: 'G', kind: 'numeric', color: '#FFD700' },
        { key: 'silver', label: 'S', kind: 'numeric', color: '#C0C0C0' },
        { key: 'bronze', label: 'B', kind: 'numeric', color: '#CD7F32' },
        { key: 'total', label: 'TOT', kind: 'total' },
        { key: 'delta', label: 'Δ', kind: 'delta', width: 56 },
      ],
      rowHeight: STANDINGS_DEFAULT_ROW_HEIGHT,
      headerHeight: STANDINGS_DEFAULT_HEADER_HEIGHT,
      staggerMs: STANDINGS_DEFAULT_STAGGER_MS,
      bandPosition: 'overlay',
      background: '#0E0E12',
      foreground: '#FFFFFF',
      goldColor: '#FFD700',
      silverColor: '#C0C0C0',
      bronzeColor: '#CD7F32',
      upColor: '#00B54A',
      downColor: '#CC0000',
      flatColor: '#999999',
    };
  },
};

/**
 * `hormozi-montserrat-black` (T-362) — first `caption`-clipKind preset, bound
 * to the `caption` primitive shipped by T-316. The cached six-word snapshot
 * substitutes for an audio-derived `WordTiming[]` source; the `'hormozi'`
 * style bundle on the primitive supplies the Montserrat 800 caps + black
 * stroke (6 px) + yellow `#FFD60A` highlight + `rise` entrance with 80 ms
 * stagger defaults — `buildProps` only declares `words`, `style`, `position`,
 * and the documentation backdrop, leaving the bundle to drive the visual
 * register (D-T362-4). Mid-hold at frame 45 (= 1500 ms @ 30fps) lands word
 * 6 (`"forever"`) as the active highlight per the primitive's strict
 * `currentTimeMs >= startMs && currentTimeMs < endMs` rule (D-T362-6).
 */
export const HORMOZI_CANONICAL_WORDS: ReadonlyArray<{
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}> = [
  { text: 'This', startMs: 0, endMs: 300 },
  { text: 'will', startMs: 300, endMs: 600 },
  { text: 'change', startMs: 600, endMs: 900 },
  { text: 'your', startMs: 900, endMs: 1200 },
  { text: 'life', startMs: 1200, endMs: 1500 },
  { text: 'forever', startMs: 1500, endMs: 1800 },
];

const captionBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'caption',
  buildProps() {
    return {
      words: HORMOZI_CANONICAL_WORDS.map((w) => ({ ...w })),
      style: 'hormozi',
      // Lower-third center per D-T362-12, scaled to the 1280×720 default
      // composition: 10% inset (x=128), 60% down (y=432), 80% width (1024).
      position: { x: 128, y: 432, width: 1024, alignment: 'center' as const },
      // Documentation-only — the primitive only honors `background` when
      // `backdrop !== 'none'` and the `'hormozi'` bundle ships `'none'`.
      // Declared here to surface intent (cluster E precedent for dark
      // broadcast registers per D-T362-11); the parity golden actually
      // renders against the host bundle's default canvas color.
      background: '#0E0E12',
    };
  },
};

/**
 * `mrbeast-komika-axis` (T-363) — second `caption`-clipKind preset, bound to
 * the same `caption` primitive (T-316) as T-362's `hormozi-montserrat-black`
 * but parameterized for the high-energy MrBeast register: the `'mrbeast'`
 * style bundle on the primitive supplies the Komika Axis 108 caps + black
 * stroke (5 px vs Hormozi's 6 px) + 3-color cycling highlight (`#FF3B30` red
 * → `#FFD60A` yellow → `#34C759` green) + `bounce` entrance with 80 ms
 * stagger defaults — `buildProps` only declares `words`, `style`, `position`,
 * and the documentation backdrop, leaving the bundle to drive the visual
 * register (D-T363-4 / D-T363-13 / D-T363-14). Mid-hold at frame 60 (=
 * 2000 ms @ 30fps) lands word 6 (`"dollars"`) as the active highlight per
 * the primitive's strict `currentTimeMs >= startMs && currentTimeMs < endMs`
 * rule (D-T363-6). Words 2 / 4 / 6 carry `emphasis: 'highlight'`; the
 * primitive's rolling `highlightedIndex % 3` routes them through the cycling
 * palette so all three colors render in one frame.
 */
export const MRBEAST_CANONICAL_WORDS: ReadonlyArray<{
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly emphasis?: 'normal' | 'highlight' | 'mute';
}> = [
  { text: 'I', startMs: 0, endMs: 350 },
  { text: 'gave', startMs: 350, endMs: 700, emphasis: 'highlight' },
  { text: 'away', startMs: 700, endMs: 1050 },
  { text: 'one', startMs: 1050, endMs: 1400, emphasis: 'highlight' },
  { text: 'million', startMs: 1400, endMs: 1750 },
  { text: 'dollars', startMs: 1750, endMs: 2100, emphasis: 'highlight' },
];

const mrbeastBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'caption',
  buildProps() {
    return {
      words: MRBEAST_CANONICAL_WORDS.map((w) => ({ ...w })),
      style: 'mrbeast',
      // Center-screen per D-T363-12, scaled to the 1280×720 default
      // composition: 10% inset (x=128), upper-center (y=200) so the larger
      // 108 px font + flex-wrap-to-3-lines block stays inside the 720 px
      // canvas. Spec's D-T363-12 prose calls for vertical center; the
      // implementer's note allows shifting `y` upward when size-108 wrapped
      // lines clip the canvas. Differentiates from T-362's lower-third
      // (y=432) anchor in the parity-golden corpus.
      position: { x: 128, y: 200, width: 1024, alignment: 'center' as const },
      // Documentation-only — same canvas-bleed quirk as T-362 (the bundle's
      // `backdrop: 'none'` + the primitive's transparent container mean the
      // host bundle's default canvas color reaches the parity golden).
      background: '#0E0E12',
    };
  },
};

/**
 * `tiktok-rounded-box` (T-364) — third `caption`-clipKind preset, bound to the
 * same `caption` primitive (T-316) as T-362's `hormozi-montserrat-black` and
 * T-363's `mrbeast-komika-axis` but parameterized for TikTok's auto-caption
 * register: the `'tiktok'` style bundle on the primitive supplies the system
 * sans 700 + sentence-case + white-on-white-pill foreground/highlight + zero
 * stroke + per-word `backdrop: 'pill'` at 0.9 opacity + `slide-from-bottom`
 * entrance with 80 ms stagger defaults — `buildProps` only declares `words`,
 * `style`, `position`, and the documentation backdrop, leaving the bundle to
 * drive the visual register (D-T364-4 / D-T364-13 / D-T364-14). Mid-hold at
 * frame 45 (= 1500 ms @ 30fps) lands word 4 (`'see'`) as the active word and
 * word 5 (`'this'`) mid-slide-from-bottom — capturing the entrance in motion
 * (D-T364-6). No `emphasis` field on any word — TikTok bundle's
 * `highlightColor` equals `foreground` so the pill backdrop IS the visual
 * emphasis, not a per-word color shift.
 */
export const TIKTOK_CANONICAL_WORDS: ReadonlyArray<{
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}> = [
  { text: 'Wait', startMs: 0, endMs: 400 },
  { text: 'until', startMs: 400, endMs: 800 },
  { text: 'you', startMs: 800, endMs: 1200 },
  { text: 'see', startMs: 1200, endMs: 1600 },
  { text: 'this', startMs: 1600, endMs: 2000 },
];

const tiktokBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'caption',
  buildProps() {
    return {
      words: TIKTOK_CANONICAL_WORDS.map((w) => ({ ...w })),
      style: 'tiktok',
      // Center-screen per D-T364-12, scaled to the 1280×720 default
      // composition: 10% inset (x=128), vertical center (y=360), 80% width
      // (1024). Differentiates from T-362's lower-third (y=432) anchor and
      // T-363's upper-center (y=200, shifted up to fit 108px caps wrap) in
      // the parity-golden corpus. TikTok's vertical-mobile register is
      // typically center / upper-center to avoid the bottom 20–25% reserved
      // for platform UI; the parity composition is landscape so true
      // center-screen reads as the canvas center.
      position: { x: 128, y: 360, width: 1024, alignment: 'center' as const },
      // Documentation-only — same canvas-bleed quirk as T-362 / T-363 (the
      // bundle's `background: '#000000'` is rendered into the per-word pill
      // rects via `backdrop: 'pill'`, NOT the canvas). The pills supply
      // local contrast against the host canvas regardless of the canvas
      // backdrop color (D-T364-11). Mid-tone gray here is the spec's
      // documented intent for legibility against pills; if the canvas
      // bleeds white, the black-on-white pills still read.
      background: '#5A5A5A',
    };
  },
};

/**
 * `ali-abdaal-opacity-karaoke` (T-365) — fourth `caption`-clipKind preset, bound
 * to the same `caption` primitive (T-316) as T-362 / T-363 / T-364 but
 * parameterized for Ali Abdaal's clean-aesthetic education-creator register:
 * the `'ali-abdaal'` style bundle on the primitive supplies the Inter 600
 * sentence-case dark-gray (`#1F1F1F`) foreground + `highlightColor` ===
 * `muteColor` === `foreground` (no color shift on the active word) +
 * `muteOpacity: 0.6` (active = 1.0 / past = 0.6 opacity-only emphasis) +
 * `strokeWidth: 0` (no stroke) + `backdrop: 'none'` (no panel/pill) +
 * `entrance: 'none'` (no per-word animation) + `staggerMs: 0` defaults —
 * `buildProps` only declares `words`, `style`, and `position`, leaving the
 * bundle to drive the visual register (D-T365-4 / D-T365-13 / D-T365-14).
 * Mid-hold at frame 60 (= 2000 ms @ 30fps) lands word 7 (`'by'`) as the
 * active word; six prior words render at opacity 0.6 (visibly muted); word 8
 * (`'teaching'`) is below its `startMs` (2100 ms) so not yet rendered. No
 * `emphasis` field on any word — opacity comes from active-vs-rest routing
 * (`muteColor === highlightColor === foreground`), not from per-word emphasis
 * tags. White canvas bleed is on-brand: the bundle's intended visual register
 * IS dark-gray-on-white (D-T365-11; canvas-bleed quirk inherited from T-362
 * but impact REVERSED — siblings document it as undesirable, here it is the
 * intended visual).
 */
export const ALI_ABDAAL_CANONICAL_WORDS: ReadonlyArray<{
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}> = [
  { text: 'The', startMs: 0, endMs: 300 },
  { text: 'best', startMs: 300, endMs: 600 },
  { text: 'way', startMs: 600, endMs: 900 },
  { text: 'to', startMs: 900, endMs: 1200 },
  { text: 'learn', startMs: 1200, endMs: 1500 },
  { text: 'is', startMs: 1500, endMs: 1800 },
  { text: 'by', startMs: 1800, endMs: 2100 },
  { text: 'teaching', startMs: 2100, endMs: 2400 },
];

const aliAbdaalBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'caption',
  buildProps() {
    return {
      words: ALI_ABDAAL_CANONICAL_WORDS.map((w) => ({ ...w })),
      style: 'ali-abdaal',
      // Lower-third per D-T365-12, scaled to the 1280×720 default composition:
      // 10% inset (x=128), lower-third (y=432, same anchor as T-362 Hormozi),
      // 80% width (1024). Differentiates from T-363 (y=200) / T-364 (y=360) in
      // the parity-golden corpus; matches T-362's lower-third anchor —
      // appropriate for the education-aesthetic register, which canonically
      // sits below the speaker's torso.
      position: { x: 128, y: 432, width: 1024, alignment: 'center' as const },
      // No `background` override — the bundle's `background: '#FFFFFF'` is
      // declared but only honored when `backdrop !== 'none'` (the
      // `'ali-abdaal'` bundle ships `backdrop: 'none'`). The host bundle's
      // default canvas color reaches the parity golden; if it defaults to
      // white the bleed gives the intended dark-gray-on-white register
      // (D-T365-11 — quirk reversed for this preset).
    };
  },
};

/**
 * `netflix-invisible` (T-366) — fifth `caption`-clipKind preset, bound to the
 * same `caption` primitive (T-316) as T-362 / T-363 / T-364 / T-365 but
 * parameterized for Netflix's strict-accessibility long-form-video subtitle
 * register: the `'netflix'` style bundle on the primitive supplies Netflix
 * Sans / Inter weight 500 + sentence-case + `#FFFFFF` foreground +
 * `highlightColor` === `muteColor` === `foreground` (no color shift on the
 * active word) + **`muteOpacity: 0`** (the strictest possible — past / future
 * visible words render at zero opacity, completely invisible) +
 * `strokeWidth: 1` (subtle black stroke for canvas-bleed contrast) +
 * `backdrop: 'rect'` at `0.7` opacity (translucent black rectangle behind the
 * active word) + `entrance: 'none'` (no per-word animation) + `staggerMs: 0`
 * defaults — `buildProps` only declares `words`, `style`, and `position`,
 * leaving the bundle to drive the visual register (D-T366-4 / D-T366-13).
 * Mid-hold at frame 45 (= 1500 ms @ 30fps) lands word 4 (`'for'`,
 * `startMs: 1200, endMs: 1600`) as the **only visible word**: words 1–3
 * render at opacity 0 (past — `muteOpacity: 0` makes them effectively
 * invisible per T-316a's routing fix); word 5 (`'everyone'`, `startMs: 1600`)
 * is below its `startMs` so not yet rendered. No `emphasis` field on any
 * word — visibility comes from active-vs-rest routing with `muteOpacity: 0`,
 * not from per-word emphasis tags. The strictest active-word emphasis in the
 * cluster F register space; distinguishes from T-365's `muteOpacity: 0.6`
 * faint-ghost karaoke and from T-362 / T-363 / T-364's `muteOpacity: 1`
 * no-mute registers (D-T366-13). Black-bundle-on-canvas posture is the same
 * as T-362 / T-363 (D-T366-11): the bundle's `background: '#000000'` is
 * declared but only honored when `backdrop !== 'none'` — `backdrop: 'rect'`
 * renders a translucent black rectangle ONLY behind the active word's region,
 * NOT a full-canvas backdrop.
 */
export const NETFLIX_CANONICAL_WORDS: ReadonlyArray<{
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}> = [
  { text: 'Captions', startMs: 0, endMs: 400 },
  { text: 'enable', startMs: 400, endMs: 800 },
  { text: 'accessibility', startMs: 800, endMs: 1200 },
  { text: 'for', startMs: 1200, endMs: 1600 },
  { text: 'everyone', startMs: 1600, endMs: 2000 },
];

const netflixBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'caption',
  buildProps() {
    return {
      words: NETFLIX_CANONICAL_WORDS.map((w) => ({ ...w })),
      style: 'netflix',
      // Bottom-of-frame anchor per D-T366-12 — Netflix's accessibility-caption
      // convention sits below T-362 / T-365's lower-third (y=432); 1280×720
      // composition: 10% inset (x=128), 75% down (y=540), 80% width (1024).
      // Differentiates from T-363 (y=200 upper-center) / T-364 (y=360 center)
      // / T-362 + T-365 (y=432 lower-third) in the parity-golden corpus.
      position: { x: 128, y: 540, width: 1024, alignment: 'center' as const },
      // No `background` override — the bundle's `background: '#000000'` is
      // declared but only honored when `backdrop !== 'none'` is full-line;
      // the `'netflix'` bundle ships `backdrop: 'rect'` which renders a
      // translucent black rectangle ONLY behind the active word's region,
      // NOT a full-canvas backdrop. Black-bundle-on-canvas posture inherited
      // from T-362 / T-363 (D-T366-11).
    };
  },
};

/**
 * `karaoke-progressive-wipe` (T-367) — first and only `lyrics`-clipKind preset
 * to date, bound to the `lyrics` primitive shipped by T-322. Three-line stack
 * of anthemic phrasing with per-line left-to-right karaoke wipe driven by
 * `(currentTimeMs - line.startMs) / (line.endMs - line.startMs)`; mid-hold at
 * frame 105 (= 3500 ms @ 30fps) lands line 2 (`'We were stronger together'`)
 * active at 40% wipe progress, line 1 dimmed above and line 3 preview below
 * (D-T367-7). The bundle's defaults supply Bebas Neue / Anton fallback chain
 * at weight 700 size 96, `#CCCCCC` foreground, `#F3CE32` highlight, 0.5 mute
 * opacity, 80 px line gap, `'fade'` entrance — `buildProps` declares only
 * `lines`, `style`, `position`, `maxLinesVisible`, `glow`, `casing`, and the
 * dark-canvas documentation backdrop, leaving the bundle to drive the rest of
 * the visual register (D-T367-4 / D-T367-15). Wired as the `lyrics` clipKind-
 * default (mirrors T-362 hormozi's first-preset-for-clipKind precedent — first
 * `lyrics` preset takes the clipKind-default slot, NOT a `PRESET_ID_BINDINGS`
 * override).
 */
export const KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES: ReadonlyArray<{
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}> = [
  { text: 'Once upon a time', startMs: 0, endMs: 2500 },
  { text: 'We were stronger together', startMs: 2500, endMs: 5000 },
  { text: 'Now we sing alone', startMs: 5000, endMs: 7500 },
];

const lyricsBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'lyrics',
  buildProps() {
    return {
      lines: KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES.map((l) => ({ ...l })),
      style: 'karaoke-wipe' as const,
      // Center-screen vertical stack per D-T367-13 — 1280×720 default
      // composition: 10% inset (x=128), vertical center (y=360), 80% width
      // (1024). Active line sits at y=360; past line at y=280 (y - 80 default
      // line gap); next preview at y=440 — all three within the 720 px canvas.
      position: { x: 128, y: 360, width: 1024, alignment: 'center' as const },
      // Three-line register (current ± 1) per D-T367-14; the canonical music-
      // video lyric stack with active in the middle and one neighbour above /
      // below.
      maxLinesVisible: 3 as const,
      // Light white outer glow halo on the active line per D-T367-15 — `blur:
      // 6` SVG `stdDeviation` produces a perceived halo around the active
      // wipe line; T-322 D-T322-6 ships static glow (no animated build-up).
      glow: { color: '#FFFFFF', blur: 6 },
      // ALL-CAPS canonical posture per D-T367-6 — high-impact lyric-video
      // register; applied at render time via the primitive's `applyCasing`
      // helper.
      casing: 'uppercase' as const,
      // Documentation-only — the primitive's container is `transparent` and
      // the `background` prop only resolves to the karaoke-wipe rendering
      // path's per-glyph fill / canvas-bleed reference (T-322 D-T322-8).
      // Declared here for the dark-canvas music-video register intent
      // (D-T367-12); the parity golden actually renders against the host
      // bundle's default canvas color.
      background: '#0E0E12',
    };
  },
};

/**
 * `magic-wall-drilldown` (T-355) — first `fullScreen`-clipKind preset, bound
 * to the `magic-wall-panel` primitive shipped by T-355a. The cached snapshot
 * substitutes for the live election-results endpoint per ADR-003 §D2 (the
 * `staticFallback` render path); `LiveDataClip`'s wrapper is bypassed and
 * `magic-wall-panel` is mounted directly with the snapshot inlined as props
 * (D-T355-12; same posture as T-356 D-T356-11 + T-357 D-T357-12). Canonical
 * top-level snapshot: 8-region simplified electoral grid (illustrative subset
 * of US states), party-shaded with mixed Dem Blue / Rep Red / tied / undecided
 * to exercise all four color paths in the single mid-hold golden (D-T355-4).
 *
 * Per-region geometry is placeholder rectangles in v1 (D-T355-6); real US
 * state SVG paths are deferred to a future asset-pipeline follow-up. Each
 * region carries `value` (electoral-vote count) rendered via `valueFormat:
 * 'count'`, plus a `valueLabel` override that pre-formats the percentage so
 * a single mid-hold frame surfaces both numerics. The party-shading color
 * lives directly in `region.color` per the primitive's prop schema (no
 * `partyAColor` / `partyBColor` / etc. on `MagicWallPanel`).
 */
export const MAGIC_WALL_CANONICAL_REGIONS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly electoralVotes: number;
  readonly percent: number;
  readonly party: 'A' | 'B' | 'tied' | 'undecided';
}> = [
  { id: 'CA', label: 'CA', electoralVotes: 54, percent: 62.1, party: 'A' },
  { id: 'TX', label: 'TX', electoralVotes: 40, percent: 56.4, party: 'B' },
  { id: 'FL', label: 'FL', electoralVotes: 30, percent: 51.2, party: 'B' },
  { id: 'NY', label: 'NY', electoralVotes: 28, percent: 58.7, party: 'A' },
  { id: 'PA', label: 'PA', electoralVotes: 19, percent: 49.8, party: 'tied' },
  { id: 'OH', label: 'OH', electoralVotes: 17, percent: 50.3, party: 'B' },
  { id: 'GA', label: 'GA', electoralVotes: 16, percent: 50.1, party: 'undecided' },
  { id: 'AZ', label: 'AZ', electoralVotes: 11, percent: 50.7, party: 'A' },
];

const MAGIC_WALL_PARTY_COLORS: Readonly<Record<'A' | 'B' | 'tied' | 'undecided', string>> = {
  A: '#0044CC', // Dem Blue
  B: '#CC0000', // Rep Red
  tied: '#7A3FB2', // purple — contested
  undecided: '#666666', // neutral gray — too-close-to-call
};

const MAGIC_WALL_DEFAULT_STAGGER_MS = 60;
// Tile layout: 4×2 grid sized for a 1280×720 composition (matches the
// generator's DEFAULT_COMPOSITION). Tiles sit below the 64 px title +
// 32 px subtitle band the primitive renders into the top of the panel.
const MAGIC_WALL_TILE_ORIGIN_X = 60;
const MAGIC_WALL_TILE_ORIGIN_Y = 140;
const MAGIC_WALL_TILE_WIDTH = 280;
const MAGIC_WALL_TILE_HEIGHT = 220;
const MAGIC_WALL_TILE_GAP = 12;

const fullScreenBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'magic-wall-panel',
  buildProps() {
    return {
      regions: MAGIC_WALL_CANONICAL_REGIONS.map((r, i) => ({
        id: r.id,
        label: r.label,
        value: r.electoralVotes,
        // The primitive's auto-sized tile typography (~48 px at the 280×220
        // canonical tile geometry) cannot fit `"<EV> EV · <%>"` without
        // truncation; the broadcast canon is the leading-party percentage as
        // the salient signal (the electoral-vote count is identification, not
        // message). v1 surfaces the percentage via `valueLabel` (overrides the
        // `'count'`-format dispatch on `value`) and documents the electoral
        // count in the prose contract + canonical-snapshot constant. The
        // numeric `value` field stays populated so future tile-geometry
        // revisions (or a tile-internal stack-layout follow-up) can switch
        // back to dual-render without changing the snapshot shape.
        valueLabel: `${r.percent.toFixed(1)}%`,
        color: MAGIC_WALL_PARTY_COLORS[r.party],
        bounds: {
          x: MAGIC_WALL_TILE_ORIGIN_X + (i % 4) * (MAGIC_WALL_TILE_WIDTH + MAGIC_WALL_TILE_GAP),
          y:
            MAGIC_WALL_TILE_ORIGIN_Y +
            Math.floor(i / 4) * (MAGIC_WALL_TILE_HEIGHT + MAGIC_WALL_TILE_GAP),
          width: MAGIC_WALL_TILE_WIDTH,
          height: MAGIC_WALL_TILE_HEIGHT,
        },
      })),
      title: 'Election Results',
      subtitle: 'State-by-state breakdown',
      valueFormat: 'count' as const,
      entrance: 'stagger-rise' as const,
      staggerMs: MAGIC_WALL_DEFAULT_STAGGER_MS,
      background: '#0E0E12',
      foreground: '#FFFFFF',
    };
  },
};

/**
 * `squid-game-geometric` (T-350) — first and (so far) only `titleSequence`-
 * clipKind preset to ship; bound to the `titleSequence` primitive shipped
 * by T-321. Six-shot timeline (5000 ms @ 30 fps = 150 frames) drives the
 * brutalist Squid-Game register: hot pink / teal / black hard-cut palette
 * jump cuts with inline ○△□ Unicode glyphs (D-T350-4) cycled across shots
 * 1–3, a teal-panel bridge at shot 4, and a `'SQUID GAME'` ALL-CAPS title
 * plate at shot 5 (D-T350-3). The `'palette-jump-cut'` style bundle (T-321
 * D-T321-3) hard-codes cut-only transitions regardless of declared
 * `transitionOut`, bleeds the most-recent `colorPanel.content.color`
 * through the container background, and dispatches `colorPanel.content.glyph`
 * through the foreground render path at `font.size * 1.5` centered. Mid-
 * hold at frame 120 (= 4000 ms; mid shot 5) lands the title plate fully
 * assembled on the teal `#067162` panel bleed (D-T350-5). Wired as the
 * `titleSequence` clipKind-default (Pattern C — first preset for a
 * clipKind takes the clipKind-default slot, NOT a `PRESET_ID_BINDINGS`
 * override; sister Cluster D presets T-348 / T-349 / T-351 / T-352 / T-353
 * supply per-preset overrides via `PRESET_ID_BINDINGS`).
 */
export const SQUID_GAME_GEOMETRIC_SHOTS: ReadonlyArray<{
  readonly id: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly kind: 'colorPanel' | 'titlePlate';
  readonly content: { color?: string; glyph?: string; text?: string };
  readonly transitionOut: 'cut';
}> = [
  {
    id: 'panel-pink-prelude',
    startMs: 0,
    endMs: 600,
    kind: 'colorPanel',
    content: { color: '#E91E63' },
    transitionOut: 'cut',
  },
  {
    id: 'panel-teal-circle',
    startMs: 600,
    endMs: 1200,
    kind: 'colorPanel',
    content: { color: '#067162', glyph: '○' },
    transitionOut: 'cut',
  },
  {
    id: 'panel-black-triangle',
    startMs: 1200,
    endMs: 1800,
    kind: 'colorPanel',
    content: { color: '#000000', glyph: '△' },
    transitionOut: 'cut',
  },
  {
    id: 'panel-pink-square',
    startMs: 1800,
    endMs: 2400,
    kind: 'colorPanel',
    content: { color: '#E91E63', glyph: '□' },
    transitionOut: 'cut',
  },
  {
    id: 'panel-teal-title',
    startMs: 2400,
    endMs: 3600,
    kind: 'colorPanel',
    content: { color: '#067162' },
    transitionOut: 'cut',
  },
  {
    id: 'title-hold',
    startMs: 3600,
    endMs: 5000,
    kind: 'titlePlate',
    content: { text: 'SQUID GAME' },
    transitionOut: 'cut',
  },
];

/**
 * CNN-Classic snapshot props per D-T323-1 / D-T323-4 / D-T323-5. Cluster A
 * preset T-323 wires the `LowerThird` primitive (T-183) end-to-end as the
 * first `lowerThird` clipKind binding (Pattern C — clipKind-default, NOT
 * `PRESET_ID_BINDINGS` override). Sister Cluster A `lowerThird` presets
 * (T-325 `bbc-reith-dark`, T-326 `al-jazeera-orange`, T-329 `netflix-doc-lt`,
 * T-330 `apple-tv-lt`) will supply per-preset snapshots via
 * `PRESET_ID_BINDINGS` (T-360 D-T360-2 / Pattern C mechanism).
 *
 * Snapshot captures the canonical CNN-Classic steady-state lower-third
 * register: white banner + red flag end-cap + UPPERCASE bold headline +
 * Mixed-Case talent ID. LIVE bug, CNN bug, ticker strip, and red-block-wipe
 * are deferred to T-323a/b/c/d carve-outs IF Reviewer scrutiny demands
 * them (per D-T323-3).
 */
export const CNN_CLASSIC_PROPS: {
  readonly name: string;
  readonly title: string;
  readonly accent: string;
  readonly background: string;
  readonly textColor: string;
  readonly insetLeftPx: number;
  readonly insetBottomPx: number;
} = {
  name: 'BREAKING: SUPREME COURT RULES',
  title: 'Anderson Cooper · Chief Anchor',
  accent: '#CC0000', // CNN red — the flag end-cap (D-T323-1; Boston University Red / PMS 2347 C)
  background: '#FFFFFF', // white banner (D-T323-1)
  textColor: '#000000', // headline black (D-T323-1)
  insetLeftPx: 64, // closer to stub's 60–80 px range than the primitive's default 96 (D-T323-4)
  insetBottomPx: 64,
};

const cnnClassicBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'lower-third', // kebab-case primitive `kind` (D-T323-12)
  buildProps() {
    return { ...CNN_CLASSIC_PROPS };
  },
};

/**
 * BBC Reith-dark snapshot props per D-T325-1 / D-T325-4 / D-T325-12. Cluster A
 * preset T-325 wires the `LowerThird` primitive (T-183) as the second
 * `lowerThird` clipKind consumer (Pattern C — `PRESET_ID_BINDINGS` override,
 * NOT the clipKind-default which T-323 holds). Mirrors T-363 / T-364 / T-365 /
 * T-366's pattern in the caption family for the lowerThird clipKind.
 *
 * Snapshot captures the canonical BBC Reith-dark steady-state lower-third
 * register: dark `#1A1A1A` bar + BBC Red `#BB1919` left-edge accent strip +
 * Mixed-Case `'Sarah Smith'` headline (white) + Mixed-Case
 * `'Chief Political Correspondent'` subtitle (rendered in `accent` red per
 * the primitive's hard-coded `title` color binding — D-T325-12-a).
 * Multi-stage entrance choreography (red strip → bar wipe L→R → text slide),
 * ticker companion, and fade-down exit are deferred to T-325a/b/c carve-outs
 * IF Reviewer scrutiny demands them (per D-T325-3). Background opacity (stub
 * spec: 85 %) renders at 100 % in v1 — the primitive's `background` prop is a
 * single hex string with no opacity channel; the 85 % spec is a production
 * tunable for arbitrary-footage overlays, not a parity-canvas concern.
 */
export const BBC_REITH_DARK_PROPS: {
  readonly name: string;
  readonly title: string;
  readonly accent: string;
  readonly background: string;
  readonly textColor: string;
  readonly insetLeftPx: number;
  readonly insetBottomPx: number;
} = {
  name: 'Sarah Smith',
  title: 'Chief Political Correspondent',
  accent: '#BB1919', // BBC Red — the left-edge accent strip (D-T325-1)
  background: '#1A1A1A', // dark bar (D-T325-1; 85 % opacity is production tunable, not v1 parity)
  textColor: '#FFFFFF', // headline white (D-T325-1)
  insetLeftPx: 64, // far-left anchor; matches T-323's 64 for cluster-internal consistency (D-T325-4)
  insetBottomPx: 48, // 40–60 px stub range; closer to bottom than T-323 (BBC bars sit lower)
};

const bbcReithDarkBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'lower-third', // kebab-case primitive `kind` (mirrors T-323 D-T323-12)
  buildProps() {
    return { ...BBC_REITH_DARK_PROPS };
  },
};

/**
 * Al Jazeera orange snapshot props per D-T326-1 / D-T326-4 / D-T326-12.
 * Cluster A preset T-326 wires the `LowerThird` primitive (T-183) as the
 * third `lowerThird` clipKind consumer (Pattern C — `PRESET_ID_BINDINGS`
 * override, NOT the clipKind-default which T-323 holds; second
 * `lowerThird`-keyed override after T-325). Mirrors T-325's
 * `bbcReithDarkBinding` shape, swapping the snapshot constants for the
 * orange-on-light register.
 *
 * Snapshot captures the canonical Al Jazeera English steady-state
 * lower-third register: light `#F7F7F5` bar + orange `#F7941D` left-edge
 * accent strip + Mixed-Case `'Marwan Bishara'` headline (dark `#222222`)
 * + Mixed-Case `'Senior Political Analyst'` subtitle (rendered in
 * `accent` orange per the primitive's hard-coded `title` color binding —
 * D-T326-12-a).
 *
 * v1 is Latin-only; the Arabic companion (`الجزيرة` second-language slot)
 * is deferred to T-326a IF Reviewer demands — the primitive does NOT
 * support a second-language / RTL / bidi prop axis (D-T326-3). Mirrors
 * T-350's D-T350-12 Hangul-deferred posture.
 *
 * Multi-stage entrance choreography, gradient accent (`#F7941D` →
 * `#E87722` deferred per D-T326-4), kraft-paper texture, extended-width
 * bilingual bar are all primitive-level follow-ups (`T-183z`-family).
 */
export const AL_JAZEERA_ORANGE_PROPS: {
  readonly name: string;
  readonly title: string;
  readonly accent: string;
  readonly background: string;
  readonly textColor: string;
  readonly insetLeftPx: number;
  readonly insetBottomPx: number;
} = {
  name: 'Marwan Bishara',
  title: 'Senior Political Analyst',
  accent: '#F7941D', // Al Jazeera orange (dominant; gradient → amber #E87722 deferred — D-T326-4)
  background: '#F7F7F5', // light bar (D-T326-1; departure from T-323 white / T-325 dark)
  textColor: '#222222', // headline dark on light (D-T326-1)
  insetLeftPx: 64, // far-left anchor; matches T-323 + T-325 cluster-internal consistency
  insetBottomPx: 48, // 40–60 px stub range; matches T-325 (al-jazeera bars sit lower like BBC)
};

const alJazeeraOrangeBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'lower-third', // kebab-case primitive `kind` (mirrors T-323 / T-325)
  buildProps() {
    return { ...AL_JAZEERA_ORANGE_PROPS };
  },
};

/**
 * Apple TV+ minimalist snapshot props per D-T330-1 / D-T330-6 / D-T330-12.
 * Cluster A preset T-330 wires the `LowerThird` primitive (T-183 + T-183z)
 * as the fourth `lowerThird` clipKind consumer (Pattern C —
 * `PRESET_ID_BINDINGS` override; third `lowerThird`-keyed override after
 * T-325 + T-326). Mirrors T-326's `alJazeeraOrangeBinding` shape, swapping
 * the snapshot constants for the Apple TV+ minimalist register.
 *
 * T-330 is the first production consumer of the just-shipped T-183z props
 * (`noFlag` / `subtitleColor` / `font`). All three are exercised: `noFlag:
 * true` suppresses the 6 px accent strip (Apple TV+ has no chrome);
 * `subtitleColor: '#FFFFFF'` decouples the talent-line from the (irrelevant)
 * `accent` per Apple's clean register; `font: { family: 'Inter', weight:
 * 300 }` substitutes the OFL fallback for Apple's proprietary SF Pro at
 * Light weight (300).
 *
 * Snapshot captures the canonical Apple TV+ steady-state lower-third
 * register: NO flag (T-183z) + black `#000000` card (canvas-matching;
 * visually disappears) + Mixed-Case `'Sofia Coppola'` headline (white
 * `#FFFFFF` Inter Light) + Mixed-Case `'Director'` subtitle (white
 * `#FFFFFF` Inter Light via T-183z `subtitleColor`).
 */
export const APPLE_TV_LT_PROPS: {
  readonly name: string;
  readonly title: string;
  readonly accent: string;
  readonly background: string;
  readonly textColor: string;
  readonly insetLeftPx: number;
  readonly insetBottomPx: number;
  readonly noFlag: true;
  readonly subtitleColor: string;
  readonly font: { readonly family: string; readonly weight: number };
} = {
  name: 'Sofia Coppola',
  title: 'Director',
  accent: '#FFFFFF', // irrelevant — noFlag: true suppresses the strip (D-T330-3)
  background: '#000000', // canvas-matching black; card visually disappears (D-T330-1)
  textColor: '#FFFFFF', // headline white-on-black (D-T330-1)
  insetLeftPx: 140, // mid-range of stub's 130–150 (D-T330-1)
  insetBottomPx: 95, // mid-range of stub's 90–100 (D-T330-1)
  noFlag: true, // T-183z — text-only register; no chrome (D-T330-3)
  subtitleColor: '#FFFFFF', // T-183z — talent-line decoupled from accent (D-T330-4)
  font: { family: 'Inter', weight: 300 }, // T-183z — Inter Light = SF Pro Light fallback (D-T330-5)
};

const appleTvLtBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'lower-third', // kebab-case primitive `kind` (mirrors T-323 / T-325 / T-326)
  buildProps() {
    return { ...APPLE_TV_LT_PROPS };
  },
};

/**
 * Netflix documentary minimalist snapshot props per D-T329-1 / D-T329-6 /
 * D-T329-11. Cluster A preset T-329 wires the `LowerThird` primitive
 * (T-183 + T-183z) as the fifth `lowerThird` clipKind consumer (Pattern C
 * — `PRESET_ID_BINDINGS` override; fourth `lowerThird`-keyed override
 * after T-325 + T-326 + T-330). Mirrors T-330's `appleTvLtBinding` shape,
 * swapping the snapshot constants for the Netflix doc minimalist register.
 *
 * T-329 is the **second production consumer of T-183z's `noFlag` /
 * `subtitleColor` / `font` props** (T-330 was first). All three are
 * exercised: `noFlag: true` suppresses the 6 px accent strip (Netflix
 * doc register has no chrome); `subtitleColor: '#FFFFFF'` decouples the
 * talent-line from the (irrelevant) `accent`; `font: { family: 'DM Sans',
 * weight: 500 }` substitutes the OFL fallback for Netflix Sans at
 * Medium weight.
 *
 * The `title` text is passed as the literal upper-case string
 * `'DIRECTOR'` to honor the stub's "ALL CAPS title is the signature"
 * rule (line 43) without a primitive `casing` prop — D-T329-6
 * establishes the canonical "headline Mixed Case + title ALL CAPS"
 * snapshot-string casing pattern for any future preset whose stub
 * demands per-line casing.
 *
 * Snapshot captures the canonical Netflix doc steady-state lower-third:
 * NO flag (T-183z) + black `#000000` card (canvas-matching; visually
 * disappears) + Mixed-Case `'Ava DuVernay'` headline (white `#FFFFFF`
 * DM Sans Medium) + ALL-CAPS `'DIRECTOR'` subtitle (white `#FFFFFF`
 * DM Sans Medium via T-183z `subtitleColor`).
 */
export const NETFLIX_DOC_LT_PROPS: {
  readonly name: string;
  readonly title: string;
  readonly accent: string;
  readonly background: string;
  readonly textColor: string;
  readonly insetLeftPx: number;
  readonly insetBottomPx: number;
  readonly noFlag: true;
  readonly subtitleColor: string;
  readonly font: { readonly family: string; readonly weight: number };
} = {
  name: 'Ava DuVernay',
  title: 'DIRECTOR',
  accent: '#FFFFFF', // irrelevant — noFlag: true suppresses the strip (D-T329-3)
  background: '#000000', // canvas-matching black; card visually disappears (D-T329-1)
  textColor: '#FFFFFF', // headline white-on-black (D-T329-1)
  insetLeftPx: 120, // stub line 26 exact (D-T329-1)
  insetBottomPx: 80, // stub line 26 exact (D-T329-1)
  noFlag: true, // T-183z — text-only register; no chrome (D-T329-3)
  subtitleColor: '#FFFFFF', // T-183z — talent-line decoupled from accent (D-T329-4)
  font: { family: 'DM Sans', weight: 500 }, // T-183z — DM Sans Medium = Netflix Sans fallback (D-T329-5)
};

const netflixDocLtBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'lower-third', // kebab-case primitive `kind` (mirrors T-323 / T-325 / T-326 / T-330)
  buildProps() {
    return { ...NETFLIX_DOC_LT_PROPS };
  },
};

/**
 * Social-handle cross-platform-passport snapshot props per D-T373-1 /
 * D-T373-6 / D-T373-12. Cluster G preset T-373 wires the `LowerThird`
 * primitive (T-183 + T-183z) as the **sixth `lowerThird` clipKind consumer**
 * (Pattern C — `PRESET_ID_BINDINGS` override; **fifth `lowerThird`-keyed
 * override** after T-325 + T-326 + T-330 + T-329). Mirrors T-330's
 * `appleTvLtBinding` shape, swapping the snapshot constants for the
 * cross-platform social-handle register.
 *
 * T-373 is the **fifth production consumer of T-183z's `noFlag` /
 * `subtitleColor` / `font` props**. All three are exercised: `noFlag: true`
 * suppresses the 6 px accent strip (cross-platform register has no per-
 * platform accent); `subtitleColor: '#FFFFFF'` keeps the subtitle in white
 * (decoupled from `accent`); `font: { family: 'Inter', weight: 700 }`
 * substitutes the OFL fallback for the compound preferred font (Roboto /
 * Montserrat / Proxima Nova) at Bold weight.
 *
 * Snapshot captures the canonical social-handle steady-state lower-third:
 * NO flag (T-183z) + flat black `#000000` card (translucent register
 * approximated; D-T373-12-a) + Mixed-Case `'@yourbrand'` headline (white
 * `#FFFFFF` Inter Bold) + Mixed-Case `'Follow us everywhere'` subtitle
 * (white `#FFFFFF` Inter Bold via T-183z `subtitleColor`).
 *
 * 1280×720 canvas-size lesson (D-T373-12 / T-369): the parity-CLI generator
 * uses a 1280×720 default canvas, NOT 1920×1080. The primitive's
 * `insetLeftPx` / `insetBottomPx` are bottom-left-anchored offsets (NOT
 * absolute coordinates), so `(96, 96)` insets fit comfortably inside the
 * canvas at any size.
 */
export const SOCIAL_HANDLE_LOWER_THIRD_PROPS: {
  readonly name: string;
  readonly title: string;
  readonly accent: string;
  readonly background: string;
  readonly textColor: string;
  readonly insetLeftPx: number;
  readonly insetBottomPx: number;
  readonly noFlag: true;
  readonly subtitleColor: string;
  readonly font: { readonly family: string; readonly weight: number };
} = {
  name: '@yourbrand',
  title: 'Follow us everywhere',
  accent: '#FFFFFF', // irrelevant — noFlag: true suppresses the strip (D-T373-3)
  background: '#000000', // flat black; translucent register approximated (D-T373-12-a)
  textColor: '#FFFFFF', // headline white-on-black per cross-platform handle canon (D-T373-1)
  insetLeftPx: 96, // primitive default; canvas-safe at 1280×720 (D-T373-12)
  insetBottomPx: 96, // primitive default; canvas-safe at 1280×720 (D-T373-12)
  noFlag: true, // T-183z — text-only register; no chrome (D-T373-3)
  subtitleColor: '#FFFFFF', // T-183z — subtitle decoupled from accent (D-T373-4)
  font: { family: 'Inter', weight: 700 }, // T-183z — Inter Bold = compound-preferred OFL fallback (D-T373-5)
};

const socialHandleLowerThirdBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'lower-third', // kebab-case primitive `kind` (mirrors T-323 / T-325 / T-326 / T-330 / T-329)
  buildProps() {
    return { ...SOCIAL_HANDLE_LOWER_THIRD_PROPS };
  },
};

/**
 * CNN-Breaking snapshot props per D-T324-1 / D-T324-4. Cluster A preset T-324
 * wires the `BreakingBanner` primitive (T-324a) end-to-end as the first
 * `breakingBanner` clipKind binding (Pattern C — clipKind-default, NOT
 * `PRESET_ID_BINDINGS` override). Sister Cluster A `breakingBanner` preset
 * T-327 `fox-news-alert` will supply a per-preset snapshot via
 * `PRESET_ID_BINDINGS` (T-360 D-T360-2 / Pattern C mechanism) for the
 * sliver-register variant.
 *
 * Snapshot captures the canonical CNN-Breaking steady-state register: white
 * full-width banner + red flag end-cap (left) + red `BREAKING NEWS` label
 * badge with white text + UPPERCASE black headline rendered at Inter Tight
 * 800 (the OFL fallback honored via the primitive's `font` prop override —
 * D-T324-13). LIVE pulse, ticker strip, red-block-wipe text-change, CNN
 * bug, and staged entrance red-block sweep are deferred to T-324b/c/d
 * carve-outs IF Reviewer scrutiny demands them (per D-T324-3).
 */
export const CNN_BREAKING_PROPS: {
  readonly headline: string;
  readonly label: { readonly text: string; readonly fill: string; readonly color: string };
  readonly endCap: { readonly fill: string; readonly position: 'left' | 'right' };
  readonly background: string;
  readonly headlineColor: string;
  readonly mode: 'banner';
  readonly slideAxis: 'horizontal';
  readonly casing: 'uppercase';
  readonly font: { readonly family: string; readonly weight: number };
  readonly insetBottomPx: number;
} = {
  headline: 'SUPREME COURT RULES UNANIMOUSLY',
  label: { text: 'BREAKING NEWS', fill: '#CC0000', color: '#FFFFFF' },
  endCap: { fill: '#CC0000', position: 'left' },
  background: '#FFFFFF', // white full-width banner (D-T324-1)
  headlineColor: '#000000', // headline black (D-T324-1)
  mode: 'banner', // CNN canonical register (full-width); T-324a default
  slideAxis: 'horizontal', // CNN canonical register (slide in from left); T-324a default
  casing: 'uppercase', // defensive — headline already UPPERCASE; D-T324-5
  font: { family: 'Inter Tight', weight: 800 }, // OFL fallback honored via primitive `font` prop (D-T324-13)
  insetBottomPx: 60, // closer to bottom edge than the chyron's 64 px; D-T324-4
};

const cnnBreakingBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'breaking-banner', // kebab-case primitive `kind` (D-T324-12)
  buildProps() {
    return { ...CNN_BREAKING_PROPS };
  },
};

/**
 * Fox-News-Alert snapshot props per D-T327-1 / D-T327-4. Cluster A preset
 * T-327 wires the `BreakingBanner` primitive (T-324a) end-to-end as the
 * second `breakingBanner` clipKind consumer (Pattern C — `PRESET_ID_BINDINGS`
 * override, NOT clipKind-default; the clipKind-default arm stays
 * `cnnBreakingBinding` from T-324). First production consumer of T-324a's
 * `mode: 'sliver'` register (per D-T324a-3 / D-T324a-6) and `slideAxis:
 * 'vertical'` axis.
 *
 * Snapshot captures the canonical Fox-News-Alert steady-state register: a
 * persistent Prussian Blue narrow sliver (`#003366`, ~30 % of frame width)
 * anchored top-left + Fox-red `FOX NEWS ALERT` label badge with white text +
 * Mixed-Case white headline rendered at League Gothic 700 (the OFL fallback
 * honored via the primitive's `font` prop override — D-T327-13). Sliver mode
 * skips entrance per T-324a D-T324a-6 — the canonical Fox posture is the
 * persistent register, NOT entrance animation. Searchlight morph,
 * return-from-commercial sequence, LIVE pulse, ticker, and dark overlay are
 * deferred to T-327a/T-327b/T-324b/sister carve-outs IF Reviewer scrutiny
 * demands them (per D-T327-3). NO `endCap` — Fox doesn't use a flag end-cap;
 * the sliver IS the brand mark (per D-T327-4).
 */
export const FOX_NEWS_ALERT_PROPS: {
  readonly headline: string;
  readonly label: { readonly text: string; readonly fill: string; readonly color: string };
  readonly background: string;
  readonly headlineColor: string;
  readonly mode: 'sliver';
  readonly slideAxis: 'vertical';
  readonly sliverAnchor: 'top-left';
  readonly sliverWidthPct: number;
  readonly casing: 'as-is';
  readonly font: { readonly family: string; readonly weight: number };
} = {
  // Shortened from 'Major Storm Approaches East Coast' on 2026-05-06 after
  // product-owner visual inspection found the longer phrase truncated mid-word
  // at the sliver's 30% width edge. Sliver-fit-tested at 17 chars.
  headline: 'Major Storm Watch',
  label: { text: 'FOX NEWS ALERT', fill: '#C20017', color: '#FFFFFF' },
  background: '#003366', // Prussian Blue persistent sliver (D-T327-1)
  headlineColor: '#FFFFFF', // white Mixed-Case headline (D-T327-1)
  mode: 'sliver', // Fox canonical register (persistent narrow sliver); first production consumer of T-324a sliver mode
  slideAxis: 'vertical', // Fox signature vertical axis; functional no-op at steady-state per D-T327-5
  sliverAnchor: 'top-left', // T-324a default; matches Fox's canonical persistent posture in upper-left
  sliverWidthPct: 0.3, // T-324a default; ~30 % of frame width per stub line 26 narrow-sliver characterization
  casing: 'as-is', // Mixed-Case headline per stub line 31 (NOT all-caps); D-T327-4
  font: { family: 'League Gothic', weight: 700 }, // OFL fallback honored via primitive `font` prop (D-T327-13)
};

const foxNewsAlertBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'breaking-banner', // kebab-case primitive `kind` (D-T327-12)
  buildProps() {
    return { ...FOX_NEWS_ALERT_PROPS };
  },
};

/**
 * `msnbc-big-board` (T-328) — second `fullScreen`-clipKind preset; second
 * production consumer of T-355a's `magic-wall-panel` primitive (after T-355
 * `magic-wall-drilldown`). Wired via `PRESET_ID_BINDINGS['msnbc-big-board']`
 * (Pattern C — `PRESET_ID_BINDINGS` override, NOT clipKind-default; the
 * `'fullScreen'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at
 * `fullScreenBinding` from T-355). Eighth and final Cluster A preset to land
 * — closes Cluster A to 8/8 substantive + signed; unlocks T-382 (or sister)
 * cluster-batch type-design review eligibility.
 *
 * Mirrors T-355's snapshot shape verbatim (same primitive, same canonical
 * region grid `4×2` placeholder rectangles, same entrance posture, same
 * background/foreground/`valueFormat` defaults) and diverges in two places:
 * (a) tenant identity (MSNBC vs CNN) → distinct title `'2024 ELECTION
 * NIGHT'` + subtitle `'County-level — 92% Reporting'` (D-T328-4); (b)
 * partisan palette (NBC peacock-derived partisan-neutral hues vs CNN
 * Dem-Blue / Rep-Red) → distinct `MSNBC_BIG_BOARD_PARTY_COLORS` constant per
 * D-T328-4 (stub line 41 explicitly defers to the tenant's partisan-color-
 * neutral alternative).
 *
 * Per-region geometry inherits T-355's placeholder rectangles (D-T355-6)
 * arranged on a 4×2 grid sized for the 1280×720 default composition; real US
 * state SVG paths are deferred cluster-wide to a future asset-pipeline
 * follow-up. Each region carries `value` (electoral-vote count) rendered via
 * `valueFormat: 'count'`, plus a `valueLabel` override that pre-formats the
 * percentage so a single mid-hold frame surfaces both numerics. The party-
 * shading color lives directly in `region.color` per the primitive's prop
 * schema (no `partyAColor` / etc. on `MagicWallPanel`).
 */
export const MSNBC_BIG_BOARD_REGIONS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly electoralVotes: number;
  readonly percent: number;
  readonly party: 'A' | 'B' | 'tied' | 'undecided';
}> = [
  { id: 'CA', label: 'CA', electoralVotes: 54, percent: 62.1, party: 'A' },
  { id: 'TX', label: 'TX', electoralVotes: 40, percent: 56.4, party: 'B' },
  { id: 'FL', label: 'FL', electoralVotes: 30, percent: 51.2, party: 'B' },
  { id: 'NY', label: 'NY', electoralVotes: 28, percent: 58.7, party: 'A' },
  { id: 'PA', label: 'PA', electoralVotes: 19, percent: 49.8, party: 'tied' },
  { id: 'OH', label: 'OH', electoralVotes: 17, percent: 50.3, party: 'B' },
  { id: 'GA', label: 'GA', electoralVotes: 16, percent: 50.1, party: 'undecided' },
  { id: 'AZ', label: 'AZ', electoralVotes: 11, percent: 50.7, party: 'A' },
];

/**
 * NBC peacock-derived partisan-neutral palette. Distinct from
 * `MAGIC_WALL_PARTY_COLORS` (CNN Dem-Blue / Rep-Red) per stub line 41
 * ("Do not adopt CNN's Magic Wall color palette ... as-is — defer to the
 * tenant's partisan-color-neutral alternative when applicable").
 *
 * Hex values are NBC peacock-faithful: peacock blue (party A), peacock red
 * (party B), peacock purple (tied), peacock gold (undecided). The peacock's
 * six-color identity (yellow / orange / red / purple / blue / green) seeds
 * these picks; the four selected swatches are the visually distinct subset
 * that still parses as a partisan map.
 */
export const MSNBC_BIG_BOARD_PARTY_COLORS: Readonly<
  Record<'A' | 'B' | 'tied' | 'undecided', string>
> = {
  A: '#0084CB', // NBC peacock blue (party A — typically Dem)
  B: '#CC2229', // NBC peacock red (party B — typically Rep)
  tied: '#9B26B6', // NBC peacock purple — contested
  undecided: '#FCB712', // NBC peacock gold — too-close-to-call
};

const MSNBC_BIG_BOARD_DEFAULT_STAGGER_MS = 60;
// Tile layout: 4×2 grid sized for a 1280×720 composition. Inherited from
// T-355's `MAGIC_WALL_TILE_*` constants verbatim (D-T328-4).
const MSNBC_BIG_BOARD_TILE_ORIGIN_X = 60;
const MSNBC_BIG_BOARD_TILE_ORIGIN_Y = 140;
const MSNBC_BIG_BOARD_TILE_WIDTH = 280;
const MSNBC_BIG_BOARD_TILE_HEIGHT = 220;
const MSNBC_BIG_BOARD_TILE_GAP = 12;

const msnbcBigBoardBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'magic-wall-panel',
  buildProps() {
    return {
      regions: MSNBC_BIG_BOARD_REGIONS.map((r, i) => ({
        id: r.id,
        label: r.label,
        value: r.electoralVotes,
        // Mirrors T-355's `valueLabel` override posture verbatim (D-T328-4):
        // the leading-party percentage is the broadcast-canonical salient
        // signal; the electoral count lives in the prose contract + `value`.
        valueLabel: `${r.percent.toFixed(1)}%`,
        color: MSNBC_BIG_BOARD_PARTY_COLORS[r.party],
        bounds: {
          x:
            MSNBC_BIG_BOARD_TILE_ORIGIN_X +
            (i % 4) * (MSNBC_BIG_BOARD_TILE_WIDTH + MSNBC_BIG_BOARD_TILE_GAP),
          y:
            MSNBC_BIG_BOARD_TILE_ORIGIN_Y +
            Math.floor(i / 4) * (MSNBC_BIG_BOARD_TILE_HEIGHT + MSNBC_BIG_BOARD_TILE_GAP),
          width: MSNBC_BIG_BOARD_TILE_WIDTH,
          height: MSNBC_BIG_BOARD_TILE_HEIGHT,
        },
      })),
      title: '2024 ELECTION NIGHT',
      subtitle: 'County-level — 92% Reporting',
      valueFormat: 'count' as const,
      entrance: 'stagger-rise' as const,
      staggerMs: MSNBC_BIG_BOARD_DEFAULT_STAGGER_MS,
      background: '#0E0E12',
      foreground: '#FFFFFF',
    };
  },
};

/**
 * `uefa-starball-refraction` (T-339) — ninth and final Cluster B preset;
 * second `fullScreen`-clipKind preset wired via `PRESET_ID_BINDINGS`
 * (Pattern C; first `PRESET_ID_BINDINGS` `fullScreen` override was T-328
 * `msnbc-big-board`); third production consumer of T-355a's
 * `magic-wall-panel` primitive (after T-355 `magic-wall-drilldown` Cluster E
 * + T-328 `msnbc-big-board` Cluster A). Closes Cluster B to 9/9 substantive
 * + signed → fourth batch-eligible cluster after E + F + A; unlocks T-340
 * (Cluster B composer) + T-382 (Cluster B type-design batch review).
 *
 * The `'fullScreen'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at
 * `fullScreenBinding` (T-355 `magic-wall-drilldown` CNN-default); T-339
 * lands a per-preset override keyed on the preset id. All 19 prior
 * `PRESET_ID_BINDINGS` entries UNCHANGED — T-339 is the twentieth.
 *
 * V1 scope is the **placeholder tile-grid composition** at the UEFA
 * Champions League palette layer (D-T339-3). Eight canonical-register
 * elements documented as out-of-v1 (D-T339-10): canonical Starball 3D
 * composition (T-339a carve-out; requires `ThreeSceneClip`), per-character
 * refracted-typography gradient (T-339b carve-out; requires typography-
 * layer extension), light-wave continuous drift (T-339c carve-out),
 * "Ultimate Stage" CGI stadium backdrop (external compose; host
 * responsibility per ADR-005), Starball-shape promo wipes (orchestration),
 * Italic / Ritalic font variants (font-registry concern), camera-tracked
 * Starball composition (frontier per ADR-005), per-character staggered
 * 40 ms reveal (bound to T-339b).
 *
 * Mirrors T-328's snapshot shape (same primitive, region grid placeholder
 * rectangles, same entrance posture, `valueFormat: 'count'`) with three
 * divergences vs T-355 / T-328: (a) tenant identity (UEFA vs CNN vs MSNBC)
 * → distinct title `'CHAMPIONS LEAGUE'` + subtitle
 * `'MATCHDAY 6 — STANDINGS'`; (b) palette divergence (UEFA refraction vs
 * CNN partisan vs NBC peacock) → distinct `UEFA_STARBALL_PALETTE` constant;
 * (c) `background` override `#041E42` UEFA dark navy (vs primitive default
 * `#0E0E12` used by both T-355 and T-328). Six regions in 3×2 grid
 * representing major UCL knockout-stage clubs at standings register.
 */
export const UEFA_STARBALL_REGIONS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly points: number;
  readonly accent: 'navy' | 'blue' | 'cyan' | 'magenta' | 'white';
}> = [
  { id: 'RMA', label: 'RMA', points: 16, accent: 'blue' }, // Real Madrid
  { id: 'LIV', label: 'LIV', points: 15, accent: 'cyan' }, // Liverpool
  { id: 'BAY', label: 'BAY', points: 13, accent: 'magenta' }, // Bayern
  { id: 'MCI', label: 'MCI', points: 12, accent: 'blue' }, // Manchester City
  { id: 'PSG', label: 'PSG', points: 11, accent: 'cyan' }, // PSG
  { id: 'INT', label: 'INT', points: 10, accent: 'magenta' }, // Inter
];

/**
 * UEFA Champions League refraction palette per stub lines 22–23. Distinct
 * from `MAGIC_WALL_PARTY_COLORS` (CNN Dem-Blue / Rep-Red — T-355) and
 * `MSNBC_BIG_BOARD_PARTY_COLORS` (NBC peacock — T-328); the refraction
 * palette evokes light-physics prism dispersion rather than a partisan
 * map. Five swatches drawn from the canonical UEFA broadcast register:
 * dark navy primary (night-match canon) + refraction blue / cyan /
 * magenta accents (stub line 23) + white foreground.
 */
export const UEFA_STARBALL_PALETTE: Readonly<
  Record<'navy' | 'blue' | 'cyan' | 'magenta' | 'white', string>
> = {
  navy: '#041E42', // dark navy primary (night-match canon, stub line 22)
  blue: '#2DA8D8', // refraction bright blue (stub line 23)
  cyan: '#6EE0E8', // refraction cyan (stub line 23)
  magenta: '#C2185B', // refraction magenta (stub line 23)
  white: '#FFFFFF', // foreground (stub line 23)
};

const UEFA_STARBALL_DEFAULT_STAGGER_MS = 60;
// Tile layout: 3×2 grid sized for a 1280×720 composition. Different from
// T-355 / T-328 4×2 grid (eight US states) — UEFA register has six clubs.
const UEFA_STARBALL_TILE_ORIGIN_X = 200;
const UEFA_STARBALL_TILE_ORIGIN_Y = 200;
const UEFA_STARBALL_TILE_WIDTH = 280;
const UEFA_STARBALL_TILE_HEIGHT = 200;
const UEFA_STARBALL_TILE_GAP = 12;

const uefaStarballRefractionBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'magic-wall-panel',
  buildProps() {
    return {
      regions: UEFA_STARBALL_REGIONS.map((r, i) => ({
        id: r.id,
        label: r.label,
        value: r.points,
        valueLabel: `${r.points} PTS`,
        color: UEFA_STARBALL_PALETTE[r.accent],
        bounds: {
          x:
            UEFA_STARBALL_TILE_ORIGIN_X +
            (i % 3) * (UEFA_STARBALL_TILE_WIDTH + UEFA_STARBALL_TILE_GAP),
          y:
            UEFA_STARBALL_TILE_ORIGIN_Y +
            Math.floor(i / 3) * (UEFA_STARBALL_TILE_HEIGHT + UEFA_STARBALL_TILE_GAP),
          width: UEFA_STARBALL_TILE_WIDTH,
          height: UEFA_STARBALL_TILE_HEIGHT,
        },
      })),
      title: 'CHAMPIONS LEAGUE',
      subtitle: 'MATCHDAY 6 — STANDINGS',
      valueFormat: 'count' as const,
      entrance: 'stagger-rise' as const,
      staggerMs: UEFA_STARBALL_DEFAULT_STAGGER_MS,
      // UEFA dark navy override — stub line 22 ("dark navy primary, night-
      // match canon"); central palette divergence vs T-355 (`#0E0E12` CNN
      // dark) + T-328 (`#0E0E12` MSNBC dark); both prior `magic-wall-panel`
      // consumers used the primitive default `DEFAULT_BACKGROUND`.
      background: '#041E42',
      foreground: '#FFFFFF',
    };
  },
};

/**
/**
 * `bbc-mark-allen-clouds` (T-347c) — first `weatherMap`-clipKind preset; wired
 * via `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C — first preset for a clipKind
 * goes through the clipKind-default arm; later weatherMap consumers
 * T-347d / T-347e wire via `PRESET_ID_BINDINGS`). Mark Allen 1975 BBC
 * symbol set + temperature discs from canonical 6-step blue→red palette
 * `MARK_ALLEN_TEMPERATURE_DISCS`. v1 ships flat 2D — 3D rotating globe
 * deferred to T-347a-3d-globe (Track A frontier; ThreeSceneClip per
 * ADR-005). Single-frame static at frame 60 (mid-zoom-in to UK per stub
 * line 47); multi-frame globe rotation + camera swoop deferred to
 * T-347a-loop-cycle. PSNR ≥ 38 / SSIM ≥ 0.95 cluster-norm thresholds
 * per D-T347c-6.
 *
 * **Geometry sized to 1280×720 default canvas**. Rough UK + Europe
 * silhouette polygons; not pixel-accurate cartography — the primitive's
 * job is to render the canon, not bake atlas data. Real consumers
 * supply higher-fidelity geometry; this binding's polygons are
 * adequate-fidelity for parity-fixture verification.
 */

/** D-T347c-3: 4 temperature-disc regions across UK cities. */
export const BBC_MARK_ALLEN_CLOUDS_REGIONS = [
  {
    id: 'london',
    name: 'London',
    dataValue: '12°C',
    screenPosition: { x: 700, y: 480 },
    paletteIndex: 3, // mid-yellow band → mild
  },
  {
    id: 'edinburgh',
    name: 'Edinburgh',
    dataValue: '8°C',
    screenPosition: { x: 580, y: 240 },
    paletteIndex: 2, // green band → cool
  },
  {
    id: 'cardiff',
    name: 'Cardiff',
    dataValue: '10°C',
    screenPosition: { x: 540, y: 460 },
    paletteIndex: 2, // green band
  },
  {
    id: 'belfast',
    name: 'Belfast',
    dataValue: '9°C',
    screenPosition: { x: 420, y: 340 },
    paletteIndex: 2, // green band
  },
] as const;

/** D-T347c-4: 6 Mark-Allen canonical icons distributed across UK + N Atlantic. */
export const BBC_MARK_ALLEN_CLOUDS_SYMBOLS = [
  { kind: 'cloud' as const, position: { x: 500, y: 200 }, scale: 1.4 },
  { kind: 'cloud' as const, position: { x: 700, y: 320 }, scale: 1.1 },
  { kind: 'sun' as const, position: { x: 800, y: 540 }, scale: 1.2 },
  { kind: 'raindrop' as const, position: { x: 400, y: 250 }, scale: 1.0 },
  { kind: 'raindrop' as const, position: { x: 480, y: 180 }, scale: 0.9 },
  { kind: 'snow' as const, position: { x: 550, y: 160 }, scale: 1.1 },
] as const;

/**
 * D-T347c-2: synthetic UK + Europe coastal outlines sized to 1280×720.
 * Three SVG path polygons — Europe continent (rough), UK + Ireland
 * silhouette (centered, prominent), North Sea / English Channel water
 * gap (slight darker fill).
 */
export const BBC_MARK_ALLEN_CLOUDS_MAP_PATHS = [
  {
    // Europe continent — rough Iberian / French / German / Scandinavian sweep.
    id: 'europe',
    d: 'M 760,200 L 920,180 L 1080,260 L 1180,400 L 1180,640 L 920,680 L 800,640 L 760,520 L 740,400 L 720,300 Z',
    fill: '#3F4F5F',
  },
  {
    // UK + Ireland silhouette — the British register's geographic anchor.
    id: 'uk-ireland',
    d: 'M 380,200 L 470,140 L 580,160 L 620,240 L 640,360 L 660,460 L 720,500 L 740,540 L 700,580 L 580,600 L 480,540 L 440,460 L 420,360 L 400,260 Z M 320,300 L 380,280 L 410,360 L 380,420 L 330,400 Z',
    fill: '#4F5F6F',
  },
  {
    // North Sea / English Channel water gap (slight darker fill).
    id: 'water',
    d: 'M 660,200 L 760,200 L 760,520 L 720,500 L 660,460 Z',
    fill: '#2F3F4F',
  },
] as const;

/** D-T347c (Pattern C clipKind-default arm) — first weatherMap consumer binding. */
const bbcMarkAllenCloudsBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'weatherMap',
  buildProps() {
    return {
      style: 'mark-allen-clouds' as const,
      regions: BBC_MARK_ALLEN_CLOUDS_REGIONS.map((r) => ({
        id: r.id,
        name: r.name,
        dataValue: r.dataValue,
        screenPosition: { ...r.screenPosition },
        paletteIndex: r.paletteIndex,
      })),
      symbols: BBC_MARK_ALLEN_CLOUDS_SYMBOLS.map((s) => ({
        kind: s.kind,
        position: { ...s.position },
        scale: s.scale,
      })),
      mapPaths: BBC_MARK_ALLEN_CLOUDS_MAP_PATHS.map((p) => ({
        id: p.id,
        d: p.d,
        fill: p.fill,
      })),
      // BBC Reith Sans is `proprietary-byo` per the preset frontmatter;
      // Source Sans 3 OFL is the rendered fallback per D-T347c-5 / stub
      // line 30 ("Bold, 22-28pt"). Mid-range size 24pt; primitive default
      // for the 'mark-allen-clouds' style is 22pt.
      font: {
        family: 'BBC Reith Sans, Source Sans 3, system-ui, -apple-system, sans-serif',
        weight: 700,
        size: 24,
      },
      // Optional legend — top-right per BBC GEL canon (8-point grid).
      legend: { enabled: true, position: 'top-right' as const },
    };
  },
};

/**
 * `nhc-cone-of-uncertainty` (T-347f) — first + only `stormTracker`-clipKind
 * consumer in v1; wired via `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C —
 * first preset for a clipKind goes through the clipKind-default arm).
 * Synthetic Atlantic hurricane "MARGOT" with canonical NHC 5-day cone +
 * 6 forecast track dots (D→S→H→M intensity arc per NWS mandate) + 3
 * coastal warnings demonstrating the sealed `warningType` enum dispatch.
 *
 * **Mandatory disclaimer**: the primitive always emits the
 * `'Impacts extend beyond the cone'` disclaimer per D-T347b-2 — this
 * binding uses the default wording.
 *
 * v1 ships single-frame static at frame 60; multi-advisory animated
 * time-lapse deferred to T-347b-advisory-cycle.
 *
 * Synthetic geometry sized to 1280×720; real-time NHC consumers wire
 * higher-fidelity coastal + cone data via T-347b-live-data
 * (LiveDataClip integration; Track A frontier per ADR-005).
 */

/** D-T347f-3: 6 forecast track dots covering 0/24/48/72/96/120h. */
export const NHC_CONE_TRACK_DOTS = [
  {
    id: 'pos-0h',
    timestamp: '5pm Mon',
    position: { x: 700, y: 460 },
    intensity: 'H' as const,
  },
  {
    id: 'pos-24h',
    timestamp: '5pm Tue',
    position: { x: 760, y: 420 },
    intensity: 'H' as const,
  },
  {
    id: 'pos-48h',
    timestamp: '5pm Wed',
    position: { x: 820, y: 360 },
    intensity: 'M' as const,
  },
  {
    id: 'pos-72h',
    timestamp: '5pm Thu',
    position: { x: 880, y: 300 },
    intensity: 'M' as const,
  },
  {
    id: 'pos-96h',
    timestamp: '5pm Fri',
    position: { x: 940, y: 240 },
    intensity: 'H' as const,
  },
  {
    id: 'pos-120h',
    timestamp: '5pm Sat',
    position: { x: 1000, y: 200 },
    intensity: 'S' as const,
  },
] as const;

/**
 * D-T347f-4: cone polygon widening over 5 days. Narrow at current
 * position (∼20px wide), widening to ∼160px at 120h endpoint.
 */
export const NHC_CONE_POLYGON_D =
  'M 690,470 L 710,450 L 770,410 L 830,350 L 890,290 L 950,230 L 1010,180 L 1100,160 L 1080,250 L 1020,310 L 940,370 L 870,440 L 800,490 L 730,505 L 690,490 Z';

/** D-T347f-5: 3 coastal-warning regions demonstrating sealed warningType enum. */
export const NHC_CONE_COASTAL_WARNINGS = [
  {
    id: 'florida-coast',
    regionPaths: [
      'M 540,460 L 580,450 L 620,470 L 640,520 L 620,580 L 580,610 L 540,600 L 530,540 Z',
    ],
    warningType: 'hurricane-warning' as const,
  },
  {
    id: 'ga-sc-coast',
    regionPaths: ['M 540,420 L 580,410 L 600,430 L 580,460 L 540,470 L 530,440 Z'],
    warningType: 'storm-surge-warning' as const,
  },
  {
    id: 'nc-coast',
    regionPaths: ['M 540,360 L 600,355 L 620,380 L 600,410 L 560,415 L 535,390 Z'],
    warningType: 'hurricane-watch' as const,
  },
] as const;

/** D-T347f-6: synthetic SE US + Atlantic basin map paths. */
export const NHC_CONE_MAP_PATHS = [
  {
    id: 'se-us-coast',
    d: 'M 380,360 L 460,340 L 520,360 L 540,400 L 560,460 L 600,520 L 620,580 L 580,640 L 500,650 L 420,620 L 380,560 L 360,480 L 360,400 Z',
    fill: '#22354F',
  },
  {
    id: 'bahamas-caribbean',
    d: 'M 660,540 L 720,520 L 750,560 L 730,610 L 670,605 Z',
    fill: '#1A2A3F',
  },
] as const;

const nhcConeOfUncertaintyBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'stormTracker',
  buildProps() {
    return {
      storm: {
        name: 'HURRICANE MARGOT',
        advisoryTimestamp: 'Advisory 18 — 5 PM EDT Mon',
      },
      cone: {
        d: NHC_CONE_POLYGON_D,
        // fill + opacity DELIBERATELY OMITTED — primitive defaults
        // (#FFFFFF semi-transparent at 0.4 opacity) are canonical NHC.
      },
      trackDots: NHC_CONE_TRACK_DOTS.map((d) => ({
        id: d.id,
        position: { ...d.position },
        intensity: d.intensity,
        timestamp: d.timestamp,
      })),
      coastalWarnings: NHC_CONE_COASTAL_WARNINGS.map((w) => ({
        id: w.id,
        regionPaths: [...w.regionPaths],
        warningType: w.warningType,
      })),
      mapPaths: NHC_CONE_MAP_PATHS.map((p) => ({
        id: p.id,
        d: p.d,
        fill: p.fill,
      })),
      // Open Sans Bold for storm-name banner; primitive uses font.size
      // for the top banner per stub line 35 ("Bold, 28-32pt"); top of
      // range = 32.
      font: {
        family: 'Open Sans, system-ui, -apple-system, sans-serif',
        weight: 700,
        size: 32,
      },
      // disclaimerText DELIBERATELY OMITTED — primitive default
      // 'Impacts extend beyond the cone' is the canonical NHC text.
    };
  },
};

/**
 * `doppler-dbz-standard` (T-347d) — second `weatherMap`-clipKind preset; wired
 * via `PRESET_ID_BINDINGS` override (Pattern C — the clipKind-default arm
 * is taken by T-347c `bbcMarkAllenCloudsBinding`). NEXRAD reflectivity
 * dBZ palette (universal `DOPPLER_DBZ_REFLECTIVITY` 7-step canon — do
 * NOT rebrand per cluster SKILL "Color palettes are standard, not
 * brand"). v1 ships single-frame static at frame 60 (loop restart per
 * stub line 50); multi-frame radar loop cycling deferred to T-347a-
 * loop-cycle. PSNR ≥ 40 / SSIM ≥ 0.97 tighter thresholds (radar pixels
 * are deterministic per stub line 50). `productMode: 'reflectivity'`
 * register; the `'velocity'` alternative (bright-green inbound +
 * bright-red outbound mesocyclone signature per stub line 28) defers
 * to T-347d-velocity follow-up.
 *
 * **Geometry sized to 1280×720 default canvas**. Synthetic radar-coverage
 * rectangle + 8 dBZ-reading regions positioned across the image —
 * adequate-fidelity for parity-fixture verification. Real NEXRAD consumers
 * wire live radar-tile data via T-347a-loop-cycle / T-347b-live-data
 * (LiveDataClip integration; Track A frontier per ADR-005).
 */

/** D-T347d-4: 8 dBZ-region overlays (varying intensity readings across radar image). */
export const DOPPLER_DBZ_STANDARD_REGIONS = [
  {
    id: 'severe-cell-1',
    name: 'Severe cell',
    dataValue: '60 dBZ',
    screenPosition: { x: 580, y: 280 },
  },
  {
    id: 'heavy-rain-1',
    name: 'Heavy rain',
    dataValue: '50 dBZ',
    screenPosition: { x: 700, y: 340 },
  },
  {
    id: 'moderate-rain-1',
    name: 'Moderate',
    dataValue: '40 dBZ',
    screenPosition: { x: 460, y: 360 },
  },
  {
    id: 'moderate-rain-2',
    name: 'Moderate',
    dataValue: '35 dBZ',
    screenPosition: { x: 760, y: 460 },
  },
  {
    id: 'light-rain-1',
    name: 'Light rain',
    dataValue: '25 dBZ',
    screenPosition: { x: 380, y: 460 },
  },
  {
    id: 'light-rain-2',
    name: 'Light rain',
    dataValue: '20 dBZ',
    screenPosition: { x: 880, y: 280 },
  },
  {
    id: 'drizzle-1',
    name: 'Drizzle',
    dataValue: '15 dBZ',
    screenPosition: { x: 320, y: 240 },
  },
  {
    id: 'tracker-loc',
    name: 'Atlanta GA',
    dataValue: '— 18:00 EDT',
    screenPosition: { x: 640, y: 640 },
  },
] as const;

/**
 * D-T347d-4: nested polygon overlays in the canonical NEXRAD reflectivity
 * palette, sized to 1280×720. Outer rings carry the lower-dBZ colors
 * (`#00BFFF` light blue) and inner cores carry the higher-dBZ colors
 * (`#FF0000` red, `#FF00FF` magenta hail-core). Layered in stacking
 * order — outer first, inner last — so each subsequent polygon
 * overdraws the prior. Mirrors the NEXRAD reflectivity rendering canon
 * across NWS / weather.com / TWC reproductions.
 *
 * Palette anchor (per `DOPPLER_DBZ_REFLECTIVITY` 7-step canonical):
 *   `#00BFFF` light blue (5-15 dBZ — light precipitation / drizzle)
 *   `#00FF00` bright green (20-25 dBZ — moderate light rain)
 *   `#009900` dark green (30-35 dBZ — moderate-to-heavy)
 *   `#FFFF00` yellow (40-45 dBZ — heavy rain)
 *   `#FFA500` orange (50 dBZ — very heavy)
 *   `#FF0000` red (55-60 dBZ — severe / hail-bearing)
 *   `#FF00FF` magenta (65+ dBZ — hail core / extreme)
 */
export const DOPPLER_DBZ_STANDARD_MAP_PATHS = [
  // Radar coverage area — black base; the dBZ palette polygons overlay on top.
  {
    id: 'radar-coverage',
    d: 'M 0,0 L 1280,0 L 1280,720 L 0,720 Z',
    fill: '#0A0A0A',
  },
  // Outermost: drizzle / light precipitation (light blue) — broad coverage.
  {
    id: 'dbz-15',
    d: 'M 240,200 L 480,160 L 720,180 L 920,220 L 1020,300 L 1000,420 L 920,520 L 760,560 L 540,560 L 360,520 L 260,420 L 220,300 Z',
    fill: '#00BFFF',
  },
  // Light-moderate rain (bright green).
  {
    id: 'dbz-25',
    d: 'M 320,240 L 520,200 L 720,220 L 880,260 L 940,340 L 920,440 L 820,500 L 660,520 L 480,500 L 360,460 L 300,380 L 290,300 Z',
    fill: '#00FF00',
  },
  // Moderate-heavy (dark green).
  {
    id: 'dbz-35',
    d: 'M 380,280 L 540,240 L 700,260 L 840,300 L 880,380 L 860,460 L 760,500 L 620,500 L 480,480 L 400,440 L 360,380 Z',
    fill: '#009900',
  },
  // Heavy rain (yellow).
  {
    id: 'dbz-45',
    d: 'M 440,300 L 580,280 L 700,300 L 800,340 L 820,400 L 800,460 L 720,480 L 600,480 L 500,460 L 440,420 L 420,360 Z',
    fill: '#FFFF00',
  },
  // Very heavy (orange).
  {
    id: 'dbz-50',
    d: 'M 480,320 L 600,300 L 700,320 L 760,360 L 780,400 L 760,440 L 680,460 L 580,460 L 500,440 L 470,400 L 470,360 Z',
    fill: '#FFA500',
  },
  // Severe / hail-bearing (red) — the supercell core.
  {
    id: 'dbz-60',
    d: 'M 540,340 L 620,330 L 690,350 L 730,380 L 720,420 L 660,440 L 580,440 L 530,420 L 520,380 Z',
    fill: '#FF0000',
  },
  // Hail core (magenta) — innermost, smallest polygon.
  {
    id: 'dbz-65',
    d: 'M 580,360 L 640,355 L 680,375 L 680,400 L 640,415 L 590,410 L 575,385 Z',
    fill: '#FF00FF',
  },
] as const;

const dopplerDbzStandardBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'weatherMap',
  buildProps() {
    return {
      style: 'doppler-radar' as const,
      productMode: 'reflectivity' as const,
      // D-T347d-3: pin sweep beam at quarter-turn (3 o'clock); single-
      // frame static (multi-frame loop deferred to T-347a-loop-cycle).
      loopFrameIndex: 0,
      sweepBeamPhase: 0.25,
      regions: DOPPLER_DBZ_STANDARD_REGIONS.map((r) => ({
        id: r.id,
        name: r.name,
        dataValue: r.dataValue,
        screenPosition: { ...r.screenPosition },
      })),
      mapPaths: DOPPLER_DBZ_STANDARD_MAP_PATHS.map((p) => ({
        id: p.id,
        d: p.d,
        fill: p.fill,
      })),
      // Open Sans Regular per stub line 32 "14-16pt"; mid-range size 14.
      // OFL — no `proprietary-byo` here (Open Sans is the canonical
      // license-cleared sans-serif used across NWS / NEXRAD reproductions).
      font: {
        family: 'Open Sans, system-ui, -apple-system, sans-serif',
        weight: 400,
        size: 14,
      },
      // Top-left legend showing 7-step NEXRAD dBZ palette swatches.
      legend: { enabled: true, position: 'top-left' as const },
    };
  },
};

/**
 * `heat-map-cool-to-warm` (T-347e) — third + final `weatherMap`-clipKind
 * consumer in v1; wired via `PRESET_ID_BINDINGS` override (Pattern C).
 * Esri/NWS Meriam 38-class temperature gradient `MERIAM_38_CLASS_HEAT`
 * (deep-purple-sub-zero → dark-maroon-extreme-heat); `units: 'F'`
 * (US-domestic); `oscillation: true` (Meriam light-dark across classes
 * for color-blind differentiation per stub line 47, "non-negotiable").
 *
 * **mapPath fill derivation pattern**: each `mapPath.id` matches a
 * `region.id`; `mapPath.fill` is OMITTED so the primitive's heat-map
 * style branch derives the fill from `region.paletteIndex` via
 * `resolveHeatMapFill(paletteIndex, oscillation)` (per primitive
 * D-T347a-7). This is the elegant binding pattern for heat-map presets.
 *
 * v1 ships single-frame static at frame 60; multi-frame time-lapse
 * cycling deferred to T-347a-time-lapse.
 *
 * After T-347e + T-347c + T-347d ship, all three weatherMap §13
 * obligations are closed.
 */

/** D-T347e-2: 8 US regions spanning the canonical Meriam 38-class spectrum. */
export const HEAT_MAP_COOL_TO_WARM_REGIONS = [
  {
    id: 'anchorage',
    name: 'Anchorage',
    dataValue: 'Anchorage 18°F',
    screenPosition: { x: 220, y: 200 },
    paletteIndex: 4,
  },
  {
    id: 'minneapolis',
    name: 'Minneapolis',
    dataValue: 'Minneapolis 38°F',
    screenPosition: { x: 600, y: 240 },
    paletteIndex: 6,
  },
  {
    id: 'seattle',
    name: 'Seattle',
    dataValue: 'Seattle 52°F',
    screenPosition: { x: 320, y: 280 },
    paletteIndex: 11,
  },
  {
    id: 'denver',
    name: 'Denver',
    dataValue: 'Denver 65°F',
    screenPosition: { x: 540, y: 380 },
    paletteIndex: 14,
  },
  {
    id: 'atlanta',
    name: 'Atlanta',
    dataValue: 'Atlanta 78°F',
    screenPosition: { x: 820, y: 460 },
    paletteIndex: 18,
  },
  {
    id: 'los-angeles',
    name: 'LA',
    dataValue: 'Los Angeles 85°F',
    screenPosition: { x: 280, y: 480 },
    paletteIndex: 20,
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    dataValue: 'Phoenix 102°F',
    screenPosition: { x: 440, y: 500 },
    paletteIndex: 26,
  },
  {
    id: 'death-valley',
    name: 'Death Valley',
    dataValue: 'Death Valley 118°F',
    screenPosition: { x: 360, y: 420 },
    paletteIndex: 32,
  },
] as const;

/**
 * D-T347e-3: 8 mapPaths with `id` matching `regions[].id`; `fill` omitted
 * so the primitive's heat-map branch derives the fill from
 * `region.paletteIndex` (id-equality lookup). Synthetic US-state-rough
 * polygons sized to 1280×720.
 */
export const HEAT_MAP_COOL_TO_WARM_MAP_PATHS = [
  { id: 'anchorage', d: 'M 80,140 L 320,120 L 360,220 L 240,300 L 100,260 Z' },
  { id: 'minneapolis', d: 'M 540,180 L 700,180 L 720,300 L 580,320 L 540,260 Z' },
  { id: 'seattle', d: 'M 240,260 L 400,260 L 420,360 L 280,380 L 240,340 Z' },
  { id: 'denver', d: 'M 480,360 L 620,360 L 620,460 L 480,460 Z' },
  { id: 'atlanta', d: 'M 760,440 L 900,440 L 920,540 L 800,560 L 760,500 Z' },
  { id: 'los-angeles', d: 'M 220,460 L 360,460 L 360,540 L 240,560 L 200,520 Z' },
  { id: 'phoenix', d: 'M 380,460 L 520,460 L 520,560 L 400,580 L 360,520 Z' },
  { id: 'death-valley', d: 'M 320,400 L 400,400 L 400,440 L 320,440 Z' },
] as const;

const heatMapCoolToWarmBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'weatherMap',
  buildProps() {
    return {
      style: 'heat-map' as const,
      units: 'F' as const,
      oscillation: true,
      regions: HEAT_MAP_COOL_TO_WARM_REGIONS.map((r) => ({
        id: r.id,
        name: r.name,
        dataValue: r.dataValue,
        screenPosition: { ...r.screenPosition },
        paletteIndex: r.paletteIndex,
      })),
      mapPaths: HEAT_MAP_COOL_TO_WARM_MAP_PATHS.map((p) => ({
        id: p.id,
        d: p.d,
        // fill DELIBERATELY OMITTED — primitive derives from matching
        // region.paletteIndex (D-T347e-3).
      })),
      // Open Sans Bold per stub line 35 "Bold, 18-22pt tabular".
      font: {
        family: 'Open Sans, system-ui, -apple-system, sans-serif',
        weight: 700,
        size: 18,
      },
      // Bottom-right legend with °F suffix.
      legend: { enabled: true, position: 'bottom-right' as const },
      // Light grey base for non-data regions per stub line 32 ("muted
      // gray #E8E8E8 for non-data regions"). Primitive default for
      // 'heat-map' is already #E8E8E8 — explicit for clarity.
      background: '#E8E8E8',
    };
  },
};

/**
 * `twc-retrocast-8bit` (T-347g) — fifth Cluster C preset; wired via
 * `PRESET_ID_BINDINGS` override (Pattern C — preset's `clipKind:
 * fullScreen` STAYS UNCHANGED; binding overrides `clipName` to the
 * NEW `weatherStar4000Panel` primitive per the T-328 msnbc-big-board
 * / T-339 uefa-starball-refraction precedent).
 *
 * The existing `magic-wall-panel` primitive (which serves the
 * fullScreen clipKind via DEFAULT_CLIP_KIND_RESOLVER) does NOT fit
 * the WeatherStar 4000 register (period-authentic L-bar sidebar +
 * 8-bit pixel font + pixel-precision rendering). T-347g introduces
 * a dedicated primitive `weatherStar4000Panel` and binds the preset
 * to it.
 *
 * **Single-frame static** at frame 60 (canonical "settled" register
 * per stub line 50). Multi-frame ticker animation deferred to
 * T-347g-ticker-cycle (v1 single-frame static suffices because the
 * ticker uses `frameOffset` to pin its position).
 *
 * **Tight thresholds**: PSNR ≥ 44 / SSIM ≥ 0.99 — pixel-perfect
 * register has very low variance per stub line 51.
 */
const twcRetrocast8bitBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'weatherStar4000Panel',
  buildProps() {
    return {
      header: { city: 'Atlanta', condition: 'Partly Cloudy' },
      temperature: { value: 78, unit: 'F' as const, foreground: 'gold' as const },
      metadata: [
        { label: 'HUMIDITY', value: '64%' },
        { label: 'WIND', value: 'ENE 12 MPH' },
        { label: 'PRESSURE', value: '30.05 IN' },
        { label: 'DEW POINT', value: '64°F' },
      ],
      ticker: {
        items: [
          'BIRMINGHAM 76°F',
          'CHARLESTON 80°F',
          'CHARLOTTE 74°F',
          'COLUMBIA 79°F',
          'JACKSONVILLE 82°F',
          'NASHVILLE 71°F',
          'NEW ORLEANS 84°F',
          'TAMPA 86°F',
        ],
        scrollSpeedPxPerFrame: 2 as const,
        frameOffset: 60, // pins mid-scroll for parity register
      },
      showLBar: true,
      showCrtScanlines: true,
      // Press Start 2P fallback per stub line 31 + 8-bit pixel font
      // canon. Press Start 2P is OFL (Google Fonts).
      font: {
        family: "'Press Start 2P', 'VT323', 'Courier New', monospace",
        size: 96,
      },
    };
  },
};

/**
 * `twc-immersive-mixed-reality` (T-347h) — sixth + final Cluster C
 * preset; CLOSES Cluster C to 6/6 ELIGIBLE once shipped (alongside
 * T-347c/d/e/f/g). Wired via `PRESET_ID_BINDINGS` override (Pattern C —
 * preset's `clipKind: fullScreen` STAYS UNCHANGED; binding overrides
 * `clipName` to the NEW `imrStaticFallback` primitive per the T-328 /
 * T-339 / T-347g precedent).
 *
 * The TWC IMR (Immersive Mixed Reality) canon is a Track A frontier
 * feature: live 3D rendering via `ThreeSceneClip` (Unreal Engine + Zero
 * Density Reality Engine + Mo-Sys StarTracker per stub line 34). The
 * stub-canon-explicit static-fallback allowance (line 41) authorizes a
 * v1 static-only register — same posture as T-353 severance-surreal-3d.
 *
 * **Single-frame static** at frame 60 (mid-camera-sweep / settled
 * register per stub line 47). PSNR ≥ 36 / SSIM ≥ 0.93 (3D scene
 * compositing has higher variance per stub).
 */
const twcImmersiveMixedRealityBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'imrStaticFallback',
  buildProps() {
    return {
      scenario: 'severe' as const,
      severity: {
        label: 'Tornado Warning',
        location: 'Atlanta Metro',
        timestamp: 'Issued 4:12 PM EDT',
      },
      data: [
        { label: 'WIND', value: '155 MPH' },
        { label: 'PRESSURE', value: '948 MB' },
        { label: 'TEMP', value: '76 °F' },
        { label: 'GUST', value: '180 MPH' },
      ],
      particleDensity: 0.6,
      font: {
        family: "'Inter Tight', system-ui, -apple-system, sans-serif",
        weight: 700,
      },
    };
  },
};

/**
 * `sky-sports-ar-formations` (T-375) — first `arOverlay`-clipKind preset;
 * wired via `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C — first preset for a
 * clipKind goes through the clipKind-default arm; later Cluster H
 * consumers T-376 hawkeye-var-3d-skeletal / T-377 olympic-swim-lane-track
 * / T-378 nba-ar-replay wire via `PRESET_ID_BINDINGS`).
 *
 * **§13 verifier** for the `arOverlay` clipKind structural extension
 * introduced in T-375a (PR #460). T-375a explicitly deferred pixel
 * verification to this preset PR per CLAUDE.md §13 acceptable-evidence
 * option 3 — this binding's parity-golden + PO ratification IS the
 * end-to-end render verification for the new clipKind.
 *
 * **v1 ships static-fallback rendering ONLY** per D-T375a-2: the
 * primitive's `setupRef` API surface is reserved on the schema for
 * forward compatibility, but the v1 dispatch ignores `setupRef` at
 * render time and always renders the static-fallback poster. Live-mount
 * via `ThreeSceneClip` (T-384) lands with T-375-live-mount post-T-397
 * Track A finale (not yet merged).
 *
 * **Single-frame static** at frame 60 (canonical "settled" register
 * matching the cluster norm). PSNR ≥ 36 / SSIM ≥ 0.93 per stub line 48
 * — slightly looser than the cluster-norm 38/0.95 because the stub
 * authorises that variance for "live AR composited frames"; the v1
 * static-fallback render is byte-deterministic so the looser thresholds
 * carry no risk and reserve headroom for the post-T-397 live-mount
 * path's expected variance.
 */

/**
 * D-T375-2: sealed canonical Sky Sports AR formations palette. Brand
 * canon is preset-specific (NOT primitive-specific per D-T375a-3) — the
 * primitive composites OVER existing video / sport context and intentionally
 * does NOT bake palettes; per-sport color canon (Sky Sports navy + PL
 * purple here; Hawk-Eye green offside lines / Olympic gold-red WR-line
 * flash / NBA orange in sibling Cluster H bindings) lives in the
 * per-preset binding.
 */
export const SKY_SPORTS_AR_FORMATIONS_PALETTE = Object.freeze({
  /** Sky Sports navy — primary fill of marker badges per stub line 26. */
  skyNavy: '#0A1128',
  /** Premier League purple — sport-specific accent per stub line 27. */
  premierPurple: '#38003C',
  /** Foreground white — player numbers / labels per stub typography. */
  foreground: '#FFFFFF',
} as const);

const skySportsArFormationsBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'arOverlay',
  buildProps() {
    return {
      staticFallback: {
        // Centered-card label per D-T375a-5: ALL CAPS Bold 48px (primitive-
        // governed font-size). "AR FORMATION OVERLAY" matches the preset
        // stub's pitch-anchored AR formation register.
        label: 'AR FORMATION OVERLAY',
        // Optional sublabel — Regular 22px at 70% opacity per D-T375a-5.
        // "4-3-3 LINEUP" matches stub line 36 ("Formation lines (4-3-3,
        // 4-4-2, etc.)").
        sublabel: '4-3-3 LINEUP',
        // Sky Sports navy backdrop per stub line 26.
        backgroundColor: SKY_SPORTS_AR_FORMATIONS_PALETTE.skyNavy,
        // Foreground white for labels (player numbers / typography).
        foregroundColor: SKY_SPORTS_AR_FORMATIONS_PALETTE.foreground,
        // Premier League purple — 1px accent border per D-T375a-5; signals
        // broadcaster brand color (the Sky Sports + PL pair is the
        // canonical Premier League broadcast register per stub line 27).
        accentColor: SKY_SPORTS_AR_FORMATIONS_PALETTE.premierPurple,
        // Default true — explicit for clarity. The bottom-right
        // "AR · STATIC FALLBACK" 14px monospace badge at 50% opacity
        // signals to the operator that the live-mount path is gated.
        showLiveMountIndicator: true,
      },
      // Sky Sports Sans is `proprietary-byo` per the preset frontmatter;
      // Inter OFL is the rendered fallback per stub line 31 ("Sky Sports
      // Sans fallback (Inter), Bold, 16-22 pt"). The primitive's centered-
      // card label renders at fixed 48px (D-T375a-5); this `font` declaration
      // governs the family stack only.
      font: {
        family: "'Sky Sports Sans', 'Inter', system-ui, -apple-system, sans-serif",
        weight: 700,
      },
      // D-T375-5: declared (Sky Sports AR requires Zero Density / Stype
      // tracking per stub line 42 + cluster SKILL line 42) but NOT exercised
      // in v1 (primitive ignores `permissions` at render time per D-T375a-2).
      // Forward-compat for the post-T-397 live-mount path.
      permissions: ['camera-tracking' as const],
      // setupRef intentionally OMITTED in v1 — live-mount via ThreeSceneClip
      // (T-384) lands with T-375-live-mount post-T-397 Track A finale.
    };
  },
};

/**
 * `hawkeye-var-3d-skeletal` (T-376) — second `arOverlay`-clipKind preset;
 * wired via `PRESET_ID_BINDINGS` override (Pattern C — second-preset-for-
 * clipKind via override; the `arOverlay` clipKind-default arm in
 * `DEFAULT_CLIP_KIND_RESOLVER` STAYS bound to `skySportsArFormationsBinding`
 * from T-375 / PR #461 / commit `a5614b56`). Brings Cluster H (AR &
 * environmental overlays) from 1/4 → 2/4 ELIGIBLE.
 *
 * **NOT a §13 (F-30) verifier.** PR #461 (T-375 sky-sports-ar-formations
 * as first downstream consumer) discharged the §13 obligation for the
 * `arOverlay` clipKind structural extension introduced in T-375a (PR #460).
 * This PR adds a new preset-binding entry; no new clipKind / element type /
 * compositing mode.
 *
 * **v1 ships static-fallback rendering ONLY** per D-T375a-2: the primitive's
 * `setupRef` API surface is reserved on the schema for forward compatibility
 * but the v1 dispatch ignores `setupRef` at render time and always renders
 * the static-fallback poster. Live-mount via `ThreeSceneClip` (Hawk-Eye
 * limb-tracking 3D wireframe overlay; Three.js scene with skeletal mesh +
 * animated offside lines on freeze-frame) lands with T-376-live-mount post-
 * T-397 Track A finale (not yet merged).
 *
 * **Visual differentiation from sibling sky-sports-ar-formations preset:**
 * - sky-sports: navy backdrop (`#0A1128`) + Premier League purple accent
 *   border (`#38003C`) + `'Sky Sports Sans', 'Inter'` font stack — register:
 *   pitch-anchored formation lineup.
 * - hawkeye-var: PL purple backdrop (`#34003A`) + decision-green accent
 *   border (`#00FC8A`) + `'Premier Sans', 'Champions', 'Space Grotesk'`
 *   font stack — register: VAR offside-decision moment, dramatic suspense
 *   beat per stub line 48 ("Most emotionally charged overlay in football").
 *
 * Both presets ship the SAME primitive (`arOverlay`) but render visually
 * distinct cards — broadcaster brand canon lives in the per-preset binding,
 * not the primitive (per D-T375a-3).
 *
 * **Single-frame static** at frame 60 for cluster-norm consistency with
 * sibling sky-sports preset. PSNR ≥ 36 / SSIM ≥ 0.93 per stub line 52 —
 * slightly looser than the cluster-norm 38/0.95 because the stub authorises
 * that variance for "3D overlay variance"; the v1 static-fallback render is
 * byte-deterministic so the looser thresholds carry no risk and reserve
 * headroom for the post-T-397 live-mount path's expected variance.
 */

/**
 * D-T376-2: sealed canonical Hawk-Eye / VAR palette. Brand canon is preset-
 * specific (NOT primitive-specific per D-T375a-3) — the primitive composites
 * OVER existing video / sport context and intentionally does NOT bake
 * palettes; per-preset color canon (PL purple decision backdrop here;
 * Sky Sports navy in sibling sky-sports-ar-formations binding; Olympic
 * gold-red WR-line flash / NBA orange in pending T-377 / T-378 bindings)
 * lives in the per-preset binding. The two offside-line colors are exported
 * for future live-mount consumers; v1 static-fallback doesn't surface them
 * on the rendered card.
 */
export const HAWKEYE_VAR_SKELETAL_PALETTE = Object.freeze({
  /** PL purple background per stub line 30 — VAR-decision moment register
   * (intentionally differentiates from sibling sky-sports-ar-formations
   * preset's Sky Sports navy formation-lineup register). */
  premierLeaguePurple: '#34003A',
  /** Green accent per stub line 30 — "white text + green accents" decision-
   * moment trim. Doubles as decision-confirmed flash color (T-376-decision-
   * variant deferral). */
  decisionGreen: '#00FC8A',
  /** Foreground white — banner text + player labels per stub typography. */
  foreground: '#FFFFFF',
  /** Attacker offside-line red/orange per stub line 26 — reserved for
   * live-mount path (T-376-live-mount post-T-397; not surfaced in v1
   * static-fallback). */
  attackerLine: '#FF6B35',
  /** Last-defender offside-line blue/green per stub line 27 — reserved
   * for live-mount path (T-376-live-mount post-T-397; not surfaced in
   * v1 static-fallback). */
  defenderLine: '#00B5D8',
} as const);

const hawkeyeVarSkeletalBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'arOverlay',
  buildProps() {
    return {
      staticFallback: {
        // Centered-card label per D-T375a-5: ALL CAPS Bold 48px (primitive-
        // governed font-size). "VAR — CHECKING OFFSIDE" matches the preset
        // stub's pre-decision suspense register per stub line 29 ("VAR —
        // CHECKING [GOAL/PENALTY/OFFSIDE]"). Offside is the canonical
        // Hawk-Eye 3D-skeletal-tracking use case (other VAR cases fall
        // back to 2D-line variant per stub line 46).
        label: 'VAR — CHECKING OFFSIDE',
        // Optional sublabel — Regular 22px at 70% opacity per D-T375a-5.
        // "HAWK-EYE 3D SKELETAL TRACKING" surfaces the limb-tracking
        // attribution per stub title + line 24 ("3D wireframe / skeletal
        // model overlaid on each player ... Hawk-Eye limb-tracking source").
        sublabel: 'HAWK-EYE 3D SKELETAL TRACKING',
        // PL purple backdrop per stub line 30. Different from sibling sky-
        // sports preset's #0A1128 navy — the VAR decision-moment register is
        // chromatically distinct from the formation-lineup register.
        backgroundColor: HAWKEYE_VAR_SKELETAL_PALETTE.premierLeaguePurple,
        // Foreground white for banner text + player labels (stub line 30
        // "white text").
        foregroundColor: HAWKEYE_VAR_SKELETAL_PALETTE.foreground,
        // Decision-green 1px accent border per D-T375a-5; signals VAR
        // decision-moment register. NOT PL purple (the backdrop) and NOT
        // sky-sports' brand-purple — the green-on-purple combo is the
        // canonical Hawk-Eye / VAR decision-moment register per stub line 30.
        accentColor: HAWKEYE_VAR_SKELETAL_PALETTE.decisionGreen,
        // Default true — explicit for clarity. The bottom-right
        // "AR · STATIC FALLBACK" 14px monospace badge at 50% opacity
        // signals to the operator that the live-mount path is gated.
        showLiveMountIndicator: true,
      },
      // Premier Sans + Champions are `proprietary-byo` per the preset
      // frontmatter; Space Grotesk OFL is the rendered fallback per stub
      // line 33 ("'VAR — CHECKING ...' banner: Premier Sans / Champions
      // fallback, Bold, 28-34 pt, ALL CAPS"). The primitive's centered-card
      // label renders at fixed 48px (D-T375a-5); this `font` declaration
      // governs the family stack only.
      font: {
        family:
          "'Premier Sans', 'Champions', 'Space Grotesk', system-ui, -apple-system, sans-serif",
        weight: 700,
      },
      // D-T376-5: declared (Hawk-Eye limb-tracking requires source data per
      // stub line 46 + cluster SKILL line 42) but NOT exercised in v1
      // (primitive ignores `permissions` at render time per D-T375a-2).
      // Forward-compat for the post-T-397 live-mount path.
      permissions: ['camera-tracking' as const],
      // setupRef intentionally OMITTED in v1 — live-mount via ThreeSceneClip
      // (T-384) lands with T-376-live-mount post-T-397 Track A finale.
    };
  },
};

const squidGameGeometricBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'titleSequence',
  buildProps() {
    return {
      shots: SQUID_GAME_GEOMETRIC_SHOTS.map((s) => {
        if (s.kind === 'colorPanel') {
          const content: { color: string; glyph?: string } = {
            color: s.content.color ?? '#000000',
          };
          if (s.content.glyph !== undefined) content.glyph = s.content.glyph;
          return {
            id: s.id,
            startMs: s.startMs,
            endMs: s.endMs,
            kind: 'colorPanel' as const,
            content,
            transitionOut: s.transitionOut,
          };
        }
        return {
          id: s.id,
          startMs: s.startMs,
          endMs: s.endMs,
          kind: 'titlePlate' as const,
          content: { text: s.content.text ?? '' },
          transitionOut: s.transitionOut,
        };
      }),
      style: 'palette-jump-cut' as const,
      // Center-screen per D-T350-7 — the title plate sits visually centered
      // against the teal panel bleed in the 1280×720 default composition.
      // The primitive renders the wrapper at `left: position.x - position.width / 2`
      // (title-sequence.tsx:643), so x=640 + width=1024 lands the visual
      // centerline at canvas x=640.
      position: { x: 640, y: 360, width: 1024, alignment: 'center' as const },
      // ALL-CAPS canonical posture per D-T350-7 (stub line 33 "ALL CAPS,
      // scaled to fill"); applied at render time via the primitive's
      // `applyCasing` helper (no CSS `text-transform`).
      casing: 'uppercase' as const,
      // Override bundle default font.size (96) → 64 per D-T350-3 sizing
      // rationale (the spec floated 120 as a starting point but the spec
      // also authorised the Implementer to adjust size after observing the
      // rendered output: at size 120, `font.size * 2 = 240 px` causes
      // `'SQUID GAME'` to wrap at the 1024 px wrapper width — only `SQUID`
      // and a partial `GAME` are visible against the teal panel. At size
      // 64 the rendered title plate runs `font.size * 2 = 128 px` and fits
      // on one line; the brutalist mass + readability are both preserved
      // at the 1280×720 canvas. The squid-game-specific family stack drops
      // `Inter Display` (the bundle default prefix) to favour Anton's
      // brutalist letterform mass first per stub line 32.
      font: { family: 'Anton, Bebas Neue, system-ui, sans-serif', weight: 700, size: 64 },
      // Title text wears white on the teal/pink/black panels per D-T350-1.
      foreground: '#FFFFFF',
      // `highlightColor`, `background`, and `glow` deliberately UNSET per
      // D-T350-7: the brutalist register forbids strokes / shadows /
      // gradients (stub line 45). The container background is overridden
      // by the most-recent `colorPanel.content.color` under
      // `'palette-jump-cut'` regardless (primitive lines 718–730).
    };
  },
};

/**
 * `premier-league-field-of-play` (T-333) — first Cluster B preset; second
 * `scoreBug` clipKind consumer; first production consumer of T-332a's
 * `score-bug` primitive AND its `'football'` style branch. Wired via
 * `PRESET_ID_BINDINGS['premier-league-field-of-play']` (Pattern C — second-
 * preset-for-clipKind via the override path, NOT clipKind-default; the
 * `'scoreBug'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at
 * `scoreBugDotsBinding` from T-358, which binds the `outcome-row` primitive
 * with the cricket canonical six-ball over).
 *
 * Snapshot captures the Premier League 2017+ broadcast canon: PL purple
 * `#34003A` chrome + Arsenal red `#EF0107` home box + Chelsea blue `#034694`
 * away box + 3-letter team codes (`'ARS'` / `'CHE'`) + tabular `'2'` / `'1'`
 * scores + `'67:42'` mid-second-half clock + `'2H'` period token. Position
 * anchored at upper-left `(60, 60)` per stub line 23. Goal celebrations,
 * per-team variants (Arsenal cannon / Brighton seagulls / United devils),
 * 6 px outer-edge kit-color stripes (vs the primitive's full-tile fill),
 * "Field of Play" companion motion, and 2 s cubic-bezier entrance are all
 * deferred to `T-332b`-family follow-ups OR external composition (D-T333-3,
 * D-T333-11). v1 ships the steady-state mid-hold scoreclock layer only.
 */
export const PREMIER_LEAGUE_FOP_PROPS: {
  readonly style: 'football';
  readonly position: { readonly x: number; readonly y: number };
  readonly background: string;
  readonly foreground: string;
  readonly home: { readonly code: string; readonly color: string; readonly score: string };
  readonly away: { readonly code: string; readonly color: string; readonly score: string };
  readonly clock: string;
  readonly period: string;
  readonly font: {
    readonly family: string;
    readonly weight: number;
    readonly tabularNums: boolean;
  };
  readonly casing: 'as-is';
} = {
  style: 'football',
  position: { x: 60, y: 60 }, // upper-left anchor per D-T333-1 / stub line 23
  background: '#34003A', // PL purple chrome (D-T333-1 / stub line 24)
  foreground: '#FFFFFF', // white text (D-T333-1 / stub line 26)
  home: { code: 'ARS', color: '#EF0107', score: '2' }, // Arsenal — canonical kit red
  away: { code: 'CHE', color: '#034694', score: '1' }, // Chelsea — canonical kit blue
  clock: '67:42', // mid-second-half (D-T333-1)
  period: '2H', // second-half token (D-T333-1)
  // OFL fallback for proprietary-byo `Premier Sans`; weight 600 matches the stub's
  // SemiBold tabular register; tabularNums for column-edge alignment of scores.
  font: { family: 'Space Grotesk', weight: 600, tabularNums: true },
  // Snapshot strings already in target casing; `'as-is'` skips `applyCasing`
  // transforms (D-T333-1 / D-T333-4). Numerics short-circuit `applyCasing`
  // regardless per primitive lines 233–235.
  casing: 'as-is',
};

const premierLeagueFopBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'score-bug', // kebab-case primitive `kind` (T-332a line 686)
  buildProps() {
    // Deep-clone the nested object literals so the binding's caller can
    // mutate the returned props without aliasing the exported constant.
    return {
      ...PREMIER_LEAGUE_FOP_PROPS,
      position: { ...PREMIER_LEAGUE_FOP_PROPS.position },
      home: { ...PREMIER_LEAGUE_FOP_PROPS.home },
      away: { ...PREMIER_LEAGUE_FOP_PROPS.away },
      font: { ...PREMIER_LEAGUE_FOP_PROPS.font },
    };
  },
};

/**
 * Fox NFL "No-Chrome" snapshot props per D-T334-1 / D-T334-4.
 * Cluster B preset T-334 wires the `score-bug` primitive (T-332a) as the
 * third `scoreBug` clipKind consumer (Pattern C — `PRESET_ID_BINDINGS`
 * override; second override after T-333 PL). SECOND production consumer
 * of T-332a's `'football'` style branch; FIRST production consumer of
 * the `backdropGradient`, `down`, AND `possession` optional props.
 *
 * Snapshot captures the 2025 NFL Super Bowl LIX register: KC red
 * `#E31837` home box + PHI green `#004C54` away box (Super Bowl LIX
 * rematch); chromeless `#000000` base + radial gradient backdrop
 * (~40% center, 0 edges); 3rd-and-7 down-and-distance; possession
 * boost on KC home box; Inter Display 900 OFL fallback for proprietary
 * Fox Sports custom typeface. Touchdown comic-book celebration,
 * down-and-distance possession-slide animation, 800 ms zoom-in
 * entrance, and 120 ms score-change pulse all deferred (D-T334-3 /
 * D-T334-11).
 */
export const FOX_NFL_NO_CHROME_PROPS: {
  readonly style: 'football';
  readonly position: { readonly x: number; readonly y: number };
  readonly background: string;
  readonly foreground: string;
  readonly backdropGradient: { readonly centerOpacity: number; readonly edgeOpacity: number };
  readonly home: { readonly code: string; readonly color: string; readonly score: string };
  readonly away: { readonly code: string; readonly color: string; readonly score: string };
  readonly clock: string;
  readonly period: string;
  readonly down: string;
  readonly possession: 'home';
  readonly font: { readonly family: string; readonly weight: number };
  readonly casing: 'as-is';
} = {
  style: 'football',
  position: { x: 280, y: 600 }, // bottom-center anchor (D-T334-1; 1280x720 canvas)
  background: '#000000', // chromeless black base (D-T334-1)
  foreground: '#FFFFFF', // white text (D-T334-1 / stub line 26)
  backdropGradient: { centerOpacity: 0.4, edgeOpacity: 0 }, // ~40% radial darken (D-T334-1)
  home: { code: 'KC', color: '#E31837', score: '24' }, // Kansas City Chiefs (Super Bowl LIX home)
  away: { code: 'PHI', color: '#004C54', score: '17' }, // Philadelphia Eagles (Super Bowl LIX away)
  clock: '04:32', // Q3 mid-quarter (D-T334-1)
  period: 'Q3', // third-quarter token (D-T334-1)
  down: '3rd & 7', // canonical NFL down-and-distance (D-T334-1)
  possession: 'home', // KC has the ball; brightness(1.12) boost (D-T334-1)
  font: { family: 'Inter Display', weight: 900 }, // OFL fallback for Fox Sports custom (D-T334-1)
  casing: 'as-is', // numeric short-circuit covers '04:32', '24', '17', '3rd & 7'
};

const foxNflNoChromeBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'score-bug', // kebab-case primitive `kind` (T-332a line 686)
  buildProps() {
    // Deep-clone nested object literals so callers can mutate without
    // aliasing the exported constant.
    return {
      ...FOX_NFL_NO_CHROME_PROPS,
      position: { ...FOX_NFL_NO_CHROME_PROPS.position },
      backdropGradient: { ...FOX_NFL_NO_CHROME_PROPS.backdropGradient },
      home: { ...FOX_NFL_NO_CHROME_PROPS.home },
      away: { ...FOX_NFL_NO_CHROME_PROPS.away },
      font: { ...FOX_NFL_NO_CHROME_PROPS.font },
    };
  },
};

/**
 * NBC SNF "Possession-Illuminated" snapshot props per D-T335-1 / D-T335-4.
 * Cluster B preset T-335 wires the `score-bug` primitive (T-332a) as the
 * fourth `scoreBug` clipKind consumer (Pattern C — `PRESET_ID_BINDINGS`
 * override; third override after T-333 PL + T-334 Fox NFL). THIRD
 * production consumer of T-332a's `'football'` style branch; FIRST
 * production consumer of the `centerCircle`, `direction`, AND
 * `networkLogo` optional props; SECOND consumer of `down` + `possession`
 * (after T-334).
 *
 * Snapshot captures the canonical Sunday Night Football register: KC red
 * `#E31837` home box + BUF navy `#00338D` away box (canonical AFC
 * matchup); dark `#0A0A0A` base; center black-circle treatment hosting
 * the NBC mark above the clock; Q2 mid-quarter clock + period; first
 * down with directional chevrons (`'<< 1st & 10'`); possession boost on
 * KC home box; Public Sans 600 OFL fallback for proprietary Sweet Sans
 * Pro + NBC Tinker pairing. Penalty-flag indicator, possession-change
 * animation, entrance slide-in, and score-change pulse all deferred
 * (D-T335-3 / D-T335-11).
 */
export const NBC_SNF_PROPS: {
  readonly style: 'football';
  readonly position: { readonly x: number; readonly y: number };
  readonly background: string;
  readonly foreground: string;
  readonly home: { readonly code: string; readonly color: string; readonly score: string };
  readonly away: { readonly code: string; readonly color: string; readonly score: string };
  readonly clock: string;
  readonly period: string;
  readonly down: string;
  readonly direction: 'left-to-right';
  readonly possession: 'home';
  readonly centerCircle: true;
  readonly networkLogo: string;
  readonly font: { readonly family: string; readonly weight: number };
  readonly casing: 'as-is';
} = {
  style: 'football',
  position: { x: 280, y: 600 }, // bottom-center anchor (D-T335-1; 1280x720 canvas)
  background: '#0A0A0A', // NBC SNF dark bar (D-T335-1 / stub line 26; opacity divergence D-T335-11-a)
  foreground: '#FFFFFF', // white clock / period / down text
  home: { code: 'KC', color: '#E31837', score: '21' }, // KC home (Sunday Night canonical AFC matchup)
  away: { code: 'BUF', color: '#00338D', score: '14' }, // BUF away (Sunday Night canonical AFC matchup)
  clock: '08:14', // Q2 mid-quarter (D-T335-1)
  period: 'Q2', // second-quarter token (D-T335-1)
  down: '<< 1st & 10', // chevrons baked-in for v1 visible render (D-T335-1 / D-T335-11-e)
  direction: 'left-to-right', // schema-supplied; primitive does NOT auto-render (D-T335-11-e)
  possession: 'home', // KC has ball; brightness(1.12) on home box (D-T335-1)
  centerCircle: true, // NBC center-circle treatment (D-T335-1)
  networkLogo: 'NBC', // glyph rendered inside the circle (D-T335-1)
  font: { family: 'Public Sans', weight: 600 }, // OFL fallback for Sweet Sans Pro + NBC Tinker (D-T335-1)
  casing: 'as-is', // strings already in target casing (D-T335-1 / D-T335-4)
};

const nbcSnfBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'score-bug', // kebab-case primitive `kind` (T-332a line 686)
  buildProps() {
    // Deep-clone nested object literals so callers can mutate without
    // aliasing the exported constant.
    return {
      ...NBC_SNF_PROPS,
      position: { ...NBC_SNF_PROPS.position },
      home: { ...NBC_SNF_PROPS.home },
      away: { ...NBC_SNF_PROPS.away },
      font: { ...NBC_SNF_PROPS.font },
    };
  },
};

/**
 * `espn-bottomline-flipper` (T-339a) — second `newsTicker`-clipKind preset,
 * bound to the same `news-ticker-bar` primitive (T-356a) as T-356's
 * `bloomberg-ticker` but parameterized for the post-2018 ESPN BottomLine
 * register: `mode: 'flip'` + `flipDurationMs: 4500` (T-356b extension; FIRST
 * production consumer of `mode: 'flip'`) + sports payload (NBA team-vs-team
 * scores) + ESPN palette (Yellow up / ESPN Red down / white flat). Cached
 * snapshot substitutes for the live scores endpoint per ADR-003 §D2 (same
 * posture as T-356's bloomberg cached snapshot). At frame 60 (= 2000 ms @
 * 30fps; pair window 4500 ms) `pairIdx = 0` → top row NYK +5, bottom row
 * BOS F (D-T339a-1). Topic-bar companion + score-flash + scale-pulse +
 * entrance + within-window flip transition + logo box all deferred
 * (D-T339a-3 / D-T339a-11).
 */
export const ESPN_BOTTOMLINE_PROPS: {
  readonly entries: ReadonlyArray<{
    readonly symbol: string;
    readonly price: string;
    readonly delta: string;
    readonly direction: 'up' | 'down' | 'flat';
  }>;
  readonly mode: 'flip';
  readonly flipDurationMs: number;
  readonly bandHeight: number;
  readonly bandPosition: 'bottom';
  readonly background: string;
  readonly foreground: string;
  readonly upColor: string;
  readonly downColor: string;
  readonly flatColor: string;
} = {
  entries: [
    { symbol: 'NYK', price: '102', delta: '+5', direction: 'up' }, // Knicks lead by 5
    { symbol: 'BOS', price: '97', delta: 'F', direction: 'flat' }, // Celtics final
    { symbol: 'LAL', price: '88', delta: '-3', direction: 'down' }, // Lakers down 3
    { symbol: 'PHX', price: '91', delta: 'F', direction: 'flat' }, // Suns final
    { symbol: 'PHI', price: '24', delta: '+2', direction: 'up' }, // 76ers up 2 (1H)
    { symbol: 'DAL', price: '22', delta: 'F', direction: 'flat' }, // Mavericks (1H)
  ],
  mode: 'flip', // FIRST production consumer of T-356b mode (D-T339a-10)
  flipDurationMs: 4500, // mid-canon "4–5 s per segment" (D-T339a-1)
  bandHeight: 100, // 50 px per row in flip-mode (D-T339a-1)
  bandPosition: 'bottom', // bottom-of-frame full-width (D-T339a-1)
  background: '#1A1A1A', // gradient end (D-T339a-11-c)
  foreground: '#FFFFFF', // white text (D-T339a-1)
  upColor: '#FFD700', // Yellow score highlights (D-T339a-1 / stub line 28)
  downColor: '#CC0000', // ESPN Red accent (D-T339a-1 / stub line 26)
  flatColor: '#FFFFFF', // white FINAL / halftime token (D-T339a-1)
};

const espnBottomlineBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'news-ticker-bar', // kebab-case primitive `kind` (T-356a)
  buildProps() {
    // Deep-clone the entries array so callers can mutate without
    // aliasing the exported constant.
    return {
      ...ESPN_BOTTOMLINE_PROPS,
      entries: ESPN_BOTTOMLINE_PROPS.entries.map((e) => ({ ...e })),
    };
  },
};

/**
 * Wimbledon "Green-Purple" snapshot props per D-T337-1 / D-T337-4.
 * Cluster B preset T-337 wires the `score-bug` primitive (T-332a) as the
 * fifth `scoreBug` clipKind consumer (Pattern C — `PRESET_ID_BINDINGS`
 * override; fourth override after T-333 PL + T-334 Fox NFL + T-335 NBC SNF).
 * FIRST production consumer of T-332a's `'tennis'` style branch — validates
 * the 2-player stack render with country code (uppercase) + seed + N set
 * columns + game score + active-server dot.
 *
 * Snapshot captures the canonical Wimbledon final mid-match register:
 * Djokovic (SRB, [1]) vs Alcaraz (ESP, [2]); 2 sets played + 3rd in progress
 * with tiebreak scores ([6, 4, 7-6] vs [4, 6, 6-7]); Djokovic serving
 * (activeServerIndex: 0; yellow dot on player[0] row); current game 40-30;
 * Wimbledon green `#006633` base + purple `#4B0082` accent (schema-supplied
 * but not visibly rendered by primitive — D-T337-11-e); bottom-left anchor;
 * Montserrat 500 OFL fallback for proprietary Gotham. Entrance animation,
 * score-change pulse, server-dot smooth transition, and set-complete flash
 * all deferred (D-T337-3 / D-T337-11).
 */
export const WIMBLEDON_PROPS: {
  readonly style: 'tennis';
  readonly position: { readonly x: number; readonly y: number };
  readonly background: string;
  readonly accent: string;
  readonly foreground: string;
  readonly players: readonly [
    {
      readonly surname: string;
      readonly countryCode: string;
      readonly seed: number;
      readonly sets: readonly string[];
      readonly gameScore: string;
    },
    {
      readonly surname: string;
      readonly countryCode: string;
      readonly seed: number;
      readonly sets: readonly string[];
      readonly gameScore: string;
    },
  ];
  readonly activeServerIndex: 0;
  readonly anchor: 'bottom-left';
  readonly font: { readonly family: string; readonly weight: number };
  readonly casing: 'as-is';
} = {
  style: 'tennis',
  position: { x: 60, y: 580 }, // bottom-left anchor (D-T337-1; 1280x720 canvas)
  background: '#006633', // Wimbledon green base (D-T337-1 / stub line 24)
  accent: '#4B0082', // Wimbledon purple — schema-supplied; not visibly rendered (D-T337-11-e)
  foreground: '#FFFFFF', // white text (D-T337-1)
  players: [
    {
      surname: 'Djokovic', // Mixed-case; casing 'as-is' leaves untouched
      countryCode: 'SRB', // primitive force-uppercases regardless of casing
      seed: 1,
      sets: ['6', '4', '7-6'], // 2 sets played + 3rd in progress (tiebreak); 2025 register
      gameScore: '40',
    },
    {
      surname: 'Alcaraz',
      countryCode: 'ESP',
      seed: 2,
      sets: ['4', '6', '6-7'], // mirror Djokovic sets (each set's loser score)
      gameScore: '30',
    },
  ],
  activeServerIndex: 0, // Djokovic serving; yellow dot on player[0] row (D-T337-1)
  anchor: 'bottom-left', // schema-supplied; primitive does NOT auto-position (D-T337-11-f)
  font: { family: 'Montserrat', weight: 500 }, // OFL fallback for Gotham (D-T337-1)
  casing: 'as-is', // Mixed-case surnames pass through; countryCode hard-uppercased
};

const wimbledonGreenPurpleBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'score-bug', // kebab-case primitive `kind` (T-332a line 686)
  buildProps() {
    // Deep-clone nested object literals + the players tuple so callers
    // can mutate without aliasing the exported constant. The `sets`
    // arrays per player are also cloned (new array via spread).
    return {
      ...WIMBLEDON_PROPS,
      position: { ...WIMBLEDON_PROPS.position },
      players: [
        { ...WIMBLEDON_PROPS.players[0], sets: [...WIMBLEDON_PROPS.players[0].sets] },
        { ...WIMBLEDON_PROPS.players[1], sets: [...WIMBLEDON_PROPS.players[1].sets] },
      ] as const,
      font: { ...WIMBLEDON_PROPS.font },
    };
  },
};

/**
 * Masters "Red-Under-Par" snapshot props per D-T338-1 / D-T338-4.
 * Cluster B preset T-338 wires the `standings-table` primitive (T-357a) as the
 * second `standings` clipKind consumer (Pattern C — `PRESET_ID_BINDINGS`
 * override; first `standings`-keyed override after T-357 olympic-medal-tracker
 * holds the clipKind-default slot). FIRST production consumer of the canonical
 * golf red-black-green score-to-par color semantic; per-cell color depends on
 * the primitive's column-tinting capability and is single-color-per-column,
 * NOT per-cell-VALUE-derived (D-T338-10) — cosmetic divergence documented
 * under D-T338-11-a.
 *
 * Snapshot captures the canonical Masters Tournament mid-round register:
 * 5-row top-5 leaderboard (Scheffler / McIlroy / Schauffele / Spieth / Bryson)
 * with score-to-par + thru-hole columns; Augusta National green `#006747`
 * accent on the rank column (theme-slot mapping; not a visible accent-strip
 * per D-T338-11-d); dark broadcast base `#0E0E12`; white text; Inter 600 OFL
 * fallback for proprietary CBS Sports custom face. Position-change row-slide,
 * birdie/eagle flash, score count-up animation, full-screen scroll register
 * all deferred (D-T338-3 / D-T338-11).
 */
export const MASTERS_PROPS: {
  readonly rows: ReadonlyArray<{
    readonly rank: number;
    readonly code: string;
    readonly values: readonly number[];
  }>;
  readonly columns: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly kind: 'rank' | 'label' | 'numeric' | 'delta' | 'total';
    readonly color?: string;
    readonly width?: number;
    readonly flex?: number;
  }>;
  readonly background: string;
  readonly foreground: string;
  readonly goldColor: string;
  readonly bandPosition: 'overlay' | 'fullscreen';
  readonly rowHeight: number;
  readonly headerHeight: number;
  readonly staggerMs: number;
} = {
  rows: [
    { rank: 1, code: 'Scheffler', values: [-12, 18] },
    { rank: 2, code: 'McIlroy', values: [-10, 17] },
    { rank: 3, code: 'Schauffele', values: [-8, 18] },
    { rank: 4, code: 'Spieth', values: [0, 18] },
    { rank: 5, code: 'Bryson', values: [2, 15] },
  ],
  columns: [
    { key: 'rank', label: '#', kind: 'rank', width: 56, color: '#006747' },
    { key: 'name', label: 'PLAYER', kind: 'label', flex: 2 },
    { key: 'score', label: 'TO PAR', kind: 'numeric' },
    { key: 'thru', label: 'THRU', kind: 'numeric' },
    { key: 'total', label: '', kind: 'total', width: 0 },
  ],
  background: '#0E0E12',
  foreground: '#FFFFFF',
  goldColor: '#006747',
  bandPosition: 'overlay',
  rowHeight: 64,
  headerHeight: 48,
  staggerMs: 80,
};

const mastersRedUnderParBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'standings-table', // kebab-case primitive `kind` (T-357a line 352)
  buildProps() {
    // Deep-clone nested object literals + the rows / columns arrays so callers
    // can mutate without aliasing the exported constant.
    return {
      rows: MASTERS_PROPS.rows.map((r) => ({
        rank: r.rank,
        code: r.code,
        values: [...r.values],
      })),
      columns: MASTERS_PROPS.columns.map((c) => ({ ...c })),
      background: MASTERS_PROPS.background,
      foreground: MASTERS_PROPS.foreground,
      goldColor: MASTERS_PROPS.goldColor,
      bandPosition: MASTERS_PROPS.bandPosition,
      rowHeight: MASTERS_PROPS.rowHeight,
      headerHeight: MASTERS_PROPS.headerHeight,
      staggerMs: MASTERS_PROPS.staggerMs,
    };
  },
};

/**
 * F1 "Timing Tower" snapshot props per D-T332-1 / D-T332-4.
 * Cluster B preset T-332 wires the `score-bug` primitive (T-332a) as the
 * seventh `scoreBug` clipKind consumer (Pattern C — `PRESET_ID_BINDINGS`
 * override; fifth override after T-333 PL + T-334 Fox NFL + T-335 NBC SNF +
 * T-337 Wimbledon). FIRST production consumer of T-332a's `'racing'` style
 * branch — closes the primitive's production-consumer matrix to all 4 styles
 * (`'football'` / `'racing'` / `'cricket'` / `'tennis'`) exercised.
 *
 * Snapshot captures the canonical 2024 mid-session F1 timing tower:
 * 20-driver vertical tower with leader VER (Red Bull) on top + canonical
 * 2024 grid order with 3-letter driver codes + livery team-color stripes
 * + per-row top-10 sector colors (purple session-best / green personal-best
 * / yellow slower / gray neutral) + tire compounds + truncated 3-decimal
 * gap times. Bottom 10 rows carry minimal data (position + code + teamColor
 * + gap; broadcast canon — leaders' timing detail is the focus). Carbon-
 * black `#0D0D0F` base + white text + Barlow Condensed 600 OFL fallback
 * for proprietary Formula1 Display. Tower slide-in entrance, position-
 * change row-slide, sector-record purple pulse, "Smart glass" highlightIndex
 * all deferred (D-T332-3 / D-T332-11).
 */
export const F1_TIMING_TOWER_PROPS: {
  readonly style: 'racing';
  readonly position: { readonly x: number; readonly y: number };
  readonly background: string;
  readonly foreground: string;
  readonly font: { readonly family: string; readonly weight: number };
  readonly casing: 'as-is';
  readonly rows: ReadonlyArray<{
    readonly position: number;
    readonly code: string;
    readonly teamColor: string;
    readonly gap: string;
    readonly sectorColors?: ReadonlyArray<'session-best' | 'personal-best' | 'slower' | 'neutral'>;
    readonly tireCompound?: 'soft' | 'medium' | 'hard' | 'inter' | 'wet';
  }>;
} = {
  style: 'racing',
  position: { x: 60, y: 60 }, // top-left tower anchor (D-T332-1; 1280x720 canvas)
  background: '#0D0D0F', // carbon black per stub line 24
  foreground: '#FFFFFF', // white text
  font: { family: 'Barlow Condensed', weight: 600 }, // OFL fallback for Formula1 Display
  casing: 'as-is',
  rows: [
    {
      position: 1,
      code: 'VER',
      teamColor: '#1E5BC6',
      gap: 'LEADER',
      sectorColors: ['session-best', 'personal-best', 'session-best'],
      tireCompound: 'soft',
    },
    {
      position: 2,
      code: 'NOR',
      teamColor: '#F58020',
      gap: '+0.124',
      sectorColors: ['personal-best', 'slower', 'personal-best'],
      tireCompound: 'medium',
    },
    {
      position: 3,
      code: 'LEC',
      teamColor: '#ED1C24',
      gap: '+0.487',
      sectorColors: ['personal-best', 'personal-best', 'slower'],
      tireCompound: 'soft',
    },
    {
      position: 4,
      code: 'SAI',
      teamColor: '#ED1C24',
      gap: '+0.789',
      sectorColors: ['slower', 'personal-best', 'personal-best'],
      tireCompound: 'medium',
    },
    {
      position: 5,
      code: 'HAM',
      teamColor: '#6CD3BF',
      gap: '+1.234',
      sectorColors: ['personal-best', 'slower', 'slower'],
      tireCompound: 'medium',
    },
    {
      position: 6,
      code: 'PIA',
      teamColor: '#F58020',
      gap: '+1.567',
      sectorColors: ['slower', 'personal-best', 'slower'],
      tireCompound: 'soft',
    },
    {
      position: 7,
      code: 'ALO',
      teamColor: '#2D826D',
      gap: '+2.012',
      sectorColors: ['neutral', 'neutral', 'neutral'],
      tireCompound: 'hard',
    },
    {
      position: 8,
      code: 'RUS',
      teamColor: '#6CD3BF',
      gap: '+2.456',
      sectorColors: ['slower', 'slower', 'personal-best'],
      tireCompound: 'medium',
    },
    {
      position: 9,
      code: 'PER',
      teamColor: '#1E5BC6',
      gap: '+2.901',
      sectorColors: ['neutral', 'neutral', 'neutral'],
      tireCompound: 'hard',
    },
    {
      position: 10,
      code: 'GAS',
      teamColor: '#2293D1',
      gap: '+3.345',
      sectorColors: ['slower', 'slower', 'slower'],
      tireCompound: 'medium',
    },
    { position: 11, code: 'OCO', teamColor: '#2293D1', gap: '+3.678' },
    { position: 12, code: 'STR', teamColor: '#2D826D', gap: '+4.012' },
    { position: 13, code: 'BOT', teamColor: '#900', gap: '+4.456' },
    { position: 14, code: 'TSU', teamColor: '#3671C6', gap: '+4.789' },
    { position: 15, code: 'ALB', teamColor: '#005AFF', gap: '+5.123' },
    { position: 16, code: 'HUL', teamColor: '#B6BABD', gap: '+5.456' },
    { position: 17, code: 'MAG', teamColor: '#B6BABD', gap: '+5.789' },
    { position: 18, code: 'SAR', teamColor: '#005AFF', gap: '+6.123' },
    { position: 19, code: 'RIC', teamColor: '#3671C6', gap: '+6.456' },
    { position: 20, code: 'ZHO', teamColor: '#900', gap: '+6.789' },
  ],
};

const f1TimingTowerBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'score-bug', // kebab-case primitive `kind` (T-332a line 686)
  buildProps() {
    // Deep-clone nested object literals + the rows array so callers can
    // mutate without aliasing the exported constant. Per-row sectorColors
    // arrays (when present) are also cloned via spread.
    return {
      ...F1_TIMING_TOWER_PROPS,
      position: { ...F1_TIMING_TOWER_PROPS.position },
      font: { ...F1_TIMING_TOWER_PROPS.font },
      rows: F1_TIMING_TOWER_PROPS.rows.map((r) => ({
        ...r,
        ...(r.sectorColors !== undefined ? { sectorColors: [...r.sectorColors] } : {}),
      })),
    };
  },
};

/**
 * Cricket scorebug snapshot props per D-T336-1 / D-T336-4.
 * Cluster B preset T-336 wires the `score-bug` primitive (T-332a) as the
 * eighth `scoreBug` clipKind consumer (Pattern C — `PRESET_ID_BINDINGS`
 * override; sixth override after T-333 PL + T-334 Fox NFL + T-335 NBC SNF +
 * T-337 Wimbledon + T-332 F1 Timing Tower). FIRST production consumer of
 * T-332a's `'cricket'` style branch — completes the primitive's full
 * production-consumer matrix across all 4 styles (`'football'` / `'racing'` /
 * `'cricket'` / `'tennis'`) exercised.
 *
 * Snapshot captures the canonical mid-innings IND vs AUS register: top-of-
 * screen multi-row complex panel anchored at top-center; India batting team
 * blue `#0066B3` score 247/4 in 42.3 overs; Australia bowling team gold
 * `#FFCD00`; current run rate 5.85 + required run rate 6.42; both batsmen
 * (Kohli on-strike 87/92 + Rahul 34/41); current bowler (Cummins 2-58);
 * partnership 64 (78). Dark broadcast base `#0E0E12` + white text + IBM Plex
 * Sans 600 OFL fallback for the proprietary Star Sports / ICC custom face.
 * Ball-by-ball pulse, wicket flash, boundary flash, milestone flash, and
 * between-overs expand all deferred (D-T336-3 / D-T336-12). Ball-by-ball dot
 * row composes externally via T-358 cricket-ball-by-ball-dots preset
 * (`outcome-row` primitive); not a T-336 axis.
 */
export const CRICKET_SCOREBUG_PROPS: {
  readonly style: 'cricket';
  readonly position: { readonly x: number; readonly y: number };
  readonly background: string;
  readonly foreground: string;
  readonly font: { readonly family: string; readonly weight: number };
  readonly casing: 'as-is';
  readonly battingTeam: {
    readonly code: string;
    readonly color: string;
    readonly runs: number;
    readonly wickets: number;
    readonly overs: string;
  };
  readonly bowlingTeam: {
    readonly code: string;
    readonly color: string;
  };
  readonly runRate: string;
  readonly requiredRunRate: string;
  readonly batsmen: ReadonlyArray<{
    readonly name: string;
    readonly runs: number;
    readonly balls?: number;
    readonly onStrike?: boolean;
  }>;
  readonly bowler: { readonly name: string; readonly figures: string };
  readonly partnership: string;
  readonly anchor: 'top-center';
} = {
  style: 'cricket',
  position: { x: 200, y: 60 }, // top-anchored mid-frame (D-T336-4; 1280x720 canvas)
  background: '#0E0E12', // dark broadcast bg per stub line 22
  foreground: '#FFFFFF', // white text
  font: { family: 'IBM Plex Sans', weight: 600 }, // OFL fallback for Star Sports / ICC custom
  casing: 'as-is',
  battingTeam: {
    code: 'IND',
    color: '#0066B3', // India blue per stub line 24
    runs: 247,
    wickets: 4,
    overs: '42.3',
  },
  bowlingTeam: {
    code: 'AUS',
    color: '#FFCD00', // Australia gold per stub line 24
  },
  runRate: '5.85',
  requiredRunRate: '6.42',
  batsmen: [
    { name: 'Kohli', runs: 87, balls: 92, onStrike: true },
    { name: 'Rahul', runs: 34, balls: 41 },
  ],
  bowler: { name: 'Cummins', figures: '2-58' },
  partnership: '64 (78)',
  anchor: 'top-center',
};

const cricketScorebugBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'score-bug', // kebab-case primitive `kind` (T-332a line 686)
  buildProps() {
    // Deep-clone nested object literals + the batsmen array (with per-batsman
    // objects) so callers can mutate without aliasing the exported constant.
    return {
      ...CRICKET_SCOREBUG_PROPS,
      position: { ...CRICKET_SCOREBUG_PROPS.position },
      font: { ...CRICKET_SCOREBUG_PROPS.font },
      battingTeam: { ...CRICKET_SCOREBUG_PROPS.battingTeam },
      bowlingTeam: { ...CRICKET_SCOREBUG_PROPS.bowlingTeam },
      batsmen: CRICKET_SCOREBUG_PROPS.batsmen.map((b) => ({ ...b })),
      bowler: { ...CRICKET_SCOREBUG_PROPS.bowler },
    };
  },
};

/**
 * YouTube subscribe-bounce snapshot props per D-T369-1 / D-T369-4.
 * Cluster G preset T-369 wires the `subscribe-button` primitive (T-317;
 * just merged at main `1cc4da93`) as the FIRST `subscribeButton` clipKind
 * consumer (Pattern C — `PRESET_ID_BINDINGS` override; no clipKind-default
 * arm in v1 since other Cluster G presets bind different primitives:
 * T-371 / T-373 → `follow-prompt`, T-372 → `qr-code-bounce`). FIRST
 * production consumer of T-317's `'youtube'` platform branch.
 *
 * Snapshot captures the YouTube native subscribe-button broadcast canon:
 * YouTube-Red `#FF0000` rounded pill (border-radius 8 px hardcoded by the
 * primitive's `YOUTUBE_BORDER_RADIUS` default) + white force-uppercased
 * "SUBSCRIBE" label in Roboto Medium 500 (per-platform defaults applied
 * inside `renderYoutube`) + drop shadow `0 4px 8px rgba(0,0,0,0.20)`
 * (primitive default `dropShadow !== false`) + lower-right anchor at
 * `(1040, 640)` on the parity-CLI default 1280×720 canvas (`DEFAULT_COMPOSITION`).
 * Position math: 1280 − ~180 button-width − ~60 right-margin = 1040;
 * 720 − ~40 button-height − ~40 bottom-margin = 640.
 *
 * Phase defaults to `'idle'`; the parity golden is rendered at frame 60,
 * well past the bounce-overshoot settle frame (`ceil(fps * 0.5) = 15` at
 * fps 30) — scale clamps to 1.00 via `extrapolateRight: 'clamp'`. Bell
 * glyph (`'subscribed'` phase) and cursor glyph (`'pressing'` phase) are
 * NOT rendered in v1 (D-T369-3 / D-T369-11 a / b — `T-317a` / `T-317b`
 * carve-outs). YouTube branch force-uppercases the label regardless of
 * `casing` (D-T369-11-c — primitive contract per T-317 D-T317-8); the
 * snapshot label `'SUBSCRIBE'` is already uppercase so the transform has
 * no observable effect on the parity golden.
 */
export const YOUTUBE_SUBSCRIBE_BOUNCE_PROPS: {
  readonly platform: 'youtube';
  readonly position: { readonly x: number; readonly y: number };
  readonly label: string;
} = {
  platform: 'youtube',
  position: { x: 1040, y: 640 }, // lower-right on parity-CLI 1280×720 canvas (D-T369-1 / D-T369-4)
  label: 'SUBSCRIBE', // YouTube-canon CTA copy (D-T369-1)
};

const youtubeSubscribeBounceBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'subscribe-button', // kebab-case primitive `kind` (T-317 line 599)
  buildProps() {
    // Deep-clone the nested `position` object so callers can mutate the
    // returned props without aliasing the exported constant.
    return {
      ...YOUTUBE_SUBSCRIBE_BOUNCE_PROPS,
      position: { ...YOUTUBE_SUBSCRIBE_BOUNCE_PROPS.position },
    };
  },
};

/**
 * TikTok follow-pulse snapshot props per D-T370-1 / D-T370-4.
 * Cluster G preset T-370 wires the `follow-prompt` primitive (T-318;
 * just merged at main `25bb0c09`) as the FIRST `followPrompt` clipKind
 * consumer (Pattern C — `PRESET_ID_BINDINGS` override; no clipKind-default
 * arm in v1 since other Cluster G presets bind different primitives:
 * T-369 → `subscribe-button`, T-372 → `qr-code-bounce`, T-373 →
 * `lower-third`). FIRST production consumer of T-318's `'tiktok'` platform
 * branch.
 *
 * Snapshot captures the TikTok native follow-prompt mobile-CTA canon:
 * 40 × 40 px white avatar circle (size hardcoded by `DEFAULT_SIZE`) +
 * TikTok-Pink `#FE2C55` "+" badge bottom-right of avatar (badge color
 * hardcoded by `TIKTOK_PINK`; brand canon dominates theme — `props.badgeColor`
 * is no-op on the TikTok branch per D-T318-6) + 30%-alpha expanding TikTok-
 * Pink pulse ring drawn behind the avatar in the `'pulsing'` phase (single
 * cycle; default `pulseRepeat = 1`) + right-thumb-zone anchor at (1180, 504)
 * on the parity-CLI default 1280 × 720 canvas (`DEFAULT_COMPOSITION`).
 * Position math: 1280 − 100 right-margin = 1180; 720 × 0.70 = 504 (~70% down
 * from top per stub line 25).
 *
 * Phase is `'pulsing'`; the parity golden is rendered at frame 30 (peakFrame
 * = 15 at fps 30; cycleFrames = 45; phaseFrame = 30 is past peak, mid-decay
 * → avatarScale ≈ 1.025; ring radiusFactor ≈ 1.33; ring opacity ≈ 0.10).
 * Captures the visually canonical mid-pulse register: avatar mid-pulse +
 * visible expanding pulse ring + TikTok-Pink "+" badge. Frame 60 is past
 * `totalFrames = 45 * pulseRepeat=1` — the avatar settles to scale 1.0 and
 * the ring stops rendering, equivalent to `'idle'` phase; T-370 OVERRIDES
 * the cluster-norm `--frame=60` to `--frame=30` (D-T370-5).
 */
export const TIKTOK_FOLLOW_PULSE_PROPS: {
  readonly platform: 'tiktok';
  readonly position: { readonly x: number; readonly y: number };
  readonly phase: 'pulsing';
} = {
  platform: 'tiktok',
  position: { x: 1180, y: 504 }, // right-thumb-zone on parity-CLI 1280×720 (D-T370-1 / D-T370-4)
  phase: 'pulsing', // mid-flight pulse register per D-T370-1
};

const tiktokFollowPulseBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'follow-prompt', // kebab-case primitive `kind` (T-318 line 677)
  buildProps() {
    // Deep-clone the nested `position` object so callers can mutate the
    // returned props without aliasing the exported constant.
    return {
      ...TIKTOK_FOLLOW_PULSE_PROPS,
      position: { ...TIKTOK_FOLLOW_PULSE_PROPS.position },
    };
  },
};

/**
 * Synthetic 21 × 21 Version 1 placeholder QR matrix for the
 * `coinbase-dvd-qr` parity fixture (T-372 D-T372-2). Carries the three
 * canonical finder patterns (top-left, top-right, bottom-left 7×7 blocks
 * with outer ring `'1'`, inner ring `'0'`, center 3×3 `'1'`) + timing
 * patterns (row 6 / col 6 alternating 1/0 between the finders) + the
 * mandatory dark-module bit at row 13 col 8 + arbitrary deterministic
 * data bits in the remaining cells. Does NOT encode any real URL —
 * Reed-Solomon parity bits are NOT computed; this matrix would NOT scan
 * as a real QR code. The brand-register identity is the
 * bouncing-rainbow-QR shape, not a literal scannable URL; the parity
 * test only cares about the rendered pixel pattern.
 */
export const COINBASE_DVD_QR_MATRIX: readonly string[] = [
  '111111100101001111111',
  '100000100101001000001',
  '101110101001001011101',
  '101110100011101011101',
  '101110101111101011101',
  '100000100011101000001',
  '111111101010101111111',
  '000000000101000000000',
  '001010100101010010101',
  '110010011001001100100',
  '000111100011100001110',
  '111111011111111111111',
  '000111100011100001110',
  '000000001001001100100',
  '111111100101010010101',
  '100000100101010010101',
  '101110101001001100100',
  '101110100011100001110',
  '101110101111111111111',
  '100000100011100001110',
  '111111101001001100100',
];

/**
 * Coinbase DVD-QR snapshot props per D-T372-1 / D-T372-3 / D-T372-4.
 * Cluster G preset T-372 wires the `qr-code-bounce` primitive (T-319;
 * just merged at main `4d0879c8`) as the FIRST `qrCodeBounce` clipKind
 * consumer (Pattern C — `PRESET_ID_BINDINGS` override; no clipKind-default
 * arm in v1 since other Cluster G presets bind different primitives:
 * T-369 → `subscribe-button`, T-370 → `follow-prompt`, T-373 →
 * `lower-third`). FIRST production consumer of T-319's `qr-code-bounce`
 * primitive.
 *
 * Snapshot captures the Coinbase Super Bowl LVI DVD-screensaver QR canon:
 * 21 × 21 Version 1 synthetic-placeholder QR matrix on pure-black backdrop
 * (primitive default `#000000` per `DEFAULT_BACKGROUND`; zero-brand canon
 * dominates theme — the snapshot does NOT pass `background`) +
 * ~22 % canvas-min-dimension size (primitive default `sizePercent: 22`;
 * `rectSize ≈ 158 px` on the parity-CLI 1280×720 canvas) + rainbow HSL
 * hue cycle (primitive default `colorCycle.palette: 'rainbow'`,
 * `cycleFrames = ceil(fps * 7) = 210` at fps 30) + DVD-screensaver bounce
 * starting at top-left corner with non-degenerate axis-asymmetric
 * velocities (D-T372-3: `vx: 8, vy: 6` — 4× faster than the stub's
 * 1.3–2.0 px/frame to deliver a visually-canonical mid-flight register
 * at frame 60).
 *
 * At frame 60 with these values: position ≈ `(480, 360)` — center-canvas,
 * still in the first up-leg of the bounce (no rebound yet —
 * `spanX = 1280 - 158 = 1122`, `spanY = 720 - 158 = 562`; both axes
 * within span). Hue ≈ `60 / 210 * 360 ≈ 102.86°` (yellow-green) →
 * `darkColor ≈ #7BFF00` per HSL→RGB conversion. Captures the canonical
 * mid-bounce + mid-rainbow register. T-372 is the FIRST non-cluster-norm
 * parity threshold pin in Phase 13: PSNR=38 / SSIM=0.94 (preset-pinned
 * per stub line 48), NOT cluster-norm 42 / 0.98.
 */
export const COINBASE_DVD_QR_PROPS: {
  readonly qrMatrix: readonly string[];
  readonly bounce: {
    readonly startPosition: { readonly x: number; readonly y: number };
    readonly startVelocity: { readonly vx: number; readonly vy: number };
  };
} = {
  qrMatrix: COINBASE_DVD_QR_MATRIX,
  bounce: {
    startPosition: { x: 0, y: 0 }, // top-left corner anchor (D-T372-1)
    startVelocity: { vx: 8, vy: 6 }, // mid-flight at frame 60 (D-T372-3)
  },
};

const coinbaseDvdQrBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'qr-code-bounce', // kebab-case primitive `kind` (T-319 line 357)
  buildProps() {
    // Deep-clone the nested objects so callers can mutate the returned
    // props without aliasing the exported constant. The `qrMatrix` itself
    // is `readonly`-typed; we expand it into a fresh array.
    return {
      qrMatrix: [...COINBASE_DVD_QR_PROPS.qrMatrix],
      bounce: {
        startPosition: { ...COINBASE_DVD_QR_PROPS.bounce.startPosition },
        startVelocity: { ...COINBASE_DVD_QR_PROPS.bounce.startVelocity },
      },
    };
  },
};

/**
 * Instagram link-sticker snapshot props per D-T371-1 / D-T371-2 / D-T371-4.
 * Cluster G preset T-371 wires the `link-sticker` primitive (T-371a; just
 * merged at main `8f7dbd4b`) as the FIRST `socialMedia` clipKind consumer
 * (Pattern C — `PRESET_ID_BINDINGS` override; no clipKind-default arm in
 * v1 since v1 has exactly one `socialMedia`-bound preset). FIRST production
 * consumer of T-371a's `link-sticker` primitive. T-371 is the FIFTH and
 * FINAL Cluster G preset — its merge closes Cluster G to 5/5 ELIGIBLE
 * (first cluster expansion beyond the four originally-ratified clusters
 * to fully close).
 *
 * Snapshot captures the Instagram Stories link-sticker canon: a rounded
 * pill with `label: 'instagram.com/yourhandle'` (D-T371-2 — domain-canon
 * placeholder; does NOT encode any real handle) + `variant:
 * 'white-on-dark'` (stub line 43 default — pure-black `#000000` backdrop /
 * white `#FFFFFF` Inter Medium 14 px text / black drop-shadow / white
 * shimmer-highlight per `VARIANT_TOKENS['white-on-dark']`) + `position:
 * { x: 540, y: 338 }` (canvas-centered top-left on parity-CLI 1280×720;
 * `(1280-200)/2 = 540`, `(720-44)/2 = 338`; D-T371-4). Snapshot
 * intentionally minimal — only the three REQUIRED fields (`label`,
 * `variant`, `position`); every other knob (`phase`, `width`, `height`,
 * `fontSize`, `shimmer`, per-variant tokens) inherits primitive defaults
 * (`'shimmering'`, 200×44 pill, 14 px font-size, `cycleFrames = ceil(fps *
 * 3) = 90`, `bandWidth = 40`, white shimmer-highlight).
 *
 * At frame 60 with default `cycleFrames = 90`: phase progress
 * `60 / 90 ≈ 0.667`; `shimmerX = round(0.667 * 240 - 40) = 120`. Band
 * lands at `left = 540 + 120 = 660` on the canvas (right portion of the
 * pill; on-pill left=120, right=160 within 200-px pill width). Captures
 * the canonical mid-shimmer register. T-371 ships **cluster-norm
 * thresholds** (PSNR ≥ 42 / SSIM ≥ 0.98) — NOT preset-pinned 38 / 0.94
 * like T-372 — because the shimmer is a steady-state-icon register: no
 * motion blur (linear-gradient sweep over a STATIC pill), static glyph
 * layout (no per-frame reflow), no per-frame color cycling (variant
 * defaults are fixed). Stub line 47 explicitly pre-declares 42 / 0.98.
 */
export const INSTAGRAM_LINK_STICKER_PROPS: {
  readonly label: string;
  readonly variant: 'white-on-dark';
  readonly position: { readonly x: number; readonly y: number };
} = {
  label: 'instagram.com/yourhandle', // domain-canon placeholder (D-T371-2)
  variant: 'white-on-dark', // stub line 43 default (D-T371-1)
  position: { x: 540, y: 338 }, // canvas-centered top-left on 1280×720 (D-T371-4)
};

const instagramLinkStickerBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'link-sticker', // kebab-case primitive `kind` (T-371a line 324)
  buildProps() {
    // Deep-clone the nested `position` object so callers can mutate the
    // returned props without aliasing the exported constant.
    return {
      ...INSTAGRAM_LINK_STICKER_PROPS,
      position: { ...INSTAGRAM_LINK_STICKER_PROPS.position },
    };
  },
};

/**
 * `stranger-things-benguiat` (T-348) — second Cluster D preset; FIRST
 * `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` (Pattern C
 * override; T-350's `squidGameGeometricBinding` stays the clipKind-default
 * arm) AND **first multi-clip-composition consumer in StageFlip parity-CLI
 * history** (D-T348-1). Composes the parent `titleSequence` primitive
 * (T-321) with four atmospheric overlays in z-order: `grain` (T-321a),
 * `light-leak` (T-131b.2), `particles` (T-131d.1), `photographic-overlay`
 * (T-321d). Lowered parity thresholds 36/0.92 (D-T348-10; mandatory film
 * grain reduces compression precision per stub line 49). Cormorant
 * Garamond Bold (OFL) is the rendered fallback for ITC Benguiat Bold
 * (commercial-byo) per D-T348-9-a. ALL CAPS scaled-to-viewport
 * "STRANGER THINGS" letterforms with red `#FF0000` Gaussian-blur glow on
 * white-letter foreground = canonical neon-torch-through-canvas register.
 */

/** D-T348-8: titleSequence parent props (`'letterform-assemble'` style). */
export const STRANGER_TITLE_SEQUENCE_PROPS = {
  shots: [
    {
      id: 'main-title',
      startMs: 0,
      endMs: 50000, // 50s sequence per stub line 35; static at frame 480
      kind: 'letterAnimation' as const,
      content: { text: 'STRANGER THINGS', staggerMs: 200 },
      transitionOut: 'cut' as const,
    },
  ],
  style: 'letterform-assemble' as const,
  font: {
    // Cormorant Garamond Bold (OFL fallback; registered via T-307); ITC
    // Benguiat is the preferred commercial-byo typeface but not bundled.
    family: 'Cormorant Garamond, ITC Benguiat, Benguiat, serif',
    weight: 700,
    // Bundle default; the `'letterform-assemble'` branch ignores font.size
    // for letterforms (scales letters to viewportHeight × letterformScale =
    // 720 × 0.7 = 504 px). Provided for non-letter-animation fallback paths.
    size: 96,
  },
  casing: 'uppercase' as const,
  background: '#000000', // deep-black per stub line 23
  // White letters BEFORE glow tints them; the red `#FF0000` Gaussian-blur
  // glow on top produces the red-neon-through-canvas torch register.
  // `highlightColor` deliberately omitted — primitive default `#FF0000`
  // matches the equality-with-default branch routing through `foreground`
  // (title-sequence.tsx:432).
  foreground: '#FFFFFF',
  position: { x: 640, y: 360, width: 1280, alignment: 'center' as const },
  entrance: 'fade' as const,
  glow: {
    color: '#FF0000', // red neon torch (stub line 24)
    blur: 8, // moderate; matches "deep, gradual" build per stub line 36
  },
  letterformScale: 0.7, // primitive default; explicit for clarity
} as const;

/** D-T348-4: grain overlay props (canonical Stranger Things-grade subtle grain). */
export const STRANGER_GRAIN_PROPS = {
  intensity: 0.15, // primitive default; explicit for parity-fixture clarity
  cellSize: 1,
  seed: 0,
} as const;

/** D-T348-5: light-leak overlay props (warm-orange family). */
export const STRANGER_LIGHT_LEAK_PROPS = {
  // color1 inherits primitive default '#ff6b35' (warm-orange); color2 and
  // color3 overridden to warm-orange siblings (vs. defaults '#ffd700' gold
  // / '#ff1493' pink) per stub line 26 "warm orange, intermittent".
  color1: '#ff6b35',
  color2: '#ff8c1a',
  color3: '#ffa040',
  intensity: 0.7, // primitive default; explicit
  seed: 42, // primitive default; explicit
} as const;

/** D-T348-6: particles overlay props (atmospheric drifting dust). */
export const STRANGER_PARTICLES_PROPS = {
  style: 'snow' as const,
  count: 30, // low for atmospheric subtlety (vs. primitive default 50)
  color: '#ffffff', // pure white, no blue tints (vs. snow defaults)
} as const;

/** D-T348-7: photographic-overlay overlay props (subtle 80s analog warmth). */
export const STRANGER_PHOTOGRAPHIC_OVERLAY_PROPS = {
  mode: 'fade' as const,
  intensity: 0.4, // subtle; full intensity 1.0 would obliterate red-neon-glow
} as const;

const strangerThingsBenguiatGrainOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'grain',
  buildProps() {
    return { ...STRANGER_GRAIN_PROPS };
  },
};

const strangerThingsBenguiatLightLeakOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'light-leak',
  buildProps() {
    return { ...STRANGER_LIGHT_LEAK_PROPS };
  },
};

const strangerThingsBenguiatParticlesOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'particles',
  buildProps() {
    return { ...STRANGER_PARTICLES_PROPS };
  },
};

const strangerThingsBenguiatPhotographicOverlayOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'photographic-overlay',
  buildProps() {
    return { ...STRANGER_PHOTOGRAPHIC_OVERLAY_PROPS };
  },
};

const strangerThingsBenguiatBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'titleSequence', // camelCase primitive kind (title-sequence.tsx:800)
  buildProps() {
    // Deep-clone nested arrays / objects so callers can mutate the returned
    // props without aliasing the exported constant.
    return {
      ...STRANGER_TITLE_SEQUENCE_PROPS,
      shots: STRANGER_TITLE_SEQUENCE_PROPS.shots.map((s) => ({
        ...s,
        content: { ...s.content },
      })),
      font: { ...STRANGER_TITLE_SEQUENCE_PROPS.font },
      position: { ...STRANGER_TITLE_SEQUENCE_PROPS.position },
      glow: { ...STRANGER_TITLE_SEQUENCE_PROPS.glow },
    };
  },
  // D-T348-2: declaration order = z-order. titleSequence base (zIndex 0)
  // → grain (1) → light-leak (2) → particles (3) → photographic-overlay (4).
  overlays: [
    strangerThingsBenguiatGrainOverlay,
    strangerThingsBenguiatLightLeakOverlay,
    strangerThingsBenguiatParticlesOverlay,
    strangerThingsBenguiatPhotographicOverlayOverlay,
  ],
};

/**
 * `true-detective-double-exposure` (T-351) — third Cluster D preset; SECOND
 * `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` (Pattern C
 * override; T-350's `squidGameGeometricBinding` stays the clipKind-default
 * arm) AND **second multi-clip-composition consumer in StageFlip parity-CLI
 * history** (D-T351-1; reuses T-348's `ClipKindBinding.overlays?` surface
 * verbatim — no architectural extension). Composes the parent `titleSequence`
 * primitive (T-321) with two atmospheric overlays in z-order: `grain`
 * (T-321a) and `photographic-overlay` (T-321d). T-351 is the **PRIMARY
 * consumer of the T-321d `photographic-overlay` primitive** — runs
 * `mode: 'cinematic-lut'` at `intensity: 0.6` (DOMINATES the visual register
 * per stub line 33 — "the photography is the foreground"). NO light-leak
 * (would conflict with the muted earth-tone register) NOR particles (no
 * atmospheric drift in this canon) per D-T351-2 (intentional 3-clip stack
 * vs. T-348's 5-clip stack). Lowered parity thresholds 34/0.90 (D-T351-5;
 * even lower than T-348's 36/0.92 — photographic source has high variance
 * per stub line 49). Inter Regular 400 (OFL fallback) is the rendered
 * deferential typography per D-T351-9-a; bespoke license-cleared sans-serif
 * is consumer-wired. Single-shot `kind: 'titlePlate'` ALL-CAPS "CREATED BY
 * NIC PIZZOLATTO" credit hold under `style: 'photographic-overlay'` (FIRST
 * end-to-end consumer of the title-sequence's `'photographic-overlay'`
 * style register per T-321 line 566–578 — only `titlePlate` + `creditsBlock`
 * shots render under this style).
 */

/** D-T351-6: titleSequence parent props (`'photographic-overlay'` style). */
export const TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS = {
  shots: [
    {
      id: 'main-credit',
      startMs: 0,
      endMs: 90000, // 90s sequence per stub line 38
      kind: 'titlePlate' as const,
      content: { text: 'CREATED BY NIC PIZZOLATTO' }, // titlePlate content shape is `{ text }` (D-T351-6)
      transitionOut: 'cut' as const,
    },
  ],
  // T-321 line 566–578: only `titlePlate` + `creditsBlock` shots render
  // under this style; defers everything else to a sister photographic clip.
  // T-351 is the FIRST end-to-end consumer of this style register.
  style: 'photographic-overlay' as const,
  font: {
    // Inter Regular 400 (OFL fallback; registered via T-307); bespoke
    // license-cleared sans-serif is consumer-wired (D-T351-9-a).
    family: 'Inter, system-ui, -apple-system, sans-serif',
    weight: 400, // Regular per stub line 30
    size: 28, // 24–30 pt range per stub line 30; mid-range
    letterSpacing: 40, // +30–50 tracking per stub line 32; mid-range (D-T351-6)
  },
  casing: 'uppercase' as const, // ALL CAPS per stub line 31 (D-T351-6)
  // Deep-black under-canvas placeholder; the photographic-overlay tonal
  // grading dominates visually (intensity 0.6) so the painted background
  // is largely hidden. Stub does not specify; pick deep black for the
  // unobtrusive base.
  background: '#000000',
  // Muted warm off-white — slightly desaturated bone color matching the
  // True Detective palette. Pure '#FFFFFF' under the cinematic-LUT @ 0.6
  // would still read as nearly-white; '#E8DCC4' ages naturally under the
  // tonal cast.
  foreground: '#E8DCC4',
  // Lower-third positioning per typical credit hold; y=600 places the
  // baseline ~120 px above the bottom edge on a 720-tall canvas; centered
  // horizontally. Wrapper renders at `left: x - width / 2`, so x=640 +
  // width=1280 spans x=0..1280 (full canvas width).
  position: { x: 640, y: 600, width: 1280, alignment: 'center' as const },
  entrance: 'fade' as const,
  // glow omitted — titlePlate under 'photographic-overlay' style does NOT
  // exercise glow.
  // letterformScale omitted — only used by 'letterform-assemble' style.
  // transitionDurationMs omitted (default 300; single-shot — no transition).
  // musicCue omitted (parity golden does not exercise music keyframes).
} as const;

/** D-T351-7: grain overlay props (canonical subtle film grain via primitive defaults). */
export const TRUE_DETECTIVE_GRAIN_PROPS = {
  intensity: 0.15, // primitive default; explicit for parity-fixture clarity
  cellSize: 1,
  seed: 0,
} as const;

/** D-T351-3: photographic-overlay overlay props (cinematic-LUT @ 0.6 — DOMINATES the visual). */
export const TRUE_DETECTIVE_PHOTOGRAPHIC_OVERLAY_PROPS = {
  // Closest sealed-enum match for True Detective's "muted desaturated earth
  // tones — oily yellows, sickly greens, industrial grays" register per stub
  // line 23. The CINEMATIC_LUT_MATRIX (photographic-overlay.tsx:105–110) has
  // teal-and-orange contrast bias matching True Detective's palette closely.
  mode: 'cinematic-lut' as const,
  // HIGH intensity — opposite posture from T-348's 0.4. Stub line 33: "the
  // photography is the foreground"; pushing intensity to 0.6 makes the
  // cinematic-LUT cast dominate the visual without overwhelming the
  // unobtrusive 28-pt credit typography (D-T351-3).
  intensity: 0.6,
  // position omitted (defaults to full-canvas at runtime).
} as const;

const trueDetectiveDoubleExposureGrainOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'grain',
  buildProps() {
    return { ...TRUE_DETECTIVE_GRAIN_PROPS };
  },
};

const trueDetectiveDoubleExposurePhotographicOverlayOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'photographic-overlay',
  buildProps() {
    return { ...TRUE_DETECTIVE_PHOTOGRAPHIC_OVERLAY_PROPS };
  },
};

const trueDetectiveDoubleExposureBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'titleSequence', // camelCase primitive kind (title-sequence.tsx:800)
  buildProps() {
    // Deep-clone nested arrays / objects so callers can mutate the returned
    // props without aliasing the exported constant.
    return {
      ...TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS,
      shots: TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS.shots.map((s) => ({
        ...s,
        content: { ...s.content },
      })),
      font: { ...TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS.font },
      position: { ...TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS.position },
    };
  },
  // D-T351-2: declaration order = z-order. titleSequence base (zIndex 0)
  // → grain (1) → photographic-overlay (2). NO light-leak / particles
  // (intentional 3-clip stack — would conflict with the muted earth-tone
  // register per stub line 23).
  overlays: [
    trueDetectiveDoubleExposureGrainOverlay,
    trueDetectiveDoubleExposurePhotographicOverlayOverlay,
  ],
};

/**
 * `succession-home-video` (T-352) — fourth Cluster D preset; THIRD
 * `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` (Pattern C
 * override; T-350's `squidGameGeometricBinding` stays the clipKind-default
 * arm) AND **third multi-clip-composition consumer in StageFlip parity-CLI
 * history** (D-T352-1; reuses T-348's `ClipKindBinding.overlays?` surface
 * verbatim — no architectural extension). Composes the parent `titleSequence`
 * primitive (T-321) with two atmospheric overlays in z-order: `grain`
 * (T-321a) and `photographic-overlay` (T-321d). T-352 is the **FIRST
 * end-to-end consumer of `mode: 'sepia'`** (T-348 picked `'fade'`; T-351
 * picked `'cinematic-lut'`) AND the **FIRST end-to-end consumer of
 * non-default grain intensity** (T-348/T-351 used the canonical 0.15 default;
 * T-352 explicitly raises grain `intensity` to 0.30 for VHS-tape chatter per
 * stub line 26 — "moderate film grain, subtle frame chatter"). Sepia tonal
 * grading at `intensity: 0.7` DOMINATES the visual register, anchoring the
 * canonical warm yellow-brown home-video VHS mood per stub line 26. NO
 * light-leak (would over-saturate the sepia register to muddy-brown) NOR
 * particles (no atmospheric drift in the canon) per D-T352-2 (intentional
 * 3-clip stack matching T-351's shape with different mode + grain intensity).
 * Lowered parity thresholds 34/0.90 (D-T352-5; matches T-351's bar — mixed-
 * grade footage variance per stub line 48 + HIGH grain intensity 0.30).
 * IBM Plex Sans Condensed weight 600 (OFL fallback) is the rendered show-logo
 * typography per D-T352-10; bespoke Engravers Gothic + Sackers Gothic
 * preferred faces are commercial-byo (consumer-wired). Single-shot
 * `kind: 'titlePlate'` ALL-CAPS "SUCCESSION" show-logo hold under
 * `style: 'photographic-overlay'` (SECOND end-to-end consumer of this style
 * register after T-351). videoShot shot-kind extension deferred to
 * T-352-followup per D-T352-1; v1 stays within the existing 5-kind sealed
 * envelope.
 */

/** D-T352-6: titleSequence parent props (`'photographic-overlay'` style; show-logo hold). */
export const SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS = {
  shots: [
    {
      id: 'main-credit',
      startMs: 0,
      endMs: 90000, // 90s sequence per stub line 35
      kind: 'titlePlate' as const,
      // titlePlate content shape is `{ text }` (D-T352-6); show-logo identity
      // per stub line 30 ("Show logo: Engravers Gothic fallback, ALL CAPS,
      // wide tracking, classic stationery-engraving style").
      content: { text: 'SUCCESSION' },
      transitionOut: 'cut' as const,
    },
  ],
  // T-321 line 566–578: only `titlePlate` + `creditsBlock` shots render
  // under this style; defers everything else to a sister photographic clip.
  // T-351 was the FIRST end-to-end consumer; T-352 is the SECOND.
  style: 'photographic-overlay' as const,
  font: {
    // IBM Plex Sans Condensed weight 600 (OFL fallback; registered via
    // T-336 / T-356 family). Bespoke Engravers Gothic + Sackers Gothic
    // preferred faces are commercial-byo (consumer-wired) per D-T352-10;
    // Copperplate (the system-only half of the license-mixed fallback) is
    // macOS-system-only and cannot render reproducibly across CDP. The
    // family chain falls through to non-condensed IBM Plex Sans, then to
    // system fallbacks, if Condensed is missing from the registry.
    family: 'IBM Plex Sans Condensed, IBM Plex Sans, system-ui, -apple-system, sans-serif',
    // Match stub fallbackFont.weight (600); aligns with the dynastic-
    // stationery register (heavy display weight) per stub lines 30–31.
    weight: 600,
    // Show-logo size — larger than T-351's 28 (credit hold). Stub line 30
    // designates "Show logo" framing; show logos canonically render larger
    // than credit holds. 56pt fits comfortably within the 1280-wide canvas
    // at +250 tracking.
    size: 56,
    // +250 letterSpacing — mid-range of stub line 32's "+200, often +300"
    // envelope. +200 is the floor; +300 stresses font rasterization across
    // CDP and is reserved for a T-352-letterspacing-extreme follow-up.
    letterSpacing: 250,
  },
  // ALL CAPS per stub line 30 — show-logo register; also stub line 31 —
  // credits ALL CAPS (D-T352-6).
  casing: 'uppercase' as const,
  // Deep warm-brown under-canvas placeholder (R=26, G=20, B=16). The sepia
  // tonal grading at intensity 0.7 dominates visually so the painted
  // background is largely hidden; '#1A1410' anchors the "warm yellow-brown"
  // register per stub line 26.
  background: '#1A1410',
  // Warm off-white / pale cream (R=244, G=232, B=200). Under the sepia
  // matrix at 0.7 intensity, '#F4E8C8' ages gracefully into the warm-yellow
  // tint while preserving legibility against the warm-brown background.
  foreground: '#F4E8C8',
  // highlightColor omitted (titlePlate doesn't use highlight under
  // 'photographic-overlay' style; would be inert).
  // Centered show-logo placement on a 1280×720 canvas; y=360 places the
  // baseline at canvas mid-height — the dynastic-stationery "show logo"
  // register wants center-of-frame placement, NOT lower-third like T-351's
  // credit hold. Wrapper renders at `left: x - width / 2`, so x=640 +
  // width=1280 spans x=0..1280 (full canvas width).
  position: { x: 640, y: 360, width: 1280, alignment: 'center' as const },
  entrance: 'fade' as const,
  // glow omitted — titlePlate under 'photographic-overlay' style does NOT
  // exercise glow per the title-sequence renderTitlePlate path.
  // letterformScale omitted — only used by 'letterform-assemble' style.
  // transitionDurationMs omitted (default 300; single-shot — no transition).
  // musicCue omitted (parity golden does not exercise music keyframes).
} as const;

/** D-T352-7: grain overlay props (HIGH intensity 0.30 — VHS-tape chatter). */
export const SUCCESSION_HOME_VIDEO_GRAIN_PROPS = {
  // HIGH intensity — opposite posture from T-348/T-351's 0.15 canonical
  // subtle default. Stub line 26 ("moderate film grain, subtle frame
  // chatter"): the "subtle" annotation is relative-to-VHS-tape, NOT
  // relative-to-T-348/T-351; actual VHS chatter is visibly heavier than the
  // default Stranger-Things-grade subtle grain. 0.30 is the centroid of
  // the canonical 0.25–0.35 VHS-chatter envelope; lower (0.20) would not
  // adequately register the "VHS chatter" annotation; higher (0.40+) would
  // start to obscure the show-logo letterforms. **FIRST end-to-end
  // consumer of non-default grain intensity** (D-T352-7).
  intensity: 0.3,
  cellSize: 1,
  seed: 0,
} as const;

/** D-T352-3: photographic-overlay overlay props (sepia @ 0.70 — DOMINATES the visual). */
export const SUCCESSION_HOME_VIDEO_PHOTOGRAPHIC_OVERLAY_PROPS = {
  // Closest sealed-enum match for Succession's "warm yellow-brown tint"
  // home-video VHS register per stub line 26. The SEPIA_MATRIX
  // (photographic-overlay.tsx:88–98) is the canonical W3C-style sepia
  // transform — collapses RGB to a warm-yellow gradient with explicit
  // per-channel scaling (`[0.393 0.769 0.189; 0.349 0.686 0.168;
  // 0.272 0.534 0.131]`). **FIRST end-to-end consumer of `mode: 'sepia'`**
  // in StageFlip parity-CLI history (T-348 picked `'fade'`; T-351 picked
  // `'cinematic-lut'`).
  mode: 'sepia' as const,
  // DOMINANT intensity — the sepia tint IS the canonical mood signal per
  // stub line 26. Without it, the render reads as a generic credit hold;
  // WITH the sepia at 0.7 dominant intensity, it reads unmistakably as the
  // home-video VHS register. HIGHER than T-351's 0.6 (cinematic-LUT cast)
  // and T-348's 0.4 (modest fade cast) because Succession's stub explicitly
  // designates the sepia tint as the canonical mood anchor. Pushing
  // intensity above 0.85 would obliterate the credit typography under the
  // sepia cast; capping at 0.7 preserves typographic legibility (D-T352-3).
  intensity: 0.7,
  // position omitted (defaults to full-canvas at runtime).
} as const;

const successionHomeVideoGrainOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'grain',
  buildProps() {
    return { ...SUCCESSION_HOME_VIDEO_GRAIN_PROPS };
  },
};

const successionHomeVideoPhotographicOverlayOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'photographic-overlay',
  buildProps() {
    return { ...SUCCESSION_HOME_VIDEO_PHOTOGRAPHIC_OVERLAY_PROPS };
  },
};

const successionHomeVideoBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'titleSequence', // camelCase primitive kind (title-sequence.tsx:800)
  buildProps() {
    // Deep-clone nested arrays / objects so callers can mutate the returned
    // props without aliasing the exported constant.
    return {
      ...SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS,
      shots: SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS.shots.map((s) => ({
        ...s,
        content: { ...s.content },
      })),
      font: { ...SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS.font },
      position: { ...SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS.position },
    };
  },
  // D-T352-2: declaration order = z-order. titleSequence base (zIndex 0)
  // → grain HIGH (1) → photographic-overlay sepia (2). NO light-leak /
  // particles (intentional 3-clip stack — would over-saturate the sepia
  // warm-yellow register to muddy-brown per stub line 26).
  overlays: [successionHomeVideoGrainOverlay, successionHomeVideoPhotographicOverlayOverlay],
};

/**
 * `severance-surreal-3d` (T-353) — fifth Cluster D preset; FOURTH
 * `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` (Pattern C
 * override; T-350's `squidGameGeometricBinding` stays the clipKind-default
 * arm) AND **fourth multi-clip-composition consumer in StageFlip parity-CLI
 * history** (D-T353-1; reuses T-348's `ClipKindBinding.overlays?` surface
 * verbatim — no architectural extension). Composes the parent `titleSequence`
 * primitive (T-321) with two atmospheric overlays in z-order: `grain`
 * (T-321a) and `photographic-overlay` (T-321d). T-353 is the **SECOND
 * end-to-end consumer of `mode: 'cinematic-lut'`** (T-351 was PRIMARY at
 * 0.60 dominant; T-353 is at 0.4 moderate) AND the **SECOND end-to-end
 * consumer of non-default grain intensity / FIRST below-default consumer**
 * (T-348/T-351 used the canonical 0.15 default; T-352 raised to 0.30; T-353
 * LOWERS to 0.10 — corporate-clean restrained register per stub line 23
 * "sterile color palette"). Cinematic-LUT tonal grading at `intensity: 0.4`
 * is MODERATE — visible but not dominating; preserves the sterile palette
 * while subtly anchoring the corporate-Vignelli office mood. NO light-leak
 * (would shift the register from "sterile corporate" toward "warm cinematic")
 * NOR particles (no atmospheric drift in canon) per D-T353-2 (intentional
 * 3-clip stack matching T-351 / T-352's shape with different mode + grain
 * intensity + photographic-intensity). Tighter parity thresholds 36/0.92
 * (D-T353-5; TIGHTER than T-351/T-352's 34/0.90 — T-353's lower-engagement
 * register has more headroom: LOW grain 0.10 + MODERATE photographic-overlay
 * 0.4 + sterile palette = uniform pixel statistics). Inter Display weight
 * 500 (OFL fallback) is the rendered title typography per D-T353-10;
 * bespoke Severance custom typeface (Helvetica + mid-century Vignelli) is
 * proprietary-byo (consumer-wired). Single-shot `kind: 'titlePlate'`
 * ALL-CAPS "SEVERANCE" title hold under `style: 'photographic-overlay'`
 * (THIRD end-to-end consumer of this style register after T-351 + T-352).
 * Live ThreeSceneClip integration deferred to T-353-live-3d follow-up per
 * D-T353-1; **stub line 39 explicitly authorizes the static-fallback
 * posture** — NOT a documented divergence, canon-allowed alternate path.
 * v1 stays within the existing 5-kind sealed envelope.
 */

/** D-T353-6: titleSequence parent props (`'photographic-overlay'` style; "scaled large" title hold). */
export const SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS = {
  shots: [
    {
      id: 'main-credit',
      startMs: 0,
      endMs: 60000, // 60s sequence per stub line 36
      kind: 'titlePlate' as const,
      // titlePlate content shape is `{ text }` (D-T353-6); show-title
      // identity per stub line 31 ("Title: Bold, ALL CAPS, scaled large,
      // very tight tracking").
      content: { text: 'SEVERANCE' },
      transitionOut: 'cut' as const,
    },
  ],
  // T-321 line 566–578: only `titlePlate` + `creditsBlock` shots render
  // under this style; defers everything else to a sister photographic clip.
  // T-351 was the FIRST end-to-end consumer; T-352 was the SECOND; T-353
  // is the THIRD.
  style: 'photographic-overlay' as const,
  font: {
    // Inter Display weight 500 (OFL fallback; widely registered across
    // StageFlip presets via T-336 / T-356 family). Bespoke Severance
    // custom typeface (Helvetica + mid-century Vignelli) is proprietary-byo
    // (consumer-wired) per D-T353-10; the family chain falls through to
    // non-Display Inter if Display is missing, then to system fallbacks.
    family: 'Inter Display, Inter, system-ui, -apple-system, sans-serif',
    // Match stub fallbackFont.weight (500); aligns with the Helvetica-
    // adjacent humanism per stub line 33 ("Fallback: Inter Display
    // preserves the Helvetica-adjacent humanism").
    weight: 500,
    // "Scaled large" per stub line 31 — larger than T-351's 28 (credit
    // hold) and T-352's 56 (show-logo). 64pt fits comfortably within
    // the 1280-wide canvas at 0 letter-spacing.
    size: 64,
    // 0 = neutral / canonical baseline. Stub line 31 says "very tight
    // tracking"; 0 is the conservative interpretation; -20 / -40 are
    // documented as T-353-letterspacing-extreme follow-up. The very-
    // tight register at 0 is anchored by Inter Display's already-
    // condensed display proportions (vs. Inter UI's slightly-wider
    // proportions).
    letterSpacing: 0,
  },
  // ALL CAPS per stub line 31 — title register; credits at stub line 32
  // are Regular, 24–30 pt, wide tracking — but v1's single-shot
  // titlePlate is the title, NOT the credits register (D-T353-6).
  casing: 'uppercase' as const,
  // Deep desaturated-green-black under-canvas placeholder (R=26, G=31,
  // B=26). The cinematic-LUT tonal grading at intensity 0.4 applies a
  // teal-leaning cast on top, deepening the sterile-office mood. Stub
  // line 23 declares "muted neutrals, desaturated greens" — the
  // background anchors the desaturated-green half.
  background: '#1A1F1A',
  // Pale neutral / off-white (R=232, G=236, B=229). Under the cinematic-
  // LUT at 0.4 intensity, '#E8ECE5' ages into a slightly-desaturated
  // cool off-white that preserves legibility against the desaturated-
  // green background. Stub line 23 — muted neutrals.
  foreground: '#E8ECE5',
  // highlightColor omitted (titlePlate doesn't use highlight under
  // 'photographic-overlay' style; would be inert).
  // Centered title placement on a 1280×720 canvas; y=360 places the
  // baseline at canvas mid-height — the mid-century-Vignelli "scaled
  // large" register canonically sits center-of-frame, NOT lower-third
  // like T-351's credit hold. Wrapper renders at `left: x - width / 2`,
  // so x=640 + width=1280 spans x=0..1280 (full canvas width).
  position: { x: 640, y: 360, width: 1280, alignment: 'center' as const },
  entrance: 'fade' as const,
  // glow omitted — titlePlate under 'photographic-overlay' style does NOT
  // exercise glow per the title-sequence renderTitlePlate path.
  // letterformScale omitted — only used by 'letterform-assemble' style.
  // transitionDurationMs omitted (default 300; single-shot — no transition).
  // musicCue omitted (parity golden does not exercise music keyframes).
} as const;

/** D-T353-7: grain overlay props (LOW intensity 0.10 — corporate-clean restrained). */
export const SEVERANCE_SURREAL_3D_GRAIN_PROPS = {
  // LOW intensity — sub-default; opposite posture from T-352's HIGH 0.30
  // VHS chatter and SLIGHTLY-BELOW T-348/T-351's canonical 0.15 default.
  // The Severance canon is RESTRAINED — corporate / clean / hyper-realistic;
  // 0.10 hints at the 3D-rendered surface micro-texture without competing
  // with the typographic identity. **SECOND end-to-end consumer of
  // non-default grain intensity / FIRST below-default consumer** (D-T353-7).
  intensity: 0.1,
  cellSize: 1,
  seed: 0,
} as const;

/** D-T353-3: photographic-overlay overlay props (cinematic-lut @ 0.4 — MODERATE muted-desaturated office register). */
export const SEVERANCE_SURREAL_3D_PHOTOGRAPHIC_OVERLAY_PROPS = {
  // Closest sealed-enum match for Severance's "sterile color palette;
  // muted neutrals, desaturated greens" register per stub line 23. The
  // cinematic-LUT mode applies a per-channel SVG `<feComponentTransfer>`
  // curve approximating teal-and-orange grading; at moderate intensity
  // (0.4) the curve produces a flat, muted, slightly-desaturated wash
  // that matches the canonical mid-century-Vignelli sterile-corporate
  // office register. **SECOND end-to-end consumer of `mode: 'cinematic-lut'`**
  // (T-351 was PRIMARY at 0.60 dominant; T-353 is SECONDARY at 0.4
  // moderate).
  mode: 'cinematic-lut' as const,
  // MODERATE intensity — visible but not dominating. The Severance canon
  // is RESTRAINED — typography + sterile palette IS the canonical
  // identity; the photographic cast is a subtle mood-anchor, not a
  // dominating tonal wash. LOWER than T-351's 0.60 (dominant) and T-352's
  // 0.70 (very dominant); HIGHER than T-348's 0.40 (modest fade — not the
  // sterile-corporate canon). Pushing intensity above 0.50 would tip
  // toward T-351's dominant cinematic-LUT register; capping at 0.4
  // preserves the typographic identity as the dominant visual (D-T353-3).
  intensity: 0.4,
  // position omitted (defaults to full-canvas at runtime).
} as const;

const severanceSurreal3dGrainOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'grain',
  buildProps() {
    return { ...SEVERANCE_SURREAL_3D_GRAIN_PROPS };
  },
};

const severanceSurreal3dPhotographicOverlayOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'photographic-overlay',
  buildProps() {
    return { ...SEVERANCE_SURREAL_3D_PHOTOGRAPHIC_OVERLAY_PROPS };
  },
};

const severanceSurreal3dBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'titleSequence', // camelCase primitive kind (title-sequence.tsx:800)
  buildProps() {
    // Deep-clone nested arrays / objects so callers can mutate the returned
    // props without aliasing the exported constant.
    return {
      ...SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS,
      shots: SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS.shots.map((s) => ({
        ...s,
        content: { ...s.content },
      })),
      font: { ...SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS.font },
      position: { ...SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS.position },
    };
  },
  // D-T353-2: declaration order = z-order. titleSequence base (zIndex 0)
  // → grain LOW (1) → photographic-overlay cinematic-lut (2). NO light-leak
  // / particles (intentional 3-clip stack — sterile / desaturated palette
  // would conflict with warm-orange leaks; canon does not enumerate
  // particle drift per stub line 23).
  overlays: [severanceSurreal3dGrainOverlay, severanceSurreal3dPhotographicOverlayOverlay],
};

/**
 * `got-trajan-clockwork` (T-349) — sixth + final Cluster D preset; FOURTH
 * `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` (Pattern C
 * override; T-350's `squidGameGeometricBinding` stays the clipKind-default
 * arm) AND **fifth multi-clip-composition consumer in StageFlip parity-CLI
 * history** (D-T349-1; reuses T-348's `ClipKindBinding.overlays?` surface
 * verbatim — no architectural extension). Composes the parent `titleSequence`
 * primitive (T-321) with two atmospheric overlays in z-order: `grain`
 * (T-321a) and `photographic-overlay` (T-321d). T-349 is the **SECOND
 * end-to-end consumer of `mode: 'sepia'`** (T-352 was PRIMARY at 0.70
 * dominant with HIGH grain 0.30; T-349 is SECONDARY at 0.65 dominant with
 * canonical-default grain 0.15) — confirms the SEPIA_MATRIX path is stable
 * across intensity values + grain levels. Sepia tonal grading at
 * `intensity: 0.65` DOMINATES the visual to anchor the metallic-gold/brown
 * register per stub line 24, but slightly LOWER than T-352's 0.70 to
 * preserve more typographic legibility for the Roman-inscription register
 * (the Trajan-fallback type is the anchor per stub line 33 "scaled large").
 * NO light-leak (would over-saturate the metallic-gold register to muddy
 * "burned-photograph") NOR particles (no atmospheric drift in canon; the
 * only canonically-enumerated particle-like effect is sun-rays per stub
 * line 30, which is deferred) per D-T349-2 (intentional 3-clip stack
 * matching T-351 / T-352 / T-353's shape with different mode + intensity).
 * Lowered parity thresholds 34/0.90 (D-T349-5; matches T-352/T-353's bar —
 * 3D + golds variance pre-declared by stub line 52; the 0.02 SSIM / 2 dB
 * PSNR relaxation from the stub's 36/0.92 absorbs sepia-matrix-multiplication
 * drift on the metallic-yellow palette across CDP versions and aligns
 * sister Cluster D presets at a uniform bar). EB Garamond weight 700 (OFL
 * fallback) is the rendered title typography per D-T349-10; bespoke Trajan
 * Pro is commercial-byo (consumer-wired). Single-shot `kind: 'titlePlate'`
 * ALL-CAPS "GAME OF THRONES" title hold under `style: 'photographic-overlay'`
 * (FIFTH end-to-end consumer of this style register after T-351 + T-352 +
 * T-353). **Closes Cluster D 5/6 → 6/6 ELIGIBLE — the cluster-closure
 * milestone.** Live ThreeSceneClip 3D integration deferred to T-349-live-3d
 * follow-up per D-T349-1; **stub line 41 explicitly authorizes the
 * static-fallback posture** — NOT a documented divergence, canon-allowed
 * alternate path. v1 stays within the existing 5-kind sealed envelope.
 */

/** D-T349-6: titleSequence parent props (`'photographic-overlay'` style; "scaled large" Roman-inscription title hold). */
export const GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS = {
  shots: [
    {
      id: 'main-title',
      startMs: 0,
      endMs: 90000, // 90s sequence per stub line 38
      kind: 'titlePlate' as const,
      // titlePlate content shape is `{ text }` (per title-sequence.tsx:51
      // `titlePlateContent`); show-title identity per stub line 33 ("Show
      // title: Trajan Pro fallback, ALL CAPS, Roman inscription style,
      // scaled large").
      content: { text: 'GAME OF THRONES' },
      transitionOut: 'cut' as const,
    },
  ],
  // T-321 line 566–578: only `titlePlate` + `creditsBlock` shots render
  // under this style; defers everything else to a sister photographic clip.
  // T-351 was the FIRST end-to-end consumer; T-352 was the SECOND; T-353
  // was the THIRD; T-349 is the FOURTH (counting consumer order, not
  // cluster order — Cluster D fifth). The shot enum does NOT include any
  // 3D-scene-bound kind; adding one is the deferred T-349-live-3d
  // follow-up; v1 stays within the 5-kind sealed envelope.
  style: 'photographic-overlay' as const,
  font: {
    // EB Garamond weight 700 (OFL fallback per stub fallbackFont).
    // Bespoke Trajan Pro is commercial-byo (consumer-wired) per D-T349-10.
    // The family chain falls through to platform Garamond → Times New
    // Roman → system serif if EB Garamond is missing — system fallbacks at
    // the tail are a safety net. EB Garamond shares Trajan's Roman serif
    // heritage and preserves the signature long ascenders + sharp serifs
    // per stub line 35.
    family: 'EB Garamond, Garamond, "Times New Roman", system-ui, -apple-system, serif',
    // Match stub fallbackFont.weight (700); aligns with the
    // Roman-inscription register (heavy display weight; signature serif
    // details preserved per stub line 35).
    weight: 700,
    // "Scaled large" per stub line 33 — larger than T-352's 56 (show-logo)
    // and T-353's 64 (surreal title). 72pt fits comfortably within the
    // 1280-wide canvas at 80 letter-spacing tracking.
    size: 72,
    // Modest tracking — Roman-inscription canonical envelope is ~50–100;
    // 80 is the centroid (preserves the signature long ascenders + sharp
    // serifs without breaking glyph proportions). Stub does NOT explicitly
    // enumerate letter-spacing for the Trajan show-title (the wide-tracking
    // register applies to dynastic-stationery clusters like Succession, NOT
    // to monumental Roman-inscription registers like GOT). Higher tracking
    // (200+) would push the Roman-inscription register toward
    // wide-display-sans-serif — wrong canonical mood.
    letterSpacing: 80,
  },
  // ALL CAPS per stub line 33 — show-title; Roman inscription register.
  casing: 'uppercase' as const,
  // Deep metallic-brown under-canvas placeholder (R=26, G=14, B=8). The
  // sepia tonal grading + Clinker `#331C0E` palette pin dominate visually
  // so the painted background is largely hidden; '#1A0E08' anchors the
  // metallic-gold/brown register per stub line 24.
  background: '#1A0E08',
  // Baby Yellow palette pin per stub line 27 — canonical highlight color
  // in the metallic palette; under the sepia matrix at 0.65 intensity,
  // '#FFF190' (R=255, G=241, B=144) ages into the warm-metallic gold
  // while preserving inscription legibility.
  foreground: '#FFF190',
  // highlightColor omitted (titlePlate doesn't use highlight under
  // 'photographic-overlay' style; would be inert).
  // Centered show-title placement on a 1280×720 canvas; y=360 places the
  // baseline at canvas mid-height — the Roman-inscription "show title
  // scaled large" register canonically sits center-of-frame, matching
  // T-352 / T-353's center-of-frame posture. Wrapper renders at
  // `left: x - width / 2`, so x=640 + width=1280 spans x=0..1280 (full
  // canvas width).
  position: { x: 640, y: 360, width: 1280, alignment: 'center' as const },
  entrance: 'fade' as const,
  // glow omitted — titlePlate under 'photographic-overlay' style does NOT
  // exercise glow per the title-sequence renderTitlePlate path.
  // letterformScale omitted — only used by 'letterform-assemble' style.
  // transitionDurationMs omitted (default 300; single-shot — no transition).
  // musicCue omitted (parity golden does not exercise music keyframes).
} as const;

/** D-T349-7: grain overlay props (canonical-default 0.15 — medieval-paper / engraved-page texture). */
export const GOT_TRAJAN_CLOCKWORK_GRAIN_PROPS = {
  // Canonical default — matches T-348/T-351/T-353; differs from T-352's
  // elevated 0.30 VHS chatter. The Roman-inscription / engraved-page
  // register canonically reads as subtle (medieval-paper texture); 0.15 is
  // the centroid of the ~0.10–0.20 envelope. Lower (0.10) would not
  // register the engraved-page texture; higher (0.20+) would obscure the
  // Roman-inscription letterforms. Explicit (rather than empty payload)
  // for clarity — makes the canonical-default-vs-elevated-VHS-chatter
  // contrast explicit relative to T-352 (D-T349-7).
  intensity: 0.15,
  cellSize: 1,
  seed: 0,
} as const;

/** D-T349-3: photographic-overlay overlay props (sepia @ 0.65 — DOMINATES the metallic-gold/brown register). */
export const GOT_TRAJAN_CLOCKWORK_PHOTOGRAPHIC_OVERLAY_PROPS = {
  // Closest sealed-enum match for GOT's "metallic golds and browns"
  // palette per stub line 24. The SEPIA_MATRIX
  // (photographic-overlay.tsx:88–98) is the canonical W3C-style sepia
  // transform — collapses RGB to a warm-yellow gradient with explicit
  // per-channel scaling (`[0.393 0.769 0.189; 0.349 0.686 0.168;
  // 0.272 0.534 0.131]`). **SECOND end-to-end consumer of `mode: 'sepia'`**
  // in StageFlip parity-CLI history (T-352 was PRIMARY at 0.70 dominant
  // with HIGH grain 0.30; T-349 is SECONDARY at 0.65 dominant with
  // canonical-default grain 0.15) — confirms the mode is stable across
  // intensity values + grain levels.
  mode: 'sepia' as const,
  // DOMINANT intensity — the metallic-gold/brown palette IS the canonical
  // mood signal per stub line 24. LOWER than T-352's 0.70 (preserves more
  // typographic legibility for the Roman-inscription register; the
  // Trajan-fallback type is the anchor per stub line 33 "scaled large");
  // HIGHER than T-351's 0.60 (cinematic-LUT cast); HIGHER than T-348's
  // 0.40 (modest fade cast). Pushing intensity above 0.75 would
  // obliterate the Roman-inscription letterforms under the sepia cast;
  // capping at 0.65 preserves typographic legibility while anchoring the
  // metallic mood register (D-T349-3).
  intensity: 0.65,
  // position omitted (defaults to full-canvas at runtime).
} as const;

const gotTrajanClockworkGrainOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'grain',
  buildProps() {
    return { ...GOT_TRAJAN_CLOCKWORK_GRAIN_PROPS };
  },
};

const gotTrajanClockworkPhotographicOverlayOverlay = {
  runtimeId: 'frame-runtime',
  clipName: 'photographic-overlay',
  buildProps() {
    return { ...GOT_TRAJAN_CLOCKWORK_PHOTOGRAPHIC_OVERLAY_PROPS };
  },
};

const gotTrajanClockworkBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'titleSequence', // camelCase primitive kind (title-sequence.tsx:800)
  buildProps() {
    // Deep-clone nested arrays / objects so callers can mutate the returned
    // props without aliasing the exported constant.
    return {
      ...GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS,
      shots: GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS.shots.map((s) => ({
        ...s,
        content: { ...s.content },
      })),
      font: { ...GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS.font },
      position: { ...GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS.position },
    };
  },
  // D-T349-2: declaration order = z-order. titleSequence base (zIndex 0)
  // → grain canonical-default (1) → photographic-overlay sepia (2). NO
  // light-leak / particles (intentional 3-clip stack — would over-saturate
  // the metallic-gold register to muddy "burned-photograph" if warm-orange
  // leaks were added; canon does not enumerate particle drift — sun-rays
  // is deferred per "out of scope").
  overlays: [gotTrajanClockworkGrainOverlay, gotTrajanClockworkPhotographicOverlayOverlay],
};

/**
 * Per-preset binding overrides (T-360 D-T360-2). Keyed by preset id so
 * multiple presets can share a `clipKind` while parameterizing the same
 * runtime clip differently. Lookups in {@link DEFAULT_CLIP_KIND_RESOLVER}
 * check this map first; unknown ids fall through to the clipKind-only path,
 * preserving T-358 / T-359 / T-359a behavior.
 */
export const PRESET_ID_BINDINGS: Readonly<Record<string, ClipKindBinding>> = {
  'big-number-stat-impact': bigNumberStatImpactBinding,
  'mrbeast-komika-axis': mrbeastBinding,
  'tiktok-rounded-box': tiktokBinding,
  'ali-abdaal-opacity-karaoke': aliAbdaalBinding,
  'netflix-invisible': netflixBinding,
  'bbc-reith-dark': bbcReithDarkBinding,
  'al-jazeera-orange': alJazeeraOrangeBinding,
  'apple-tv-lt': appleTvLtBinding,
  'netflix-doc-lt': netflixDocLtBinding,
  'fox-news-alert': foxNewsAlertBinding, // T-327
  'msnbc-big-board': msnbcBigBoardBinding, // T-328
  'premier-league-field-of-play': premierLeagueFopBinding, // T-333
  'fox-nfl-no-chrome': foxNflNoChromeBinding, // T-334
  'nbc-snf-possession-illuminated': nbcSnfBinding, // T-335
  'espn-bottomline-flipper': espnBottomlineBinding, // T-339a
  'wimbledon-green-purple': wimbledonGreenPurpleBinding, // T-337
  'masters-red-under-par': mastersRedUnderParBinding, // T-338
  'f1-timing-tower': f1TimingTowerBinding, // T-332
  'cricket-scorebug': cricketScorebugBinding, // T-336
  'uefa-starball-refraction': uefaStarballRefractionBinding, // T-339
  'youtube-subscribe-bounce': youtubeSubscribeBounceBinding, // T-369
  'social-handle-lower-third': socialHandleLowerThirdBinding, // T-373
  'tiktok-follow-pulse': tiktokFollowPulseBinding, // T-370
  'coinbase-dvd-qr': coinbaseDvdQrBinding, // T-372
  'instagram-link-sticker': instagramLinkStickerBinding, // T-371 (Cluster G closer; 5/5)
  'stranger-things-benguiat': strangerThingsBenguiatBinding, // T-348 (Cluster D 2/6; first multi-clip composition)
  'true-detective-double-exposure': trueDetectiveDoubleExposureBinding, // T-351 (Cluster D 3/6; second multi-clip composition; PRIMARY consumer of T-321d photographic-overlay)
  'succession-home-video': successionHomeVideoBinding, // T-352 (Cluster D 4/6; third multi-clip composition; FIRST consumer of mode: 'sepia' AND non-default grain intensity 0.30)
  'severance-surreal-3d': severanceSurreal3dBinding, // T-353 (Cluster D 5/6; fourth multi-clip composition; SECOND consumer of mode: 'cinematic-lut'; FIRST below-default grain intensity 0.10; live ThreeSceneClip integration deferred per stub-canon-explicit static-fallback allowance)
  'got-trajan-clockwork': gotTrajanClockworkBinding, // T-349 (Cluster D 6/6 — CLOSES Cluster D ELIGIBLE; fifth multi-clip composition; SECOND consumer of mode: 'sepia' confirms stable; canonical-default grain 0.15; live ThreeSceneClip integration deferred per stub-canon-explicit static-fallback allowance — stub line 41)
  'doppler-dbz-standard': dopplerDbzStandardBinding, // T-347d (Cluster C 2/6; second weatherMap consumer; first 'doppler-radar' style branch; verifies §13 (F-30) doppler-radar branch end-to-end)
  'heat-map-cool-to-warm': heatMapCoolToWarmBinding, // T-347e (Cluster C 3/6; third + final weatherMap consumer; verifies §13 (F-30) heat-map branch end-to-end; closes all three weatherMap §13 obligations once T-347c + T-347d also land)
  'twc-retrocast-8bit': twcRetrocast8bitBinding, // T-347g (Cluster C 5/6; preset clipKind: fullScreen stays; binding overrides clipName to the new weatherStar4000Panel primitive per T-328 / T-339 precedent. Pixel-perfect register; PSNR >= 44 / SSIM >= 0.99 tight thresholds)
  'twc-immersive-mixed-reality': twcImmersiveMixedRealityBinding, // T-347h (Cluster C 6/6 — CLOSES Cluster C ELIGIBLE; preset clipKind: fullScreen stays; binding overrides clipName to the new imrStaticFallback primitive. Static-fallback register; live ThreeSceneClip IMR rendering deferred to T-347h-three-scene Track A frontier per ADR-005)
  'hawkeye-var-3d-skeletal': hawkeyeVarSkeletalBinding, // T-376 (Cluster H 2/4; second arOverlay consumer via PRESET_ID_BINDINGS override — Pattern C second-preset-for-clipKind; arOverlay clipKind-default arm stays bound to skySportsArFormationsBinding from T-375. NOT a §13 verifier — reuses arOverlay clipKind whose structural-extension verification was discharged by PR #461)
};

/**
 * v1 default resolver — `bigNumber → animated-value`, `scoreBug → outcome-row`
 * (T-358), `newsTicker → news-ticker-bar` (T-356), `standings →
 * standings-table` (T-357), `caption → caption` (T-362), `fullScreen →
 * magic-wall-panel` (T-355), `lyrics → lyrics` (T-367), `titleSequence →
 * titleSequence` (T-350), `lowerThird → lower-third` (T-323),
 * `breakingBanner → breaking-banner` (T-324), `weatherMap → weatherMap`
 * (T-347c), `stormTracker → stormTracker` (T-347f), `arOverlay → arOverlay`
 * (T-375 — first Cluster H consumer; §13 verifier for the arOverlay
 * structural extension introduced in T-375a PR #460), with per-preset
 * overrides for
 * multi-preset-per-clipKind cases (T-360 D-T360-2). Per-preset entries take
 * precedence; absent an override, the resolver falls back to the
 * clipKind-only mapping.
 */
export const DEFAULT_CLIP_KIND_RESOLVER: ClipKindResolver = (clipKind, presetId) => {
  if (presetId !== undefined) {
    const override = PRESET_ID_BINDINGS[presetId];
    if (override !== undefined) return override;
  }
  if (clipKind === 'bigNumber') return bigNumberBinding;
  if (clipKind === 'scoreBug') return scoreBugDotsBinding;
  if (clipKind === 'newsTicker') return newsTickerBinding;
  if (clipKind === 'standings') return standingsBinding;
  if (clipKind === 'caption') return captionBinding;
  if (clipKind === 'fullScreen') return fullScreenBinding;
  if (clipKind === 'lyrics') return lyricsBinding;
  if (clipKind === 'titleSequence') return squidGameGeometricBinding;
  if (clipKind === 'lowerThird') return cnnClassicBinding;
  if (clipKind === 'breakingBanner') return cnnBreakingBinding;
  if (clipKind === 'weatherMap') return bbcMarkAllenCloudsBinding;
  if (clipKind === 'stormTracker') return nhcConeOfUncertaintyBinding;
  if (clipKind === 'arOverlay') return skySportsArFormationsBinding;
  return undefined;
};

// ---------- RIRDocument builder ----------

/**
 * Build a minimal renderable `RIRDocument` for `(preset, binding, props)`.
 * Mirrors `manifestToDocument` in `@stageflip/testing` but sources the clip
 * shape from the resolver rather than a fixture manifest. Exported for tests.
 */
export function buildPresetDocument(args: {
  preset: PresetForRender;
  composition: FixtureComposition;
  binding: ClipKindBinding;
  props: Record<string, unknown>;
  variant?: string;
}): RIRDocument {
  const variantSlug = args.variant !== undefined ? `-${args.variant}` : '';
  const documentId = `preset-${args.preset.frontmatter.id}${variantSlug}`;

  // Shared transform / timing for every element (parent + overlays). Per
  // T-348 D-T348-1 / D-T348-2: atmospheric overlays render at full canvas +
  // full duration; the z-stack is purely declaration-order.
  const sharedTransform = {
    x: 0,
    y: 0,
    width: args.composition.width,
    height: args.composition.height,
    rotation: 0,
    opacity: 1,
  } as const;
  const sharedTiming = {
    startFrame: 0,
    endFrame: args.composition.durationInFrames,
    durationFrames: args.composition.durationInFrames,
  } as const;

  // Build the parent + (optional) overlay elements. Single-clip bindings
  // (no `overlays`) yield a 1-element array byte-identical to the pre-T-348
  // shape — backward compat for all 25 existing PRESET_ID_BINDINGS entries
  // + the 10 clipKind-default arms.
  const parentEntry = {
    id: 'preset-clip-0',
    runtimeId: args.binding.runtimeId,
    clipName: args.binding.clipName,
    params: args.props,
  };
  const overlayEntries = (args.binding.overlays ?? []).map((overlay, i) => ({
    id: `preset-clip-${i + 1}`,
    runtimeId: overlay.runtimeId,
    clipName: overlay.clipName,
    params: overlay.buildProps(args.variant),
  }));
  const allEntries = [parentEntry, ...overlayEntries];

  const elements = allEntries.map((entry, zIndex) => ({
    id: entry.id,
    type: 'clip' as const,
    transform: { ...sharedTransform },
    timing: { ...sharedTiming },
    zIndex,
    visible: true,
    locked: false,
    stacking: 'auto' as const,
    animations: [] as never[],
    content: {
      type: 'clip' as const,
      runtime: entry.runtimeId,
      clipName: entry.clipName,
      params: entry.params,
    },
  }));
  const stackingMap: Record<string, 'auto' | 'isolate'> = Object.fromEntries(
    allEntries.map((e) => [e.id, 'auto' as const]),
  );

  const doc: RIRDocument = {
    id: documentId,
    width: args.composition.width,
    height: args.composition.height,
    frameRate: args.composition.fps,
    durationFrames: args.composition.durationInFrames,
    mode: 'slide',
    elements,
    stackingMap,
    fontRequirements: [],
    meta: {
      sourceDocId: `preset-source-${args.preset.frontmatter.id}${variantSlug}`,
      sourceVersion: 1,
      compilerVersion: 'preset-fixture-0.0.0',
      digest: documentId,
    },
  };
  // Validate before returning so a drift between this builder and
  // `rirDocumentSchema` surfaces here, not at puppeteer mount time.
  return rirDocumentSchema.parse(doc);
}

// ---------- FixtureRenderer composition ----------

/**
 * The generator-script-side `FixtureRenderer.render` signature. Duplicated
 * here so this module doesn't take a build-time dep on the script (the
 * script lives outside the package's `exports` surface). Structural typing
 * keeps the two in sync — a drift would surface at the bin's
 * `bindProductionRenderer` call site at typecheck time.
 */
export interface FixtureRendererLike {
  render(args: FixtureRenderArgs): Promise<Uint8Array> | Uint8Array;
}

/**
 * Build a `FixtureRenderer`-shaped object from a clipKind resolver and a
 * `PrimeRenderFn` (puppeteer-backed in production; a stub in tests). The
 * resolver maps the preset's `clipKind` to a render plan; the render fn
 * actually mounts the resulting RIRDocument and snapshots the frame.
 *
 * On unknown `clipKind`, throws {@link GenerateFixtureUnavailableError} so
 * the generator script's CLI catches it as a render-unavailable failure
 * (the script's `RenderUnavailableError` instanceof check is name-based via
 * the {@link toGeneratorRenderUnavailable} adapter at the bin layer).
 */
export function createGenerateFixtureRenderer(args: {
  resolver: ClipKindResolver;
  render: PrimeRenderFn;
}): FixtureRendererLike {
  return {
    async render(renderArgs) {
      // Pass `presetId` so the resolver can disambiguate multi-preset-per-clipKind
      // bindings (T-360 D-T360-2). Resolvers ignoring the arg keep T-359 behavior.
      const binding = args.resolver(
        renderArgs.preset.frontmatter.clipKind,
        renderArgs.preset.frontmatter.id,
      );
      if (binding === undefined) {
        throw new GenerateFixtureUnavailableError(
          `no component bound for clipKind '${renderArgs.preset.frontmatter.clipKind}'`,
        );
      }
      const props = binding.buildProps(renderArgs.variant);
      const doc = buildPresetDocument({
        preset: renderArgs.preset,
        composition: renderArgs.composition,
        binding,
        props,
        ...(renderArgs.variant !== undefined ? { variant: renderArgs.variant } : {}),
      });
      return args.render(doc, renderArgs.frame);
    },
  };
}
