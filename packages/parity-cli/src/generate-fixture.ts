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
 * Per-preset binding overrides (T-360 D-T360-2). Keyed by preset id so
 * multiple presets can share a `clipKind` while parameterizing the same
 * runtime clip differently. Lookups in {@link DEFAULT_CLIP_KIND_RESOLVER}
 * check this map first; unknown ids fall through to the clipKind-only path,
 * preserving T-358 / T-359 / T-359a behavior.
 */
export const PRESET_ID_BINDINGS: Readonly<Record<string, ClipKindBinding>> = {
  'big-number-stat-impact': bigNumberStatImpactBinding,
  'mrbeast-komika-axis': mrbeastBinding,
};

/**
 * v1 default resolver — `bigNumber → animated-value`, `scoreBug → outcome-row`
 * (T-358), `newsTicker → news-ticker-bar` (T-356), `standings →
 * standings-table` (T-357), `caption → caption` (T-362), with per-preset
 * overrides for multi-preset-per-clipKind cases (T-360 D-T360-2). Per-preset
 * entries take precedence; absent an override, the resolver falls back to
 * the clipKind-only mapping.
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
