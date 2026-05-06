// packages/parity-cli/src/generate-fixture.test.ts
// Tests for the production-renderer binding (T-359a). Uses a stub
// `PrimeRenderFn` (no Chrome / ffmpeg dependency).

import { rirDocumentSchema } from '@stageflip/rir';
import { describe, expect, it, vi } from 'vitest';

import {
  ALI_ABDAAL_CANONICAL_WORDS,
  AL_JAZEERA_ORANGE_PROPS,
  APPLE_TV_LT_PROPS,
  BBC_REITH_DARK_PROPS,
  BLOOMBERG_CANONICAL_SNAPSHOT,
  CNN_BREAKING_PROPS,
  CNN_CLASSIC_PROPS,
  CRICKET_OUTCOME_COLORS,
  DEFAULT_CLIP_KIND_RESOLVER,
  ESPN_BOTTOMLINE_PROPS,
  F1_SECTOR_STATE_COLORS,
  FOX_NEWS_ALERT_PROPS,
  FOX_NFL_NO_CHROME_PROPS,
  GenerateFixtureUnavailableError,
  HORMOZI_CANONICAL_WORDS,
  KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES,
  MAGIC_WALL_CANONICAL_REGIONS,
  MASTERS_PROPS,
  MRBEAST_CANONICAL_WORDS,
  MSNBC_BIG_BOARD_PARTY_COLORS,
  MSNBC_BIG_BOARD_REGIONS,
  NBC_SNF_PROPS,
  NETFLIX_CANONICAL_WORDS,
  NETFLIX_DOC_LT_PROPS,
  OLYMPIC_CANONICAL_STANDINGS,
  PREMIER_LEAGUE_FOP_PROPS,
  PRESET_ID_BINDINGS,
  type PresetForRender,
  SQUID_GAME_GEOMETRIC_SHOTS,
  TIKTOK_CANONICAL_WORDS,
  WIMBLEDON_PROPS,
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

  // T-350 — first `titleSequence`-clipKind preset (`squid-game-geometric`),
  // wired as the `titleSequence` clipKind-default (Pattern C — first preset
  // for a clipKind takes the clipKind-default slot, NOT a `PRESET_ID_BINDINGS`
  // override). First Cluster D preset to ship; first preset to bind the
  // `TitleSequenceClip` primitive (T-321, PR #346) end-to-end.

  it('resolves titleSequence to titleSequence on the frame-runtime (T-350 D-T350-6)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('titleSequence');
  });

  it('falls through to squidGameGeometricBinding for squid-game-geometric (T-350 AC #15)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'squid-game-geometric');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('titleSequence');
  });

  it('falls through to squidGameGeometricBinding for unknown titleSequence presetIds (T-350 AC #15)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'unknown-titles-preset');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('titleSequence');
  });

  it('builds titleSequence props with the six-shot squid-game canonical snapshot (T-350 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    const shots = props.shots as ReadonlyArray<{
      id: string;
      kind: string;
      startMs: number;
      endMs: number;
      content: { color?: string; glyph?: string; text?: string };
      transitionOut: string;
    }>;
    expect(Array.isArray(shots)).toBe(true);
    expect(shots).toHaveLength(6);
    expect(shots.map((s) => s.kind)).toEqual([
      'colorPanel',
      'colorPanel',
      'colorPanel',
      'colorPanel',
      'colorPanel',
      'titlePlate',
    ]);
    expect(shots.map((s) => s.id)).toEqual([
      'panel-pink-prelude',
      'panel-teal-circle',
      'panel-black-triangle',
      'panel-pink-square',
      'panel-teal-title',
      'title-hold',
    ]);
    // Inline ○△□ Unicode glyphs per D-T350-4.
    expect(shots[1]?.content.glyph).toBe('○');
    expect(shots[2]?.content.glyph).toBe('△');
    expect(shots[3]?.content.glyph).toBe('□');
    // Title plate text per D-T350-3.
    expect(shots[5]?.content.text).toBe('SQUID GAME');
    // Cut-only enforcement upstream of the bundle's `styleForcesCut`.
    for (const s of shots) {
      expect(s.transitionOut).toBe('cut');
    }
    expect(props.style).toBe('palette-jump-cut');
    expect(props.casing).toBe('uppercase');
    expect(props.foreground).toBe('#FFFFFF');
    // No glow / highlightColor / background per D-T350-7.
    expect(props.glow).toBeUndefined();
    expect(props.highlightColor).toBeUndefined();
    expect(props.background).toBeUndefined();
    const position = props.position as {
      x: number;
      y: number;
      width: number;
      alignment: string;
    };
    expect(position.x).toBe(640);
    expect(position.y).toBe(360);
    expect(position.width).toBe(1024);
    expect(position.alignment).toBe('center');
    const font = props.font as { family: string; weight: number; size: number };
    expect(font.weight).toBe(700);
    // Size 64 (renders at font.size * 2 = 128 px); fits SQUID GAME on one
    // line at the 1024 px wrapper width per D-T350-3 sizing rationale.
    expect(font.size).toBe(64);
    expect(font.family).toContain('Anton');
    expect(font.family).toContain('Bebas Neue');
  });

  it('exports SQUID_GAME_GEOMETRIC_SHOTS with six entries totalling 5000 ms (T-350 AC #14)', () => {
    expect(SQUID_GAME_GEOMETRIC_SHOTS).toHaveLength(6);
    const last = SQUID_GAME_GEOMETRIC_SHOTS[SQUID_GAME_GEOMETRIC_SHOTS.length - 1];
    expect(last?.endMs).toBe(5000);
    // Every shot has a positive duration and chains tail-to-head.
    for (let i = 0; i < SQUID_GAME_GEOMETRIC_SHOTS.length; i += 1) {
      const s = SQUID_GAME_GEOMETRIC_SHOTS[i];
      if (s === undefined) continue;
      expect(s.endMs).toBeGreaterThan(s.startMs);
      if (i > 0) {
        const prev = SQUID_GAME_GEOMETRIC_SHOTS[i - 1];
        expect(s.startMs).toBe(prev?.endMs);
      }
    }
    // Mid-shot-5 lands at frame 120 (= 4000 ms) per D-T350-5; the active
    // shot at ms 4000 is the title-hold (3600..5000), and the most-recent
    // colorPanel up to ms 4000 is shot 4 (panel-teal-title @ #067162).
    const titleHold = SQUID_GAME_GEOMETRIC_SHOTS[5];
    expect(titleHold?.kind).toBe('titlePlate');
    expect(titleHold?.startMs).toBe(3600);
    expect(titleHold?.endMs).toBe(5000);
    const tealBridge = SQUID_GAME_GEOMETRIC_SHOTS[4];
    expect(tealBridge?.content.color).toBe('#067162');
    // No PRESET_ID_BINDINGS entry — first preset for the titleSequence
    // clipKind takes the clipKind-default slot (Pattern C).
    expect(PRESET_ID_BINDINGS['squid-game-geometric']).toBeUndefined();
  });

  it('routes squid-game-geometric through the renderer-side clipKind-default (T-350 AC #13 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('titleSequence', 'squid-game-geometric', 'titles'),
      composition: COMPOSITION,
      frame: 120,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('titleSequence');
    expect(element.content.params).toMatchObject({
      style: 'palette-jump-cut',
      casing: 'uppercase',
      foreground: '#FFFFFF',
    });
    const params = element.content.params as { shots: ReadonlyArray<{ id: string }> };
    expect(params.shots.map((s) => s.id)).toEqual([
      'panel-pink-prelude',
      'panel-teal-circle',
      'panel-black-triangle',
      'panel-pink-square',
      'panel-teal-title',
      'title-hold',
    ]);
  });

  // T-350 backward compat — every prior cluster's clipKind-default + per-
  // preset overrides must still resolve correctly after the titleSequence
  // clipKind-default lands.

  it('falls through to lyricsBinding for karaoke-progressive-wipe after T-350 lands (T-350 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lyrics', 'karaoke-progressive-wipe');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('lyrics');
  });

  it('falls through to captionBinding for hormozi-montserrat-black after T-350 lands (T-350 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'hormozi-montserrat-black');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('hormozi');
  });

  it('routes magic-wall-drilldown after T-350 lands (T-350 AC #19 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'magic-wall-drilldown');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('magic-wall-panel');
  });

  it('routes big-number-stat-impact via PRESET_ID_BINDINGS after T-350 lands (T-350 AC #20 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('animated-value');
    expect(PRESET_ID_BINDINGS['big-number-stat-impact']).toBeDefined();
  });

  it('still returns undefined for unknown clipKinds after T-350 lands (T-350 AC #21)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'squid-game-geometric')).toBeUndefined();
  });

  // T-323 — first `lowerThird`-clipKind preset (`cnn-classic`), wired as the
  // `lowerThird` clipKind-default (Pattern C — first preset for a clipKind
  // takes the clipKind-default slot, NOT a `PRESET_ID_BINDINGS` override).
  // First Cluster A preset to ship; first preset to bind the `LowerThird`
  // primitive (T-183) end-to-end. Note the case mapping per D-T323-12:
  // preset frontmatter `clipKind: 'lowerThird'` (camelCase) → primitive
  // `kind: 'lower-third'` (kebab-case).

  it('resolves lowerThird to lower-third on the frame-runtime (T-323 AC #13 / D-T323-2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('lower-third');
  });

  it('falls through to cnnClassicBinding for cnn-classic (T-323 AC #15)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'cnn-classic');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('lower-third');
  });

  it('falls through to cnnClassicBinding for unknown lowerThird presetIds (T-323 AC #15)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'unknown-news-preset');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('lower-third');
  });

  it('builds lowerThird props with the cnn-classic canonical snapshot (T-323 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    expect(props.name).toBe('BREAKING: SUPREME COURT RULES');
    expect(props.title).toBe('Anderson Cooper · Chief Anchor');
    expect(props.accent).toBe('#CC0000');
    expect(props.background).toBe('#FFFFFF');
    expect(props.textColor).toBe('#000000');
    expect(props.insetLeftPx).toBe(64);
    expect(props.insetBottomPx).toBe(64);
  });

  it('exports CNN_CLASSIC_PROPS with seven canonical fields (T-323 AC #14)', () => {
    expect(CNN_CLASSIC_PROPS).toEqual({
      name: 'BREAKING: SUPREME COURT RULES',
      title: 'Anderson Cooper · Chief Anchor',
      accent: '#CC0000',
      background: '#FFFFFF',
      textColor: '#000000',
      insetLeftPx: 64,
      insetBottomPx: 64,
    });
    // No PRESET_ID_BINDINGS entry — first preset for the lowerThird clipKind
    // takes the clipKind-default slot (Pattern C).
    expect(PRESET_ID_BINDINGS['cnn-classic']).toBeUndefined();
  });

  it('routes cnn-classic through the renderer-side clipKind-default (T-323 AC #13 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('lowerThird', 'cnn-classic', 'news'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('lower-third');
    expect(element.content.params).toMatchObject({
      name: 'BREAKING: SUPREME COURT RULES',
      title: 'Anderson Cooper · Chief Anchor',
      accent: '#CC0000',
      background: '#FFFFFF',
      textColor: '#000000',
      insetLeftPx: 64,
      insetBottomPx: 64,
    });
  });

  // T-323 backward compat — every prior cluster's clipKind-default + per-
  // preset overrides must still resolve correctly after the lowerThird
  // clipKind-default lands.

  it('falls through to squidGameGeometricBinding for squid-game-geometric after T-323 lands (T-323 AC #20 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'squid-game-geometric');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('titleSequence');
  });

  it('falls through to lyricsBinding for karaoke-progressive-wipe after T-323 lands (T-323 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lyrics', 'karaoke-progressive-wipe');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('lyrics');
  });

  it('falls through to captionBinding for hormozi-montserrat-black after T-323 lands (T-323 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'hormozi-montserrat-black');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('hormozi');
  });

  it('routes big-number-stat-impact via PRESET_ID_BINDINGS after T-323 lands (T-323 AC #21 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('animated-value');
    expect(PRESET_ID_BINDINGS['big-number-stat-impact']).toBeDefined();
  });

  it('still returns undefined for unknown clipKinds after T-323 lands (T-323 AC #22)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'cnn-classic')).toBeUndefined();
  });

  // T-325 — second `lowerThird`-clipKind preset (`bbc-reith-dark`), wired via
  // the `PRESET_ID_BINDINGS` override path (Pattern C — second preset for a
  // clipKind shares the clipKind via per-presetId override; T-323's
  // `cnnClassicBinding` keeps the clipKind-default slot). Mirrors T-363 /
  // T-364 / T-365 / T-366 pattern in the caption family. Second Cluster A
  // preset to ship.

  it('routes bbc-reith-dark through the per-preset override binding (T-325 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('lower-third');
    const props = binding?.buildProps(undefined);
    expect(props?.name).toBe('Sarah Smith');
    expect(props?.title).toBe('Chief Political Correspondent');
    expect(props?.accent).toBe('#BB1919');
    expect(props?.background).toBe('#1A1A1A');
    expect(props?.textColor).toBe('#FFFFFF');
    expect(props?.insetLeftPx).toBe(64);
    expect(props?.insetBottomPx).toBe(48);
  });

  it('exports BBC_REITH_DARK_PROPS with seven canonical fields (T-325 AC #14)', () => {
    expect(BBC_REITH_DARK_PROPS).toEqual({
      name: 'Sarah Smith',
      title: 'Chief Political Correspondent',
      accent: '#BB1919',
      background: '#1A1A1A',
      textColor: '#FFFFFF',
      insetLeftPx: 64,
      insetBottomPx: 48,
    });
  });

  it('PRESET_ID_BINDINGS exposes the bbc-reith-dark override (T-325 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['bbc-reith-dark']).toBeDefined();
    expect(PRESET_ID_BINDINGS['bbc-reith-dark']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['bbc-reith-dark']?.runtimeId).toBe('frame-runtime');
  });

  it('falls through to cnnClassicBinding for cnn-classic after T-325 lands (T-325 AC #16 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'cnn-classic');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('lower-third');
    const props = binding?.buildProps(undefined);
    expect(props?.name).toBe('BREAKING: SUPREME COURT RULES');
    expect(props?.background).toBe('#FFFFFF');
  });

  it('falls through to cnnClassicBinding for unknown lowerThird presetIds after T-325 lands (T-325 AC #16 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'unknown-news-preset');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('lower-third');
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF'); // cnn-classic white banner
  });

  it('falls through to cnnClassicBinding for bare lowerThird (no presetId) after T-325 lands (T-325 AC #16)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF'); // cnn-classic clipKind-default
  });

  it('routes mrbeast-komika-axis after T-325 lands (T-325 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'mrbeast-komika-axis');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('mrbeast');
  });

  it('routes netflix-invisible after T-325 lands (T-325 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('caption', 'netflix-invisible');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('netflix');
  });

  it('routes big-number-stat-impact after T-325 lands (T-325 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('animated-value');
  });

  it('still returns undefined for unknown clipKinds after T-325 lands (T-325 AC #20)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'unknown-preset-id')).toBeUndefined();
  });

  // T-326 — third `lowerThird`-clipKind preset (`al-jazeera-orange`), wired
  // via the `PRESET_ID_BINDINGS` override path (Pattern C — second
  // `lowerThird`-keyed override after T-325; T-323's `cnnClassicBinding`
  // keeps the clipKind-default slot). Third Cluster A preset to ship.

  it('routes al-jazeera-orange through the per-preset override binding (T-326 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'al-jazeera-orange');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('lower-third');
    const props = binding?.buildProps(undefined);
    expect(props?.name).toBe('Marwan Bishara');
    expect(props?.title).toBe('Senior Political Analyst');
    expect(props?.accent).toBe('#F7941D');
    expect(props?.background).toBe('#F7F7F5');
    expect(props?.textColor).toBe('#222222');
    expect(props?.insetLeftPx).toBe(64);
    expect(props?.insetBottomPx).toBe(48);
  });

  it('exports AL_JAZEERA_ORANGE_PROPS with seven canonical fields (T-326 AC #14)', () => {
    expect(AL_JAZEERA_ORANGE_PROPS).toEqual({
      name: 'Marwan Bishara',
      title: 'Senior Political Analyst',
      accent: '#F7941D',
      background: '#F7F7F5',
      textColor: '#222222',
      insetLeftPx: 64,
      insetBottomPx: 48,
    });
  });

  it('PRESET_ID_BINDINGS exposes the al-jazeera-orange override (T-326 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['al-jazeera-orange']).toBeDefined();
    expect(PRESET_ID_BINDINGS['al-jazeera-orange']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['al-jazeera-orange']?.runtimeId).toBe('frame-runtime');
  });

  it('still routes bbc-reith-dark after T-326 lands (T-326 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#1A1A1A');
    expect(props?.accent).toBe('#BB1919');
  });

  it('falls through to cnnClassicBinding for cnn-classic after T-326 lands (T-326 AC #16 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'cnn-classic');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('lower-third');
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF');
  });

  it('falls through to cnnClassicBinding for unknown lowerThird presetIds after T-326 lands (T-326 AC #16)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'unknown-news-preset-2');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF'); // cnn-classic clipKind-default
  });

  it('falls through to cnnClassicBinding for bare lowerThird after T-326 lands (T-326 AC #16)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF'); // cnn-classic clipKind-default
  });

  it('routes al-jazeera-orange through the renderer-side override (T-326 AC #13 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('lowerThird', 'al-jazeera-orange', 'news'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('lower-third');
    expect(element.content.params).toMatchObject({
      name: 'Marwan Bishara',
      title: 'Senior Political Analyst',
      accent: '#F7941D',
      background: '#F7F7F5',
      textColor: '#222222',
      insetLeftPx: 64,
      insetBottomPx: 48,
    });
  });

  it('still returns undefined for unknown clipKinds after T-326 lands (T-326 AC #20)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'unknown-preset-id-2')).toBeUndefined();
  });

  it('routes bbc-reith-dark through the renderer-side override (T-325 AC #13 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('lowerThird', 'bbc-reith-dark', 'news'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('lower-third');
    expect(element.content.params).toMatchObject({
      name: 'Sarah Smith',
      title: 'Chief Political Correspondent',
      accent: '#BB1919',
      background: '#1A1A1A',
      textColor: '#FFFFFF',
      insetLeftPx: 64,
      insetBottomPx: 48,
    });
  });

  // T-330 — fourth `lowerThird`-clipKind preset (`apple-tv-lt`), wired via
  // the `PRESET_ID_BINDINGS` override path (Pattern C — third
  // `lowerThird`-keyed override after T-325 + T-326). Fourth Cluster A
  // preset to ship; first production consumer of T-183z's `noFlag` /
  // `subtitleColor` / `font` props.

  it('routes apple-tv-lt through the per-preset override binding (T-330 AC #14)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'apple-tv-lt');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('lower-third');
    const props = binding?.buildProps(undefined);
    expect(props?.name).toBe('Sofia Coppola');
    expect(props?.title).toBe('Director');
    expect(props?.accent).toBe('#FFFFFF');
    expect(props?.background).toBe('#000000');
    expect(props?.textColor).toBe('#FFFFFF');
    expect(props?.insetLeftPx).toBe(140);
    expect(props?.insetBottomPx).toBe(95);
    // T-183z props (first production consumer milestone)
    expect(props?.noFlag).toBe(true);
    expect(props?.subtitleColor).toBe('#FFFFFF');
    expect(props?.font).toEqual({ family: 'Inter', weight: 300 });
  });

  it('exports APPLE_TV_LT_PROPS with ten canonical fields (T-330 AC #15)', () => {
    expect(APPLE_TV_LT_PROPS).toEqual({
      name: 'Sofia Coppola',
      title: 'Director',
      accent: '#FFFFFF',
      background: '#000000',
      textColor: '#FFFFFF',
      insetLeftPx: 140,
      insetBottomPx: 95,
      noFlag: true,
      subtitleColor: '#FFFFFF',
      font: { family: 'Inter', weight: 300 },
    });
  });

  it('PRESET_ID_BINDINGS exposes the apple-tv-lt override (T-330 AC #16)', () => {
    expect(PRESET_ID_BINDINGS['apple-tv-lt']).toBeDefined();
    expect(PRESET_ID_BINDINGS['apple-tv-lt']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['apple-tv-lt']?.runtimeId).toBe('frame-runtime');
  });

  it('still routes al-jazeera-orange after T-330 lands (T-330 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'al-jazeera-orange');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#F7F7F5');
    expect(props?.accent).toBe('#F7941D');
  });

  it('still routes bbc-reith-dark after T-330 lands (T-330 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#1A1A1A');
    expect(props?.accent).toBe('#BB1919');
  });

  it('falls through to cnnClassicBinding for cnn-classic after T-330 lands (T-330 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'cnn-classic');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF');
  });

  it('falls through to cnnClassicBinding for unknown lowerThird presetIds after T-330 lands (T-330 AC #17)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'unknown-news-preset-3');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF'); // cnn-classic clipKind-default
  });

  it('falls through to cnnClassicBinding for bare lowerThird after T-330 lands (T-330 AC #17)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF'); // cnn-classic clipKind-default
  });

  it('routes apple-tv-lt through the renderer-side override (T-330 AC #14 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('lowerThird', 'apple-tv-lt', 'news'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('lower-third');
    expect(element.content.params).toMatchObject({
      name: 'Sofia Coppola',
      title: 'Director',
      accent: '#FFFFFF',
      background: '#000000',
      textColor: '#FFFFFF',
      insetLeftPx: 140,
      insetBottomPx: 95,
      noFlag: true,
      subtitleColor: '#FFFFFF',
      font: { family: 'Inter', weight: 300 },
    });
  });

  it('still returns undefined for unknown clipKinds after T-330 lands (T-330 AC #21)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'unknown-preset-id-3')).toBeUndefined();
  });

  // T-329 — fifth `lowerThird`-clipKind preset (`netflix-doc-lt`), wired via
  // the `PRESET_ID_BINDINGS` override path (Pattern C — fourth
  // `lowerThird`-keyed override after T-325 + T-326 + T-330). Fifth Cluster A
  // preset to ship; second production consumer of T-183z's `noFlag` /
  // `subtitleColor` / `font` props; canonical "headline Mixed + title ALL
  // CAPS" snapshot-string casing pattern (D-T329-6).

  it('routes netflix-doc-lt through the per-preset override binding (T-329 AC #14)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'netflix-doc-lt');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('lower-third');
    const props = binding?.buildProps(undefined);
    expect(props?.name).toBe('Ava DuVernay');
    expect(props?.title).toBe('DIRECTOR'); // literal ALL CAPS via snapshot-string casing (D-T329-6)
    expect(props?.accent).toBe('#FFFFFF');
    expect(props?.background).toBe('#000000');
    expect(props?.textColor).toBe('#FFFFFF');
    expect(props?.insetLeftPx).toBe(120);
    expect(props?.insetBottomPx).toBe(80);
    // T-183z props (second production consumer milestone)
    expect(props?.noFlag).toBe(true);
    expect(props?.subtitleColor).toBe('#FFFFFF');
    expect(props?.font).toEqual({ family: 'DM Sans', weight: 500 });
  });

  it('exports NETFLIX_DOC_LT_PROPS with ten canonical fields (T-329 AC #15)', () => {
    expect(NETFLIX_DOC_LT_PROPS).toEqual({
      name: 'Ava DuVernay',
      title: 'DIRECTOR',
      accent: '#FFFFFF',
      background: '#000000',
      textColor: '#FFFFFF',
      insetLeftPx: 120,
      insetBottomPx: 80,
      noFlag: true,
      subtitleColor: '#FFFFFF',
      font: { family: 'DM Sans', weight: 500 },
    });
  });

  it('PRESET_ID_BINDINGS exposes the netflix-doc-lt override (T-329 AC #16)', () => {
    expect(PRESET_ID_BINDINGS['netflix-doc-lt']).toBeDefined();
    expect(PRESET_ID_BINDINGS['netflix-doc-lt']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['netflix-doc-lt']?.runtimeId).toBe('frame-runtime');
  });

  it('still routes apple-tv-lt after T-329 lands (T-329 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'apple-tv-lt');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.name).toBe('Sofia Coppola');
    expect(props?.font).toEqual({ family: 'Inter', weight: 300 });
  });

  it('still routes al-jazeera-orange after T-329 lands (T-329 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'al-jazeera-orange');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#F7F7F5');
    expect(props?.accent).toBe('#F7941D');
  });

  it('still routes bbc-reith-dark after T-329 lands (T-329 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#1A1A1A');
    expect(props?.accent).toBe('#BB1919');
  });

  it('falls through to cnnClassicBinding for cnn-classic after T-329 lands (T-329 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'cnn-classic');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF');
  });

  it('falls through to cnnClassicBinding for unknown lowerThird presetIds after T-329 lands (T-329 AC #17)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'unknown-news-preset-4');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF'); // cnn-classic clipKind-default
  });

  it('falls through to cnnClassicBinding for bare lowerThird after T-329 lands (T-329 AC #17)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF'); // cnn-classic clipKind-default
  });

  it('routes netflix-doc-lt through the renderer-side override (T-329 AC #14 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('lowerThird', 'netflix-doc-lt', 'news'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('lower-third');
    expect(element.content.params).toMatchObject({
      name: 'Ava DuVernay',
      title: 'DIRECTOR',
      accent: '#FFFFFF',
      background: '#000000',
      textColor: '#FFFFFF',
      insetLeftPx: 120,
      insetBottomPx: 80,
      noFlag: true,
      subtitleColor: '#FFFFFF',
      font: { family: 'DM Sans', weight: 500 },
    });
  });

  it('still returns undefined for unknown clipKinds after T-329 lands (T-329 AC #21)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'unknown-preset-id-4')).toBeUndefined();
  });

  // T-324 — first `breakingBanner`-clipKind preset (`cnn-breaking`), wired via
  // the clipKind-default path (Pattern C — clipKind-default, NOT
  // `PRESET_ID_BINDINGS` override). Sixth Cluster A preset to ship; first
  // production consumer of the just-shipped T-324a `BreakingBanner` primitive.
  // T-327 `fox-news-alert` (next consumer) will take the `PRESET_ID_BINDINGS`
  // override path for the sliver-register variant.

  it('resolves breakingBanner to breaking-banner on the frame-runtime (T-324 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('breakingBanner');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('breaking-banner');
  });

  it('routes cnn-breaking through the breakingBanner clipKind-default (T-324 AC #15)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('breakingBanner', 'cnn-breaking');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('breaking-banner');
    const props = binding?.buildProps(undefined);
    expect(props?.headline).toBe('SUPREME COURT RULES UNANIMOUSLY');
    expect(props?.label).toEqual({ text: 'BREAKING NEWS', fill: '#CC0000', color: '#FFFFFF' });
    expect(props?.endCap).toEqual({ fill: '#CC0000', position: 'left' });
    expect(props?.background).toBe('#FFFFFF');
    expect(props?.headlineColor).toBe('#000000');
    expect(props?.mode).toBe('banner');
    expect(props?.slideAxis).toBe('horizontal');
    expect(props?.casing).toBe('uppercase');
    expect(props?.font).toEqual({ family: 'Inter Tight', weight: 800 });
    expect(props?.insetBottomPx).toBe(60);
  });

  it('exports CNN_BREAKING_PROPS with ten canonical fields (T-324 AC #14)', () => {
    expect(CNN_BREAKING_PROPS).toEqual({
      headline: 'SUPREME COURT RULES UNANIMOUSLY',
      label: { text: 'BREAKING NEWS', fill: '#CC0000', color: '#FFFFFF' },
      endCap: { fill: '#CC0000', position: 'left' },
      background: '#FFFFFF',
      headlineColor: '#000000',
      mode: 'banner',
      slideAxis: 'horizontal',
      casing: 'uppercase',
      font: { family: 'Inter Tight', weight: 800 },
      insetBottomPx: 60,
    });
  });

  it('PRESET_ID_BINDINGS does NOT contain cnn-breaking — clipKind-default only (T-324 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['cnn-breaking']).toBeUndefined();
  });

  it('falls through to cnnBreakingBinding for bare breakingBanner (T-324 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('breakingBanner');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF');
    expect(props?.mode).toBe('banner');
  });

  it('still routes cnn-classic after T-324 lands (T-324 AC #16 backward compat — lowerThird default)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'cnn-classic');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF');
    expect(props?.name).toBe('BREAKING: SUPREME COURT RULES');
  });

  it('still routes bbc-reith-dark after T-324 lands (T-324 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#1A1A1A');
    expect(props?.accent).toBe('#BB1919');
  });

  it('still routes al-jazeera-orange after T-324 lands (T-324 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'al-jazeera-orange');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#F7F7F5');
    expect(props?.accent).toBe('#F7941D');
  });

  it('still routes apple-tv-lt after T-324 lands (T-324 AC #19 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'apple-tv-lt');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.name).toBe('Sofia Coppola');
    expect(props?.font).toEqual({ family: 'Inter', weight: 300 });
  });

  it('still routes netflix-doc-lt after T-324 lands (T-324 AC #20 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'netflix-doc-lt');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.name).toBe('Ava DuVernay');
    expect(props?.font).toEqual({ family: 'DM Sans', weight: 500 });
  });

  it('still routes bigNumber / caption / lyrics / fullScreen / titleSequence / scoreBug / newsTicker / standings after T-324 lands (T-324 AC #21)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
  });

  it('still routes big-number-stat-impact via PRESET_ID_BINDINGS after T-324 lands (T-324 AC #21)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('animated-value');
  });

  it('routes cnn-breaking through the renderer-side clipKind-default (T-324 AC #13 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('breakingBanner', 'cnn-breaking', 'news'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('breaking-banner');
    expect(element.content.params).toMatchObject({
      headline: 'SUPREME COURT RULES UNANIMOUSLY',
      label: { text: 'BREAKING NEWS', fill: '#CC0000', color: '#FFFFFF' },
      endCap: { fill: '#CC0000', position: 'left' },
      background: '#FFFFFF',
      headlineColor: '#000000',
      mode: 'banner',
      slideAxis: 'horizontal',
      casing: 'uppercase',
      font: { family: 'Inter Tight', weight: 800 },
      insetBottomPx: 60,
    });
  });

  it('still returns undefined for unknown clipKinds after T-324 lands (T-324 AC #22)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'unknown-preset-id-5')).toBeUndefined();
  });

  // T-327 — second `breakingBanner`-clipKind preset (`fox-news-alert`), wired
  // via the `PRESET_ID_BINDINGS` override path (Pattern C). Seventh Cluster A
  // preset to ship; first production consumer of T-324a sliver mode +
  // vertical slide axis. The clipKind-default arm stays UNCHANGED at
  // `cnnBreakingBinding` from T-324.

  it('routes fox-news-alert through PRESET_ID_BINDINGS override (T-327 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('breakingBanner', 'fox-news-alert');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('breaking-banner');
    const props = binding?.buildProps(undefined);
    expect(props?.headline).toBe('Major Storm Watch');
    expect(props?.label).toEqual({ text: 'FOX NEWS ALERT', fill: '#C20017', color: '#FFFFFF' });
    expect(props?.background).toBe('#003366');
    expect(props?.headlineColor).toBe('#FFFFFF');
    expect(props?.mode).toBe('sliver');
    expect(props?.slideAxis).toBe('vertical');
    expect(props?.sliverAnchor).toBe('top-left');
    expect(props?.sliverWidthPct).toBe(0.3);
    expect(props?.casing).toBe('as-is');
    expect(props?.font).toEqual({ family: 'League Gothic', weight: 700 });
    // No endCap — Fox doesn't use a flag (D-T327-4)
    expect(props?.endCap).toBeUndefined();
  });

  it('exports FOX_NEWS_ALERT_PROPS with ten canonical fields and no endCap (T-327 AC #14)', () => {
    expect(FOX_NEWS_ALERT_PROPS).toEqual({
      headline: 'Major Storm Watch',
      label: { text: 'FOX NEWS ALERT', fill: '#C20017', color: '#FFFFFF' },
      background: '#003366',
      headlineColor: '#FFFFFF',
      mode: 'sliver',
      slideAxis: 'vertical',
      sliverAnchor: 'top-left',
      sliverWidthPct: 0.3,
      casing: 'as-is',
      font: { family: 'League Gothic', weight: 700 },
    });
    expect((FOX_NEWS_ALERT_PROPS as { endCap?: unknown }).endCap).toBeUndefined();
  });

  it('PRESET_ID_BINDINGS contains fox-news-alert override (T-327 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['fox-news-alert']).toBeDefined();
    expect(PRESET_ID_BINDINGS['fox-news-alert']?.clipName).toBe('breaking-banner');
  });

  it('clipKind-default for breakingBanner STILL returns cnnBreakingBinding after T-327 lands (T-327 AC #16 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('breakingBanner');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF');
    expect(props?.mode).toBe('banner');
    expect(props?.headline).toBe('SUPREME COURT RULES UNANIMOUSLY');
  });

  it('cnn-breaking STILL falls through to clipKind-default after T-327 lands (T-327 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('breakingBanner', 'cnn-breaking');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF');
    expect(props?.mode).toBe('banner');
    expect(PRESET_ID_BINDINGS['cnn-breaking']).toBeUndefined();
  });

  it('lowerThird clipKind-default STILL returns cnnClassicBinding after T-327 lands (T-327 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.name).toBe('BREAKING: SUPREME COURT RULES');
  });

  it('still routes bbc-reith-dark / al-jazeera-orange / apple-tv-lt / netflix-doc-lt via PRESET_ID_BINDINGS after T-327 lands (T-327 AC #19–22 backward compat)', () => {
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark')?.buildProps(undefined).background,
    ).toBe('#1A1A1A');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'al-jazeera-orange')?.buildProps(undefined).accent,
    ).toBe('#F7941D');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'apple-tv-lt')?.buildProps(undefined).name,
    ).toBe('Sofia Coppola');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'netflix-doc-lt')?.buildProps(undefined).name,
    ).toBe('Ava DuVernay');
  });

  it('all prior clipKind-defaults STILL resolve after T-327 lands (T-327 AC #23 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact')?.clipName).toBe(
      'animated-value',
    );
  });

  it('unknown preset id falls through to clipKind-default after T-327 lands (T-327 AC #24)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('breakingBanner', 'unknown-preset');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#FFFFFF');
    expect(props?.mode).toBe('banner');
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'unknown-preset')).toBeUndefined();
  });

  it('routes fox-news-alert through the renderer-side PRESET_ID_BINDINGS override (T-327 AC #13 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('breakingBanner', 'fox-news-alert', 'news'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('breaking-banner');
    expect(element.content.params).toMatchObject({
      headline: 'Major Storm Watch',
      label: { text: 'FOX NEWS ALERT', fill: '#C20017', color: '#FFFFFF' },
      background: '#003366',
      headlineColor: '#FFFFFF',
      mode: 'sliver',
      slideAxis: 'vertical',
      sliverAnchor: 'top-left',
      sliverWidthPct: 0.3,
      casing: 'as-is',
      font: { family: 'League Gothic', weight: 700 },
    });
  });

  // T-328 — second `fullScreen`-clipKind preset (`msnbc-big-board`), wired
  // via the `PRESET_ID_BINDINGS` override path (Pattern C). Eighth and final
  // Cluster A preset to ship; second production consumer of T-355a's
  // `magic-wall-panel` primitive (after T-355). The clipKind-default arm
  // stays UNCHANGED at `fullScreenBinding` (T-355's CNN-default magic-wall-
  // drilldown binding). Closes Cluster A to 8/8 substantive + signed.

  it('routes msnbc-big-board through PRESET_ID_BINDINGS override (T-328 AC #14)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'msnbc-big-board');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('magic-wall-panel');
    const props = binding?.buildProps(undefined);
    expect(props?.title).toBe('2024 ELECTION NIGHT');
    expect(props?.subtitle).toBe('County-level — 92% Reporting');
    expect(props?.valueFormat).toBe('count');
    expect(props?.entrance).toBe('stagger-rise');
    expect(props?.staggerMs).toBe(60);
    expect(props?.background).toBe('#0E0E12');
    expect(props?.foreground).toBe('#FFFFFF');
    const regions = props?.regions as ReadonlyArray<{ id: string; color: string }>;
    expect(regions).toHaveLength(8);
    expect(regions.map((r) => r.id)).toEqual(['CA', 'TX', 'FL', 'NY', 'PA', 'OH', 'GA', 'AZ']);
    // Each region's color comes from MSNBC_BIG_BOARD_PARTY_COLORS, not the
    // CNN canonical MAGIC_WALL_PARTY_COLORS (D-T328-4 / AC #16).
    expect(regions[0]?.color).toBe(MSNBC_BIG_BOARD_PARTY_COLORS.A); // CA — peacock blue
    expect(regions[1]?.color).toBe(MSNBC_BIG_BOARD_PARTY_COLORS.B); // TX — peacock red
    expect(regions[4]?.color).toBe(MSNBC_BIG_BOARD_PARTY_COLORS.tied); // PA — peacock purple
    expect(regions[6]?.color).toBe(MSNBC_BIG_BOARD_PARTY_COLORS.undecided); // GA — peacock gold
  });

  it('exports MSNBC_BIG_BOARD_REGIONS with eight entries mixing all four party colors (T-328 AC #15)', () => {
    expect(MSNBC_BIG_BOARD_REGIONS).toHaveLength(8);
    expect(MSNBC_BIG_BOARD_REGIONS.map((r) => r.id)).toEqual([
      'CA',
      'TX',
      'FL',
      'NY',
      'PA',
      'OH',
      'GA',
      'AZ',
    ]);
    const parties = MSNBC_BIG_BOARD_REGIONS.map((r) => r.party);
    expect(parties.filter((p) => p === 'A')).toHaveLength(3); // CA, NY, AZ
    expect(parties.filter((p) => p === 'B')).toHaveLength(3); // TX, FL, OH
    expect(parties.filter((p) => p === 'tied')).toHaveLength(1); // PA
    expect(parties.filter((p) => p === 'undecided')).toHaveLength(1); // GA
  });

  it('exports MSNBC_BIG_BOARD_PARTY_COLORS with NBC peacock-derived hues distinct from CNN canonical (T-328 AC #16)', () => {
    expect(MSNBC_BIG_BOARD_PARTY_COLORS).toEqual({
      A: '#0084CB',
      B: '#CC2229',
      tied: '#9B26B6',
      undecided: '#FCB712',
    });
    // Distinct from MAGIC_WALL_PARTY_COLORS (CNN Dem-Blue / Rep-Red /
    // tied-purple / neutral-gray) per stub line 41 (D-T328-4). None of
    // the four hex values may match CNN's canonical palette.
    const cnn = { A: '#0044CC', B: '#CC0000', tied: '#7A3FB2', undecided: '#666666' } as const;
    expect(MSNBC_BIG_BOARD_PARTY_COLORS.A).not.toBe(cnn.A);
    expect(MSNBC_BIG_BOARD_PARTY_COLORS.B).not.toBe(cnn.B);
    expect(MSNBC_BIG_BOARD_PARTY_COLORS.tied).not.toBe(cnn.tied);
    expect(MSNBC_BIG_BOARD_PARTY_COLORS.undecided).not.toBe(cnn.undecided);
  });

  it('PRESET_ID_BINDINGS contains msnbc-big-board override (T-328 AC #17)', () => {
    expect(PRESET_ID_BINDINGS['msnbc-big-board']).toBeDefined();
    expect(PRESET_ID_BINDINGS['msnbc-big-board']?.clipName).toBe('magic-wall-panel');
  });

  it('clipKind-default for fullScreen STILL returns fullScreenBinding after T-328 lands (T-328 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('magic-wall-panel');
    const props = binding?.buildProps(undefined);
    // T-355's CNN-default canonical title/subtitle, NOT MSNBC's:
    expect(props?.title).toBe('Election Results');
    expect(props?.subtitle).toBe('State-by-state breakdown');
  });

  it('magic-wall-drilldown STILL falls through to fullScreen clipKind-default after T-328 lands (T-328 AC #19 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'magic-wall-drilldown');
    expect(binding).toBeDefined();
    const props = binding?.buildProps(undefined);
    expect(props?.title).toBe('Election Results');
    expect(PRESET_ID_BINDINGS['magic-wall-drilldown']).toBeUndefined();
  });

  it('still routes prior PRESET_ID_BINDINGS overrides after T-328 lands (T-328 AC #20–26 backward compat)', () => {
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('breakingBanner', 'fox-news-alert')?.buildProps(undefined).mode,
    ).toBe('sliver');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark')?.buildProps(undefined).background,
    ).toBe('#1A1A1A');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'al-jazeera-orange')?.buildProps(undefined).accent,
    ).toBe('#F7941D');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'apple-tv-lt')?.buildProps(undefined).name,
    ).toBe('Sofia Coppola');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'netflix-doc-lt')?.buildProps(undefined).name,
    ).toBe('Ava DuVernay');
  });

  it('all prior clipKind-defaults STILL resolve after T-328 lands (T-328 AC #27 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact')?.clipName).toBe(
      'animated-value',
    );
  });

  it('unknown preset id falls through to fullScreen clipKind-default after T-328 lands (T-328 AC #28)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'unknown-preset');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'unknown-preset')).toBeUndefined();
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

  // T-333 — second `scoreBug`-clipKind preset (`premier-league-field-of-play`),
  // wired via the `PRESET_ID_BINDINGS` override path (Pattern C). First Cluster
  // B preset to land; first production consumer of T-332a's `score-bug`
  // primitive AND its `'football'` style branch. The clipKind-default arm
  // stays UNCHANGED at `scoreBugDotsBinding` (T-358's cricket-ball-by-ball-dots
  // binding via the `outcome-row` primitive — different primitive entirely).
  it('routes premier-league-field-of-play through PRESET_ID_BINDINGS override (T-333 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'premier-league-field-of-play');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('score-bug'); // kebab-case primitive kind
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('football');
    expect(props?.background).toBe('#34003A'); // PL purple
    expect(props?.foreground).toBe('#FFFFFF');
    expect(props?.clock).toBe('67:42');
    expect(props?.period).toBe('2H');
    expect(props?.casing).toBe('as-is');
    expect(props?.position).toEqual({ x: 60, y: 60 });
    expect(props?.home).toEqual({ code: 'ARS', color: '#EF0107', score: '2' });
    expect(props?.away).toEqual({ code: 'CHE', color: '#034694', score: '1' });
    expect(props?.font).toEqual({ family: 'Space Grotesk', weight: 600, tabularNums: true });
  });

  it('exports PREMIER_LEAGUE_FOP_PROPS with ten canonical fields (T-333 AC #14)', () => {
    expect(PREMIER_LEAGUE_FOP_PROPS).toEqual({
      style: 'football',
      position: { x: 60, y: 60 },
      background: '#34003A',
      foreground: '#FFFFFF',
      home: { code: 'ARS', color: '#EF0107', score: '2' },
      away: { code: 'CHE', color: '#034694', score: '1' },
      clock: '67:42',
      period: '2H',
      font: { family: 'Space Grotesk', weight: 600, tabularNums: true },
      casing: 'as-is',
    });
  });

  it('PRESET_ID_BINDINGS contains premier-league-field-of-play override (T-333 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['premier-league-field-of-play']).toBeDefined();
    expect(PRESET_ID_BINDINGS['premier-league-field-of-play']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['premier-league-field-of-play']?.runtimeId).toBe('frame-runtime');
    // Seventeen overrides total after T-338 lands (T-333 added the 12th; T-338 the 17th).
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(17);
  });

  it('binding deep-clones nested object literals so callers can mutate freely (T-333)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'premier-league-field-of-play');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      position: { x: number };
      home: { score: string };
    };
    const b = binding.buildProps(undefined) as {
      position: { x: number };
      home: { score: string };
    };
    // Mutate one returned tree; the other (and the exported constant) stay clean.
    a.position.x = 999;
    a.home.score = 'mutated';
    expect(b.position.x).toBe(60);
    expect(b.home.score).toBe('2');
    expect(PREMIER_LEAGUE_FOP_PROPS.position.x).toBe(60);
    expect(PREMIER_LEAGUE_FOP_PROPS.home.score).toBe('2');
  });

  it('clipKind-default for scoreBug STILL returns scoreBugDotsBinding after T-333 lands (T-333 AC #16 backward compat)', () => {
    // T-358 holds the `scoreBug` clipKind-default via the `outcome-row` primitive
    // with the cricket canonical over. T-333 must NOT touch that arm.
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('outcome-row');
    expect(binding?.runtimeId).toBe('frame-runtime');
  });

  it('cricket-ball-by-ball-dots STILL falls through to scoreBug clipKind-default after T-333 lands (T-333 AC #16 backward compat)', () => {
    // T-358's preset id has no override entry; Pattern C miss-fallthrough.
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-ball-by-ball-dots');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('outcome-row');
    expect(PRESET_ID_BINDINGS['cricket-ball-by-ball-dots']).toBeUndefined();
  });

  it('unknown preset id STILL falls through to scoreBug clipKind-default after T-333 lands (T-333 AC #16 / AC #19)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'unknown-preset-id');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('outcome-row');
  });

  it('still routes prior PRESET_ID_BINDINGS overrides after T-333 lands (T-333 AC #17 backward compat)', () => {
    // Every override entry that pre-existed T-333 must keep resolving.
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact')?.buildProps(undefined)
        .value,
    ).toBe(87.4);
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark')?.buildProps(undefined).background,
    ).toBe('#1A1A1A');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'al-jazeera-orange')?.buildProps(undefined).accent,
    ).toBe('#F7941D');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'apple-tv-lt')?.buildProps(undefined).name,
    ).toBe('Sofia Coppola');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'netflix-doc-lt')?.buildProps(undefined).name,
    ).toBe('Ava DuVernay');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('breakingBanner', 'fox-news-alert')?.buildProps(undefined).mode,
    ).toBe('sliver');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'msnbc-big-board')?.buildProps(undefined).title,
    ).toBe('2024 ELECTION NIGHT');
    // Caption-clipKind overrides (T-363/364/365/366) still resolve.
    expect(PRESET_ID_BINDINGS['mrbeast-komika-axis']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['tiktok-rounded-box']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['ali-abdaal-opacity-karaoke']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['netflix-invisible']?.clipName).toBe('caption');
  });

  it('all prior clipKind-defaults STILL resolve after T-333 lands (T-333 AC #18 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
  });

  it('unknown clipKind STILL returns undefined after T-333 lands (T-333 AC #19)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'premier-league-field-of-play')).toBeDefined();
    // ^ presetId override path takes precedence over the clipKind-default arm
    //   per resolver shape (lines 1402–1418); a known preset id resolves
    //   regardless of clipKind. T-360 D-T360-2 contract.
  });

  // T-334 — third `scoreBug`-clipKind preset (`fox-nfl-no-chrome`), wired
  // via the `PRESET_ID_BINDINGS` override path (Pattern C). Second Cluster
  // B preset to land; second production consumer of T-332a's `'football'`
  // style branch; first production consumer of `backdropGradient`, `down`,
  // and `possession` optional props. The clipKind-default arm stays
  // UNCHANGED at `scoreBugDotsBinding` (T-358); T-333's
  // `premierLeagueFopBinding` stays UNCHANGED.
  it('routes fox-nfl-no-chrome through PRESET_ID_BINDINGS override (T-334 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'fox-nfl-no-chrome');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('score-bug'); // kebab-case primitive kind
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('football');
    expect(props?.background).toBe('#000000'); // chromeless black base
    expect(props?.foreground).toBe('#FFFFFF');
    expect(props?.clock).toBe('04:32');
    expect(props?.period).toBe('Q3');
    expect(props?.down).toBe('3rd & 7');
    expect(props?.possession).toBe('home');
    expect(props?.casing).toBe('as-is');
    expect(props?.position).toEqual({ x: 280, y: 600 });
    expect(props?.backdropGradient).toEqual({ centerOpacity: 0.4, edgeOpacity: 0 });
    expect(props?.home).toEqual({ code: 'KC', color: '#E31837', score: '24' });
    expect(props?.away).toEqual({ code: 'PHI', color: '#004C54', score: '17' });
    expect(props?.font).toEqual({ family: 'Inter Display', weight: 900 });
  });

  it('exports FOX_NFL_NO_CHROME_PROPS with thirteen canonical fields (T-334 AC #14)', () => {
    expect(FOX_NFL_NO_CHROME_PROPS).toEqual({
      style: 'football',
      position: { x: 280, y: 600 },
      background: '#000000',
      foreground: '#FFFFFF',
      backdropGradient: { centerOpacity: 0.4, edgeOpacity: 0 },
      home: { code: 'KC', color: '#E31837', score: '24' },
      away: { code: 'PHI', color: '#004C54', score: '17' },
      clock: '04:32',
      period: 'Q3',
      down: '3rd & 7',
      possession: 'home',
      font: { family: 'Inter Display', weight: 900 },
      casing: 'as-is',
    });
  });

  it('PRESET_ID_BINDINGS contains fox-nfl-no-chrome override (T-334 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['fox-nfl-no-chrome']).toBeDefined();
    expect(PRESET_ID_BINDINGS['fox-nfl-no-chrome']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['fox-nfl-no-chrome']?.runtimeId).toBe('frame-runtime');
    // Seventeen overrides total after T-338 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(17);
  });

  it('fox-nfl-no-chrome binding deep-clones nested object literals so callers can mutate freely (T-334)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'fox-nfl-no-chrome');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      position: { x: number };
      backdropGradient: { centerOpacity: number };
      home: { score: string };
    };
    const b = binding.buildProps(undefined) as {
      position: { x: number };
      backdropGradient: { centerOpacity: number };
      home: { score: string };
    };
    a.position.x = 999;
    a.backdropGradient.centerOpacity = 0.99;
    a.home.score = 'mutated';
    expect(b.position.x).toBe(280);
    expect(b.backdropGradient.centerOpacity).toBe(0.4);
    expect(b.home.score).toBe('24');
    expect(FOX_NFL_NO_CHROME_PROPS.position.x).toBe(280);
    expect(FOX_NFL_NO_CHROME_PROPS.backdropGradient.centerOpacity).toBe(0.4);
    expect(FOX_NFL_NO_CHROME_PROPS.home.score).toBe('24');
  });

  it('T-333 premier-league-field-of-play binding STILL resolves after T-334 lands (T-334 AC #16 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'premier-league-field-of-play');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('score-bug');
    const props = binding?.buildProps(undefined);
    expect(props?.background).toBe('#34003A');
    expect(props?.home).toEqual({ code: 'ARS', color: '#EF0107', score: '2' });
  });

  it('clipKind-default for scoreBug STILL returns scoreBugDotsBinding after T-334 lands (T-334 AC #17 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-ball-by-ball-dots')?.clipName).toBe(
      'outcome-row',
    );
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'unknown-preset-id')?.clipName).toBe(
      'outcome-row',
    );
  });

  it('still routes prior PRESET_ID_BINDINGS overrides after T-334 lands (T-334 AC #18 backward compat)', () => {
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact')?.buildProps(undefined)
        .value,
    ).toBe(87.4);
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark')?.buildProps(undefined).background,
    ).toBe('#1A1A1A');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('breakingBanner', 'fox-news-alert')?.buildProps(undefined).mode,
    ).toBe('sliver');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'msnbc-big-board')?.buildProps(undefined).title,
    ).toBe('2024 ELECTION NIGHT');
    expect(PRESET_ID_BINDINGS['mrbeast-komika-axis']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['premier-league-field-of-play']?.clipName).toBe('score-bug');
  });

  it('all prior clipKind-defaults STILL resolve after T-334 lands (T-334 AC #19 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
  });

  it('unknown clipKind STILL returns undefined after T-334 lands (T-334 AC #20)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'fox-nfl-no-chrome')).toBeDefined();
  });

  // T-335 — fourth `scoreBug`-clipKind preset (`nbc-snf-possession-illuminated`),
  // wired via the `PRESET_ID_BINDINGS` override path (Pattern C). Third
  // Cluster B preset to land; third production consumer of T-332a's
  // `'football'` style branch; first production consumer of `centerCircle`,
  // `direction`, and `networkLogo` optional props; second production
  // consumer of `down` + `possession`. The clipKind-default arm stays
  // UNCHANGED at `scoreBugDotsBinding` (T-358); T-333's
  // `premierLeagueFopBinding` + T-334's `foxNflNoChromeBinding` stay
  // UNCHANGED.
  it('routes nbc-snf-possession-illuminated through PRESET_ID_BINDINGS override (T-335 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'nbc-snf-possession-illuminated');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('score-bug'); // kebab-case primitive kind
    const props = binding?.buildProps(undefined);
    expect(props?.style).toBe('football');
    expect(props?.background).toBe('#0A0A0A'); // NBC SNF dark base
    expect(props?.foreground).toBe('#FFFFFF');
    expect(props?.clock).toBe('08:14');
    expect(props?.period).toBe('Q2');
    expect(props?.down).toBe('<< 1st & 10');
    expect(props?.direction).toBe('left-to-right');
    expect(props?.possession).toBe('home');
    expect(props?.centerCircle).toBe(true);
    expect(props?.networkLogo).toBe('NBC');
    expect(props?.casing).toBe('as-is');
    expect(props?.position).toEqual({ x: 280, y: 600 });
    expect(props?.home).toEqual({ code: 'KC', color: '#E31837', score: '21' });
    expect(props?.away).toEqual({ code: 'BUF', color: '#00338D', score: '14' });
    expect(props?.font).toEqual({ family: 'Public Sans', weight: 600 });
  });

  it('exports NBC_SNF_PROPS with fourteen canonical fields (T-335 AC #14)', () => {
    expect(NBC_SNF_PROPS).toEqual({
      style: 'football',
      position: { x: 280, y: 600 },
      background: '#0A0A0A',
      foreground: '#FFFFFF',
      home: { code: 'KC', color: '#E31837', score: '21' },
      away: { code: 'BUF', color: '#00338D', score: '14' },
      clock: '08:14',
      period: 'Q2',
      down: '<< 1st & 10',
      direction: 'left-to-right',
      possession: 'home',
      centerCircle: true,
      networkLogo: 'NBC',
      font: { family: 'Public Sans', weight: 600 },
      casing: 'as-is',
    });
  });

  it('PRESET_ID_BINDINGS contains nbc-snf-possession-illuminated override (T-335 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['nbc-snf-possession-illuminated']).toBeDefined();
    expect(PRESET_ID_BINDINGS['nbc-snf-possession-illuminated']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['nbc-snf-possession-illuminated']?.runtimeId).toBe('frame-runtime');
    // Seventeen overrides total after T-338 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(17);
  });

  it('nbc-snf-possession-illuminated binding deep-clones nested object literals so callers can mutate freely (T-335)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'nbc-snf-possession-illuminated');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      position: { x: number };
      home: { score: string };
      font: { weight: number };
    };
    const b = binding.buildProps(undefined) as {
      position: { x: number };
      home: { score: string };
      font: { weight: number };
    };
    a.position.x = 999;
    a.home.score = 'mutated';
    a.font.weight = 1;
    expect(b.position.x).toBe(280);
    expect(b.home.score).toBe('21');
    expect(b.font.weight).toBe(600);
    expect(NBC_SNF_PROPS.position.x).toBe(280);
    expect(NBC_SNF_PROPS.home.score).toBe('21');
    expect(NBC_SNF_PROPS.font.weight).toBe(600);
  });

  it('T-333 + T-334 bindings STILL resolve after T-335 lands (T-335 AC #16, #17 backward compat)', () => {
    const pl = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'premier-league-field-of-play');
    expect(pl?.clipName).toBe('score-bug');
    expect(pl?.buildProps(undefined).background).toBe('#34003A');
    expect(pl?.buildProps(undefined).home).toEqual({ code: 'ARS', color: '#EF0107', score: '2' });
    const fox = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'fox-nfl-no-chrome');
    expect(fox?.clipName).toBe('score-bug');
    expect(fox?.buildProps(undefined).background).toBe('#000000');
    expect(fox?.buildProps(undefined).home).toEqual({ code: 'KC', color: '#E31837', score: '24' });
  });

  it('clipKind-default for scoreBug STILL returns scoreBugDotsBinding after T-335 lands (T-335 AC #18 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug');
    expect(binding?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-ball-by-ball-dots')?.clipName).toBe(
      'outcome-row',
    );
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'unknown-preset-id')?.clipName).toBe(
      'outcome-row',
    );
  });

  it('still routes prior PRESET_ID_BINDINGS overrides after T-335 lands (T-335 AC #19 backward compat)', () => {
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact')?.buildProps(undefined)
        .value,
    ).toBe(87.4);
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'bbc-reith-dark')?.buildProps(undefined).background,
    ).toBe('#1A1A1A');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('breakingBanner', 'fox-news-alert')?.buildProps(undefined).mode,
    ).toBe('sliver');
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'msnbc-big-board')?.buildProps(undefined).title,
    ).toBe('2024 ELECTION NIGHT');
    expect(PRESET_ID_BINDINGS['mrbeast-komika-axis']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['premier-league-field-of-play']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['fox-nfl-no-chrome']?.clipName).toBe('score-bug');
  });

  it('all prior clipKind-defaults STILL resolve after T-335 lands (T-335 AC #20 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'nbc-snf-possession-illuminated'),
    ).toBeDefined();
  });

  // T-339a — second `newsTicker`-clipKind preset (`espn-bottomline-flipper`),
  // wired via the `PRESET_ID_BINDINGS` override path (Pattern C). Fourth
  // Cluster B preset to land; first non-`scoreBug`-clipKind Cluster B
  // preset; first production consumer of T-356b's `mode: 'flip'`
  // two-row stacked register on the `news-ticker-bar` primitive. The
  // clipKind-default arm stays UNCHANGED at `newsTickerBinding` (T-356);
  // T-333 / T-334 / T-335 scoreBug overrides stay UNCHANGED.
  it('routes espn-bottomline-flipper through PRESET_ID_BINDINGS override (T-339a AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('newsTicker', 'espn-bottomline-flipper');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('news-ticker-bar'); // kebab-case primitive kind (T-356a)
    const props = binding?.buildProps(undefined);
    expect(props?.mode).toBe('flip');
    expect(props?.flipDurationMs).toBe(4500);
    expect(props?.bandHeight).toBe(100);
    expect(props?.bandPosition).toBe('bottom');
    expect(props?.background).toBe('#1A1A1A');
    expect(props?.foreground).toBe('#FFFFFF');
    expect(props?.upColor).toBe('#FFD700');
    expect(props?.downColor).toBe('#CC0000');
    expect(props?.flatColor).toBe('#FFFFFF');
    expect(props?.entries).toEqual([
      { symbol: 'NYK', price: '102', delta: '+5', direction: 'up' },
      { symbol: 'BOS', price: '97', delta: 'F', direction: 'flat' },
      { symbol: 'LAL', price: '88', delta: '-3', direction: 'down' },
      { symbol: 'PHX', price: '91', delta: 'F', direction: 'flat' },
      { symbol: 'PHI', price: '24', delta: '+2', direction: 'up' },
      { symbol: 'DAL', price: '22', delta: 'F', direction: 'flat' },
    ]);
  });

  it('exports ESPN_BOTTOMLINE_PROPS with ten canonical fields (T-339a AC #14)', () => {
    expect(ESPN_BOTTOMLINE_PROPS).toEqual({
      entries: [
        { symbol: 'NYK', price: '102', delta: '+5', direction: 'up' },
        { symbol: 'BOS', price: '97', delta: 'F', direction: 'flat' },
        { symbol: 'LAL', price: '88', delta: '-3', direction: 'down' },
        { symbol: 'PHX', price: '91', delta: 'F', direction: 'flat' },
        { symbol: 'PHI', price: '24', delta: '+2', direction: 'up' },
        { symbol: 'DAL', price: '22', delta: 'F', direction: 'flat' },
      ],
      mode: 'flip',
      flipDurationMs: 4500,
      bandHeight: 100,
      bandPosition: 'bottom',
      background: '#1A1A1A',
      foreground: '#FFFFFF',
      upColor: '#FFD700',
      downColor: '#CC0000',
      flatColor: '#FFFFFF',
    });
  });

  it('PRESET_ID_BINDINGS contains espn-bottomline-flipper override (T-339a AC #15)', () => {
    expect(PRESET_ID_BINDINGS['espn-bottomline-flipper']).toBeDefined();
    expect(PRESET_ID_BINDINGS['espn-bottomline-flipper']?.clipName).toBe('news-ticker-bar');
    expect(PRESET_ID_BINDINGS['espn-bottomline-flipper']?.runtimeId).toBe('frame-runtime');
    // Seventeen overrides total after T-338 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(17);
  });

  it('espn-bottomline-flipper binding deep-clones the entries array so callers can mutate freely (T-339a)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('newsTicker', 'espn-bottomline-flipper');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      entries: Array<{ symbol: string; price: string }>;
    };
    const b = binding.buildProps(undefined) as {
      entries: Array<{ symbol: string; price: string }>;
    };
    const aFirst = a.entries[0];
    if (!aFirst) throw new Error('test setup');
    aFirst.symbol = 'MUT';
    aFirst.price = 'mutated';
    a.entries.push({ symbol: 'X', price: 'X' } as never);
    expect(b.entries[0]?.symbol).toBe('NYK');
    expect(b.entries[0]?.price).toBe('102');
    expect(b.entries).toHaveLength(6);
    expect(ESPN_BOTTOMLINE_PROPS.entries[0]?.symbol).toBe('NYK');
    expect(ESPN_BOTTOMLINE_PROPS.entries[0]?.price).toBe('102');
    expect(ESPN_BOTTOMLINE_PROPS.entries).toHaveLength(6);
  });

  it('clipKind-default for newsTicker STILL returns newsTickerBinding after T-339a lands (T-339a AC #16 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('newsTicker');
    expect(binding?.clipName).toBe('news-ticker-bar');
    // T-356 bloomberg-ticker has NO PRESET_ID_BINDINGS entry — falls through
    // to clipKind-default arm (newsTickerBinding); resolver returns the
    // bloomberg-canonical scroll-mode shape, NOT the espn flip-mode shape.
    const bloomberg = DEFAULT_CLIP_KIND_RESOLVER('newsTicker', 'bloomberg-ticker');
    expect(bloomberg?.clipName).toBe('news-ticker-bar');
    expect(bloomberg?.buildProps(undefined).mode).toBeUndefined();
    expect(bloomberg?.buildProps(undefined).background).toBe('#0A0A0A');
    const unknown = DEFAULT_CLIP_KIND_RESOLVER('newsTicker', 'unknown-preset-id');
    expect(unknown?.clipName).toBe('news-ticker-bar');
    expect(unknown?.buildProps(undefined).mode).toBeUndefined();
  });

  it('T-333 / T-334 / T-335 scoreBug overrides STILL resolve after T-339a lands (T-339a AC #17 backward compat)', () => {
    const pl = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'premier-league-field-of-play');
    expect(pl?.clipName).toBe('score-bug');
    expect(pl?.buildProps(undefined).background).toBe('#34003A');
    const fox = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'fox-nfl-no-chrome');
    expect(fox?.clipName).toBe('score-bug');
    expect(fox?.buildProps(undefined).background).toBe('#000000');
    const nbc = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'nbc-snf-possession-illuminated');
    expect(nbc?.clipName).toBe('score-bug');
    expect(nbc?.buildProps(undefined).background).toBe('#0A0A0A');
    expect(nbc?.buildProps(undefined).networkLogo).toBe('NBC');
  });

  it('clipKind-default for scoreBug STILL returns scoreBugDotsBinding after T-339a lands (T-339a AC #18 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-ball-by-ball-dots')?.clipName).toBe(
      'outcome-row',
    );
  });

  it('still routes prior PRESET_ID_BINDINGS overrides after T-339a lands (T-339a AC #19 backward compat)', () => {
    expect(
      DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact')?.buildProps(undefined)
        .value,
    ).toBe(87.4);
    expect(PRESET_ID_BINDINGS['mrbeast-komika-axis']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['tiktok-rounded-box']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['ali-abdaal-opacity-karaoke']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['netflix-invisible']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['bbc-reith-dark']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['al-jazeera-orange']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['apple-tv-lt']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['netflix-doc-lt']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['fox-news-alert']?.clipName).toBe('breaking-banner');
    expect(PRESET_ID_BINDINGS['msnbc-big-board']?.clipName).toBe('magic-wall-panel');
    expect(PRESET_ID_BINDINGS['premier-league-field-of-play']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['fox-nfl-no-chrome']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['nbc-snf-possession-illuminated']?.clipName).toBe('score-bug');
  });

  it('all prior clipKind-defaults STILL resolve after T-339a lands (T-339a AC #20 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'espn-bottomline-flipper')).toBeDefined();
  });

  // T-337 — fifth Cluster B preset (`wimbledon-green-purple`), wired via the
  // `PRESET_ID_BINDINGS` override path (Pattern C). Sixth `scoreBug` clipKind
  // consumer; fourth `score-bug` primitive consumer; FIRST production
  // consumer of T-332a's `'tennis'` style branch (2-player stack with
  // country code + seed + N set columns + game score + active-server dot).
  // The clipKind-default arm stays UNCHANGED at `scoreBugDotsBinding`
  // (T-358); T-333 / T-334 / T-335 / T-339a prior overrides UNCHANGED.
  it('routes wimbledon-green-purple through PRESET_ID_BINDINGS override (T-337 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'wimbledon-green-purple');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('score-bug'); // kebab-case primitive kind (T-332a line 686)
    const props = binding?.buildProps(undefined) as typeof WIMBLEDON_PROPS;
    expect(props.style).toBe('tennis');
    expect(props.position).toEqual({ x: 60, y: 580 });
    expect(props.background).toBe('#006633');
    expect(props.accent).toBe('#4B0082');
    expect(props.foreground).toBe('#FFFFFF');
    expect(props.activeServerIndex).toBe(0);
    expect(props.anchor).toBe('bottom-left');
    expect(props.casing).toBe('as-is');
    expect(props.font).toEqual({ family: 'Montserrat', weight: 500 });
    expect(props.players).toHaveLength(2);
    expect(props.players[0]).toEqual({
      surname: 'Djokovic',
      countryCode: 'SRB',
      seed: 1,
      sets: ['6', '4', '7-6'],
      gameScore: '40',
    });
    expect(props.players[1]).toEqual({
      surname: 'Alcaraz',
      countryCode: 'ESP',
      seed: 2,
      sets: ['4', '6', '6-7'],
      gameScore: '30',
    });
  });

  it('exports WIMBLEDON_PROPS with canonical Wimbledon final mid-match values (T-337 AC #14)', () => {
    expect(WIMBLEDON_PROPS).toEqual({
      style: 'tennis',
      position: { x: 60, y: 580 },
      background: '#006633',
      accent: '#4B0082',
      foreground: '#FFFFFF',
      players: [
        {
          surname: 'Djokovic',
          countryCode: 'SRB',
          seed: 1,
          sets: ['6', '4', '7-6'],
          gameScore: '40',
        },
        {
          surname: 'Alcaraz',
          countryCode: 'ESP',
          seed: 2,
          sets: ['4', '6', '6-7'],
          gameScore: '30',
        },
      ],
      activeServerIndex: 0,
      anchor: 'bottom-left',
      font: { family: 'Montserrat', weight: 500 },
      casing: 'as-is',
    });
    // Per Zod schema `z.array(tennisPlayerSchema).length(2)` — exactly 2.
    expect(WIMBLEDON_PROPS.players).toHaveLength(2);
    expect(WIMBLEDON_PROPS.players[0].sets).toHaveLength(3);
    expect(WIMBLEDON_PROPS.players[1].sets).toHaveLength(3);
  });

  it('PRESET_ID_BINDINGS contains wimbledon-green-purple override (T-337 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['wimbledon-green-purple']).toBeDefined();
    expect(PRESET_ID_BINDINGS['wimbledon-green-purple']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['wimbledon-green-purple']?.runtimeId).toBe('frame-runtime');
    // Seventeen overrides total after T-338 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(17);
  });

  it('wimbledon-green-purple binding deep-clones nested objects + players tuple + sets arrays (T-337)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'wimbledon-green-purple');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      position: { x: number; y: number };
      players: Array<{ surname: string; sets: string[] }>;
      font: { family: string; weight: number };
    };
    const b = binding.buildProps(undefined) as {
      position: { x: number; y: number };
      players: Array<{ surname: string; sets: string[] }>;
      font: { family: string; weight: number };
    };
    a.position.x = 999;
    const aPlayer0 = a.players[0];
    if (!aPlayer0) throw new Error('test setup');
    aPlayer0.surname = 'MUT';
    aPlayer0.sets[0] = 'MUT';
    a.font.weight = 999;
    expect(b.position.x).toBe(60);
    expect(b.players[0]?.surname).toBe('Djokovic');
    expect(b.players[0]?.sets[0]).toBe('6');
    expect(b.font.weight).toBe(500);
    expect(WIMBLEDON_PROPS.position.x).toBe(60);
    expect(WIMBLEDON_PROPS.players[0].surname).toBe('Djokovic');
    expect(WIMBLEDON_PROPS.players[0].sets[0]).toBe('6');
    expect(WIMBLEDON_PROPS.font.weight).toBe(500);
  });

  it('clipKind-default for scoreBug STILL returns scoreBugDotsBinding after T-337 lands (T-337 AC #19 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-ball-by-ball-dots')?.clipName).toBe(
      'outcome-row',
    );
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'unknown-preset-id')?.clipName).toBe(
      'outcome-row',
    );
  });

  it('T-333 / T-334 / T-335 scoreBug overrides STILL resolve after T-337 lands (T-337 AC #16-18 backward compat)', () => {
    const pl = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'premier-league-field-of-play');
    expect(pl?.clipName).toBe('score-bug');
    expect(pl?.buildProps(undefined).background).toBe('#34003A');
    const fox = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'fox-nfl-no-chrome');
    expect(fox?.clipName).toBe('score-bug');
    expect(fox?.buildProps(undefined).background).toBe('#000000');
    const nbc = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'nbc-snf-possession-illuminated');
    expect(nbc?.clipName).toBe('score-bug');
    expect(nbc?.buildProps(undefined).background).toBe('#0A0A0A');
  });

  it('still routes prior PRESET_ID_BINDINGS overrides after T-337 lands (T-337 AC #20 backward compat)', () => {
    expect(PRESET_ID_BINDINGS['big-number-stat-impact']?.clipName).toBe('animated-value');
    expect(PRESET_ID_BINDINGS['mrbeast-komika-axis']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['tiktok-rounded-box']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['ali-abdaal-opacity-karaoke']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['netflix-invisible']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['bbc-reith-dark']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['al-jazeera-orange']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['apple-tv-lt']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['netflix-doc-lt']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['fox-news-alert']?.clipName).toBe('breaking-banner');
    expect(PRESET_ID_BINDINGS['msnbc-big-board']?.clipName).toBe('magic-wall-panel');
    expect(PRESET_ID_BINDINGS['premier-league-field-of-play']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['fox-nfl-no-chrome']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['nbc-snf-possession-illuminated']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['espn-bottomline-flipper']?.clipName).toBe('news-ticker-bar');
  });

  it('all prior clipKind-defaults STILL resolve after T-337 lands (T-337 AC #21 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'wimbledon-green-purple')).toBeDefined();
  });

  // T-338 — sixth Cluster B preset (`masters-red-under-par`), wired via the
  // `PRESET_ID_BINDINGS` override path (Pattern C). Second `standings`
  // clipKind consumer; FIRST `standings`-keyed `PRESET_ID_BINDINGS` override
  // (T-357 olympic-medal-tracker holds the clipKind-default slot via
  // `standingsBinding`). The clipKind-default arm stays UNCHANGED at
  // `standingsBinding` (T-357); T-333 / T-334 / T-335 / T-337 / T-339a prior
  // overrides UNCHANGED.
  it('routes masters-red-under-par through PRESET_ID_BINDINGS override (T-338 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('standings', 'masters-red-under-par');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('standings-table'); // kebab-case primitive kind (T-357a line 352)
    const props = binding?.buildProps(undefined) as {
      rows: Array<{ rank: number; code: string; values: number[] }>;
      columns: Array<{ key: string; kind: string; color?: string }>;
      background: string;
      foreground: string;
      goldColor: string;
      bandPosition: string;
      rowHeight: number;
      headerHeight: number;
      staggerMs: number;
    };
    expect(props.rows).toHaveLength(5);
    expect(props.columns).toHaveLength(5);
    expect(props.background).toBe('#0E0E12');
    expect(props.foreground).toBe('#FFFFFF');
    expect(props.goldColor).toBe('#006747');
    expect(props.bandPosition).toBe('overlay');
    expect(props.rowHeight).toBe(64);
    expect(props.headerHeight).toBe(48);
    expect(props.staggerMs).toBe(80);
    expect(props.rows[0]).toEqual({ rank: 1, code: 'Scheffler', values: [-12, 18] });
    expect(props.rows[1]).toEqual({ rank: 2, code: 'McIlroy', values: [-10, 17] });
    expect(props.rows[2]).toEqual({ rank: 3, code: 'Schauffele', values: [-8, 18] });
    expect(props.rows[3]).toEqual({ rank: 4, code: 'Spieth', values: [0, 18] });
    expect(props.rows[4]).toEqual({ rank: 5, code: 'Bryson', values: [2, 15] });
    expect(props.columns[0]).toEqual({
      key: 'rank',
      label: '#',
      kind: 'rank',
      width: 56,
      color: '#006747',
    });
    expect(props.columns[1]).toEqual({ key: 'name', label: 'PLAYER', kind: 'label', flex: 2 });
    expect(props.columns[2]).toEqual({ key: 'score', label: 'TO PAR', kind: 'numeric' });
    expect(props.columns[3]).toEqual({ key: 'thru', label: 'THRU', kind: 'numeric' });
    expect(props.columns[4]).toEqual({ key: 'total', label: '', kind: 'total', width: 0 });
  });

  it('exports MASTERS_PROPS with canonical Masters mid-round leaderboard values (T-338 AC #14)', () => {
    expect(MASTERS_PROPS.rows).toHaveLength(5);
    expect(MASTERS_PROPS.rows[0]?.code).toBe('Scheffler');
    expect(MASTERS_PROPS.rows[0]?.values[0]).toBe(-12);
    expect(MASTERS_PROPS.rows[1]?.code).toBe('McIlroy');
    expect(MASTERS_PROPS.rows[2]?.code).toBe('Schauffele');
    expect(MASTERS_PROPS.rows[3]?.code).toBe('Spieth');
    expect(MASTERS_PROPS.rows[3]?.values[0]).toBe(0);
    expect(MASTERS_PROPS.rows[4]?.code).toBe('Bryson');
    expect(MASTERS_PROPS.rows[4]?.values[0]).toBe(2);
    expect(MASTERS_PROPS.columns).toHaveLength(5);
    expect(MASTERS_PROPS.columns[0]?.kind).toBe('rank');
    expect(MASTERS_PROPS.columns[0]?.color).toBe('#006747');
    expect(MASTERS_PROPS.columns[1]?.kind).toBe('label');
    expect(MASTERS_PROPS.columns[1]?.key).toBe('name');
    expect(MASTERS_PROPS.columns[2]?.kind).toBe('numeric');
    expect(MASTERS_PROPS.columns[2]?.key).toBe('score');
    expect(MASTERS_PROPS.columns[3]?.kind).toBe('numeric');
    expect(MASTERS_PROPS.columns[3]?.key).toBe('thru');
    expect(MASTERS_PROPS.goldColor).toBe('#006747');
    expect(MASTERS_PROPS.background).toBe('#0E0E12');
    expect(MASTERS_PROPS.foreground).toBe('#FFFFFF');
  });

  it('PRESET_ID_BINDINGS contains masters-red-under-par override (T-338 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['masters-red-under-par']).toBeDefined();
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.runtimeId).toBe('frame-runtime');
    // Seventeen overrides total after T-338 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(17);
  });

  it('masters-red-under-par binding deep-clones rows + columns + values arrays (T-338)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('standings', 'masters-red-under-par');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      rows: Array<{ rank: number; code: string; values: number[] }>;
      columns: Array<{ key: string; color?: string }>;
    };
    const b = binding.buildProps(undefined) as {
      rows: Array<{ rank: number; code: string; values: number[] }>;
      columns: Array<{ key: string; color?: string }>;
    };
    const aRow0 = a.rows[0];
    const aCol0 = a.columns[0];
    if (!aRow0 || !aCol0) throw new Error('test setup');
    aRow0.code = 'MUT';
    aRow0.values[0] = 999;
    aCol0.color = '#000000';
    expect(b.rows[0]?.code).toBe('Scheffler');
    expect(b.rows[0]?.values[0]).toBe(-12);
    expect(b.columns[0]?.color).toBe('#006747');
    expect(MASTERS_PROPS.rows[0]?.code).toBe('Scheffler');
    expect(MASTERS_PROPS.rows[0]?.values[0]).toBe(-12);
    expect(MASTERS_PROPS.columns[0]?.color).toBe('#006747');
  });

  it('clipKind-default for standings STILL returns standingsBinding after T-338 lands (T-338 AC #16 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    // T-357 olympic-medal-tracker has NO PRESET_ID_BINDINGS entry; falls through.
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings', 'olympic-medal-tracker')?.clipName).toBe(
      'standings-table',
    );
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings', 'unknown-preset-id')?.clipName).toBe(
      'standings-table',
    );
    // The `standings` clipKind-default binding is `standingsBinding` (T-357),
    // not `mastersRedUnderParBinding`. Both share `clipName: 'standings-table'`
    // but have different snapshot props (Olympic 5-row medal table vs Masters
    // 5-row golf leaderboard). Distinguish via the rows[].code field.
    const oly = DEFAULT_CLIP_KIND_RESOLVER('standings');
    const olyProps = oly?.buildProps(undefined) as {
      rows: Array<{ code: string }>;
    };
    expect(olyProps.rows[0]?.code).toBe('USA');
    const masters = DEFAULT_CLIP_KIND_RESOLVER('standings', 'masters-red-under-par');
    const mastersProps = masters?.buildProps(undefined) as {
      rows: Array<{ code: string }>;
    };
    expect(mastersProps.rows[0]?.code).toBe('Scheffler');
  });

  it('T-333 / T-334 / T-335 / T-337 / T-339a prior overrides STILL resolve after T-338 lands (T-338 AC #17-22 backward compat)', () => {
    const pl = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'premier-league-field-of-play');
    expect(pl?.clipName).toBe('score-bug');
    const fox = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'fox-nfl-no-chrome');
    expect(fox?.clipName).toBe('score-bug');
    const nbc = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'nbc-snf-possession-illuminated');
    expect(nbc?.clipName).toBe('score-bug');
    const wim = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'wimbledon-green-purple');
    expect(wim?.clipName).toBe('score-bug');
    const espn = DEFAULT_CLIP_KIND_RESOLVER('newsTicker', 'espn-bottomline-flipper');
    expect(espn?.clipName).toBe('news-ticker-bar');
    // T-358 cricket clipKind-default for scoreBug also unchanged.
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-ball-by-ball-dots')?.clipName).toBe(
      'outcome-row',
    );
  });

  it('still routes prior PRESET_ID_BINDINGS overrides after T-338 lands (T-338 AC #22 backward compat)', () => {
    expect(PRESET_ID_BINDINGS['big-number-stat-impact']?.clipName).toBe('animated-value');
    expect(PRESET_ID_BINDINGS['mrbeast-komika-axis']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['tiktok-rounded-box']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['ali-abdaal-opacity-karaoke']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['netflix-invisible']?.clipName).toBe('caption');
    expect(PRESET_ID_BINDINGS['bbc-reith-dark']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['al-jazeera-orange']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['apple-tv-lt']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['netflix-doc-lt']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['fox-news-alert']?.clipName).toBe('breaking-banner');
    expect(PRESET_ID_BINDINGS['msnbc-big-board']?.clipName).toBe('magic-wall-panel');
    expect(PRESET_ID_BINDINGS['premier-league-field-of-play']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['fox-nfl-no-chrome']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['nbc-snf-possession-illuminated']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['espn-bottomline-flipper']?.clipName).toBe('news-ticker-bar');
    expect(PRESET_ID_BINDINGS['wimbledon-green-purple']?.clipName).toBe('score-bug');
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
