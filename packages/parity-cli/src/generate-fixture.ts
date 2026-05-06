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
};

/**
 * v1 default resolver — `bigNumber → animated-value`, `scoreBug → outcome-row`
 * (T-358), `newsTicker → news-ticker-bar` (T-356), `standings →
 * standings-table` (T-357), `caption → caption` (T-362), `fullScreen →
 * magic-wall-panel` (T-355), `lyrics → lyrics` (T-367), `titleSequence →
 * titleSequence` (T-350), `lowerThird → lower-third` (T-323), with
 * per-preset overrides for multi-preset-per-
 * clipKind cases (T-360 D-T360-2). Per-preset entries take precedence;
 * absent an override, the resolver falls back to the clipKind-only mapping.
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
  const elementId = 'preset-clip-0';
  const variantSlug = args.variant !== undefined ? `-${args.variant}` : '';
  const documentId = `preset-${args.preset.frontmatter.id}${variantSlug}`;
  const doc: RIRDocument = {
    id: documentId,
    width: args.composition.width,
    height: args.composition.height,
    frameRate: args.composition.fps,
    durationFrames: args.composition.durationInFrames,
    mode: 'slide',
    elements: [
      {
        id: elementId,
        type: 'clip',
        transform: {
          x: 0,
          y: 0,
          width: args.composition.width,
          height: args.composition.height,
          rotation: 0,
          opacity: 1,
        },
        timing: {
          startFrame: 0,
          endFrame: args.composition.durationInFrames,
          durationFrames: args.composition.durationInFrames,
        },
        zIndex: 0,
        visible: true,
        locked: false,
        stacking: 'auto',
        animations: [],
        content: {
          type: 'clip',
          runtime: args.binding.runtimeId,
          clipName: args.binding.clipName,
          params: args.props,
        },
      },
    ],
    stackingMap: { [elementId]: 'auto' },
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
