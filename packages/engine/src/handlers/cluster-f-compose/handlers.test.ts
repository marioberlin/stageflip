// packages/engine/src/handlers/cluster-f-compose/handlers.test.ts
// Vitest coverage for the 4 cluster-f-compose tools — happy-path
// dispatch per style enum, default-branch fallbacks, schema rejection
// (strict mode + sealed enums + hex regex), brand passthrough, and
// determinism (same input → deeply equal output).

import { describe, expect, it } from 'vitest';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import { CLUSTER_F_COMPOSE_HANDLERS, CLUSTER_F_PRESET_IDS } from './handlers.js';

const ctx: ToolContext = {};

function getTool(name: string): ToolHandler<unknown, unknown, ToolContext> {
  const found = CLUSTER_F_COMPOSE_HANDLERS.find((h) => h.name === name);
  if (!found) throw new Error(`tool ${name} not found in CLUSTER_F_COMPOSE_HANDLERS`);
  return found;
}

async function invoke(name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  const parsed = tool.inputSchema.parse(input);
  const result = await tool.handle(parsed, ctx);
  // Round-trip the output through its schema to catch shape drift.
  return tool.outputSchema.parse(result);
}

const transcriptOne = [{ text: 'hello', startMs: 0, endMs: 500 }];
const transcriptThree = [
  { text: 'this', startMs: 0, endMs: 200 },
  { text: 'is', startMs: 200, endMs: 350 },
  { text: 'amazing', startMs: 350, endMs: 900 },
];

describe('compose_creator_caption', () => {
  it('dispatches every style enum to the correct preset', async () => {
    const cases: Array<[string, string]> = [
      ['hormozi', 'hormozi-montserrat-black'],
      ['mrbeast', 'mrbeast-komika-axis'],
      ['tiktok', 'tiktok-rounded-box'],
      ['ali-abdaal', 'ali-abdaal-opacity-karaoke'],
      ['netflix', 'netflix-invisible'],
    ];
    for (const [style, expectedPreset] of cases) {
      const out = (await invoke('compose_creator_caption', {
        transcript: transcriptOne,
        style,
      })) as { ok: true; presetId: string; clipKind: string; rationale: string };
      expect(out.ok).toBe(true);
      expect(out.presetId).toBe(expectedPreset);
      expect(out.clipKind).toBe('caption');
      expect(out.rationale.length).toBeGreaterThan(0);
    }
  });

  it('default (style omitted) routes to tiktok-rounded-box', async () => {
    const out = (await invoke('compose_creator_caption', {
      transcript: transcriptOne,
    })) as { ok: true; presetId: string; rationale: string };
    expect(out.presetId).toBe('tiktok-rounded-box');
    expect(out.rationale).toMatch(/platform-native|tiktok/i);
  });

  it('echoes transcript verbatim into the output envelope', async () => {
    const out = (await invoke('compose_creator_caption', {
      transcript: transcriptThree,
      style: 'hormozi',
    })) as { ok: true; transcript: typeof transcriptThree };
    expect(out.transcript).toEqual(transcriptThree);
  });

  it('echoes brand verbatim when supplied; absent when omitted', async () => {
    const brand = { primary: '#FF0000', accent: '#00FF00', font: 'Inter' };
    const withBrand = (await invoke('compose_creator_caption', {
      transcript: transcriptOne,
      style: 'hormozi',
      brand,
    })) as { brand?: unknown };
    expect(withBrand.brand).toEqual(brand);
    const without = (await invoke('compose_creator_caption', {
      transcript: transcriptOne,
      style: 'hormozi',
    })) as { brand?: unknown };
    expect(without.brand).toBeUndefined();
  });

  it('schema rejects empty transcript / unknown style / extra field / bad hex', () => {
    const tool = getTool('compose_creator_caption');
    expect(() => tool.inputSchema.parse({ transcript: [] })).toThrow();
    expect(() => tool.inputSchema.parse({ transcript: transcriptOne, style: 'rogue' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ transcript: transcriptOne, style: 'hormozi', rogue: 1 }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        transcript: transcriptOne,
        brand: { primary: '#XYZ' },
      }),
    ).toThrow();
    // nested word-timing strict mode
    expect(() =>
      tool.inputSchema.parse({
        transcript: [{ text: 'x', startMs: 0, endMs: 1, rogue: 'y' }],
      }),
    ).toThrow();
    // wordTiming requires positive endMs
    expect(() =>
      tool.inputSchema.parse({
        transcript: [{ text: 'x', startMs: 0, endMs: 0 }],
      }),
    ).toThrow();
  });

  it('determinism — same input twice yields deeply-equal output', async () => {
    const input = { transcript: transcriptThree, style: 'mrbeast' as const };
    const a = await invoke('compose_creator_caption', input);
    const b = await invoke('compose_creator_caption', input);
    expect(a).toEqual(b);
  });
});

describe('compose_subtitle', () => {
  it('default (no accessibility_mode) routes to netflix-invisible (strict)', async () => {
    const out = (await invoke('compose_subtitle', {
      transcript: transcriptOne,
    })) as { ok: true; presetId: string; clipKind: string; rationale: string };
    expect(out.presetId).toBe('netflix-invisible');
    expect(out.clipKind).toBe('caption');
    expect(out.rationale).toMatch(/strict|FCC/i);
  });

  it("accessibility_mode='strict' routes to netflix-invisible", async () => {
    const out = (await invoke('compose_subtitle', {
      transcript: transcriptOne,
      accessibility_mode: 'strict',
    })) as { ok: true; presetId: string };
    expect(out.presetId).toBe('netflix-invisible');
  });

  it("accessibility_mode='relaxed' routes to tiktok-rounded-box", async () => {
    const out = (await invoke('compose_subtitle', {
      transcript: transcriptOne,
      accessibility_mode: 'relaxed',
    })) as { ok: true; presetId: string; rationale: string };
    expect(out.presetId).toBe('tiktok-rounded-box');
    expect(out.rationale).toMatch(/relaxed|platform-native/i);
  });

  it('schema rejects unknown accessibility_mode / extra field', () => {
    const tool = getTool('compose_subtitle');
    expect(() =>
      tool.inputSchema.parse({
        transcript: transcriptOne,
        accessibility_mode: 'super-strict',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        transcript: transcriptOne,
        rogue: 'x',
      }),
    ).toThrow();
  });
});

describe('compose_lyric_video', () => {
  it('happy path: minimal lyrics → karaoke-progressive-wipe with clipKind lyrics', async () => {
    const out = (await invoke('compose_lyric_video', {
      lyrics: transcriptOne,
    })) as {
      ok: true;
      presetId: string;
      clipKind: string;
      lyrics: typeof transcriptOne;
    };
    expect(out.ok).toBe(true);
    expect(out.presetId).toBe('karaoke-progressive-wipe');
    expect(out.clipKind).toBe('lyrics');
    expect(out.lyrics).toEqual(transcriptOne);
  });

  it('echoes lyrics + music payload when supplied', async () => {
    const music = { bpm: 128, beatGrid: [0, 468, 937, 1406] };
    const out = (await invoke('compose_lyric_video', {
      lyrics: transcriptThree,
      music,
      style: 'progressive-wipe' as const,
    })) as { lyrics: typeof transcriptThree; music?: typeof music };
    expect(out.lyrics).toEqual(transcriptThree);
    expect(out.music).toEqual(music);
  });

  it('schema rejects empty lyrics / unknown style / bad bpm', () => {
    const tool = getTool('compose_lyric_video');
    expect(() => tool.inputSchema.parse({ lyrics: [] })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ lyrics: transcriptOne, style: 'static-stack' }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        lyrics: transcriptOne,
        music: { bpm: 0 },
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        lyrics: transcriptOne,
        music: { bpm: 120, rogue: 1 },
      }),
    ).toThrow();
  });
});

describe('compose_keyword_highlight', () => {
  it("default style ('hormozi') routes to hormozi-montserrat-black", async () => {
    const out = (await invoke('compose_keyword_highlight', {
      transcript: transcriptThree,
      keywords: ['amazing'],
    })) as { ok: true; presetId: string; keywords: string[]; clipKind: string };
    expect(out.presetId).toBe('hormozi-montserrat-black');
    expect(out.clipKind).toBe('caption');
    expect(out.keywords).toEqual(['amazing']);
  });

  it("style 'mrbeast' routes to mrbeast-komika-axis", async () => {
    const out = (await invoke('compose_keyword_highlight', {
      transcript: transcriptThree,
      keywords: ['$1,000,000'],
      style: 'mrbeast',
    })) as { ok: true; presetId: string; rationale: string };
    expect(out.presetId).toBe('mrbeast-komika-axis');
    expect(out.rationale).toMatch(/monetary|mrbeast/i);
  });

  it('schema rejects empty keywords / empty-string keyword / unknown style', () => {
    const tool = getTool('compose_keyword_highlight');
    expect(() => tool.inputSchema.parse({ transcript: transcriptOne, keywords: [] })).toThrow();
    expect(() => tool.inputSchema.parse({ transcript: transcriptOne, keywords: [''] })).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        transcript: transcriptOne,
        keywords: ['a'],
        style: 'tiktok',
      }),
    ).toThrow();
  });
});

describe('barrel discipline', () => {
  it('CLUSTER_F_PRESET_IDS contains 6 entries', () => {
    expect(CLUSTER_F_PRESET_IDS.length).toBe(6);
  });

  it('handlers array length is 4', () => {
    expect(CLUSTER_F_COMPOSE_HANDLERS.length).toBe(4);
  });

  it('every handler declares bundle === "cluster-f-compose"', () => {
    for (const h of CLUSTER_F_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe('cluster-f-compose');
    }
  });

  it('handler names match the four canonical compose tools', () => {
    const names = CLUSTER_F_COMPOSE_HANDLERS.map((h) => h.name).sort();
    expect(names).toEqual([
      'compose_creator_caption',
      'compose_keyword_highlight',
      'compose_lyric_video',
      'compose_subtitle',
    ]);
  });

  it('compose_lyric_video is the only tool returning clipKind: lyrics', async () => {
    const lyric = (await invoke('compose_lyric_video', {
      lyrics: transcriptOne,
    })) as { clipKind: string };
    expect(lyric.clipKind).toBe('lyrics');
    const cap = (await invoke('compose_creator_caption', {
      transcript: transcriptOne,
      style: 'hormozi',
    })) as { clipKind: string };
    expect(cap.clipKind).toBe('caption');
    const sub = (await invoke('compose_subtitle', {
      transcript: transcriptOne,
    })) as { clipKind: string };
    expect(sub.clipKind).toBe('caption');
    const kw = (await invoke('compose_keyword_highlight', {
      transcript: transcriptOne,
      keywords: ['x'],
    })) as { clipKind: string };
    expect(kw.clipKind).toBe('caption');
  });
});
