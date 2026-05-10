// packages/parity-cli/src/generate-fixture.test.ts
// Tests for the production-renderer binding (T-359a). Uses a stub
// `PrimeRenderFn` (no Chrome / ffmpeg dependency).

import { rirDocumentSchema } from '@stageflip/rir';
import {
  grainPropsSchema,
  lightLeakPropsSchema,
  particlesPropsSchema,
  photographicOverlayPropsSchema,
  titleSequencePropsSchema,
} from '@stageflip/runtimes-frame-runtime-bridge';
import { describe, expect, it, vi } from 'vitest';

import {
  ALI_ABDAAL_CANONICAL_WORDS,
  AL_JAZEERA_ORANGE_PROPS,
  APPLE_TV_LT_PROPS,
  BBC_REITH_DARK_PROPS,
  BLOOMBERG_CANONICAL_SNAPSHOT,
  CNN_BREAKING_PROPS,
  CNN_CLASSIC_PROPS,
  COINBASE_DVD_QR_MATRIX,
  COINBASE_DVD_QR_PROPS,
  CRICKET_OUTCOME_COLORS,
  CRICKET_SCOREBUG_PROPS,
  DEFAULT_CLIP_KIND_RESOLVER,
  ESPN_BOTTOMLINE_PROPS,
  F1_SECTOR_STATE_COLORS,
  F1_TIMING_TOWER_PROPS,
  FOX_NEWS_ALERT_PROPS,
  FOX_NFL_NO_CHROME_PROPS,
  GOT_TRAJAN_CLOCKWORK_GRAIN_PROPS,
  GOT_TRAJAN_CLOCKWORK_PHOTOGRAPHIC_OVERLAY_PROPS,
  GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS,
  GenerateFixtureUnavailableError,
  HAWKEYE_VAR_SKELETAL_PALETTE,
  HORMOZI_CANONICAL_WORDS,
  INSTAGRAM_LINK_STICKER_PROPS,
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
  SEVERANCE_SURREAL_3D_GRAIN_PROPS,
  SEVERANCE_SURREAL_3D_PHOTOGRAPHIC_OVERLAY_PROPS,
  SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS,
  SKY_SPORTS_AR_FORMATIONS_PALETTE,
  SOCIAL_HANDLE_LOWER_THIRD_PROPS,
  SQUID_GAME_GEOMETRIC_SHOTS,
  STRANGER_GRAIN_PROPS,
  STRANGER_LIGHT_LEAK_PROPS,
  STRANGER_PARTICLES_PROPS,
  STRANGER_PHOTOGRAPHIC_OVERLAY_PROPS,
  STRANGER_TITLE_SEQUENCE_PROPS,
  SUCCESSION_HOME_VIDEO_GRAIN_PROPS,
  SUCCESSION_HOME_VIDEO_PHOTOGRAPHIC_OVERLAY_PROPS,
  SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS,
  TIKTOK_CANONICAL_WORDS,
  TIKTOK_FOLLOW_PULSE_PROPS,
  TRUE_DETECTIVE_GRAIN_PROPS,
  TRUE_DETECTIVE_PHOTOGRAPHIC_OVERLAY_PROPS,
  TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS,
  UEFA_STARBALL_PALETTE,
  UEFA_STARBALL_REGIONS,
  WIMBLEDON_PROPS,
  YOUTUBE_SUBSCRIBE_BOUNCE_PROPS,
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
    // Eighteen overrides total after T-332 lands (T-333 added the 12th; T-338 the 17th; T-332 the 18th).
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
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
    // Eighteen overrides total after T-332 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
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
    // Eighteen overrides total after T-332 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
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
    // Eighteen overrides total after T-332 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
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
    // Eighteen overrides total after T-332 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
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
    // Eighteen overrides total after T-332 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
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

  // T-332 — seventh Cluster B preset (`f1-timing-tower`), wired via the
  // `PRESET_ID_BINDINGS` override path (Pattern C). Seventh `scoreBug`
  // clipKind consumer; FIRST production consumer of T-332a's `'racing'`
  // style branch (vertical N-driver tower with team-color stripes + sector
  // colors + tire compounds + truncated gap times). Closes the T-332a
  // primitive's production-consumer matrix to all 4 styles exercised. The
  // clipKind-default arm stays UNCHANGED at `scoreBugDotsBinding` (T-358);
  // T-333 / T-334 / T-335 / T-337 / T-339a / T-338 prior overrides UNCHANGED.
  it('routes f1-timing-tower through PRESET_ID_BINDINGS override (T-332 AC #10)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'f1-timing-tower');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('score-bug'); // kebab-case primitive kind (T-332a line 686)
    const props = binding?.buildProps(undefined) as typeof F1_TIMING_TOWER_PROPS;
    expect(props.style).toBe('racing');
    expect(props.position).toEqual({ x: 60, y: 60 });
    expect(props.background).toBe('#0D0D0F');
    expect(props.foreground).toBe('#FFFFFF');
    expect(props.casing).toBe('as-is');
    expect(props.font).toEqual({ family: 'Barlow Condensed', weight: 600 });
    expect(props.rows).toHaveLength(20);
    expect(props.rows[0]).toEqual({
      position: 1,
      code: 'VER',
      teamColor: '#1E5BC6',
      gap: 'LEADER',
      sectorColors: ['session-best', 'personal-best', 'session-best'],
      tireCompound: 'soft',
    });
    expect(props.rows[19]).toEqual({
      position: 20,
      code: 'ZHO',
      teamColor: '#900',
      gap: '+6.789',
    });
  });

  it('exports F1_TIMING_TOWER_PROPS with style="racing" + 20 rows + canonical 2024 grid (T-332 AC #8)', () => {
    expect(F1_TIMING_TOWER_PROPS.style).toBe('racing');
    expect(F1_TIMING_TOWER_PROPS.rows).toHaveLength(20);
    expect(F1_TIMING_TOWER_PROPS.rows[0]?.code).toBe('VER');
    expect(F1_TIMING_TOWER_PROPS.rows[0]?.gap).toBe('LEADER');
    expect(F1_TIMING_TOWER_PROPS.rows[1]?.code).toBe('NOR');
    expect(F1_TIMING_TOWER_PROPS.rows[2]?.code).toBe('LEC');
    expect(F1_TIMING_TOWER_PROPS.rows[19]?.code).toBe('ZHO');
    // Top-10 carry full data (gap + sectorColors + tireCompound).
    for (let i = 0; i < 10; i++) {
      const r = F1_TIMING_TOWER_PROPS.rows[i];
      expect(r?.sectorColors).toBeDefined();
      expect(r?.sectorColors).toHaveLength(3);
      expect(r?.tireCompound).toBeDefined();
    }
    // Bottom-10 carry minimal data (no sectorColors / tireCompound).
    for (let i = 10; i < 20; i++) {
      const r = F1_TIMING_TOWER_PROPS.rows[i];
      expect(r?.sectorColors).toBeUndefined();
      expect(r?.tireCompound).toBeUndefined();
    }
    expect(F1_TIMING_TOWER_PROPS.background).toBe('#0D0D0F');
    expect(F1_TIMING_TOWER_PROPS.foreground).toBe('#FFFFFF');
    expect(F1_TIMING_TOWER_PROPS.font).toEqual({ family: 'Barlow Condensed', weight: 600 });
    expect(F1_TIMING_TOWER_PROPS.position).toEqual({ x: 60, y: 60 });
    expect(F1_TIMING_TOWER_PROPS.casing).toBe('as-is');
  });

  it('PRESET_ID_BINDINGS contains f1-timing-tower override; length 18 (T-332 AC #10/#13)', () => {
    expect(PRESET_ID_BINDINGS['f1-timing-tower']).toBeDefined();
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.runtimeId).toBe('frame-runtime');
    // Eighteen overrides total after T-332 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('f1-timing-tower binding deep-clones nested objects + rows + sectorColors arrays (T-332)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'f1-timing-tower');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      position: { x: number; y: number };
      font: { family: string; weight: number };
      rows: Array<{
        position: number;
        code: string;
        teamColor: string;
        gap: string;
        sectorColors?: string[];
        tireCompound?: string;
      }>;
    };
    const b = binding.buildProps(undefined) as {
      position: { x: number; y: number };
      font: { family: string; weight: number };
      rows: Array<{
        position: number;
        code: string;
        teamColor: string;
        gap: string;
        sectorColors?: string[];
        tireCompound?: string;
      }>;
    };
    a.position.x = 999;
    a.font.weight = 999;
    const aRow0 = a.rows[0];
    if (!aRow0) throw new Error('test setup');
    aRow0.code = 'MUT';
    if (aRow0.sectorColors) aRow0.sectorColors[0] = 'mutated';
    expect(b.position.x).toBe(60);
    expect(b.font.weight).toBe(600);
    expect(b.rows[0]?.code).toBe('VER');
    expect(b.rows[0]?.sectorColors?.[0]).toBe('session-best');
    expect(F1_TIMING_TOWER_PROPS.position.x).toBe(60);
    expect(F1_TIMING_TOWER_PROPS.font.weight).toBe(600);
    expect(F1_TIMING_TOWER_PROPS.rows[0]?.code).toBe('VER');
    expect(F1_TIMING_TOWER_PROPS.rows[0]?.sectorColors?.[0]).toBe('session-best');
  });

  it('clipKind-default for scoreBug STILL returns scoreBugDotsBinding after T-332 lands (T-332 AC #11 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-ball-by-ball-dots')?.clipName).toBe(
      'outcome-row',
    );
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'unknown-preset-id')?.clipName).toBe(
      'outcome-row',
    );
  });

  it('all 17 prior PRESET_ID_BINDINGS overrides STILL resolve after T-332 lands (T-332 AC #12 backward compat)', () => {
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
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
  });

  // T-336 — eighth Cluster B preset (`cricket-scorebug`), wired via the
  // `PRESET_ID_BINDINGS` override path (Pattern C). Eighth `scoreBug`
  // clipKind consumer; FIRST production consumer of T-332a's `'cricket'`
  // style branch (multi-row complex panel: battingTeam + bowlingTeam +
  // runRate + 2 batsmen + bowler + partnership). Closes the T-332a primitive's
  // production-consumer matrix to all 4 styles exercised. The clipKind-
  // default arm stays UNCHANGED at `scoreBugDotsBinding` (T-358); T-333 /
  // T-334 / T-335 / T-337 / T-339a / T-338 / T-332 prior overrides UNCHANGED.
  it('routes cricket-scorebug through PRESET_ID_BINDINGS override (T-336 AC #10)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-scorebug');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('score-bug'); // kebab-case primitive kind (T-332a line 686)
    const props = binding?.buildProps(undefined) as typeof CRICKET_SCOREBUG_PROPS;
    expect(props.style).toBe('cricket');
    expect(props.position).toEqual({ x: 200, y: 60 });
    expect(props.background).toBe('#0E0E12');
    expect(props.foreground).toBe('#FFFFFF');
    expect(props.casing).toBe('as-is');
    expect(props.font).toEqual({ family: 'IBM Plex Sans', weight: 600 });
    expect(props.battingTeam).toEqual({
      code: 'IND',
      color: '#0066B3',
      runs: 247,
      wickets: 4,
      overs: '42.3',
    });
    expect(props.bowlingTeam).toEqual({ code: 'AUS', color: '#FFCD00' });
    expect(props.runRate).toBe('5.85');
    expect(props.requiredRunRate).toBe('6.42');
    expect(props.batsmen).toHaveLength(2);
    expect(props.batsmen[0]).toEqual({ name: 'Kohli', runs: 87, balls: 92, onStrike: true });
    expect(props.batsmen[1]).toEqual({ name: 'Rahul', runs: 34, balls: 41 });
    expect(props.bowler).toEqual({ name: 'Cummins', figures: '2-58' });
    expect(props.partnership).toBe('64 (78)');
    expect(props.anchor).toBe('top-center');
  });

  it('exports CRICKET_SCOREBUG_PROPS with style="cricket" + canonical IND vs AUS register (T-336 AC #8)', () => {
    expect(CRICKET_SCOREBUG_PROPS.style).toBe('cricket');
    expect(CRICKET_SCOREBUG_PROPS.battingTeam.code).toBe('IND');
    expect(CRICKET_SCOREBUG_PROPS.battingTeam.runs).toBe(247);
    expect(CRICKET_SCOREBUG_PROPS.battingTeam.wickets).toBe(4);
    expect(CRICKET_SCOREBUG_PROPS.battingTeam.overs).toBe('42.3');
    expect(CRICKET_SCOREBUG_PROPS.bowlingTeam.code).toBe('AUS');
    expect(CRICKET_SCOREBUG_PROPS.batsmen).toHaveLength(2);
    expect(CRICKET_SCOREBUG_PROPS.batsmen[0]?.onStrike).toBe(true);
    expect(CRICKET_SCOREBUG_PROPS.batsmen[1]?.onStrike).toBeUndefined();
    expect(CRICKET_SCOREBUG_PROPS.anchor).toBe('top-center');
    expect(CRICKET_SCOREBUG_PROPS.background).toBe('#0E0E12');
    expect(CRICKET_SCOREBUG_PROPS.foreground).toBe('#FFFFFF');
    expect(CRICKET_SCOREBUG_PROPS.font).toEqual({ family: 'IBM Plex Sans', weight: 600 });
    expect(CRICKET_SCOREBUG_PROPS.position).toEqual({ x: 200, y: 60 });
    expect(CRICKET_SCOREBUG_PROPS.casing).toBe('as-is');
  });

  it('PRESET_ID_BINDINGS contains cricket-scorebug override; length 19 (T-336 AC #10/#13)', () => {
    expect(PRESET_ID_BINDINGS['cricket-scorebug']).toBeDefined();
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.runtimeId).toBe('frame-runtime');
    // Nineteen overrides total after T-336 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('cricket-scorebug binding deep-clones nested objects + batsmen array (T-336 AC #9)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-scorebug');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      position: { x: number; y: number };
      font: { family: string; weight: number };
      battingTeam: { code: string; color: string; runs: number; wickets: number; overs: string };
      bowlingTeam: { code: string; color: string };
      batsmen: Array<{ name: string; runs: number; balls?: number; onStrike?: boolean }>;
      bowler: { name: string; figures: string };
    };
    const b = binding.buildProps(undefined) as typeof a;
    a.position.x = 999;
    a.font.weight = 999;
    a.battingTeam.runs = 999;
    a.bowlingTeam.code = 'MUT';
    a.bowler.name = 'Mutated';
    const aBatsman0 = a.batsmen[0];
    if (!aBatsman0) throw new Error('test setup');
    aBatsman0.name = 'MUT';
    expect(b.position.x).toBe(200);
    expect(b.font.weight).toBe(600);
    expect(b.battingTeam.runs).toBe(247);
    expect(b.bowlingTeam.code).toBe('AUS');
    expect(b.bowler.name).toBe('Cummins');
    expect(b.batsmen[0]?.name).toBe('Kohli');
    expect(CRICKET_SCOREBUG_PROPS.position.x).toBe(200);
    expect(CRICKET_SCOREBUG_PROPS.font.weight).toBe(600);
    expect(CRICKET_SCOREBUG_PROPS.battingTeam.runs).toBe(247);
    expect(CRICKET_SCOREBUG_PROPS.bowlingTeam.code).toBe('AUS');
    expect(CRICKET_SCOREBUG_PROPS.bowler.name).toBe('Cummins');
    expect(CRICKET_SCOREBUG_PROPS.batsmen[0]?.name).toBe('Kohli');
  });

  it('clipKind-default for scoreBug STILL returns scoreBugDotsBinding after T-336 lands (T-336 AC #11 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'cricket-ball-by-ball-dots')?.clipName).toBe(
      'outcome-row',
    );
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug', 'unknown-preset-id')?.clipName).toBe(
      'outcome-row',
    );
  });

  it('all 18 prior PRESET_ID_BINDINGS overrides STILL resolve after T-336 lands (T-336 AC #12 backward compat)', () => {
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
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.clipName).toBe('score-bug');
  });

  // T-339 — ninth and final Cluster B preset (`uefa-starball-refraction`),
  // wired via `PRESET_ID_BINDINGS` (Pattern C). Second `fullScreen`-clipKind
  // `PRESET_ID_BINDINGS` consumer (after T-328 `msnbc-big-board`); third
  // production consumer of T-355a's `magic-wall-panel` primitive (after
  // T-355 `magic-wall-drilldown` clipKind-default + T-328 `msnbc-big-board`
  // `PRESET_ID_BINDINGS`). Closes Cluster B to 9/9 substantive + signed →
  // fourth batch-eligible cluster after E + F + A. The `'fullScreen'` arm
  // in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at `fullScreenBinding`
  // (T-355's CNN-default magic-wall-drilldown binding); all 19 prior
  // `PRESET_ID_BINDINGS` entries UNCHANGED.
  it('routes uefa-starball-refraction through PRESET_ID_BINDINGS override (T-339 AC #16)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'uefa-starball-refraction');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('magic-wall-panel');
    const props = binding?.buildProps(undefined) as {
      regions: Array<{
        id: string;
        label: string;
        value: number;
        valueLabel: string;
        color: string;
        bounds: { x: number; y: number; width: number; height: number };
      }>;
      title: string;
      subtitle: string;
      valueFormat: string;
      entrance: string;
      staggerMs: number;
      background: string;
      foreground: string;
    };
    expect(props.regions).toHaveLength(6);
    expect(props.title).toBe('CHAMPIONS LEAGUE');
    expect(props.subtitle).toBe('MATCHDAY 6 — STANDINGS');
    expect(props.valueFormat).toBe('count');
    expect(props.entrance).toBe('stagger-rise');
    expect(props.staggerMs).toBe(60);
    expect(props.background).toBe('#041E42'); // UEFA dark navy override
    expect(props.foreground).toBe('#FFFFFF');
    // Each region's color comes from UEFA_STARBALL_PALETTE.
    expect(props.regions[0]?.color).toBe(UEFA_STARBALL_PALETTE.blue); // RMA
    expect(props.regions[1]?.color).toBe(UEFA_STARBALL_PALETTE.cyan); // LIV
    expect(props.regions[2]?.color).toBe(UEFA_STARBALL_PALETTE.magenta); // BAY
    expect(props.regions[3]?.color).toBe(UEFA_STARBALL_PALETTE.blue); // MCI
    expect(props.regions[4]?.color).toBe(UEFA_STARBALL_PALETTE.cyan); // PSG
    expect(props.regions[5]?.color).toBe(UEFA_STARBALL_PALETTE.magenta); // INT
    // Per-region valueLabel formatted as '<n> PTS'.
    expect(props.regions[0]?.valueLabel).toBe('16 PTS');
    expect(props.regions[5]?.valueLabel).toBe('10 PTS');
  });

  it('exports UEFA_STARBALL_REGIONS with six entries: RMA / LIV / BAY / MCI / PSG / INT (T-339 AC #9)', () => {
    expect(UEFA_STARBALL_REGIONS).toHaveLength(6);
    expect(UEFA_STARBALL_REGIONS.map((r) => r.id)).toEqual([
      'RMA',
      'LIV',
      'BAY',
      'MCI',
      'PSG',
      'INT',
    ]);
    // Mid-matchday standings register; descending points across the six.
    expect(UEFA_STARBALL_REGIONS.map((r) => r.points)).toEqual([16, 15, 13, 12, 11, 10]);
    // Snapshot exercises three of five accents (blue / cyan / magenta;
    // `navy` is reserved for `background`, `white` for `foreground`).
    const accents = UEFA_STARBALL_REGIONS.map((r) => r.accent);
    expect(accents).toContain('blue');
    expect(accents).toContain('cyan');
    expect(accents).toContain('magenta');
  });

  it('exports UEFA_STARBALL_PALETTE with five UEFA refraction swatches distinct from CNN + NBC palettes (T-339 AC #10)', () => {
    expect(UEFA_STARBALL_PALETTE).toEqual({
      navy: '#041E42',
      blue: '#2DA8D8',
      cyan: '#6EE0E8',
      magenta: '#C2185B',
      white: '#FFFFFF',
    });
    // Palette distinctness vs MSNBC_BIG_BOARD_PARTY_COLORS (T-328 NBC peacock).
    const uefaHexes = Object.values(UEFA_STARBALL_PALETTE);
    const nbcHexes = Object.values(MSNBC_BIG_BOARD_PARTY_COLORS);
    for (const hex of uefaHexes) {
      expect(nbcHexes).not.toContain(hex);
    }
    // Palette distinctness vs CNN Magic Wall canonical hexes (T-355
    // MAGIC_WALL_PARTY_COLORS is module-private; the canonical CNN partisan
    // hexes `#0044CC` / `#CC0000` / `#666666` / `#666666` MUST NOT collide
    // with the UEFA refraction palette).
    const cnnCanonicalHexes = ['#0044CC', '#CC0000', '#666666'];
    for (const hex of uefaHexes) {
      expect(cnnCanonicalHexes).not.toContain(hex);
    }
  });

  it('PRESET_ID_BINDINGS contains uefa-starball-refraction override; length 20 (T-339 AC #12/#15)', () => {
    expect(PRESET_ID_BINDINGS['uefa-starball-refraction']).toBeDefined();
    expect(PRESET_ID_BINDINGS['uefa-starball-refraction']?.clipName).toBe('magic-wall-panel');
    expect(PRESET_ID_BINDINGS['uefa-starball-refraction']?.runtimeId).toBe('frame-runtime');
    // Twenty overrides total after T-339 lands.
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('uefa-starball-refraction binding deep-clones regions array per call (T-339 AC #11)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'uefa-starball-refraction');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      regions: Array<{ label: string; valueLabel: string }>;
    };
    const b = binding.buildProps(undefined) as typeof a;
    const aRegion0 = a.regions[0];
    if (!aRegion0) throw new Error('test setup');
    aRegion0.label = 'MUTATED';
    aRegion0.valueLabel = 'MUTATED';
    expect(b.regions[0]?.label).toBe('RMA');
    expect(b.regions[0]?.valueLabel).toBe('16 PTS');
    expect(UEFA_STARBALL_REGIONS[0]?.label).toBe('RMA');
  });

  it('clipKind-default for fullScreen STILL returns fullScreenBinding after T-339 lands (T-339 AC #17/#18 backward compat)', () => {
    // No presetId → clipKind-default magic-wall-drilldown (T-355).
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    // magic-wall-drilldown is NOT in PRESET_ID_BINDINGS → falls through.
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'magic-wall-drilldown')?.clipName).toBe(
      'magic-wall-panel',
    );
    expect(PRESET_ID_BINDINGS['magic-wall-drilldown']).toBeUndefined();
    // Unknown preset id → falls through to clipKind-default.
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'unknown-preset')?.clipName).toBe(
      'magic-wall-panel',
    );
  });

  it('msnbc-big-board STILL routes through its T-328 PRESET_ID_BINDINGS override after T-339 lands (T-339 AC #19 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('fullScreen', 'msnbc-big-board');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('magic-wall-panel');
    const props = binding?.buildProps(undefined) as { title: string };
    expect(props.title).toBe('2024 ELECTION NIGHT');
  });

  it('all 19 prior PRESET_ID_BINDINGS overrides STILL resolve after T-339 lands (T-339 AC #14 backward compat)', () => {
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
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.clipName).toBe('score-bug');
  });

  // T-369 — first Cluster G preset (`youtube-subscribe-bounce`), wired via
  // the `PRESET_ID_BINDINGS` override path (Pattern C). FIRST `subscribeButton`
  // clipKind consumer; FIRST production consumer of T-317's `subscribe-button`
  // primitive AND its `'youtube'` platform branch. The clipKind-default arm
  // for `'subscribeButton'` is INTENTIONALLY ABSENT (D-T369-2 — sister Cluster
  // G presets bind different primitives: `follow-prompt` / `qr-code-bounce` /
  // `lower-third`). All 20 prior `PRESET_ID_BINDINGS` entries UNCHANGED.
  it('routes youtube-subscribe-bounce through PRESET_ID_BINDINGS override (T-369 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('subscribeButton', 'youtube-subscribe-bounce');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('subscribe-button'); // kebab-case primitive kind (T-317 line 599)
    const props = binding?.buildProps(undefined) as typeof YOUTUBE_SUBSCRIBE_BOUNCE_PROPS;
    expect(props.platform).toBe('youtube');
    expect(props.position).toEqual({ x: 1040, y: 640 });
    expect(props.label).toBe('SUBSCRIBE');
  });

  it('exports YOUTUBE_SUBSCRIBE_BOUNCE_PROPS with platform="youtube" + canonical YouTube subscribe-pill snapshot (T-369 AC #14)', () => {
    expect(YOUTUBE_SUBSCRIBE_BOUNCE_PROPS.platform).toBe('youtube');
    expect(YOUTUBE_SUBSCRIBE_BOUNCE_PROPS.position).toEqual({ x: 1040, y: 640 });
    expect(YOUTUBE_SUBSCRIBE_BOUNCE_PROPS.label).toBe('SUBSCRIBE');
    // Snapshot is intentionally minimal — 3 fields only — because brand canon
    // dominates theme on the YouTube branch (D-T317-6 / D-T369-2 budget).
    expect(Object.keys(YOUTUBE_SUBSCRIBE_BOUNCE_PROPS)).toHaveLength(3);
  });

  it('PRESET_ID_BINDINGS contains youtube-subscribe-bounce override; length 21 (T-369 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['youtube-subscribe-bounce']).toBeDefined();
    expect(PRESET_ID_BINDINGS['youtube-subscribe-bounce']?.clipName).toBe('subscribe-button');
    expect(PRESET_ID_BINDINGS['youtube-subscribe-bounce']?.runtimeId).toBe('frame-runtime');
    // Twenty-one overrides total after T-369 lands (20 prior + youtube-subscribe-bounce).
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('youtube-subscribe-bounce binding deep-clones the position object so callers can mutate freely (T-369 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('subscribeButton', 'youtube-subscribe-bounce');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      platform: string;
      position: { x: number; y: number };
      label: string;
    };
    const b = binding.buildProps(undefined) as typeof a;
    a.position.x = 999;
    a.position.y = 999;
    a.label = 'MUTATED';
    expect(b.position.x).toBe(1040);
    expect(b.position.y).toBe(640);
    expect(b.label).toBe('SUBSCRIBE');
    // Exported constant is unchanged after caller mutates the returned object.
    expect(YOUTUBE_SUBSCRIBE_BOUNCE_PROPS.position.x).toBe(1040);
    expect(YOUTUBE_SUBSCRIBE_BOUNCE_PROPS.position.y).toBe(640);
    expect(YOUTUBE_SUBSCRIBE_BOUNCE_PROPS.label).toBe('SUBSCRIBE');
  });

  it('NO clipKind-default arm for subscribeButton (T-369 AC #16)', () => {
    // No presetId → no clipKind-default arm; resolver returns undefined.
    expect(DEFAULT_CLIP_KIND_RESOLVER('subscribeButton')).toBeUndefined();
    // Unknown preset id → PRESET_ID_BINDINGS miss; no clipKind-default fall-through.
    expect(DEFAULT_CLIP_KIND_RESOLVER('subscribeButton', 'unknown-preset-id')).toBeUndefined();
  });

  it('clipKind-default arms for other clipKinds STILL resolve after T-369 lands (T-369 AC #18 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
  });

  it('all 20 prior PRESET_ID_BINDINGS overrides STILL resolve after T-369 lands (T-369 AC #17 backward compat)', () => {
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
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['uefa-starball-refraction']?.clipName).toBe('magic-wall-panel');
  });

  it('unknown clipKind STILL returns undefined after T-369 lands (T-369 AC #19)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('unknownKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'youtube-subscribe-bounce')).toBeDefined();
    // Per T-360 D-T360-2: PRESET_ID_BINDINGS hit overrides clipKind mismatch.
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'youtube-subscribe-bounce')?.clipName).toBe(
      'subscribe-button',
    );
  });

  // T-373 — second Cluster G preset (`social-handle-lower-third`), wired via
  // the `PRESET_ID_BINDINGS` override path (Pattern C). FIFTH `lowerThird`-
  // keyed override (after T-325 / T-326 / T-330 / T-329) and SIXTH
  // `lowerThird` clipKind consumer overall (T-323 holds the clipKind-default
  // arm). FIFTH production consumer of T-183z's `noFlag` / `subtitleColor` /
  // `font` props. All 21 prior `PRESET_ID_BINDINGS` entries UNCHANGED.
  it('routes social-handle-lower-third through PRESET_ID_BINDINGS override (T-373 AC #14)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'social-handle-lower-third');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('lower-third'); // kebab-case primitive kind
    const props = binding?.buildProps(undefined) as typeof SOCIAL_HANDLE_LOWER_THIRD_PROPS;
    expect(props.name).toBe('@yourbrand');
    expect(props.title).toBe('Follow us everywhere');
    expect(props.accent).toBe('#FFFFFF');
    expect(props.background).toBe('#000000');
    expect(props.textColor).toBe('#FFFFFF');
    expect(props.insetLeftPx).toBe(96);
    expect(props.insetBottomPx).toBe(96);
    expect(props.noFlag).toBe(true);
    expect(props.subtitleColor).toBe('#FFFFFF');
    expect(props.font).toEqual({ family: 'Inter', weight: 700 });
  });

  it('exports SOCIAL_HANDLE_LOWER_THIRD_PROPS with ten canonical fields (T-373 AC #15)', () => {
    expect(SOCIAL_HANDLE_LOWER_THIRD_PROPS).toEqual({
      name: '@yourbrand',
      title: 'Follow us everywhere',
      accent: '#FFFFFF',
      background: '#000000',
      textColor: '#FFFFFF',
      insetLeftPx: 96,
      insetBottomPx: 96,
      noFlag: true,
      subtitleColor: '#FFFFFF',
      font: { family: 'Inter', weight: 700 },
    });
    expect(Object.keys(SOCIAL_HANDLE_LOWER_THIRD_PROPS)).toHaveLength(10);
  });

  it('PRESET_ID_BINDINGS contains social-handle-lower-third override; length 22 (T-373 AC #16)', () => {
    expect(PRESET_ID_BINDINGS['social-handle-lower-third']).toBeDefined();
    expect(PRESET_ID_BINDINGS['social-handle-lower-third']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['social-handle-lower-third']?.runtimeId).toBe('frame-runtime');
    // Twenty-two overrides total after T-373 lands (21 prior + social-handle-lower-third).
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('lowerThird clipKind-default arm STILL returns cnnClassicBinding after T-373 lands (T-373 AC #17)', () => {
    // No presetId → clipKind-default arm.
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    const fallback = DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.buildProps(undefined) as {
      name: string;
    };
    expect(fallback.name).toBe('BREAKING: SUPREME COURT RULES'); // CNN-classic default (CNN_CLASSIC_PROPS.name)
    // Unknown preset id → PRESET_ID_BINDINGS miss → clipKind-default fall-through.
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird', 'unknown-preset-id')?.clipName).toBe(
      'lower-third',
    );
  });

  it('all 21 prior PRESET_ID_BINDINGS overrides STILL resolve after T-373 lands (T-373 AC #18 backward compat)', () => {
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
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['uefa-starball-refraction']?.clipName).toBe('magic-wall-panel');
    expect(PRESET_ID_BINDINGS['youtube-subscribe-bounce']?.clipName).toBe('subscribe-button');
  });

  it('clipKind-default arms for other clipKinds STILL resolve after T-373 lands (T-373 AC #20 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
  });

  it('unknown clipKind STILL returns undefined after T-373 lands (T-373 AC #21)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('unknownKind')).toBeUndefined();
    // Per T-360 D-T360-2: PRESET_ID_BINDINGS hit overrides clipKind mismatch.
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'social-handle-lower-third')?.clipName).toBe(
      'lower-third',
    );
  });

  // T-370 — third Cluster G preset (`tiktok-follow-pulse`), wired via
  // the `PRESET_ID_BINDINGS` override path (Pattern C). FIRST `followPrompt`
  // clipKind consumer; FIRST production consumer of T-318's `follow-prompt`
  // primitive AND its `'tiktok'` platform branch. The clipKind-default arm
  // for `'followPrompt'` is INTENTIONALLY ABSENT (D-T370-2 — sister Cluster
  // G presets bind different primitives: `subscribe-button` / `qr-code-bounce` /
  // `lower-third`). All 22 prior `PRESET_ID_BINDINGS` entries UNCHANGED.
  it('routes tiktok-follow-pulse through PRESET_ID_BINDINGS override (T-370 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('followPrompt', 'tiktok-follow-pulse');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('follow-prompt'); // kebab-case primitive kind (T-318 line 677)
    const props = binding?.buildProps(undefined) as typeof TIKTOK_FOLLOW_PULSE_PROPS;
    expect(props.platform).toBe('tiktok');
    expect(props.position).toEqual({ x: 1180, y: 504 });
    expect(props.phase).toBe('pulsing');
  });

  it('exports TIKTOK_FOLLOW_PULSE_PROPS with platform="tiktok" + canonical TikTok follow-prompt snapshot (T-370 AC #14)', () => {
    expect(TIKTOK_FOLLOW_PULSE_PROPS.platform).toBe('tiktok');
    expect(TIKTOK_FOLLOW_PULSE_PROPS.position).toEqual({ x: 1180, y: 504 });
    expect(TIKTOK_FOLLOW_PULSE_PROPS.phase).toBe('pulsing');
    // Snapshot is intentionally minimal — 3 fields only — because brand canon
    // dominates theme on the TikTok branch (D-T318-6 / D-T370-2 budget).
    expect(Object.keys(TIKTOK_FOLLOW_PULSE_PROPS)).toHaveLength(3);
  });

  it('PRESET_ID_BINDINGS contains tiktok-follow-pulse override; length 23 (T-370 AC #15)', () => {
    expect(PRESET_ID_BINDINGS['tiktok-follow-pulse']).toBeDefined();
    expect(PRESET_ID_BINDINGS['tiktok-follow-pulse']?.clipName).toBe('follow-prompt');
    expect(PRESET_ID_BINDINGS['tiktok-follow-pulse']?.runtimeId).toBe('frame-runtime');
    // Twenty-three overrides total after T-370 lands (22 prior + tiktok-follow-pulse).
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('tiktok-follow-pulse binding deep-clones the position object so callers can mutate freely (T-370 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('followPrompt', 'tiktok-follow-pulse');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      platform: string;
      position: { x: number; y: number };
      phase: string;
    };
    const b = binding.buildProps(undefined) as typeof a;
    a.position.x = 999;
    a.position.y = 999;
    expect(b.position.x).toBe(1180);
    expect(b.position.y).toBe(504);
    // Exported constant is unchanged after caller mutates the returned object.
    expect(TIKTOK_FOLLOW_PULSE_PROPS.position.x).toBe(1180);
    expect(TIKTOK_FOLLOW_PULSE_PROPS.position.y).toBe(504);
    expect(TIKTOK_FOLLOW_PULSE_PROPS.phase).toBe('pulsing');
  });

  it('NO clipKind-default arm for followPrompt (T-370 AC #16)', () => {
    // No presetId → no clipKind-default arm; resolver returns undefined.
    expect(DEFAULT_CLIP_KIND_RESOLVER('followPrompt')).toBeUndefined();
    // Unknown preset id → PRESET_ID_BINDINGS miss; no clipKind-default fall-through.
    expect(DEFAULT_CLIP_KIND_RESOLVER('followPrompt', 'unknown-preset-id')).toBeUndefined();
  });

  it('all 22 prior PRESET_ID_BINDINGS overrides STILL resolve after T-370 lands (T-370 AC #17 backward compat)', () => {
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
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['uefa-starball-refraction']?.clipName).toBe('magic-wall-panel');
    expect(PRESET_ID_BINDINGS['youtube-subscribe-bounce']?.clipName).toBe('subscribe-button');
    expect(PRESET_ID_BINDINGS['social-handle-lower-third']?.clipName).toBe('lower-third');
  });

  it('clipKind-default arms for other clipKinds STILL resolve after T-370 lands (T-370 AC #18 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
  });

  it('unknown clipKind STILL returns undefined after T-370 lands (T-370 AC #19)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('unknownKind')).toBeUndefined();
    // Per T-360 D-T360-2: PRESET_ID_BINDINGS hit overrides clipKind mismatch.
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'tiktok-follow-pulse')?.clipName).toBe(
      'follow-prompt',
    );
  });

  // T-372 — fourth Cluster G preset (`coinbase-dvd-qr`), wired via the
  // `PRESET_ID_BINDINGS` override path (Pattern C). FIRST `qrCodeBounce`
  // clipKind consumer; FIRST production consumer of T-319's `qr-code-bounce`
  // primitive. The clipKind-default arm for `'qrCodeBounce'` is INTENTIONALLY
  // ABSENT (D-T372-4 — only one `qrCodeBounce`-bound preset in v1). FIRST
  // non-cluster-norm parity threshold pin in Phase 13 (PSNR=38 / SSIM=0.94
  // preset-pinned per stub line 48). All 23 prior `PRESET_ID_BINDINGS`
  // entries UNCHANGED.
  it('routes coinbase-dvd-qr through PRESET_ID_BINDINGS override (T-372 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('qrCodeBounce', 'coinbase-dvd-qr');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('qr-code-bounce'); // kebab-case primitive kind (T-319 line 357)
    const props = binding?.buildProps(undefined) as {
      qrMatrix: readonly string[];
      bounce: {
        startPosition: { x: number; y: number };
        startVelocity: { vx: number; vy: number };
      };
    };
    expect(props.qrMatrix).toEqual([...COINBASE_DVD_QR_MATRIX]);
    expect(props.bounce.startPosition).toEqual({ x: 0, y: 0 });
    expect(props.bounce.startVelocity).toEqual({ vx: 8, vy: 6 });
  });

  it('exports COINBASE_DVD_QR_PROPS with the canonical Coinbase DVD-QR snapshot (T-372 AC #14)', () => {
    expect(COINBASE_DVD_QR_PROPS.qrMatrix).toBe(COINBASE_DVD_QR_MATRIX);
    expect(COINBASE_DVD_QR_PROPS.bounce.startPosition).toEqual({ x: 0, y: 0 });
    expect(COINBASE_DVD_QR_PROPS.bounce.startVelocity).toEqual({ vx: 8, vy: 6 });
    // Snapshot intentionally minimal — only the two REQUIRED fields
    // (`qrMatrix`, `bounce`); every other axis (`sizePercent`,
    // `colorCycle`, `background`, `lightModuleColor`) inherits primitive
    // defaults per D-T372-1 / D-T372-4.
    expect(Object.keys(COINBASE_DVD_QR_PROPS)).toHaveLength(2);
  });

  it('exports COINBASE_DVD_QR_MATRIX as a square 21×21 0/1-row-string matrix (T-372 AC #15 / D-T372-2)', () => {
    expect(COINBASE_DVD_QR_MATRIX).toHaveLength(21);
    for (const row of COINBASE_DVD_QR_MATRIX) {
      expect(row).toHaveLength(21);
      expect(/^[01]+$/.test(row)).toBe(true);
    }
    // Top-left finder (rows 0..6, cols 0..6) — outer ring is `'1'`.
    expect(COINBASE_DVD_QR_MATRIX[0]?.startsWith('1111111')).toBe(true);
    // Top-right finder (rows 0..6, cols 14..20) — outer ring is `'1'`.
    expect(COINBASE_DVD_QR_MATRIX[0]?.endsWith('1111111')).toBe(true);
    // Bottom-left finder (rows 14..20, cols 0..6) — outer ring is `'1'`.
    expect(COINBASE_DVD_QR_MATRIX[14]?.startsWith('1111111')).toBe(true);
    expect(COINBASE_DVD_QR_MATRIX[20]?.startsWith('1111111')).toBe(true);
  });

  it('PRESET_ID_BINDINGS contains coinbase-dvd-qr override (T-372 AC #16)', () => {
    expect(PRESET_ID_BINDINGS['coinbase-dvd-qr']).toBeDefined();
    expect(PRESET_ID_BINDINGS['coinbase-dvd-qr']?.clipName).toBe('qr-code-bounce');
    expect(PRESET_ID_BINDINGS['coinbase-dvd-qr']?.runtimeId).toBe('frame-runtime');
    // Thirty overrides total after T-349 lands (29 post-T-353 + got-trajan-clockwork;
    // the post-T-372 count was 24 — assertion updated for T-348 / T-351 / T-352 / T-353 / T-349 forward compat).
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('coinbase-dvd-qr binding deep-clones the bounce config so callers can mutate freely (T-372 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('qrCodeBounce', 'coinbase-dvd-qr');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      qrMatrix: string[];
      bounce: {
        startPosition: { x: number; y: number };
        startVelocity: { vx: number; vy: number };
      };
    };
    const b = binding.buildProps(undefined) as typeof a;
    a.bounce.startPosition.x = 999;
    a.bounce.startVelocity.vx = 999;
    a.qrMatrix.push('mutated');
    expect(b.bounce.startPosition.x).toBe(0);
    expect(b.bounce.startVelocity.vx).toBe(8);
    expect(b.qrMatrix).toHaveLength(21);
    // Exported constant unchanged after caller mutates the returned object.
    expect(COINBASE_DVD_QR_PROPS.bounce.startPosition.x).toBe(0);
    expect(COINBASE_DVD_QR_PROPS.bounce.startVelocity.vx).toBe(8);
    expect(COINBASE_DVD_QR_MATRIX).toHaveLength(21);
  });

  it('NO clipKind-default arm for qrCodeBounce (T-372 AC #17)', () => {
    // No presetId → no clipKind-default arm; resolver returns undefined.
    expect(DEFAULT_CLIP_KIND_RESOLVER('qrCodeBounce')).toBeUndefined();
    // Unknown preset id → PRESET_ID_BINDINGS miss; no clipKind-default fall-through.
    expect(DEFAULT_CLIP_KIND_RESOLVER('qrCodeBounce', 'unknown-preset-id')).toBeUndefined();
  });

  it('all 23 prior PRESET_ID_BINDINGS overrides STILL resolve after T-372 lands (T-372 AC #18 backward compat)', () => {
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
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['uefa-starball-refraction']?.clipName).toBe('magic-wall-panel');
    expect(PRESET_ID_BINDINGS['youtube-subscribe-bounce']?.clipName).toBe('subscribe-button');
    expect(PRESET_ID_BINDINGS['social-handle-lower-third']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['tiktok-follow-pulse']?.clipName).toBe('follow-prompt');
  });

  it('clipKind-default arms for other clipKinds STILL resolve after T-372 lands (T-372 AC #19 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
  });

  it('unknown clipKind STILL returns undefined after T-372 lands (T-372 AC #20)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('unknownKind')).toBeUndefined();
    // Per T-360 D-T360-2: PRESET_ID_BINDINGS hit overrides clipKind mismatch.
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'coinbase-dvd-qr')?.clipName).toBe(
      'qr-code-bounce',
    );
  });

  // T-371 — fifth and final Cluster G preset (`instagram-link-sticker`),
  // wired via the `PRESET_ID_BINDINGS` override path (Pattern C). FIRST
  // `socialMedia` clipKind consumer; FIRST production consumer of T-371a's
  // `link-sticker` primitive. The clipKind-default arm for `'socialMedia'`
  // is INTENTIONALLY ABSENT (D-T371-4 — only one `socialMedia`-bound preset
  // in v1). Cluster-norm parity thresholds (PSNR 42 / SSIM 0.98 — NOT
  // preset-pinned 38 / 0.94 like T-372). T-371's merge closes Cluster G to
  // 5/5 ELIGIBLE — first cluster expansion to fully close. All 24 prior
  // `PRESET_ID_BINDINGS` entries UNCHANGED.
  it('routes instagram-link-sticker through PRESET_ID_BINDINGS override (T-371 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('socialMedia', 'instagram-link-sticker');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('link-sticker'); // kebab-case primitive kind (T-371a line 324)
    const props = binding?.buildProps(undefined) as {
      label: string;
      variant: string;
      position: { x: number; y: number };
    };
    expect(props.label).toBe('instagram.com/yourhandle');
    expect(props.variant).toBe('white-on-dark');
    expect(props.position).toEqual({ x: 540, y: 338 });
  });

  it('exports INSTAGRAM_LINK_STICKER_PROPS with the canonical Instagram link-sticker snapshot (T-371 AC #14)', () => {
    expect(INSTAGRAM_LINK_STICKER_PROPS.label).toBe('instagram.com/yourhandle');
    expect(INSTAGRAM_LINK_STICKER_PROPS.variant).toBe('white-on-dark');
    expect(INSTAGRAM_LINK_STICKER_PROPS.position).toEqual({ x: 540, y: 338 });
    // Snapshot intentionally minimal — only the three REQUIRED fields
    // (`label`, `variant`, `position`); every other axis (`phase`, `width`,
    // `height`, `fontSize`, `shimmer`, per-variant tokens) inherits
    // primitive defaults per D-T371-1 / D-T371-4.
    expect(Object.keys(INSTAGRAM_LINK_STICKER_PROPS)).toHaveLength(3);
  });

  it('PRESET_ID_BINDINGS contains instagram-link-sticker override (T-371 AC #16)', () => {
    expect(PRESET_ID_BINDINGS['instagram-link-sticker']).toBeDefined();
    expect(PRESET_ID_BINDINGS['instagram-link-sticker']?.clipName).toBe('link-sticker');
    expect(PRESET_ID_BINDINGS['instagram-link-sticker']?.runtimeId).toBe('frame-runtime');
    // Twenty-seven overrides total after T-351 lands (the post-T-371 count was 25;
    // assertion updated for T-348 + T-351 forward compat).
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('instagram-link-sticker binding deep-clones the position object so callers can mutate freely (T-371 AC #13)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('socialMedia', 'instagram-link-sticker');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      label: string;
      variant: string;
      position: { x: number; y: number };
    };
    const b = binding.buildProps(undefined) as typeof a;
    a.position.x = 999;
    a.position.y = 999;
    expect(b.position.x).toBe(540);
    expect(b.position.y).toBe(338);
    // Exported constant unchanged after caller mutates the returned object.
    expect(INSTAGRAM_LINK_STICKER_PROPS.position.x).toBe(540);
    expect(INSTAGRAM_LINK_STICKER_PROPS.position.y).toBe(338);
  });

  it('NO clipKind-default arm for socialMedia (T-371 AC #17)', () => {
    // No presetId → no clipKind-default arm; resolver returns undefined.
    expect(DEFAULT_CLIP_KIND_RESOLVER('socialMedia')).toBeUndefined();
    // Unknown preset id → PRESET_ID_BINDINGS miss; no clipKind-default fall-through.
    expect(DEFAULT_CLIP_KIND_RESOLVER('socialMedia', 'unknown-preset-id')).toBeUndefined();
  });

  it('all 24 prior PRESET_ID_BINDINGS overrides STILL resolve after T-371 lands (T-371 AC #18 backward compat)', () => {
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
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['uefa-starball-refraction']?.clipName).toBe('magic-wall-panel');
    expect(PRESET_ID_BINDINGS['youtube-subscribe-bounce']?.clipName).toBe('subscribe-button');
    expect(PRESET_ID_BINDINGS['social-handle-lower-third']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['tiktok-follow-pulse']?.clipName).toBe('follow-prompt');
    expect(PRESET_ID_BINDINGS['coinbase-dvd-qr']?.clipName).toBe('qr-code-bounce');
  });

  it('clipKind-default arms for other clipKinds STILL resolve after T-371 lands (T-371 AC #19 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
  });

  it('unknown clipKind STILL returns undefined after T-371 lands (T-371 AC #20)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('unknownKind')).toBeUndefined();
    // Per T-360 D-T360-2: PRESET_ID_BINDINGS hit overrides clipKind mismatch.
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'instagram-link-sticker')?.clipName).toBe(
      'link-sticker',
    );
  });

  // T-348 — second Cluster D preset (`stranger-things-benguiat`); FIRST
  // `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` override
  // (T-350's `squidGameGeometricBinding` stays the clipKind-default arm)
  // AND **first multi-clip-composition consumer in StageFlip parity-CLI
  // history** (D-T348-1). Composes the parent `titleSequence` primitive
  // (T-321) with four atmospheric overlays — `grain` (T-321a), `light-leak`
  // (T-131b.2), `particles` (T-131d.1), `photographic-overlay` (T-321d) —
  // in declaration order = z-order (D-T348-2). Lowered parity thresholds
  // 36/0.92 (D-T348-10; mandatory film grain reduces compression precision
  // per stub line 49). All 25 prior `PRESET_ID_BINDINGS` entries UNCHANGED.
  it('routes stranger-things-benguiat through PRESET_ID_BINDINGS override (T-348 AC #17)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'stranger-things-benguiat');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('titleSequence'); // camelCase primitive kind (title-sequence.tsx:800)
    const props = binding?.buildProps(undefined) as { style: string; foreground: string };
    expect(props.style).toBe('letterform-assemble');
    expect(props.foreground).toBe('#FFFFFF');
  });

  it('stranger-things-benguiat binding declares 4 overlays in declaration order = z-order (T-348 AC #17 / D-T348-2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'stranger-things-benguiat');
    expect(binding?.overlays).toBeDefined();
    expect(binding?.overlays).toHaveLength(4);
    expect(binding?.overlays?.[0]?.runtimeId).toBe('frame-runtime');
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('light-leak');
    expect(binding?.overlays?.[2]?.clipName).toBe('particles');
    expect(binding?.overlays?.[3]?.clipName).toBe('photographic-overlay');
  });

  it('stranger-things-benguiat overlays buildProps deep-equal the exported STRANGER_*_PROPS constants (T-348 AC #17)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'stranger-things-benguiat');
    if (!binding?.overlays) throw new Error('test setup');
    expect(binding.overlays[0]?.buildProps(undefined)).toEqual(STRANGER_GRAIN_PROPS);
    expect(binding.overlays[1]?.buildProps(undefined)).toEqual(STRANGER_LIGHT_LEAK_PROPS);
    expect(binding.overlays[2]?.buildProps(undefined)).toEqual(STRANGER_PARTICLES_PROPS);
    expect(binding.overlays[3]?.buildProps(undefined)).toEqual(STRANGER_PHOTOGRAPHIC_OVERLAY_PROPS);
  });

  it('STRANGER_TITLE_SEQUENCE_PROPS satisfies titleSequencePropsSchema (T-348 AC #18)', () => {
    expect(titleSequencePropsSchema.safeParse(STRANGER_TITLE_SEQUENCE_PROPS).success).toBe(true);
  });

  it('STRANGER_GRAIN_PROPS satisfies grainPropsSchema (T-348 AC #18)', () => {
    expect(grainPropsSchema.safeParse(STRANGER_GRAIN_PROPS).success).toBe(true);
  });

  it('STRANGER_LIGHT_LEAK_PROPS satisfies lightLeakPropsSchema (T-348 AC #18)', () => {
    expect(lightLeakPropsSchema.safeParse(STRANGER_LIGHT_LEAK_PROPS).success).toBe(true);
  });

  it('STRANGER_PARTICLES_PROPS satisfies particlesPropsSchema (T-348 AC #18)', () => {
    expect(particlesPropsSchema.safeParse(STRANGER_PARTICLES_PROPS).success).toBe(true);
  });

  it('STRANGER_PHOTOGRAPHIC_OVERLAY_PROPS satisfies photographicOverlayPropsSchema (T-348 AC #18)', () => {
    expect(
      photographicOverlayPropsSchema.safeParse(STRANGER_PHOTOGRAPHIC_OVERLAY_PROPS).success,
    ).toBe(true);
  });

  it('PRESET_ID_BINDINGS contains stranger-things-benguiat override; length 27 post-T-351 (T-348 AC #19)', () => {
    expect(PRESET_ID_BINDINGS['stranger-things-benguiat']).toBeDefined();
    expect(PRESET_ID_BINDINGS['stranger-things-benguiat']?.clipName).toBe('titleSequence');
    expect(PRESET_ID_BINDINGS['stranger-things-benguiat']?.runtimeId).toBe('frame-runtime');
    expect(PRESET_ID_BINDINGS['stranger-things-benguiat']?.overlays).toHaveLength(4);
    // Twenty-seven overrides total after T-351 lands (26 post-T-348 + true-detective-double-exposure).
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('stranger-things-benguiat binding deep-clones nested arrays/objects so callers can mutate freely (T-348 AC #17)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'stranger-things-benguiat');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      shots: Array<{ content: { text: string } }>;
      glow: { color: string };
      position: { x: number };
    };
    const aShot0 = a.shots[0];
    if (!aShot0) throw new Error('test setup');
    aShot0.content.text = 'MUTATED';
    a.glow.color = '#000000';
    a.position.x = 999;
    const b = binding.buildProps(undefined) as typeof a;
    expect(b.shots[0]?.content.text).toBe('STRANGER THINGS');
    expect(b.glow.color).toBe('#FF0000');
    expect(b.position.x).toBe(640);
    // Exported constants unchanged after caller mutates the returned props.
    expect(STRANGER_TITLE_SEQUENCE_PROPS.shots[0]?.content.text).toBe('STRANGER THINGS');
    expect(STRANGER_TITLE_SEQUENCE_PROPS.glow.color).toBe('#FF0000');
    expect(STRANGER_TITLE_SEQUENCE_PROPS.position.x).toBe(640);
  });

  it('clipKind-default for titleSequence STILL returns squidGameGeometric without presetId after T-348 lands (T-348 AC #20)', () => {
    // No presetId → clipKind-default arm; T-350's squidGameGeometricBinding
    // remains the fallthrough. T-348 is an OVERRIDE only; does NOT touch
    // DEFAULT_CLIP_KIND_RESOLVER's `if (clipKind === 'titleSequence')` arm.
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence');
    expect(binding?.clipName).toBe('titleSequence');
    expect(binding?.overlays).toBeUndefined();
    // squid-game-geometric is the parent here; verify by buildProps shape.
    const props = binding?.buildProps(undefined) as { style: string };
    expect(props.style).toBe('palette-jump-cut'); // T-350 D-T350-7 register
  });

  it('all 25 prior PRESET_ID_BINDINGS overrides STILL resolve after T-348 lands (T-348 AC #21 backward compat)', () => {
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
    expect(PRESET_ID_BINDINGS['masters-red-under-par']?.clipName).toBe('standings-table');
    expect(PRESET_ID_BINDINGS['f1-timing-tower']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.clipName).toBe('score-bug');
    expect(PRESET_ID_BINDINGS['uefa-starball-refraction']?.clipName).toBe('magic-wall-panel');
    expect(PRESET_ID_BINDINGS['youtube-subscribe-bounce']?.clipName).toBe('subscribe-button');
    expect(PRESET_ID_BINDINGS['social-handle-lower-third']?.clipName).toBe('lower-third');
    expect(PRESET_ID_BINDINGS['tiktok-follow-pulse']?.clipName).toBe('follow-prompt');
    expect(PRESET_ID_BINDINGS['coinbase-dvd-qr']?.clipName).toBe('qr-code-bounce');
    expect(PRESET_ID_BINDINGS['instagram-link-sticker']?.clipName).toBe('link-sticker');
  });

  it('every prior single-clip PRESET_ID_BINDINGS entry has NO overlays field (T-348 AC #21 backward compat)', () => {
    // All 25 prior entries are single-clip — `overlays` field is OPTIONAL
    // on `ClipKindBinding` and undefined for them. Only T-348's
    // stranger-things-benguiat declares overlays.
    expect(PRESET_ID_BINDINGS['big-number-stat-impact']?.overlays).toBeUndefined();
    expect(PRESET_ID_BINDINGS['bbc-reith-dark']?.overlays).toBeUndefined();
    expect(PRESET_ID_BINDINGS['instagram-link-sticker']?.overlays).toBeUndefined();
    expect(PRESET_ID_BINDINGS['cricket-scorebug']?.overlays).toBeUndefined();
    expect(PRESET_ID_BINDINGS['coinbase-dvd-qr']?.overlays).toBeUndefined();
  });

  it('clipKind-default arms for other clipKinds STILL resolve after T-348 lands (T-348 AC #22 backward compat)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('bigNumber')?.clipName).toBe('animated-value');
    expect(DEFAULT_CLIP_KIND_RESOLVER('scoreBug')?.clipName).toBe('outcome-row');
    expect(DEFAULT_CLIP_KIND_RESOLVER('newsTicker')?.clipName).toBe('news-ticker-bar');
    expect(DEFAULT_CLIP_KIND_RESOLVER('standings')?.clipName).toBe('standings-table');
    expect(DEFAULT_CLIP_KIND_RESOLVER('caption')?.clipName).toBe('caption');
    expect(DEFAULT_CLIP_KIND_RESOLVER('fullScreen')?.clipName).toBe('magic-wall-panel');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lyrics')?.clipName).toBe('lyrics');
    expect(DEFAULT_CLIP_KIND_RESOLVER('titleSequence')?.clipName).toBe('titleSequence');
    expect(DEFAULT_CLIP_KIND_RESOLVER('lowerThird')?.clipName).toBe('lower-third');
    expect(DEFAULT_CLIP_KIND_RESOLVER('breakingBanner')?.clipName).toBe('breaking-banner');
  });

  it('unknown clipKind STILL returns undefined after T-348 lands (T-348 AC #23)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('unknownKind')).toBeUndefined();
    // Per T-360 D-T360-2: PRESET_ID_BINDINGS hit overrides clipKind mismatch.
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'stranger-things-benguiat')?.clipName).toBe(
      'titleSequence',
    );
  });

  // T-351 — third Cluster D preset (`true-detective-double-exposure`); SECOND
  // `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` override
  // AND **second multi-clip-composition consumer in StageFlip parity-CLI
  // history** (D-T351-1; reuses T-348's `overlays?` surface verbatim — no
  // architectural extension). Composes the parent `titleSequence` primitive
  // (T-321) with two atmospheric overlays — `grain` (T-321a) and
  // `photographic-overlay` (T-321d) — in declaration order = z-order
  // (D-T351-2). NO light-leak / particles per the muted earth-tone canon.
  // Lowered parity thresholds 34/0.90 (D-T351-5; even lower than T-348's
  // 36/0.92 — photographic source has high variance per stub line 49).
  // T-351 is the **PRIMARY consumer of the T-321d photographic-overlay
  // primitive** — runs `mode: 'cinematic-lut'` at `intensity: 0.6`
  // (DOMINATES the visual register).
  it('routes true-detective-double-exposure through PRESET_ID_BINDINGS override (T-351 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'true-detective-double-exposure');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('titleSequence');
    const props = binding?.buildProps(undefined) as {
      style: string;
      foreground: string;
      casing: string;
    };
    expect(props.style).toBe('photographic-overlay');
    expect(props.foreground).toBe('#E8DCC4');
    expect(props.casing).toBe('uppercase');
  });

  it('true-detective-double-exposure binding declares 2 overlays in declaration order = z-order (T-351 AC #18 / D-T351-2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'true-detective-double-exposure');
    expect(binding?.overlays).toBeDefined();
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.runtimeId).toBe('frame-runtime');
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  it('true-detective-double-exposure overlays buildProps deep-equal the exported TRUE_DETECTIVE_*_PROPS constants (T-351 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'true-detective-double-exposure');
    if (!binding?.overlays) throw new Error('test setup');
    expect(binding.overlays[0]?.buildProps(undefined)).toEqual(TRUE_DETECTIVE_GRAIN_PROPS);
    expect(binding.overlays[1]?.buildProps(undefined)).toEqual(
      TRUE_DETECTIVE_PHOTOGRAPHIC_OVERLAY_PROPS,
    );
  });

  it('TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS satisfies titleSequencePropsSchema (T-351 AC #19)', () => {
    expect(titleSequencePropsSchema.safeParse(TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS).success).toBe(
      true,
    );
  });

  it('TRUE_DETECTIVE_GRAIN_PROPS satisfies grainPropsSchema (T-351 AC #19)', () => {
    expect(grainPropsSchema.safeParse(TRUE_DETECTIVE_GRAIN_PROPS).success).toBe(true);
  });

  it('TRUE_DETECTIVE_PHOTOGRAPHIC_OVERLAY_PROPS satisfies photographicOverlayPropsSchema; mode=cinematic-lut intensity=0.6 (T-351 AC #19 / D-T351-3)', () => {
    expect(
      photographicOverlayPropsSchema.safeParse(TRUE_DETECTIVE_PHOTOGRAPHIC_OVERLAY_PROPS).success,
    ).toBe(true);
    expect(TRUE_DETECTIVE_PHOTOGRAPHIC_OVERLAY_PROPS.mode).toBe('cinematic-lut');
    expect(TRUE_DETECTIVE_PHOTOGRAPHIC_OVERLAY_PROPS.intensity).toBe(0.6);
  });

  it('PRESET_ID_BINDINGS contains true-detective-double-exposure override; length 27 (T-351 AC #20)', () => {
    expect(PRESET_ID_BINDINGS['true-detective-double-exposure']).toBeDefined();
    expect(PRESET_ID_BINDINGS['true-detective-double-exposure']?.clipName).toBe('titleSequence');
    expect(PRESET_ID_BINDINGS['true-detective-double-exposure']?.runtimeId).toBe('frame-runtime');
    expect(PRESET_ID_BINDINGS['true-detective-double-exposure']?.overlays).toHaveLength(2);
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('true-detective-double-exposure binding deep-clones nested arrays/objects so callers can mutate freely (T-351 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'true-detective-double-exposure');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      shots: Array<{ content: { text: string } }>;
      font: { family: string };
      position: { x: number };
    };
    const aShot0 = a.shots[0];
    if (!aShot0) throw new Error('test setup');
    aShot0.content.text = 'MUTATED';
    a.font.family = 'mutated-family';
    a.position.x = 999;
    const b = binding.buildProps(undefined) as typeof a;
    expect(b.shots[0]?.content.text).toBe('CREATED BY NIC PIZZOLATTO');
    expect(b.font.family).toBe('Inter, system-ui, -apple-system, sans-serif');
    expect(b.position.x).toBe(640);
    // Exported constants unchanged after caller mutates the returned props.
    expect(TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS.shots[0]?.content.text).toBe(
      'CREATED BY NIC PIZZOLATTO',
    );
    expect(TRUE_DETECTIVE_TITLE_SEQUENCE_PROPS.position.x).toBe(640);
  });

  it('clipKind-default for titleSequence STILL returns squidGameGeometric without presetId after T-351 lands (T-351 AC #21)', () => {
    // No presetId → clipKind-default arm; T-350's squidGameGeometricBinding
    // remains the fallthrough. T-351 is an OVERRIDE only; does NOT touch
    // DEFAULT_CLIP_KIND_RESOLVER's `if (clipKind === 'titleSequence')` arm.
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence');
    expect(binding?.clipName).toBe('titleSequence');
    expect(binding?.overlays).toBeUndefined();
    const props = binding?.buildProps(undefined) as { style: string };
    expect(props.style).toBe('palette-jump-cut'); // T-350 D-T350-7 register
  });

  it('stranger-things-benguiat binding STILL fans out 4 overlays after T-351 lands (T-351 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'stranger-things-benguiat');
    expect(binding?.overlays).toHaveLength(4);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('light-leak');
    expect(binding?.overlays?.[2]?.clipName).toBe('particles');
    expect(binding?.overlays?.[3]?.clipName).toBe('photographic-overlay');
  });

  // T-352 — fourth Cluster D preset (`succession-home-video`); THIRD
  // `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` override
  // AND **third multi-clip-composition consumer in StageFlip parity-CLI
  // history** (D-T352-1; reuses T-348's `overlays?` surface verbatim — no
  // architectural extension). Composes the parent `titleSequence` primitive
  // (T-321) with two atmospheric overlays — `grain` (T-321a) and
  // `photographic-overlay` (T-321d) — in declaration order = z-order
  // (D-T352-2). NO light-leak / particles per the sepia warm-yellow canon
  // (would over-saturate to muddy-brown). Lowered parity thresholds
  // 34/0.90 (D-T352-5; matches T-351's bar — mixed-grade footage variance
  // per stub line 48 + HIGH grain intensity 0.30). T-352 is the **FIRST
  // end-to-end consumer of `mode: 'sepia'`** (T-348 picked 'fade'; T-351
  // picked 'cinematic-lut') AND the **FIRST end-to-end consumer of
  // non-default grain intensity** (T-348/T-351 used the canonical 0.15
  // default; T-352 raises to 0.30 for VHS-tape chatter per stub line 26).
  it('routes succession-home-video through PRESET_ID_BINDINGS override (T-352 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'succession-home-video');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('titleSequence');
    const props = binding?.buildProps(undefined) as {
      style: string;
      foreground: string;
      casing: string;
    };
    expect(props.style).toBe('photographic-overlay');
    expect(props.foreground).toBe('#F4E8C8');
    expect(props.casing).toBe('uppercase');
  });

  it('succession-home-video binding declares 2 overlays in declaration order = z-order (T-352 AC #18 / D-T352-2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'succession-home-video');
    expect(binding?.overlays).toBeDefined();
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.runtimeId).toBe('frame-runtime');
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  it('succession-home-video overlays buildProps deep-equal the exported SUCCESSION_HOME_VIDEO_*_PROPS constants (T-352 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'succession-home-video');
    if (!binding?.overlays) throw new Error('test setup');
    expect(binding.overlays[0]?.buildProps(undefined)).toEqual(SUCCESSION_HOME_VIDEO_GRAIN_PROPS);
    expect(binding.overlays[1]?.buildProps(undefined)).toEqual(
      SUCCESSION_HOME_VIDEO_PHOTOGRAPHIC_OVERLAY_PROPS,
    );
  });

  it('SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS satisfies titleSequencePropsSchema (T-352 AC #19)', () => {
    expect(
      titleSequencePropsSchema.safeParse(SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS).success,
    ).toBe(true);
  });

  it('SUCCESSION_HOME_VIDEO_GRAIN_PROPS satisfies grainPropsSchema; intensity=0.30 (T-352 AC #19 / D-T352-7)', () => {
    expect(grainPropsSchema.safeParse(SUCCESSION_HOME_VIDEO_GRAIN_PROPS).success).toBe(true);
    expect(SUCCESSION_HOME_VIDEO_GRAIN_PROPS.intensity).toBe(0.3);
  });

  it('SUCCESSION_HOME_VIDEO_PHOTOGRAPHIC_OVERLAY_PROPS satisfies photographicOverlayPropsSchema; mode=sepia intensity=0.7 (T-352 AC #19 / D-T352-3)', () => {
    expect(
      photographicOverlayPropsSchema.safeParse(SUCCESSION_HOME_VIDEO_PHOTOGRAPHIC_OVERLAY_PROPS)
        .success,
    ).toBe(true);
    expect(SUCCESSION_HOME_VIDEO_PHOTOGRAPHIC_OVERLAY_PROPS.mode).toBe('sepia');
    expect(SUCCESSION_HOME_VIDEO_PHOTOGRAPHIC_OVERLAY_PROPS.intensity).toBe(0.7);
  });

  it('PRESET_ID_BINDINGS contains succession-home-video override; length 29 after T-353 (T-352 AC #20)', () => {
    expect(PRESET_ID_BINDINGS['succession-home-video']).toBeDefined();
    expect(PRESET_ID_BINDINGS['succession-home-video']?.clipName).toBe('titleSequence');
    expect(PRESET_ID_BINDINGS['succession-home-video']?.runtimeId).toBe('frame-runtime');
    expect(PRESET_ID_BINDINGS['succession-home-video']?.overlays).toHaveLength(2);
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('succession-home-video binding deep-clones nested arrays/objects so callers can mutate freely (T-352 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'succession-home-video');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      shots: Array<{ content: { text: string } }>;
      font: { family: string };
      position: { x: number };
    };
    const aShot0 = a.shots[0];
    if (!aShot0) throw new Error('test setup');
    aShot0.content.text = 'MUTATED';
    a.font.family = 'mutated-family';
    a.position.x = 999;
    const b = binding.buildProps(undefined) as typeof a;
    expect(b.shots[0]?.content.text).toBe('SUCCESSION');
    expect(b.font.family).toBe(
      'IBM Plex Sans Condensed, IBM Plex Sans, system-ui, -apple-system, sans-serif',
    );
    expect(b.position.x).toBe(640);
    // Exported constants unchanged after caller mutates the returned props.
    expect(SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS.shots[0]?.content.text).toBe('SUCCESSION');
    expect(SUCCESSION_HOME_VIDEO_TITLE_SEQUENCE_PROPS.position.x).toBe(640);
  });

  it('clipKind-default for titleSequence STILL returns squidGameGeometric without presetId after T-352 lands (T-352 AC #21)', () => {
    // No presetId → clipKind-default arm; T-350's squidGameGeometricBinding
    // remains the fallthrough. T-352 is an OVERRIDE only; does NOT touch
    // DEFAULT_CLIP_KIND_RESOLVER's `if (clipKind === 'titleSequence')` arm.
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence');
    expect(binding?.clipName).toBe('titleSequence');
    expect(binding?.overlays).toBeUndefined();
    const props = binding?.buildProps(undefined) as { style: string };
    expect(props.style).toBe('palette-jump-cut'); // T-350 D-T350-7 register
  });

  it('stranger-things-benguiat binding STILL fans out 4 overlays after T-352 lands (T-352 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'stranger-things-benguiat');
    expect(binding?.overlays).toHaveLength(4);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('light-leak');
    expect(binding?.overlays?.[2]?.clipName).toBe('particles');
    expect(binding?.overlays?.[3]?.clipName).toBe('photographic-overlay');
  });

  it('true-detective-double-exposure binding STILL fans out 2 overlays after T-352 lands (T-352 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'true-detective-double-exposure');
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  // T-353 — fifth Cluster D preset (`severance-surreal-3d`); FOURTH
  // `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` override
  // AND **fourth multi-clip-composition consumer in StageFlip parity-CLI
  // history** (D-T353-1; reuses T-348's `overlays?` surface verbatim — no
  // architectural extension). Composes the parent `titleSequence` primitive
  // (T-321) with two atmospheric overlays — `grain` (T-321a) and
  // `photographic-overlay` (T-321d) — in declaration order = z-order
  // (D-T353-2). NO light-leak / particles per the sterile-corporate canon.
  // Tighter parity thresholds 36/0.92 (D-T353-5; TIGHTER than T-351 +
  // T-352's 34/0.90 — lower-engagement register has more headroom: LOW
  // grain 0.10 + MODERATE photographic-overlay 0.4 + sterile palette).
  // T-353 is the **SECOND end-to-end consumer of `mode: 'cinematic-lut'`**
  // (T-351 was PRIMARY at 0.60 dominant; T-353 at 0.4 moderate) AND the
  // **SECOND end-to-end consumer of non-default grain intensity / FIRST
  // below-default consumer** (T-348/T-351 used 0.15 default; T-352 raised
  // to 0.30; T-353 LOWERS to 0.10). Live ThreeSceneClip integration
  // deferred per stub-canon-explicit static-fallback allowance (stub line
  // 39).
  it('routes severance-surreal-3d through PRESET_ID_BINDINGS override (T-353 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'severance-surreal-3d');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('titleSequence');
    const props = binding?.buildProps(undefined) as {
      style: string;
      foreground: string;
      casing: string;
    };
    expect(props.style).toBe('photographic-overlay');
    expect(props.foreground).toBe('#E8ECE5');
    expect(props.casing).toBe('uppercase');
  });

  it('severance-surreal-3d binding declares 2 overlays in declaration order = z-order (T-353 AC #18 / D-T353-2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'severance-surreal-3d');
    expect(binding?.overlays).toBeDefined();
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.runtimeId).toBe('frame-runtime');
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  it('severance-surreal-3d overlays buildProps deep-equal the exported SEVERANCE_SURREAL_3D_*_PROPS constants (T-353 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'severance-surreal-3d');
    if (!binding?.overlays) throw new Error('test setup');
    expect(binding.overlays[0]?.buildProps(undefined)).toEqual(SEVERANCE_SURREAL_3D_GRAIN_PROPS);
    expect(binding.overlays[1]?.buildProps(undefined)).toEqual(
      SEVERANCE_SURREAL_3D_PHOTOGRAPHIC_OVERLAY_PROPS,
    );
  });

  it('SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS satisfies titleSequencePropsSchema (T-353 AC #19)', () => {
    expect(
      titleSequencePropsSchema.safeParse(SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS).success,
    ).toBe(true);
  });

  it('SEVERANCE_SURREAL_3D_GRAIN_PROPS satisfies grainPropsSchema; intensity=0.10 (T-353 AC #19 / D-T353-7)', () => {
    expect(grainPropsSchema.safeParse(SEVERANCE_SURREAL_3D_GRAIN_PROPS).success).toBe(true);
    expect(SEVERANCE_SURREAL_3D_GRAIN_PROPS.intensity).toBe(0.1);
  });

  it('SEVERANCE_SURREAL_3D_PHOTOGRAPHIC_OVERLAY_PROPS satisfies photographicOverlayPropsSchema; mode=cinematic-lut intensity=0.4 (T-353 AC #19 / D-T353-3)', () => {
    expect(
      photographicOverlayPropsSchema.safeParse(SEVERANCE_SURREAL_3D_PHOTOGRAPHIC_OVERLAY_PROPS)
        .success,
    ).toBe(true);
    expect(SEVERANCE_SURREAL_3D_PHOTOGRAPHIC_OVERLAY_PROPS.mode).toBe('cinematic-lut');
    expect(SEVERANCE_SURREAL_3D_PHOTOGRAPHIC_OVERLAY_PROPS.intensity).toBe(0.4);
  });

  it('PRESET_ID_BINDINGS contains severance-surreal-3d override; length 29 (T-353 AC #20)', () => {
    expect(PRESET_ID_BINDINGS['severance-surreal-3d']).toBeDefined();
    expect(PRESET_ID_BINDINGS['severance-surreal-3d']?.clipName).toBe('titleSequence');
    expect(PRESET_ID_BINDINGS['severance-surreal-3d']?.runtimeId).toBe('frame-runtime');
    expect(PRESET_ID_BINDINGS['severance-surreal-3d']?.overlays).toHaveLength(2);
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('severance-surreal-3d binding deep-clones nested arrays/objects so callers can mutate freely (T-353 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'severance-surreal-3d');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      shots: Array<{ content: { text: string } }>;
      font: { family: string };
      position: { x: number };
    };
    const aShot0 = a.shots[0];
    if (!aShot0) throw new Error('test setup');
    aShot0.content.text = 'MUTATED';
    a.font.family = 'mutated-family';
    a.position.x = 999;
    const b = binding.buildProps(undefined) as typeof a;
    expect(b.shots[0]?.content.text).toBe('SEVERANCE');
    expect(b.font.family).toBe('Inter Display, Inter, system-ui, -apple-system, sans-serif');
    expect(b.position.x).toBe(640);
    // Exported constants unchanged after caller mutates the returned props.
    expect(SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS.shots[0]?.content.text).toBe('SEVERANCE');
    expect(SEVERANCE_SURREAL_3D_TITLE_SEQUENCE_PROPS.position.x).toBe(640);
  });

  it('clipKind-default for titleSequence STILL returns squidGameGeometric without presetId after T-353 lands (T-353 AC #21)', () => {
    // No presetId → clipKind-default arm; T-350's squidGameGeometricBinding
    // remains the fallthrough. T-353 is an OVERRIDE only; does NOT touch
    // DEFAULT_CLIP_KIND_RESOLVER's `if (clipKind === 'titleSequence')` arm.
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence');
    expect(binding?.clipName).toBe('titleSequence');
    expect(binding?.overlays).toBeUndefined();
    const props = binding?.buildProps(undefined) as { style: string };
    expect(props.style).toBe('palette-jump-cut'); // T-350 D-T350-7 register
  });

  it('stranger-things-benguiat binding STILL fans out 4 overlays after T-353 lands (T-353 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'stranger-things-benguiat');
    expect(binding?.overlays).toHaveLength(4);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('light-leak');
    expect(binding?.overlays?.[2]?.clipName).toBe('particles');
    expect(binding?.overlays?.[3]?.clipName).toBe('photographic-overlay');
  });

  it('true-detective-double-exposure binding STILL fans out 2 overlays after T-353 lands (T-353 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'true-detective-double-exposure');
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  it('succession-home-video binding STILL fans out 2 overlays after T-353 lands (T-353 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'succession-home-video');
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  // T-349 — sixth + final Cluster D preset (`got-trajan-clockwork`); FOURTH
  // `titleSequence`-clipKind preset wired via `PRESET_ID_BINDINGS` override
  // AND **fifth multi-clip-composition consumer in StageFlip parity-CLI
  // history** (D-T349-1; reuses T-348's `overlays?` surface verbatim — no
  // architectural extension). Composes the parent `titleSequence` primitive
  // (T-321) with two atmospheric overlays — `grain` (T-321a) and
  // `photographic-overlay` (T-321d) — in declaration order = z-order
  // (D-T349-2). NO light-leak / particles per the metallic-gold/brown canon
  // (warm-orange leaks would over-saturate to muddy "burned-photograph";
  // sun-rays particle-like effect is deferred per "out of scope"). Lowered
  // parity thresholds 34/0.90 (D-T349-5; matches T-352/T-353's bar — 3D +
  // golds variance pre-declared by stub line 52 with 0.02 SSIM / 2 dB PSNR
  // relaxation from stub's 36/0.92 absorbing sepia-matrix coupling on
  // metallic-yellow palette across CDP versions). T-349 is the **SECOND
  // end-to-end consumer of `mode: 'sepia'`** (T-352 was PRIMARY at 0.70
  // dominant with HIGH grain 0.30; T-349 is SECONDARY at 0.65 dominant
  // with canonical-default grain 0.15 — confirms mode is stable across
  // intensity values + grain levels). Live ThreeSceneClip 3D integration
  // deferred per stub-canon-explicit static-fallback allowance (stub line
  // 41). **Closes Cluster D 5/6 → 6/6 ELIGIBLE — the cluster-closure
  // milestone.**
  it('routes got-trajan-clockwork through PRESET_ID_BINDINGS override (T-349 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'got-trajan-clockwork');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('titleSequence');
    const props = binding?.buildProps(undefined) as {
      style: string;
      foreground: string;
      casing: string;
    };
    expect(props.style).toBe('photographic-overlay');
    expect(props.foreground).toBe('#FFF190');
    expect(props.casing).toBe('uppercase');
  });

  it('got-trajan-clockwork binding declares 2 overlays in declaration order = z-order (T-349 AC #18 / D-T349-2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'got-trajan-clockwork');
    expect(binding?.overlays).toBeDefined();
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.runtimeId).toBe('frame-runtime');
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  it('got-trajan-clockwork overlays buildProps deep-equal the exported GOT_TRAJAN_CLOCKWORK_*_PROPS constants (T-349 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'got-trajan-clockwork');
    if (!binding?.overlays) throw new Error('test setup');
    expect(binding.overlays[0]?.buildProps(undefined)).toEqual(GOT_TRAJAN_CLOCKWORK_GRAIN_PROPS);
    expect(binding.overlays[1]?.buildProps(undefined)).toEqual(
      GOT_TRAJAN_CLOCKWORK_PHOTOGRAPHIC_OVERLAY_PROPS,
    );
  });

  it('GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS satisfies titleSequencePropsSchema (T-349 AC #19)', () => {
    expect(
      titleSequencePropsSchema.safeParse(GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS).success,
    ).toBe(true);
  });

  it('GOT_TRAJAN_CLOCKWORK_GRAIN_PROPS satisfies grainPropsSchema; intensity=0.15 (T-349 AC #19 / D-T349-7)', () => {
    expect(grainPropsSchema.safeParse(GOT_TRAJAN_CLOCKWORK_GRAIN_PROPS).success).toBe(true);
    expect(GOT_TRAJAN_CLOCKWORK_GRAIN_PROPS.intensity).toBe(0.15);
  });

  it('GOT_TRAJAN_CLOCKWORK_PHOTOGRAPHIC_OVERLAY_PROPS satisfies photographicOverlayPropsSchema; mode=sepia intensity=0.65 (T-349 AC #19 / D-T349-3)', () => {
    expect(
      photographicOverlayPropsSchema.safeParse(GOT_TRAJAN_CLOCKWORK_PHOTOGRAPHIC_OVERLAY_PROPS)
        .success,
    ).toBe(true);
    expect(GOT_TRAJAN_CLOCKWORK_PHOTOGRAPHIC_OVERLAY_PROPS.mode).toBe('sepia');
    expect(GOT_TRAJAN_CLOCKWORK_PHOTOGRAPHIC_OVERLAY_PROPS.intensity).toBe(0.65);
  });

  it('PRESET_ID_BINDINGS contains got-trajan-clockwork override; length 30 (T-349 AC #20)', () => {
    expect(PRESET_ID_BINDINGS['got-trajan-clockwork']).toBeDefined();
    expect(PRESET_ID_BINDINGS['got-trajan-clockwork']?.clipName).toBe('titleSequence');
    expect(PRESET_ID_BINDINGS['got-trajan-clockwork']?.runtimeId).toBe('frame-runtime');
    expect(PRESET_ID_BINDINGS['got-trajan-clockwork']?.overlays).toHaveLength(2);
    expect(Object.keys(PRESET_ID_BINDINGS)).toHaveLength(35);
  });

  it('got-trajan-clockwork binding deep-clones nested arrays/objects so callers can mutate freely (T-349 AC #18)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'got-trajan-clockwork');
    if (!binding) throw new Error('test setup');
    const a = binding.buildProps(undefined) as {
      shots: Array<{ content: { text: string } }>;
      font: { family: string };
      position: { x: number };
    };
    const aShot0 = a.shots[0];
    if (!aShot0) throw new Error('test setup');
    aShot0.content.text = 'MUTATED';
    a.font.family = 'mutated-family';
    a.position.x = 999;
    const b = binding.buildProps(undefined) as typeof a;
    expect(b.shots[0]?.content.text).toBe('GAME OF THRONES');
    expect(b.font.family).toBe(
      'EB Garamond, Garamond, "Times New Roman", system-ui, -apple-system, serif',
    );
    expect(b.position.x).toBe(640);
    // Exported constants unchanged after caller mutates the returned props.
    expect(GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS.shots[0]?.content.text).toBe(
      'GAME OF THRONES',
    );
    expect(GOT_TRAJAN_CLOCKWORK_TITLE_SEQUENCE_PROPS.position.x).toBe(640);
  });

  it('clipKind-default for titleSequence STILL returns squidGameGeometric without presetId after T-349 lands (T-349 AC #21)', () => {
    // No presetId → clipKind-default arm; T-350's squidGameGeometricBinding
    // remains the fallthrough. T-349 is an OVERRIDE only; does NOT touch
    // DEFAULT_CLIP_KIND_RESOLVER's `if (clipKind === 'titleSequence')` arm.
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence');
    expect(binding?.clipName).toBe('titleSequence');
    expect(binding?.overlays).toBeUndefined();
    const props = binding?.buildProps(undefined) as { style: string };
    expect(props.style).toBe('palette-jump-cut'); // T-350 D-T350-7 register
  });

  it('stranger-things-benguiat binding STILL fans out 4 overlays after T-349 lands (T-349 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'stranger-things-benguiat');
    expect(binding?.overlays).toHaveLength(4);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('light-leak');
    expect(binding?.overlays?.[2]?.clipName).toBe('particles');
    expect(binding?.overlays?.[3]?.clipName).toBe('photographic-overlay');
  });

  it('true-detective-double-exposure binding STILL fans out 2 overlays after T-349 lands (T-349 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'true-detective-double-exposure');
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  it('succession-home-video binding STILL fans out 2 overlays after T-349 lands (T-349 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'succession-home-video');
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  it('severance-surreal-3d binding STILL fans out 2 overlays after T-349 lands (T-349 AC #22 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'severance-surreal-3d');
    expect(binding?.overlays).toHaveLength(2);
    expect(binding?.overlays?.[0]?.clipName).toBe('grain');
    expect(binding?.overlays?.[1]?.clipName).toBe('photographic-overlay');
  });

  // T-375 — first `arOverlay`-clipKind preset (`sky-sports-ar-formations`),
  // wired as the `arOverlay` clipKind-default (Pattern C — first preset for
  // a clipKind takes the clipKind-default slot, NOT a `PRESET_ID_BINDINGS`
  // override). First Cluster H preset to ship; first preset to bind the
  // `ArOverlay` primitive (T-375a, PR #460) end-to-end. **§13 verifier**
  // for the arOverlay clipKind structural extension introduced in T-375a
  // (PR #460 deferred pixel verification per CLAUDE.md §13 option 3).

  it('resolves arOverlay to arOverlay on the frame-runtime (T-375 D-T375-1)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('arOverlay');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('arOverlay');
  });

  it('falls through to skySportsArFormationsBinding for sky-sports-ar-formations (T-375 AC #2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('arOverlay', 'sky-sports-ar-formations');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('arOverlay');
  });

  it('falls through to skySportsArFormationsBinding for unknown arOverlay presetIds (T-375 AC #2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('arOverlay', 'unknown-ar-preset');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('arOverlay');
  });

  it('exports SKY_SPORTS_AR_FORMATIONS_PALETTE with sealed brand constants (T-375 AC #1 / D-T375-2)', () => {
    expect(SKY_SPORTS_AR_FORMATIONS_PALETTE.skyNavy).toBe('#0A1128');
    expect(SKY_SPORTS_AR_FORMATIONS_PALETTE.premierPurple).toBe('#38003C');
    expect(SKY_SPORTS_AR_FORMATIONS_PALETTE.foreground).toBe('#FFFFFF');
    expect(Object.isFrozen(SKY_SPORTS_AR_FORMATIONS_PALETTE)).toBe(true);
  });

  it('builds arOverlay props with the sky-sports-ar-formations canonical static-fallback snapshot (T-375 AC #2 / D-T375-3)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('arOverlay');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    const staticFallback = props.staticFallback as {
      label: string;
      sublabel?: string;
      backgroundColor?: string;
      foregroundColor?: string;
      accentColor?: string;
      showLiveMountIndicator?: boolean;
    };
    expect(staticFallback.label).toBe('AR FORMATION OVERLAY');
    expect(staticFallback.sublabel).toBe('4-3-3 LINEUP');
    expect(staticFallback.backgroundColor).toBe(SKY_SPORTS_AR_FORMATIONS_PALETTE.skyNavy);
    expect(staticFallback.foregroundColor).toBe(SKY_SPORTS_AR_FORMATIONS_PALETTE.foreground);
    expect(staticFallback.accentColor).toBe(SKY_SPORTS_AR_FORMATIONS_PALETTE.premierPurple);
    expect(staticFallback.showLiveMountIndicator).toBe(true);
    const font = props.font as { family: string; weight: number };
    expect(font.weight).toBe(700);
    expect(font.family).toContain('Sky Sports Sans');
    expect(font.family).toContain('Inter');
    // permissions: ['camera-tracking'] declared (forward-compat); v1 ignores it per D-T375a-2.
    expect(props.permissions).toEqual(['camera-tracking']);
    // setupRef NOT supplied in v1 — live-mount lands with T-375-live-mount post-T-397.
    expect(props.setupRef).toBeUndefined();
    // Pattern C — no PRESET_ID_BINDINGS entry (first preset for arOverlay clipKind takes the clipKind-default slot).
    expect(PRESET_ID_BINDINGS['sky-sports-ar-formations']).toBeUndefined();
  });

  it('routes sky-sports-ar-formations through the renderer-side clipKind-default (T-375 AC #5 round-trip; §13 verifier shape)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('arOverlay', 'sky-sports-ar-formations', 'ar'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('arOverlay');
    const params = element.content.params as {
      staticFallback: { label: string; backgroundColor: string };
    };
    expect(params.staticFallback.label).toBe('AR FORMATION OVERLAY');
    expect(params.staticFallback.backgroundColor).toBe('#0A1128');
  });

  // T-375 backward compat — every prior cluster's clipKind-default + per-
  // preset overrides must still resolve correctly after the arOverlay
  // clipKind-default lands.

  it('clipKind-default for titleSequence STILL returns squidGameGeometric after T-375 lands (T-375 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence');
    expect(binding?.clipName).toBe('titleSequence');
    const props = binding?.buildProps(undefined) as { style: string };
    expect(props.style).toBe('palette-jump-cut');
  });

  it('falls through to lyricsBinding for karaoke-progressive-wipe after T-375 lands (T-375 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('lyrics', 'karaoke-progressive-wipe');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('lyrics');
  });

  it('routes big-number-stat-impact via PRESET_ID_BINDINGS after T-375 lands (T-375 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber', 'big-number-stat-impact');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('animated-value');
    expect(PRESET_ID_BINDINGS['big-number-stat-impact']).toBeDefined();
  });

  it('still returns undefined for unknown clipKinds after T-375 lands', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind', 'sky-sports-ar-formations')).toBeUndefined();
  });

  // T-376 — second `arOverlay`-clipKind preset (`hawkeye-var-3d-skeletal`),
  // wired via PRESET_ID_BINDINGS override (Pattern C — second-preset-for-
  // clipKind via override; the arOverlay clipKind-default arm STAYS bound
  // to skySportsArFormationsBinding from T-375). Cluster H 1/4 → 2/4
  // ELIGIBLE. NOT a §13 (F-30) verifier — reuses arOverlay clipKind whose
  // structural-extension verification was discharged by PR #461 (T-375).

  it('routes hawkeye-var-3d-skeletal via PRESET_ID_BINDINGS override (T-376 D-T376-1; Pattern C second-preset-for-clipKind)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('arOverlay', 'hawkeye-var-3d-skeletal');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('arOverlay');
    expect(PRESET_ID_BINDINGS['hawkeye-var-3d-skeletal']).toBeDefined();
    expect(PRESET_ID_BINDINGS['hawkeye-var-3d-skeletal']).toBe(binding);
  });

  it('arOverlay clipKind-default STILL returns sky-sports for non-overridden presetIds after T-376 lands (T-376 AC #5; resolver arm unchanged)', () => {
    const skyBinding = DEFAULT_CLIP_KIND_RESOLVER('arOverlay');
    const unknownBinding = DEFAULT_CLIP_KIND_RESOLVER('arOverlay', 'unknown-ar-preset');
    const skyByName = DEFAULT_CLIP_KIND_RESOLVER('arOverlay', 'sky-sports-ar-formations');
    expect(skyBinding).toBeDefined();
    expect(unknownBinding).toBeDefined();
    expect(skyByName).toBeDefined();
    // All three resolve to the same binding (the clipKind-default
    // skySportsArFormationsBinding; sky-sports-ar-formations does NOT have
    // a PRESET_ID_BINDINGS entry per T-375 D-T375-1).
    expect(skyBinding).toBe(unknownBinding);
    expect(skyBinding).toBe(skyByName);
    // The hawkeye binding is DIFFERENT from the sky-sports binding
    // (different per-preset overrides).
    const hawkeyeBinding = DEFAULT_CLIP_KIND_RESOLVER('arOverlay', 'hawkeye-var-3d-skeletal');
    expect(hawkeyeBinding).not.toBe(skyBinding);
  });

  it('exports HAWKEYE_VAR_SKELETAL_PALETTE with sealed brand constants (T-376 AC #1 / D-T376-2)', () => {
    expect(HAWKEYE_VAR_SKELETAL_PALETTE.premierLeaguePurple).toBe('#34003A');
    expect(HAWKEYE_VAR_SKELETAL_PALETTE.decisionGreen).toBe('#00FC8A');
    expect(HAWKEYE_VAR_SKELETAL_PALETTE.foreground).toBe('#FFFFFF');
    expect(HAWKEYE_VAR_SKELETAL_PALETTE.attackerLine).toBe('#FF6B35');
    expect(HAWKEYE_VAR_SKELETAL_PALETTE.defenderLine).toBe('#00B5D8');
    expect(Object.isFrozen(HAWKEYE_VAR_SKELETAL_PALETTE)).toBe(true);
  });

  it('builds arOverlay props with the hawkeye-var-3d-skeletal canonical static-fallback snapshot (T-376 AC #2 / D-T376-3)', () => {
    const binding = PRESET_ID_BINDINGS['hawkeye-var-3d-skeletal'];
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    const staticFallback = props.staticFallback as {
      label: string;
      sublabel?: string;
      backgroundColor?: string;
      foregroundColor?: string;
      accentColor?: string;
      showLiveMountIndicator?: boolean;
    };
    expect(staticFallback.label).toBe('VAR — CHECKING OFFSIDE');
    expect(staticFallback.sublabel).toBe('HAWK-EYE 3D SKELETAL TRACKING');
    expect(staticFallback.backgroundColor).toBe(HAWKEYE_VAR_SKELETAL_PALETTE.premierLeaguePurple);
    expect(staticFallback.foregroundColor).toBe(HAWKEYE_VAR_SKELETAL_PALETTE.foreground);
    expect(staticFallback.accentColor).toBe(HAWKEYE_VAR_SKELETAL_PALETTE.decisionGreen);
    expect(staticFallback.showLiveMountIndicator).toBe(true);
    const font = props.font as { family: string; weight: number };
    expect(font.weight).toBe(700);
    expect(font.family).toContain('Premier Sans');
    expect(font.family).toContain('Champions');
    expect(font.family).toContain('Space Grotesk');
    // permissions: ['camera-tracking'] declared (forward-compat); v1 ignores per D-T375a-2.
    expect(props.permissions).toEqual(['camera-tracking']);
    // setupRef NOT supplied in v1 — live-mount lands with T-376-live-mount post-T-397.
    expect(props.setupRef).toBeUndefined();
  });

  it('routes hawkeye-var-3d-skeletal end-to-end through the renderer-side PRESET_ID_BINDINGS override (T-376 AC #6 round-trip)', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('arOverlay', 'hawkeye-var-3d-skeletal', 'ar'),
      composition: COMPOSITION,
      frame: 60,
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.clipName).toBe('arOverlay');
    const params = element.content.params as {
      staticFallback: { label: string; backgroundColor: string; accentColor: string };
    };
    expect(params.staticFallback.label).toBe('VAR — CHECKING OFFSIDE');
    expect(params.staticFallback.backgroundColor).toBe('#34003A');
    expect(params.staticFallback.accentColor).toBe('#00FC8A');
  });

  // T-376 backward compat — T-375's resolver arm + every prior cluster's
  // clipKind-default + per-preset overrides must still resolve correctly
  // after the hawkeye PRESET_ID_BINDINGS entry lands.

  it('falls through to skySportsArFormationsBinding for sky-sports-ar-formations after T-376 lands (T-376 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('arOverlay', 'sky-sports-ar-formations');
    expect(binding).toBeDefined();
    expect(binding?.clipName).toBe('arOverlay');
    const props = binding?.buildProps(undefined) as {
      staticFallback: { label: string };
    };
    expect(props.staticFallback.label).toBe('AR FORMATION OVERLAY');
  });

  it('clipKind-default for titleSequence STILL returns squidGameGeometric after T-376 lands (T-376 backward compat)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence');
    expect(binding?.clipName).toBe('titleSequence');
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

  // T-348 — multi-clip composition surface (D-T348-1). Bindings that
  // declare an `overlays?` array fan out one RIRDocument.elements entry per
  // overlay in declaration order = z-order (parent at zIndex 0; overlays
  // at zIndex 1, 2, 3, ...). Single-clip bindings (no `overlays`) emit
  // exactly one element — backward compat for all 25 existing
  // PRESET_ID_BINDINGS entries + the 10 clipKind-default arms.
  it('single-clip binding (no overlays) emits exactly one element (T-348 AC #12 backward compat)', () => {
    const doc = buildPresetDocument({
      preset: presetWith('bigNumber', 'demo'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'animated-value',
        buildProps: () => ({}),
      },
      props: { value: 1 },
    });
    expect(doc.elements).toHaveLength(1);
    expect(doc.elements[0]?.zIndex).toBe(0);
    expect(doc.elements[0]?.id).toBe('preset-clip-0');
  });

  it('multi-clip binding (with overlays) fans out N+1 elements with strictly increasing zIndex (T-348 AC #10 / AC #11)', () => {
    const doc = buildPresetDocument({
      preset: presetWith('titleSequence', 'demo', 'titles'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'titleSequence',
        buildProps: () => ({ parent: true }),
        overlays: [
          { runtimeId: 'frame-runtime', clipName: 'grain', buildProps: () => ({ a: 1 }) },
          { runtimeId: 'frame-runtime', clipName: 'light-leak', buildProps: () => ({ b: 2 }) },
          { runtimeId: 'frame-runtime', clipName: 'particles', buildProps: () => ({ c: 3 }) },
          {
            runtimeId: 'frame-runtime',
            clipName: 'photographic-overlay',
            buildProps: () => ({ d: 4 }),
          },
        ],
      },
      props: { parent: true },
    });
    expect(doc.elements).toHaveLength(5);
    expect(doc.elements.map((e) => e.zIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(doc.elements.map((e) => e.id)).toEqual([
      'preset-clip-0',
      'preset-clip-1',
      'preset-clip-2',
      'preset-clip-3',
      'preset-clip-4',
    ]);
    // Parent + 4 overlays bind to their declared clipNames in declaration order.
    const clipNames = doc.elements.map((e) =>
      e.content.type === 'clip' ? e.content.clipName : null,
    );
    expect(clipNames).toEqual([
      'titleSequence',
      'grain',
      'light-leak',
      'particles',
      'photographic-overlay',
    ]);
  });

  it('every fanned-out element shares the parent transform + timing (T-348 AC #10)', () => {
    const doc = buildPresetDocument({
      preset: presetWith('titleSequence', 'demo', 'titles'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'titleSequence',
        buildProps: () => ({}),
        overlays: [
          { runtimeId: 'frame-runtime', clipName: 'grain', buildProps: () => ({}) },
          { runtimeId: 'frame-runtime', clipName: 'particles', buildProps: () => ({}) },
        ],
      },
      props: {},
    });
    for (const el of doc.elements) {
      expect(el.transform).toEqual({
        x: 0,
        y: 0,
        width: COMPOSITION.width,
        height: COMPOSITION.height,
        rotation: 0,
        opacity: 1,
      });
      expect(el.timing).toEqual({
        startFrame: 0,
        endFrame: COMPOSITION.durationInFrames,
        durationFrames: COMPOSITION.durationInFrames,
      });
    }
  });

  it('overlay buildProps are routed through the fanout with the parent variant (T-348 AC #10)', () => {
    const doc = buildPresetDocument({
      preset: presetWith('titleSequence', 'demo', 'titles'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'titleSequence',
        buildProps: (v) => ({ kind: 'parent', variant: v }),
        overlays: [
          {
            runtimeId: 'frame-runtime',
            clipName: 'grain',
            buildProps: (v) => ({ kind: 'grain', variant: v }),
          },
        ],
      },
      props: { kind: 'parent', variant: 'demoVariant' },
      variant: 'demoVariant',
    });
    expect(doc.elements).toHaveLength(2);
    const overlayContent = doc.elements[1]?.content;
    if (!overlayContent || overlayContent.type !== 'clip') throw new Error('expected clip');
    expect(overlayContent.params).toEqual({ kind: 'grain', variant: 'demoVariant' });
    expect(overlayContent.clipName).toBe('grain');
  });

  it('stranger-things-benguiat binding fans out 5 elements through buildPresetDocument (T-348 AC #10 / AC #11)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'stranger-things-benguiat');
    if (!binding) throw new Error('test setup');
    const doc = buildPresetDocument({
      preset: presetWith('titleSequence', 'stranger-things-benguiat', 'titles'),
      composition: COMPOSITION,
      binding,
      props: binding.buildProps(undefined),
    });
    expect(doc.elements).toHaveLength(5);
    expect(doc.elements.map((e) => e.zIndex)).toEqual([0, 1, 2, 3, 4]);
    const clipNames = doc.elements.map((e) =>
      e.content.type === 'clip' ? e.content.clipName : null,
    );
    expect(clipNames).toEqual([
      'titleSequence',
      'grain',
      'light-leak',
      'particles',
      'photographic-overlay',
    ]);
  });

  it('true-detective-double-exposure binding fans out 3 elements through buildPresetDocument (T-351 AC #11 / D-T351-2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'true-detective-double-exposure');
    if (!binding) throw new Error('test setup');
    const doc = buildPresetDocument({
      preset: presetWith('titleSequence', 'true-detective-double-exposure', 'titles'),
      composition: COMPOSITION,
      binding,
      props: binding.buildProps(undefined),
    });
    // 3 elements (parent + 2 overlays); fewer than T-348's 5 (intentional 3-clip stack).
    expect(doc.elements).toHaveLength(3);
    expect(doc.elements.map((e) => e.zIndex)).toEqual([0, 1, 2]);
    const clipNames = doc.elements.map((e) =>
      e.content.type === 'clip' ? e.content.clipName : null,
    );
    expect(clipNames).toEqual(['titleSequence', 'grain', 'photographic-overlay']);
  });

  it('succession-home-video binding fans out 3 elements through buildPresetDocument (T-352 AC #11 / D-T352-2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'succession-home-video');
    if (!binding) throw new Error('test setup');
    const doc = buildPresetDocument({
      preset: presetWith('titleSequence', 'succession-home-video', 'titles'),
      composition: COMPOSITION,
      binding,
      props: binding.buildProps(undefined),
    });
    // 3 elements (parent + 2 overlays); matches T-351's shape (intentional
    // 3-clip stack — sepia + grain VHS canon does not enumerate light-leak
    // / particles per stub line 26).
    expect(doc.elements).toHaveLength(3);
    expect(doc.elements.map((e) => e.zIndex)).toEqual([0, 1, 2]);
    const clipNames = doc.elements.map((e) =>
      e.content.type === 'clip' ? e.content.clipName : null,
    );
    expect(clipNames).toEqual(['titleSequence', 'grain', 'photographic-overlay']);
  });

  it('severance-surreal-3d binding fans out 3 elements through buildPresetDocument (T-353 AC #11 / D-T353-2)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('titleSequence', 'severance-surreal-3d');
    if (!binding) throw new Error('test setup');
    const doc = buildPresetDocument({
      preset: presetWith('titleSequence', 'severance-surreal-3d', 'titles'),
      composition: COMPOSITION,
      binding,
      props: binding.buildProps(undefined),
    });
    // 3 elements (parent + 2 overlays); matches T-351 + T-352's shape
    // (intentional 3-clip stack — sterile-corporate canon does not
    // enumerate light-leak / particles per stub line 23).
    expect(doc.elements).toHaveLength(3);
    expect(doc.elements.map((e) => e.zIndex)).toEqual([0, 1, 2]);
    const clipNames = doc.elements.map((e) =>
      e.content.type === 'clip' ? e.content.clipName : null,
    );
    expect(clipNames).toEqual(['titleSequence', 'grain', 'photographic-overlay']);
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
