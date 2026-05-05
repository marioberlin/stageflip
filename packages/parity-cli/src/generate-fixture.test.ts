// packages/parity-cli/src/generate-fixture.test.ts
// Tests for the production-renderer binding (T-359a). Uses a stub
// `PrimeRenderFn` (no Chrome / ffmpeg dependency).

import { rirDocumentSchema } from '@stageflip/rir';
import { describe, expect, it, vi } from 'vitest';

import {
  BLOOMBERG_CANONICAL_SNAPSHOT,
  CRICKET_OUTCOME_COLORS,
  DEFAULT_CLIP_KIND_RESOLVER,
  F1_SECTOR_STATE_COLORS,
  GenerateFixtureUnavailableError,
  HORMOZI_CANONICAL_WORDS,
  OLYMPIC_CANONICAL_STANDINGS,
  PRESET_ID_BINDINGS,
  type PresetForRender,
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
