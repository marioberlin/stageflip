// packages/parity-cli/src/generate-fixture.test.ts
// Tests for the production-renderer binding (T-359a). Uses a stub
// `PrimeRenderFn` (no Chrome / ffmpeg dependency).

import { rirDocumentSchema } from '@stageflip/rir';
import { describe, expect, it, vi } from 'vitest';

import {
  ALI_ABDAAL_CANONICAL_WORDS,
  BLOOMBERG_CANONICAL_SNAPSHOT,
  CRICKET_OUTCOME_COLORS,
  DEFAULT_CLIP_KIND_RESOLVER,
  F1_SECTOR_STATE_COLORS,
  GenerateFixtureUnavailableError,
  HORMOZI_CANONICAL_WORDS,
  KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES,
  MAGIC_WALL_CANONICAL_REGIONS,
  MRBEAST_CANONICAL_WORDS,
  NETFLIX_CANONICAL_WORDS,
  OLYMPIC_CANONICAL_STANDINGS,
  PRESET_ID_BINDINGS,
  type PresetForRender,
  TIKTOK_CANONICAL_WORDS,
  buildPresetDocument,
  createGenerateFixtureRenderer,
} from './generate-fixture.js';

const COMPOSITION = {
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 150,
} as const;

function presetWith(clipKind: string, id = 'demo', cluster = 'data'): PresetForRender {
  return { frontmatter: { id, cluster, clipKind } };
}

describe('DEFAULT_CLIP_KIND_RESOLVER', () => {
  it('resolves bigNumber to animated-value on the frame-runtime (D-T359a-4)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('animated-value');
  });

  it('returns undefined for unknown clipKinds (D-T359a-4)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
  });

  it('builds bigNumber props with the variant-mapped F1 state color', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber');
    if (!binding) throw new Error('test setup');
    const session = binding.buildProps('sessionBest');
    expect(session.color).toBe(F1_SECTOR_STATE_COLORS.sessionBest);
    expect(session.value).toBe(21.412);
    expect(session.decimals).toBe(3);
    expect(session.fontWeight).toBe(700);

    const personal = binding.buildProps('personalBest');
    expect(personal.color).toBe(F1_SECTOR_STATE_COLORS.personalBest);
    const neutral = binding.buildProps('neutral');
    expect(neutral.color).toBe(F1_SECTOR_STATE_COLORS.neutral);
  });

  it('omits color when variant is undefined (single-variant legacy)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    expect(props.color).toBeUndefined();
  });

  it('omits color when variant is unknown (defensive)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps('unknownVariant');
    expect(props.color).toBeUndefined();
  });

  it('resolves scoreBug to outcome-row on the frame-runtime (T-358 D-T358-4)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('outcome-row');
  });

  // T-360 — per-preset binding overrides (D-T360-2). The bigNumber clipKind
  // is now shared between f1-sector-purple-green (T-359) and big-number-stat-impact
  // (T-360); the resolver disambiguates via the optional `presetId` arg.

  it('resolves bigNumber + big-number-stat-impact to the impact binding (T-360 AC #11)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('animated-value');
    const props = binding?.buildProps(undefined);
    expect(props?.value).toBe(87.4);
    expect(props?.decimals).toBe(1);
    expect(props?.suffix).toBe('%');
    expect(props?.fontSize).toBe(360);
    expect(props?.fontWeight).toBe(800);
  });

  it('PRESET_ID_BINDINGS exposes the big-number-stat-impact override (T-360)', () => {
    expect(PRESET_ID_BINDINGS['big-number-stat-impact']).toBeDefined();
    expect(PRESET_ID_BINDINGS['big-number-stat-impact']?.clipName).toBe('animated-value');
  });

  it('falls through to bigNumberBinding for f1-sector-purple-green (T-360 AC #12 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'f1-sector-purple-green');
    expect(binding).toBeDefined();
    // T-359's binding sets fontWeight: 700; T-360's sets 800. The fall-through
    // selection MUST land on T-359's binding for any presetId not in PRESET_ID_BINDINGS.
    const props = binding?.buildProps(undefined);
    expect(props?.value).toBe(21.412);
    expect(props?.decimals).toBe(3);
    expect(props?.fontWeight).toBe(700);
  });

  it('falls through to bigNumberBinding when presetId is omitted (T-360 AC #13 / T-359a)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.value).toBe(21.412);
    expect(props?.decimals).toBe(3);
    expect(props?.fontWeight).toBe(700);
  });

  it('falls through to scoreBugDotsBinding for cricket-ball-by-ball-dots (T-360 AC #14)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-ball-by-ball-dots');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('outcome-row');
  });

  it('still returns undefined for unknown clipKinds with an unknown presetId (T-360 AC #15)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'unknown-preset')).toBeUndefined();
  });

  // T-356 — newsTicker → news-ticker-bar binding (D-T356-3) + cached
  // BLOOMBERG_CANONICAL_SNAPSHOT (D-T356-4). The clipKind-default entry is
  // generic across future financial / sports / news-feed presets; the
  // per-preset override path is reserved for tenant-specific colorways.

  it('resolves newsTicker to news-ticker-bar on the frame-runtime (T-356 D-T356-3)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('newsTicker');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('news-ticker-bar');
  });

  it('falls through to newsTickerBinding for bloomberg-ticker (T-356 AC #14)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('newsTicker', 'bloomberg-ticker');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('news-ticker-bar');
  });

  it('builds newsTicker props with the six-entry Bloomberg canonical snapshot (T-356 AC #12)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('newsTicker');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    const entries = props.entries as ReadonlyArray<{
      symbol: string;
      price: string;
      delta: string;
      direction: string;
    }>;
    expect(Array.isArray(entries)).toBe(true);
    expect(entries).toHaveLength(6);
    expect(entries.map((e) => e.symbol)).toEqual([
      'AAPL',
      'MSFT',
      'GOOGL',
      'NVDA',
      'TSLA',
      'BTC-USD',
    ]);
    expect(props.scrollSpeed).toBe(60);
    expect(props.background).toBe('#0A0A0A');
    expect(props.upColor).toBe('#00D26A');
    expect(props.downColor).toBe('#FF3C3C');
    expect(props.foreground).toBe('#FFFFFF');
    expect(props.bandPosition).toBe('bottom');
  });

  it('exports BLOOMBERG_CANONICAL_SNAPSHOT with six entries mixing up + down deltas (T-356 AC #13)', () => {
    expect(BLOOMBERG_CANONICAL_SNAPSHOT).toHaveLength(6);
    const directions = BLOOMBERG_CANONICAL_SNAPSHOT.map((e) => e.direction);
    expect(directions.filter((d) => d === 'up').length).toBeGreaterThanOrEqual(1);
    expect(directions.filter((d) => d === 'down').length).toBeGreaterThanOrEqual(1);
  });

  // T-357 — standings → standings-table binding (D-T357-3) + cached
  // OLYMPIC_CANONICAL_STANDINGS (D-T357-4). The clipKind-default entry is
  // generic across future Cluster A/B/E ranked-list presets (election
  // results, F1 / NBA / NCAA leaderboards, crypto top-N dashboards); the
  // per-preset override path is reserved for tenant-specific colorways.

  it('resolves standings to standings-table on the frame-runtime (T-357 D-T357-3)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('standings');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('standings-table');
  });

  it('falls through to standingsBinding for olympic-medal-tracker (T-357 AC #15)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('standings', 'olympic-medal-tracker');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('standings-table');
  });

  it('builds standings props with five rows + seven columns + medal-color tints (T-357 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('standings');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    const rows = props.rows as ReadonlyArray<{
      rank: number;
      code: string;
      values: number[];
      total: number;
      delta: 'up' | 'down' | 'flat';
    }>;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.code)).toEqual(['USA', 'CHN', 'JPN', 'AUS', 'GBR']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    // Numeric values per row are [gold, silver, bronze].
    expect(rows[0]?.values).toEqual([28, 22, 19]);
    expect(rows[0]?.total).toBe(69);

    const columns = props.columns as ReadonlyArray<{
      key: string;
      label: string;
      kind: string;
      color?: string;
    }>;
    expect(columns).toHaveLength(7);
    expect(columns.map((c) => c.key)).toEqual([
      'rank',
      'code',
      'gold',
      'silver',
      'bronze',
      'total',
      'delta',
    ]);
    expect(columns.find((c) => c.key === 'gold')?.color).toBe('#FFD700');
    expect(columns.find((c) => c.key === 'silver')?.color).toBe('#C0C0C0');
    expect(columns.find((c) => c.key === 'bronze')?.color).toBe('#CD7F32');

    expect(props.background).toBe('#0E0E12');
    expect(props.foreground).toBe('#FFFFFF');
    expect(props.upColor).toBe('#00B54A');
    expect(props.downColor).toBe('#CC0000');
    expect(props.flatColor).toBe('#999999');
    expect(props.bandPosition).toBe('overlay');
  });

  it('exports OLYMPIC_CANONICAL_STANDINGS with five entries mixing up + down + flat deltas (T-357 AC #14)', () => {
    expect(OLYMPIC_CANONICAL_STANDINGS).toHaveLength(5);
    expect(OLYMPIC_CANONICAL_STANDINGS.map((r) => r.code)).toEqual([
      'USA',
      'CHN',
      'JPN',
      'AUS',
      'GBR',
    ]);
    const directions = OLYMPIC_CANONICAL_STANDINGS.map((r) => r.delta);
    expect(directions.filter((d) => d === 'up').length).toBeGreaterThanOrEqual(1);
    expect(directions.filter((d) => d === 'down').length).toBeGreaterThanOrEqual(1);
    expect(directions.filter((d) => d === 'flat').length).toBeGreaterThanOrEqual(1);
  });

  // T-362 — caption → caption binding (D-T362-4) + cached
  // HORMOZI_CANONICAL_WORDS (D-T362-6). First Cluster F entry; first
  // `caption` clipKind binding. The clipKind-default entry is the canonical
  // Hormozi snapshot; sibling cluster F presets (T-363+) override per-preset
  // via PRESET_ID_BINDINGS to swap the `style` enum + word snapshot.

  it('resolves caption to caption on the frame-runtime (T-362 D-T362-4)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('caption');
  });

  it('falls through to captionBinding for hormozi-montserrat-black (T-362 AC #14)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'hormozi-montserrat-black');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('caption');
  });

  it('builds caption props with the six-word Hormozi canonical snapshot (T-362 AC #12)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    const words = props.words as ReadonlyArray<{
      text: string;
      startMs: number;
      endMs: number;
    }>;
    expect(Array.isArray(words)).toBe(true);
    expect(words).toHaveLength(6);
    expect(words.map((w) => w.text)).toEqual(['This', 'will', 'change', 'your', 'life', 'forever']);
    expect(props.style).toBe('hormozi');
    expect(props.background).toBe('#0E0E12');
    const position = props.position as {
      x: number;
      y: number;
      width: number;
      alignment: string;
    };
    expect(position.x).toBe(128);
    expect(position.y).toBe(432);
    expect(position.width).toBe(1024);
    expect(position.alignment).toBe('center');
  });

  it('exports HORMOZI_CANONICAL_WORDS with six entries totalling 1800 ms (T-362 AC #13)', () => {
    expect(HORMOZI_CANONICAL_WORDS).toHaveLength(6);
    const total = HORMOZI_CANONICAL_WORDS.reduce((acc, w) => acc + (w.endMs - w.startMs), 0);
    expect(total).toBe(1800);
    // Each word is 300 ms.
    for (const w of HORMOZI_CANONICAL_WORDS) {
      expect(w.endMs - w.startMs).toBe(300);
    }
    // Word 6 ('forever') is the active highlight at frame 45 (= 1500 ms).
    const word6 = HORMOZI_CANONICAL_WORDS[5];
    expect(word6?.text).toBe('forever');
    expect(word6?.startMs).toBe(1500);
    expect(word6?.endMs).toBe(1800);
  });

  // T-363 — second `caption` clipKind preset (`mrbeast-komika-axis`), routed
  // via the per-presetId override path (D-T363-4). The clipKind-default
  // (T-362's `captionBinding` with style 'hormozi') stays unchanged; only
  // the `mrbeast-komika-axis` presetId resolves to `mrbeastBinding`.

  it('routes mrbeast-komika-axis through the per-preset override binding (T-363 AC #12)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'mrbeast-komika-axis');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('caption');
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('mrbeast');
    const words = props?.words as ReadonlyArray<{
      text: string;
      startMs: number;
      endMs: number;
      emphasis?: string;
    }>;
    expect(Array.isArray(words)).toBe(true);
    expect(words).toHaveLength(6);
    expect(words.map((w) => w.text)).toEqual(['I', 'gave', 'away', 'one', 'million', 'dollars']);
    // Three highlight words at indices 1 / 3 / 5 (D-T363-5) — cycling color
    // routing fires red / yellow / green via the primitive's
    // `highlightedIndex % 3` rule.
    expect(words.filter((w) => w.emphasis === 'highlight')).toHaveLength(3);
    expect(words[1]?.emphasis).toBe('highlight');
    expect(words[3]?.emphasis).toBe('highlight');
    expect(words[5]?.emphasis).toBe('highlight');
    expect(props?.background).toBe('#0E0E12');
    const position = props?.position as {
      x: number;
      y: number;
      width: number;
      alignment: string;
    };
    expect(position.x).toBe(128);
    expect(position.y).toBe(200);
    expect(position.width).toBe(1024);
    expect(position.alignment).toBe('center');
  });

  it('PRESET_ID_BINDINGS exposes the mrbeast-komika-axis override (T-363)', () => {
    expect(PRESET_ID_BINDINGS['mrbeast-komika-axis']).toBeDefined();
    expect(PRESET_ID_BINDINGS['mrbeast-komika-axis']?.clipName).toBe('caption');
  });

  it('falls through to captionBinding for hormozi-montserrat-black after T-363 lands (T-363 AC #14 backward compat)', () => {
    // T-363's PRESET_ID_BINDINGS entry must NOT shadow T-362's clipKind-
    // default. Asserting style stays 'hormozi' (vs 'mrbeast') guards the
    // fall-through.
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'hormozi-montserrat-black');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('hormozi');
    const words = props?.words as ReadonlyArray<{ text: string }>;
    expect(words.map((w) => w.text)).toEqual(['This', 'will', 'change', 'your', 'life', 'forever']);
  });

  it('falls through to captionBinding for unknown caption presetIds (T-363 AC #17)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'unknown-caption-preset');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('hormozi');
  });

  it('exports MRBEAST_CANONICAL_WORDS with six entries totalling 2100 ms (T-363 AC #13)', () => {
    expect(MRBEAST_CANONICAL_WORDS).toHaveLength(6);
    const total = MRBEAST_CANONICAL_WORDS.reduce((acc, w) => acc + (w.endMs - w.startMs), 0);
    expect(total).toBe(2100);
    // Each word is 350 ms (vs Hormozi's 300 ms — emphasis-heavy register
    // stays slightly longer per word per D-T363-6).
    for (const w of MRBEAST_CANONICAL_WORDS) {
      expect(w.endMs - w.startMs).toBe(350);
    }
    // Word 6 ('dollars') is the active highlight at frame 60 (= 2000 ms).
    const word6 = MRBEAST_CANONICAL_WORDS[5];
    expect(word6?.text).toBe('dollars');
    expect(word6?.startMs).toBe(1750);
    expect(word6?.endMs).toBe(2100);
    expect(word6?.emphasis).toBe('highlight');
  });

  it('routes mrbeast-komika-axis through the renderer-side override (T-363 AC #12 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('caption', 'mrbeast-komika-axis', 'captions'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.params).toMatchObject({
      style: 'mrbeast',
    });
    const params = element.content.params as { words: ReadonlyArray<{ text: string }> };
    expect(params.words.map((w) => w.text)).toEqual([
      'I',
      'gave',
      'away',
      'one',
      'million',
      'dollars',
    ]);
  });

  // T-364 — third `caption` clipKind preset (`tiktok-rounded-box`), routed
  // via the per-presetId override path (D-T364-4). The clipKind-default
  // (T-362's `captionBinding` with style 'hormozi') stays unchanged; T-363's
  // `mrbeast-komika-axis` override stays unchanged; only `tiktok-rounded-box`
  // resolves to `tiktokBinding`. First Cluster F preset to render
  // `backdrop: 'pill'` and the `'slide-from-bottom'` entrance.

  it('routes tiktok-rounded-box through the per-preset override binding (T-364 AC #12)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'tiktok-rounded-box');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('caption');
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('tiktok');
    const words = props?.words as ReadonlyArray<{
      text: string;
      startMs: number;
      endMs: number;
      emphasis?: string;
    }>;
    expect(Array.isArray(words)).toBe(true);
    expect(words).toHaveLength(5);
    expect(words.map((w) => w.text)).toEqual(['Wait', 'until', 'you', 'see', 'this']);
    // No emphasis on any word — TikTok bundle's highlightColor === foreground,
    // so the pill backdrop IS the emphasis, not a per-word color shift
    // (D-T364-13).
    for (const w of words) {
      expect(w.emphasis).toBeUndefined();
    }
    expect(props?.background).toBe('#5A5A5A');
    const position = props?.position as {
      x: number;
      y: number;
      width: number;
      alignment: string;
    };
    expect(position.x).toBe(128);
    expect(position.y).toBe(360);
    expect(position.width).toBe(1024);
    expect(position.alignment).toBe('center');
  });

  it('PRESET_ID_BINDINGS exposes the tiktok-rounded-box override (T-364)', () => {
    expect(PRESET_ID_BINDINGS['tiktok-rounded-box']).toBeDefined();
    expect(PRESET_ID_BINDINGS['tiktok-rounded-box']?.clipName).toBe('caption');
  });

  it('falls through to captionBinding for hormozi-montserrat-black after T-364 lands (T-364 AC #14 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'hormozi-montserrat-black');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('hormozi');
  });

  it('routes mrbeast-komika-axis after T-364 lands (T-364 AC #15 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'mrbeast-komika-axis');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('mrbeast');
  });

  it('exports TIKTOK_CANONICAL_WORDS with five entries totalling 2000 ms (T-364 AC #13)', () => {
    expect(TIKTOK_CANONICAL_WORDS).toHaveLength(5);
    const total = TIKTOK_CANONICAL_WORDS.reduce((acc, w) => acc + (w.endMs - w.startMs), 0);
    expect(total).toBe(2000);
    // Each word is 400 ms (slower than Hormozi's 300 ms; faster than MrBeast's
    // 350 ms emphasis-heavy register per D-T364-6).
    for (const w of TIKTOK_CANONICAL_WORDS) {
      expect(w.endMs - w.startMs).toBe(400);
    }
    // Word 4 ('see', 1200..1600) is the active word at frame 45 (= 1500 ms);
    // word 5 ('this', 1600..2000) is mid-slide-from-bottom entrance at frame 45.
    const word4 = TIKTOK_CANONICAL_WORDS[3];
    expect(word4?.text).toBe('see');
    expect(word4?.startMs).toBe(1200);
    expect(word4?.endMs).toBe(1600);
    const word5 = TIKTOK_CANONICAL_WORDS[4];
    expect(word5?.text).toBe('this');
    expect(word5?.startMs).toBe(1600);
    expect(word5?.endMs).toBe(2000);
  });

  it('routes tiktok-rounded-box through the renderer-side override (T-364 AC #12 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('caption', 'tiktok-rounded-box', 'captions'),
      composition: COMPOSITION,
      frame: 45,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.params).toMatchObject({
      style: 'tiktok',
    });
    const params = element.content.params as { words: ReadonlyArray<{ text: string }> };
    expect(params.words.map((w) => w.text)).toEqual(['Wait', 'until', 'you', 'see', 'this']);
  });

  // T-365 — fourth `caption` clipKind preset (`ali-abdaal-opacity-karaoke`),
  // routed via the per-presetId override path (D-T365-4). The clipKind-default
  // (T-362's `captionBinding` with style 'hormozi') stays unchanged; T-363's
  // `mrbeast-komika-axis` and T-364's `tiktok-rounded-box` overrides stay
  // unchanged; only `ali-abdaal-opacity-karaoke` resolves to `aliAbdaalBinding`.
  // First Cluster F preset to render `entrance: 'none'` AND opacity-only
  // active-word emphasis (`muteColor === highlightColor === foreground` with
  // `muteOpacity: 0.6`).

  it('routes ali-abdaal-opacity-karaoke through the per-preset override binding (T-365 AC #12)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'ali-abdaal-opacity-karaoke');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('caption');
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('ali-abdaal');
    const words = props?.words as ReadonlyArray<{
      text: string;
      startMs: number;
      endMs: number;
      emphasis?: string;
    }>;
    expect(Array.isArray(words)).toBe(true);
    expect(words).toHaveLength(8);
    expect(words.map((w) => w.text)).toEqual([
      'The',
      'best',
      'way',
      'to',
      'learn',
      'is',
      'by',
      'teaching',
    ]);
    // No emphasis on any word — ali-abdaal bundle's `muteColor === highlightColor
    // === foreground` so emphasis comes from active-vs-rest opacity routing,
    // not from per-word emphasis tags (D-T365-13).
    for (const w of words) {
      expect(w.emphasis).toBeUndefined();
    }
    // No `background` override — bundle ships `backdrop: 'none'`; the canvas
    // bleed (white) is the intended visual register (D-T365-11).
    expect(props?.background).toBeUndefined();
    const position = props?.position as {
      x: number;
      y: number;
      width: number;
      alignment: string;
    };
    expect(position.x).toBe(128);
    expect(position.y).toBe(432);
    expect(position.width).toBe(1024);
    expect(position.alignment).toBe('center');
  });

  it('PRESET_ID_BINDINGS exposes the ali-abdaal-opacity-karaoke override (T-365)', () => {
    expect(PRESET_ID_BINDINGS['ali-abdaal-opacity-karaoke']).toBeDefined();
    expect(PRESET_ID_BINDINGS['ali-abdaal-opacity-karaoke']?.clipName).toBe('caption');
  });

  it('falls through to captionBinding for hormozi-montserrat-black after T-365 lands (T-365 AC #14 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'hormozi-montserrat-black');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('hormozi');
  });

  it('routes mrbeast-komika-axis after T-365 lands (T-365 AC #15 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'mrbeast-komika-axis');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('mrbeast');
  });

  it('routes tiktok-rounded-box after T-365 lands (T-365 AC #16 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'tiktok-rounded-box');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('tiktok');
  });

  it('exports ALI_ABDAAL_CANONICAL_WORDS with eight entries totalling 2400 ms (T-365 AC #13)', () => {
    expect(ALI_ABDAAL_CANONICAL_WORDS).toHaveLength(8);
    const total = ALI_ABDAAL_CANONICAL_WORDS.reduce((acc, w) => acc + (w.endMs - w.startMs), 0);
    expect(total).toBe(2400);
    // Each word is 300 ms (matches Hormozi pace; slower than TikTok's 400 ms).
    for (const w of ALI_ABDAAL_CANONICAL_WORDS) {
      expect(w.endMs - w.startMs).toBe(300);
    }
    // Word 7 ('by', 1800..2100) is the active word at frame 60 (= 2000 ms);
    // word 8 ('teaching', 2100..2400) has not yet entered (`entrance: 'none'`
    // means no anticipatory entrance — pops in at startMs).
    const word7 = ALI_ABDAAL_CANONICAL_WORDS[6];
    expect(word7?.text).toBe('by');
    expect(word7?.startMs).toBe(1800);
    expect(word7?.endMs).toBe(2100);
    const word8 = ALI_ABDAAL_CANONICAL_WORDS[7];
    expect(word8?.text).toBe('teaching');
    expect(word8?.startMs).toBe(2100);
    expect(word8?.endMs).toBe(2400);
    // Sentence case ('as-is' bundle casing) — only 'The' is capitalized.
    expect(ALI_ABDAAL_CANONICAL_WORDS[0]?.text).toBe('The');
    for (const w of ALI_ABDAAL_CANONICAL_WORDS.slice(1)) {
      expect(w.text[0]).toBe(w.text[0]?.toLowerCase());
    }
  });

  it('routes ali-abdaal-opacity-karaoke through the renderer-side override (T-365 AC #12 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('caption', 'ali-abdaal-opacity-karaoke', 'captions'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.params).toMatchObject({
      style: 'ali-abdaal',
    });
    const params = element.content.params as { words: ReadonlyArray<{ text: string }> };
    expect(params.words.map((w) => w.text)).toEqual([
      'The',
      'best',
      'way',
      'to',
      'learn',
      'is',
      'by',
      'teaching',
    ]);
  });

  // T-366 — fifth `caption` clipKind preset (`netflix-invisible`), routed via
  // the per-presetId override path (D-T366-4). The clipKind-default (T-362's
  // `captionBinding` with style 'hormozi') stays unchanged; T-363's
  // `mrbeast-komika-axis`, T-364's `tiktok-rounded-box`, and T-365's
  // `ali-abdaal-opacity-karaoke` overrides stay unchanged; only
  // `netflix-invisible` resolves to `netflixBinding`. First Cluster F preset
  // to render `muteOpacity: 0` strict-accessibility active-only visibility
  // (past / future words completely invisible per T-316a's routing fix) AND
  // the first Cluster F preset to use `backdrop: 'rect'` (translucent black
  // rectangle behind the active word).

  it('routes netflix-invisible through the per-preset override binding (T-366 AC #12)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'netflix-invisible');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('caption');
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('netflix');
    const words = props?.words as ReadonlyArray<{
      text: string;
      startMs: number;
      endMs: number;
      emphasis?: string;
    }>;
    expect(Array.isArray(words)).toBe(true);
    expect(words).toHaveLength(5);
    expect(words.map((w) => w.text)).toEqual([
      'Captions',
      'enable',
      'accessibility',
      'for',
      'everyone',
    ]);
    // No emphasis on any word — netflix bundle's `muteColor === highlightColor
    // === foreground === '#FFFFFF'` so visibility comes from active-vs-rest
    // routing with `muteOpacity: 0`, not from per-word emphasis tags
    // (D-T366-13).
    for (const w of words) {
      expect(w.emphasis).toBeUndefined();
    }
    // No `background` override — bundle ships `backdrop: 'rect'` which only
    // renders a translucent rect behind the active word, not a full-canvas
    // backdrop (D-T366-11).
    expect(props?.background).toBeUndefined();
    const position = props?.position as {
      x: number;
      y: number;
      width: number;
      alignment: string;
    };
    expect(position.x).toBe(128);
    expect(position.y).toBe(540);
    expect(position.width).toBe(1024);
    expect(position.alignment).toBe('center');
  });

  it('PRESET_ID_BINDINGS exposes the netflix-invisible override (T-366)', () => {
    expect(PRESET_ID_BINDINGS['netflix-invisible']).toBeDefined();
    expect(PRESET_ID_BINDINGS['netflix-invisible']?.clipName).toBe('caption');
  });

  it('falls through to captionBinding for hormozi-montserrat-black after T-366 lands (T-366 AC #14 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'hormozi-montserrat-black');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('hormozi');
  });

  it('routes mrbeast-komika-axis after T-366 lands (T-366 AC #15 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'mrbeast-komika-axis');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('mrbeast');
  });

  it('routes tiktok-rounded-box after T-366 lands (T-366 AC #16 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'tiktok-rounded-box');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('tiktok');
  });

  it('routes ali-abdaal-opacity-karaoke after T-366 lands (T-366 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'ali-abdaal-opacity-karaoke');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('ali-abdaal');
  });

  it('exports NETFLIX_CANONICAL_WORDS with five entries totalling 2000 ms (T-366 AC #13)', () => {
    expect(NETFLIX_CANONICAL_WORDS).toHaveLength(5);
    const total = NETFLIX_CANONICAL_WORDS.reduce((acc, w) => acc + (w.endMs - w.startMs), 0);
    expect(total).toBe(2000);
    // Each word is 400 ms — Netflix register is slow / readable (subtitles are
    // infrastructure, readable for hard-of-hearing audiences) per D-T366-6.
    for (const w of NETFLIX_CANONICAL_WORDS) {
      expect(w.endMs - w.startMs).toBe(400);
    }
    // Word 4 ('for', 1200..1600) is the active word at frame 45 (= 1500 ms);
    // word 5 ('everyone', 1600..2000) has not yet entered (`entrance: 'none'`
    // means no anticipatory entrance — pops in at startMs).
    const word4 = NETFLIX_CANONICAL_WORDS[3];
    expect(word4?.text).toBe('for');
    expect(word4?.startMs).toBe(1200);
    expect(word4?.endMs).toBe(1600);
    const word5 = NETFLIX_CANONICAL_WORDS[4];
    expect(word5?.text).toBe('everyone');
    expect(word5?.startMs).toBe(1600);
    expect(word5?.endMs).toBe(2000);
    // Sentence case ('as-is' bundle casing) — only 'Captions' is capitalized.
    expect(NETFLIX_CANONICAL_WORDS[0]?.text).toBe('Captions');
    for (const w of NETFLIX_CANONICAL_WORDS.slice(1)) {
      expect(w.text[0]).toBe(w.text[0]?.toLowerCase());
    }
  });

  it('routes netflix-invisible through the renderer-side override (T-366 AC #12 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('caption', 'netflix-invisible', 'captions'),
      composition: COMPOSITION,
      frame: 45,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.params).toMatchObject({
      style: 'netflix',
    });
    const params = element.content.params as { words: ReadonlyArray<{ text: string }> };
    expect(params.words.map((w) => w.text)).toEqual([
      'Captions',
      'enable',
      'accessibility',
      'for',
      'everyone',
    ]);
  });

  // T-355 — fullScreen → magic-wall-panel binding (D-T355-3) + cached
  // MAGIC_WALL_CANONICAL_REGIONS (D-T355-4). First Cluster E entry to ship
  // using `clipKind: fullScreen`; closes Cluster E to 6/6. The clipKind-
  // default entry is generic across future fullScreen presets across
  // Clusters A (msnbc-big-board), B (uefa-starball-refraction), C
  // (twc-retrocast-8bit / twc-immersive-mixed-reality); the per-preset
  // override path is reserved for tenant-specific colorways.

  it('resolves fullScreen to magic-wall-panel on the frame-runtime (T-355 D-T355-3)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('magic-wall-panel');
  });

  it('falls through to fullScreenBinding for magic-wall-drilldown (T-355 AC #15)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'magic-wall-drilldown');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('magic-wall-panel');
  });

  it('builds fullScreen props with eight regions in a 4x2 grid + party-color shading (T-355 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    const regions = props.regions as ReadonlyArray<{
      id: string;
      label: string;
      value: number;
      valueLabel: string;
      color: string;
      bounds: { x: number; y: number; width: number; height: number };
    }>;
    expect(Array.isArray(regions)).toBe(true);
    expect(regions).toHaveLength(8);
    expect(regions.map((r) => r.id)).toEqual(['CA', 'TX', 'FL', 'NY', 'PA', 'OH', 'GA', 'AZ']);

    // Party-color shading: 3 Dem (CA, NY, AZ), 3 Rep (TX, FL, OH), 1 tied
    // (PA), 1 undecided (GA) — exercises all four color paths.
    const colorById = new Map(regions.map((r) => [r.id, r.color]));
    expect(colorById.get('CA')).toBe('#0044CC'); // Dem Blue
    expect(colorById.get('NY')).toBe('#0044CC');
    expect(colorById.get('AZ')).toBe('#0044CC');
    expect(colorById.get('TX')).toBe('#CC0000'); // Rep Red
    expect(colorById.get('FL')).toBe('#CC0000');
    expect(colorById.get('OH')).toBe('#CC0000');
    expect(colorById.get('PA')).toBe('#7A3FB2'); // tied — purple
    expect(colorById.get('GA')).toBe('#666666'); // undecided — gray

    // Electoral-vote count threaded through `value`.
    const evById = new Map(regions.map((r) => [r.id, r.value]));
    expect(evById.get('CA')).toBe(54);
    expect(evById.get('TX')).toBe(40);
    expect(evById.get('AZ')).toBe(11);

    // Bounds: 4×2 grid; first row at y=140, second row offset by tile height + gap.
    expect(regions[0]?.bounds.x).toBe(60);
    expect(regions[0]?.bounds.y).toBe(140);
    expect(regions[3]?.bounds.x).toBeGreaterThan(regions[0]?.bounds.x ?? 0);
    expect(regions[3]?.bounds.y).toBe(140);
    expect(regions[4]?.bounds.x).toBe(60); // wraps to row 2, col 0
    expect(regions[4]?.bounds.y).toBeGreaterThan(140);

    // valueLabel is the leading-party percentage (broadcast-canonical
    // salient signal); the electoral-vote count lives in the numeric
    // `value` field for documentation + future dual-render layouts.
    const labelById = new Map(regions.map((r) => [r.id, r.valueLabel]));
    expect(labelById.get('CA')).toBe('62.1%');
    expect(labelById.get('PA')).toBe('49.8%');
    expect(labelById.get('GA')).toBe('50.1%');

    expect(props.title).toBe('Election Results');
    expect(props.subtitle).toBe('State-by-state breakdown');
    expect(props.valueFormat).toBe('count');
    expect(props.entrance).toBe('stagger-rise');
    expect(props.staggerMs).toBe(60);
    expect(props.background).toBe('#0E0E12');
    expect(props.foreground).toBe('#FFFFFF');
  });

  it('exports MAGIC_WALL_CANONICAL_REGIONS with eight entries mixing all four party colors (T-355 AC #14)', () => {
    expect(MAGIC_WALL_CANONICAL_REGIONS).toHaveLength(8);
    expect(MAGIC_WALL_CANONICAL_REGIONS.map((r) => r.id)).toEqual([
      'CA',
      'TX',
      'FL',
      'NY',
      'PA',
      'OH',
      'GA',
      'AZ',
    ]);
    const parties = MAGIC_WALL_CANONICAL_REGIONS.map((r) => r.party);
    expect(parties.filter((p) => p === 'A')).toHaveLength(3);
    expect(parties.filter((p) => p === 'B')).toHaveLength(3);
    expect(parties.filter((p) => p === 'tied')).toHaveLength(1);
    expect(parties.filter((p) => p === 'undecided')).toHaveLength(1);
    // Sum of electoral votes: 54 + 40 + 30 + 28 + 19 + 17 + 16 + 11 = 215.
    const totalEv = MAGIC_WALL_CANONICAL_REGIONS.reduce((acc, r) => acc + r.electoralVotes, 0);
    expect(totalEv).toBe(215);
  });

  // T-367 — first `lyrics`-clipKind preset (`karaoke-progressive-wipe`),
  // wired as the `lyrics` clipKind-default (NOT a per-preset override —
  // mirrors T-362 hormozi's first-preset-for-clipKind precedent). The
  // clipKind-default returns `lyricsBinding` for any `lyrics` resolution,
  // including unknown / omitted presetIds. Closes Cluster F to 6/6.

  it('resolves lyrics to lyrics on the frame-runtime (T-367 D-T367-4)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lyrics');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('lyrics');
  });

  it('falls through to lyricsBinding for karaoke-progressive-wipe (T-367 AC #14)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lyrics', 'karaoke-progressive-wipe');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('lyrics');
  });

  it('falls through to lyricsBinding for unknown lyrics presetIds (T-367 AC #24)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lyrics', 'unknown-lyrics-preset');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('lyrics');
  });

  it('builds lyrics props with the three-line karaoke canonical snapshot (T-367 AC #14)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lyrics');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    const lines = props.lines as ReadonlyArray<{
      text: string;
      startMs: number;
      endMs: number;
    }>;
    expect(Array.isArray(lines)).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.text)).toEqual([
      'Once upon a time',
      'We were stronger together',
      'Now we sing alone',
    ]);
    expect(props.style).toBe('karaoke-wipe');
    expect(props.maxLinesVisible).toBe(3);
    expect(props.casing).toBe('uppercase');
    const glow = props.glow as { color: string; blur: number };
    expect(glow.color).toBe('#FFFFFF');
    expect(glow.blur).toBe(6);
    expect(props.background).toBe('#0E0E12');
    const position = props.position as {
      x: number;
      y: number;
      width: number;
      alignment: string;
    };
    expect(position.x).toBe(128);
    expect(position.y).toBe(360);
    expect(position.width).toBe(1024);
    expect(position.alignment).toBe('center');
  });

  it('exports KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES with three entries totalling 7500 ms (T-367 AC #16)', () => {
    expect(KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES).toHaveLength(3);
    const total = KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES.reduce(
      (acc, l) => acc + (l.endMs - l.startMs),
      0,
    );
    expect(total).toBe(7500);
    // Each line is 2500 ms (anthemic / mid-tempo register per D-T367-7).
    for (const l of KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES) {
      expect(l.endMs - l.startMs).toBe(2500);
    }
    // Line 2 ('We were stronger together', 2500..5000) is the active line at
    // frame 105 (= 3500 ms); wipe progress = (3500 - 2500) / 2500 = 0.40.
    const line2 = KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES[1];
    expect(line2?.text).toBe('We were stronger together');
    expect(line2?.startMs).toBe(2500);
    expect(line2?.endMs).toBe(5000);
    // No PRESET_ID_BINDINGS entry — first preset for the lyrics clipKind takes
    // the clipKind-default slot (D-T367-4).
    expect(PRESET_ID_BINDINGS['karaoke-progressive-wipe']).toBeUndefined();
  });

  it('routes karaoke-progressive-wipe through the renderer-side clipKind-default (T-367 AC #14 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('lyrics', 'karaoke-progressive-wipe', 'captions'),
      composition: COMPOSITION,
      frame: 105,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('lyrics');
    expect(element.content.params).toMatchObject({
      style: 'karaoke-wipe',
      maxLinesVisible: 3,
      casing: 'uppercase',
    });
    const params = element.content.params as { lines: ReadonlyArray<{ text: string }> };
    expect(params.lines.map((l) => l.text)).toEqual([
      'Once upon a time',
      'We were stronger together',
      'Now we sing alone',
    ]);
  });

  // T-367 backward compat — preceding cluster F + cluster E presets must still
  // resolve correctly after the lyrics clipKind-default lands.

  it('falls through to captionBinding for hormozi-montserrat-black after T-367 lands (T-367 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'hormozi-montserrat-black');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('hormozi');
  });

  it('routes mrbeast-komika-axis after T-367 lands (T-367 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'mrbeast-komika-axis');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('mrbeast');
  });

  it('routes tiktok-rounded-box after T-367 lands (T-367 AC #19 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'tiktok-rounded-box');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('tiktok');
  });

  it('routes ali-abdaal-opacity-karaoke after T-367 lands (T-367 AC #20 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'ali-abdaal-opacity-karaoke');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('ali-abdaal');
  });

  it('routes netflix-invisible after T-367 lands (T-367 AC #21 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'netflix-invisible');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('netflix');
  });

  it('routes magic-wall-drilldown after T-367 lands (T-367 AC #23 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'magic-wall-drilldown');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('magic-wall-panel');
  });

  it('still returns undefined for unknown clipKinds after T-367 lands (T-367 AC #24)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'karaoke-progressive-wipe')).toBeUndefined();
  });

  it('builds scoreBug props as a six-chip canonical over with cricket-canon colors (T-358)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    expect(props.shape).toBe('circle');
    expect(Array.isArray(props.chips)).toBe(true);
    const chips = props.chips as ReadonlyArray<{ color: string; label: string }>;
    expect(chips).toHaveLength(6);
    // Canonical over: 1, ., 4, 6, W, 2 — exposes all six outcome palette colors in one frame.
    expect(chips.map((c) => c.label)).toEqual(['1', '.', '4', '6', 'W', '2']);
    expect(chips[0]?.color).toBe(CRICKET_OUTCOME_COLORS['1']);
    expect(chips[1]?.color).toBe(CRICKET_OUTCOME_COLORS['.']);
    expect(chips[2]?.color).toBe(CRICKET_OUTCOME_COLORS['4']);
    expect(chips[3]?.color).toBe(CRICKET_OUTCOME_COLORS['6']);
    expect(chips[4]?.color).toBe(CRICKET_OUTCOME_COLORS.W);
    expect(chips[5]?.color).toBe(CRICKET_OUTCOME_COLORS['2']);
  });
});

describe('buildPresetDocument', () => {
  it('produces a Zod-valid RIRDocument', () => {
    const doc = buildPresetDocument({
      preset: presetWith('bigNumber', 'f1-sector', 'data'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'animated-value',
        buildProps: () => ({ value: 1 }),
      },
      props: { value: 21.412, decimals: 3 },
      variant: 'sessionBest',
    });
    expect(() => rirDocumentSchema.parse(doc)).not.toThrow();
  });

  it('includes the variant in the generated document id', () => {
    const doc = buildPresetDocument({
      preset: presetWith('bigNumber', 'f1-sector'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'animated-value',
        buildProps: () => ({}),
      },
      props: {},
      variant: 'sessionBest',
    });
    expect(doc.id).toContain('f1-sector');
    expect(doc.id).toContain('sessionBest');
  });

  it('omits the variant suffix from the document id when variant is unset', () => {
    const doc = buildPresetDocument({
      preset: presetWith('bigNumber', 'cnn-classic'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'animated-value',
        buildProps: () => ({}),
      },
      props: {},
    });
    expect(doc.id).toBe('preset-cnn-classic');
  });

  it('places the resolved props into the clip element params', () => {
    const doc = buildPresetDocument({
      preset: presetWith('bigNumber', 'demo'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'animated-value',
        buildProps: () => ({}),
      },
      props: { value: 99, color: '#abcdef' },
    });
    const element = doc.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.params).toEqual({ value: 99, color: '#abcdef' });
    expect(element.content.runtime).toBe('frame-runtime');
    expect(element.content.clipName).toBe('animated-value');
  });
});

describe('createGenerateFixtureRenderer', () => {
  it('throws GenerateFixtureUnavailableError on unknown clipKind (AC #10)', async () => {
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: vi.fn(),
    });
    await expect(
      Promise.resolve(
        renderer.render({
          preset: presetWith('totallyMadeUp', 'demo'),
          composition: COMPOSITION,
          frame: 60,
        }),
      ),
    ).rejects.toBeInstanceOf(GenerateFixtureUnavailableError);
  });

  it('error message names the unknown clipKind verbatim (AC #10)', async () => {
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: vi.fn(),
    });
    try {
      await renderer.render({
        preset: presetWith('mysteryKind', 'demo'),
        composition: COMPOSITION,
        frame: 60,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as Error).message).toContain("no component bound for clipKind 'mysteryKind'");
    }
  });

  it('round-trip: bound stub renderer is called with a valid RIRDocument and frame', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([1, 2, 3]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    const png = await renderer.render({
      preset: presetWith('bigNumber', 'f1-sector'),
      composition: COMPOSITION,
      frame: 60,
      variant: 'sessionBest',
    });
    expect(Array.from(png)).toEqual([1, 2, 3]);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const [doc, frame] = renderSpy.mock.calls[0] ?? [];
    expect(frame).toBe(60);
    expect(() => rirDocumentSchema.parse(doc)).not.toThrow();
  });

  it('routes big-number-stat-impact through the per-preset override binding (T-360)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('bigNumber', 'big-number-stat-impact'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.params).toMatchObject({
      value: 87.4,
      decimals: 1,
      suffix: '%',
      fontWeight: 800,
    });
  });

  it('passes variant-derived props into the RIRDocument', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('bigNumber', 'f1-sector'),
      composition: COMPOSITION,
      frame: 60,
      variant: 'personalBest',
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.params).toMatchObject({
      color: F1_SECTOR_STATE_COLORS.personalBest,
    });
  });
});
