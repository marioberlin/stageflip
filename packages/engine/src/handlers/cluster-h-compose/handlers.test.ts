// packages/engine/src/handlers/cluster-h-compose/handlers.test.ts
// Vitest coverage for the 3 cluster-h-compose tools — happy-path
// dispatch per (sport, brand) tuple, error reasons, schema rejection,
// full Cluster H preset coverage, determinism + read-only invariants.

import { describe, expect, it } from 'vitest';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  AR_BRANDS,
  AR_CONTENT_KINDS,
  CLUSTER_H_COMPOSE_HANDLERS,
  CLUSTER_H_PRESET_IDS,
  DISPLAY_TIERS,
  SPORTS,
  SWIM_BRANDS,
  VAR_BRANDS,
} from './handlers.js';

const ctx: ToolContext = {};

function getTool(name: string): ToolHandler<unknown, unknown, ToolContext> {
  const found = CLUSTER_H_COMPOSE_HANDLERS.find((h) => h.name === name);
  if (!found) throw new Error(`tool ${name} not found in CLUSTER_H_COMPOSE_HANDLERS`);
  return found;
}

async function invoke(name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  const parsed = tool.inputSchema.parse(input);
  const result = await tool.handle(parsed, ctx);
  return tool.outputSchema.parse(result);
}

describe('compose_ar_overlay', () => {
  it('happy path: soccer + sky-sports → sky-sports-ar-formations', async () => {
    const out = (await invoke('compose_ar_overlay', {
      sport: 'soccer',
      content: 'formation',
      brand: 'sky-sports',
    })) as {
      ok: true;
      presetId: string;
      clipKind: string;
      props: Record<string, unknown>;
    };
    expect(out.ok).toBe(true);
    expect(out.presetId).toBe('sky-sports-ar-formations');
    expect(out.clipKind).toBe('arOverlay');
    expect(out.props.sport).toBe('soccer');
    expect(out.props.content).toBe('formation');
  });

  it('happy path: football + sky-sports → sky-sports-ar-formations', async () => {
    const out = (await invoke('compose_ar_overlay', {
      sport: 'football',
      content: 'formation',
      brand: 'sky-sports',
      cameraTrack: { feed: 'live', provider: 'Zero Density' },
      displayTier: 'broadcast',
      label: 'PREMIER LEAGUE — MATCH DAY',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(out.presetId).toBe('sky-sports-ar-formations');
    expect(out.props.cameraTrack).toEqual({ feed: 'live', provider: 'Zero Density' });
    expect(out.props.displayTier).toBe('broadcast');
    expect(out.props.label).toBe('PREMIER LEAGUE — MATCH DAY');
  });

  it('happy path: basketball + nba → nba-ar-replay', async () => {
    const out = (await invoke('compose_ar_overlay', {
      sport: 'basketball',
      content: 'shot-arc',
      brand: 'nba',
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(out.presetId).toBe('nba-ar-replay');
    expect(out.clipKind).toBe('arOverlay');
    expect(out.props.content).toBe('shot-arc');
  });

  it('rejects (tennis, formation, sky-sports) with no_preset_for_sport_brand', async () => {
    const out = (await invoke('compose_ar_overlay', {
      sport: 'tennis',
      content: 'formation',
      brand: 'sky-sports',
    })) as { ok: false; reason: string; detail?: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no_preset_for_sport_brand');
    expect(out.detail).toBeDefined();
  });

  it('rejects (soccer, formation, espn) with no_preset_for_sport_brand', async () => {
    const out = (await invoke('compose_ar_overlay', {
      sport: 'soccer',
      content: 'formation',
      brand: 'espn',
    })) as { ok: false; reason: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no_preset_for_sport_brand');
  });

  it('schema rejects bad enum / missing required / extras at root + nested', () => {
    const tool = getTool('compose_ar_overlay');
    expect(() =>
      tool.inputSchema.parse({ sport: 'curling', content: 'formation', brand: 'sky-sports' }),
    ).toThrow();
    expect(() => tool.inputSchema.parse({ sport: 'soccer', content: 'formation' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        sport: 'soccer',
        content: 'formation',
        brand: 'sky-sports',
        rogue: 'x',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        sport: 'soccer',
        content: 'formation',
        brand: 'sky-sports',
        cameraTrack: { feed: 'live', rogue: 'x' },
      }),
    ).toThrow();
  });
});

describe('compose_var_skeletal', () => {
  it('happy path: minimal + full input', async () => {
    const minimal = (await invoke('compose_var_skeletal', { brand: 'hawkeye' })) as {
      ok: true;
      presetId: string;
      clipKind: string;
      props: Record<string, unknown>;
    };
    expect(minimal.presetId).toBe('hawkeye-var-3d-skeletal');
    expect(minimal.clipKind).toBe('arOverlay');

    const full = (await invoke('compose_var_skeletal', {
      brand: 'premier-league',
      freezeFrame: { timestampMs: 1234567, advisory: 'CHECKING OFFSIDE' },
      playerTracking: [
        { role: 'attacker', skeletalPoints: 17 },
        { role: 'defender', skeletalPoints: 17 },
      ],
      decision: 'overturned',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(full.presetId).toBe('hawkeye-var-3d-skeletal');
    expect(full.props.decision).toBe('overturned');
    expect(full.props.freezeFrame).toEqual({ timestampMs: 1234567, advisory: 'CHECKING OFFSIDE' });
  });

  it('dispatch: hawkeye + premier-league + uefa-cl all route to hawkeye-var-3d-skeletal', async () => {
    for (const brand of VAR_BRANDS) {
      const out = (await invoke('compose_var_skeletal', { brand })) as {
        ok: true;
        presetId: string;
      };
      expect(out.presetId).toBe('hawkeye-var-3d-skeletal');
    }
  });

  it('schema rejects bad brand / extras', () => {
    const tool = getTool('compose_var_skeletal');
    expect(() => tool.inputSchema.parse({ brand: 'fox-sports' })).toThrow();
    expect(() => tool.inputSchema.parse({})).toThrow();
    expect(() => tool.inputSchema.parse({ brand: 'hawkeye', rogue: 'x' })).toThrow();
    // freezeFrame nested rejects extras
    expect(() =>
      tool.inputSchema.parse({
        brand: 'hawkeye',
        freezeFrame: { timestampMs: 0, rogue: 'x' },
      }),
    ).toThrow();
    // negative timestampMs
    expect(() =>
      tool.inputSchema.parse({ brand: 'hawkeye', freezeFrame: { timestampMs: -1 } }),
    ).toThrow();
  });
});

describe('compose_swim_lane_track', () => {
  it('happy path: minimal + full input', async () => {
    const minimal = (await invoke('compose_swim_lane_track', {
      brand: 'olympic',
      laneCount: 8,
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(minimal.presetId).toBe('olympic-swim-lane-track');
    expect(minimal.clipKind).toBe('arOverlay');
    expect(minimal.props.laneCount).toBe(8);

    const full = (await invoke('compose_swim_lane_track', {
      brand: 'omega',
      laneCount: 8,
      recordTime: {
        seconds: 46.86,
        holder: 'David Popovici',
        eventName: "Men's 100m Freestyle",
      },
      athletes: [
        { laneNumber: 4, name: 'Popovici', countryCode: 'ROU' },
        { laneNumber: 5, name: 'Chalmers', countryCode: 'AUS' },
      ],
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(full.presetId).toBe('olympic-swim-lane-track');
    expect(full.props.recordTime).toEqual({
      seconds: 46.86,
      holder: 'David Popovici',
      eventName: "Men's 100m Freestyle",
    });
    expect((full.props.athletes as unknown[]).length).toBe(2);
  });

  it('dispatch: olympic + omega + fina + world-aquatics all route to olympic-swim-lane-track', async () => {
    for (const brand of SWIM_BRANDS) {
      const out = (await invoke('compose_swim_lane_track', { brand, laneCount: 6 })) as {
        ok: true;
        presetId: string;
      };
      expect(out.presetId).toBe('olympic-swim-lane-track');
    }
  });

  it('schema rejects laneCount < 2 / > 10 / bad brand / extras', () => {
    const tool = getTool('compose_swim_lane_track');
    expect(() => tool.inputSchema.parse({ brand: 'olympic', laneCount: 1 })).toThrow();
    expect(() => tool.inputSchema.parse({ brand: 'olympic', laneCount: 11 })).toThrow();
    expect(() => tool.inputSchema.parse({ brand: 'random', laneCount: 8 })).toThrow();
    expect(() => tool.inputSchema.parse({ brand: 'olympic', laneCount: 8, rogue: 'x' })).toThrow();
    // recordTime nested rejects extras
    expect(() =>
      tool.inputSchema.parse({
        brand: 'olympic',
        laneCount: 8,
        recordTime: { seconds: 46.86, rogue: 'x' },
      }),
    ).toThrow();
    // ISO countryCode length=3 enforced
    expect(() =>
      tool.inputSchema.parse({
        brand: 'olympic',
        laneCount: 8,
        athletes: [{ laneNumber: 1, name: 'A', countryCode: 'US' }],
      }),
    ).toThrow();
  });
});

describe('cluster H coverage', () => {
  it('every Cluster H preset id is reachable from at least one (tool, input) pair', async () => {
    const reached = new Set<string>();

    const a = (await invoke('compose_ar_overlay', {
      sport: 'soccer',
      content: 'formation',
      brand: 'sky-sports',
    })) as { presetId: string };
    reached.add(a.presetId);

    const b = (await invoke('compose_var_skeletal', { brand: 'hawkeye' })) as {
      presetId: string;
    };
    reached.add(b.presetId);

    const c = (await invoke('compose_swim_lane_track', {
      brand: 'olympic',
      laneCount: 8,
    })) as { presetId: string };
    reached.add(c.presetId);

    const d = (await invoke('compose_ar_overlay', {
      sport: 'basketball',
      content: 'shot-arc',
      brand: 'nba',
    })) as { presetId: string };
    reached.add(d.presetId);

    expect(reached).toEqual(new Set(CLUSTER_H_PRESET_IDS));
  });
});

describe('barrel + invariants', () => {
  it('CLUSTER_H_PRESET_IDS contains exactly 4 entries in canonical order', () => {
    expect(CLUSTER_H_PRESET_IDS).toEqual([
      'sky-sports-ar-formations',
      'hawkeye-var-3d-skeletal',
      'olympic-swim-lane-track',
      'nba-ar-replay',
    ]);
  });

  it('SPORTS contains exactly 6 entries', () => {
    expect(SPORTS.length).toBe(6);
  });

  it('AR_BRANDS contains exactly 5 entries', () => {
    expect(AR_BRANDS.length).toBe(5);
  });

  it('VAR_BRANDS contains exactly 3 entries', () => {
    expect(VAR_BRANDS.length).toBe(3);
  });

  it('SWIM_BRANDS contains exactly 4 entries', () => {
    expect(SWIM_BRANDS.length).toBe(4);
  });

  it('AR_CONTENT_KINDS contains exactly 4 entries', () => {
    expect(AR_CONTENT_KINDS.length).toBe(4);
  });

  it('DISPLAY_TIERS contains exactly 2 entries', () => {
    expect(DISPLAY_TIERS).toEqual(['broadcast', 'mobile']);
  });

  it('handlers array length is 3', () => {
    expect(CLUSTER_H_COMPOSE_HANDLERS.length).toBe(3);
  });

  it('every handler declares bundle === "cluster-h-compose"', () => {
    for (const h of CLUSTER_H_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe('cluster-h-compose');
    }
  });

  it('determinism — same input twice yields deeply-equal output for each tool', async () => {
    const cases: Array<[string, unknown]> = [
      ['compose_ar_overlay', { sport: 'soccer', content: 'formation', brand: 'sky-sports' }],
      ['compose_var_skeletal', { brand: 'hawkeye' }],
      ['compose_swim_lane_track', { brand: 'olympic', laneCount: 8 }],
    ];
    for (const [name, input] of cases) {
      const a = await invoke(name, input);
      const b = await invoke(name, input);
      expect(a).toEqual(b);
    }
  });

  it('read-only posture — handlers do not call patchSink (none exists on ToolContext)', async () => {
    const bareCtx: ToolContext = {};
    for (const h of CLUSTER_H_COMPOSE_HANDLERS) {
      const sample =
        h.name === 'compose_ar_overlay'
          ? {
              sport: 'soccer' as const,
              content: 'formation' as const,
              brand: 'sky-sports' as const,
            }
          : h.name === 'compose_var_skeletal'
            ? { brand: 'hawkeye' as const }
            : { brand: 'olympic' as const, laneCount: 8 };
      const parsed = h.inputSchema.parse(sample);
      const result = await h.handle(parsed, bareCtx);
      expect(result).toBeDefined();
    }
  });
});
