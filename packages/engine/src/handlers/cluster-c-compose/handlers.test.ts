// packages/engine/src/handlers/cluster-c-compose/handlers.test.ts
// Vitest coverage for the 4 cluster-c-compose tools — schema accept /
// reject per tool, dispatch table per (tool, input gate) pair, all 6
// Cluster C preset ids reachable, output schema round-trip, no patch
// sink touched, disclaimer pass-through for storm tracker.

import { describe, expect, it, vi } from 'vitest';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_C_COMPOSE_BUNDLE_NAME,
  CLUSTER_C_COMPOSE_HANDLERS,
  CLUSTER_C_COMPOSE_TOOL_DEFINITIONS,
  CLUSTER_C_PRESET_IDS,
} from './handlers.js';

const ctx: ToolContext = {};

function getTool(name: string): ToolHandler<unknown, unknown, ToolContext> {
  const found = CLUSTER_C_COMPOSE_HANDLERS.find((h) => h.name === name);
  if (!found) throw new Error(`tool ${name} not found in CLUSTER_C_COMPOSE_HANDLERS`);
  return found;
}

async function invoke(name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  const parsed = tool.inputSchema.parse(input);
  const result = await tool.handle(parsed, ctx);
  return tool.outputSchema.parse(result);
}

describe('compose_weather_alert', () => {
  it('schema accepts minimal + full input', () => {
    const tool = getTool('compose_weather_alert');
    expect(() =>
      tool.inputSchema.parse({
        condition: 'hurricane',
        regions: ['FL'],
        severity: 'warning',
        brand: 'nhc',
      }),
    ).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        condition: 'tornado',
        regions: ['OK', 'TX'],
        severity: 'watch',
        brand: 'twc',
        headline: 'PDS Tornado Watch — Central Plains',
      }),
    ).not.toThrow();
  });

  it('schema rejects bad condition / severity / brand / extras / missing', () => {
    const tool = getTool('compose_weather_alert');
    expect(() =>
      tool.inputSchema.parse({
        condition: 'volcano',
        regions: ['FL'],
        severity: 'warning',
        brand: 'nhc',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        condition: 'hurricane',
        regions: ['FL'],
        severity: 'mega',
        brand: 'nhc',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        condition: 'hurricane',
        regions: ['FL'],
        severity: 'warning',
        brand: 'cnn',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        condition: 'hurricane',
        regions: ['FL'],
        severity: 'warning',
        brand: 'nhc',
        rogue: 'x',
      }),
    ).toThrow();
    expect(() => tool.inputSchema.parse({ condition: 'hurricane' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        condition: 'hurricane',
        regions: [],
        severity: 'warning',
        brand: 'nhc',
      }),
    ).toThrow();
  });

  it('dispatch matrix: NHC × hurricane/tropical-storm warning → nhc cone; TWC × severe-thunderstorm/tornado warning/watch → twc IMR', async () => {
    const cases: Array<{
      input: { condition: string; severity: string; brand: string };
      presetId: string;
    }> = [
      {
        input: { condition: 'hurricane', severity: 'warning', brand: 'nhc' },
        presetId: 'nhc-cone-of-uncertainty',
      },
      {
        input: { condition: 'tropical-storm', severity: 'warning', brand: 'nhc' },
        presetId: 'nhc-cone-of-uncertainty',
      },
      {
        input: { condition: 'severe-thunderstorm', severity: 'warning', brand: 'twc' },
        presetId: 'twc-immersive-mixed-reality',
      },
      {
        input: { condition: 'tornado', severity: 'watch', brand: 'twc' },
        presetId: 'twc-immersive-mixed-reality',
      },
    ];
    for (const c of cases) {
      const out = (await invoke('compose_weather_alert', { ...c.input, regions: ['R'] })) as {
        ok: true;
        presetId: string;
      };
      expect(out.ok).toBe(true);
      expect(out.presetId).toBe(c.presetId);
    }
  });

  it('returns no_preset_for_condition_severity_brand for (flood, advisory, nws)', async () => {
    const out = (await invoke('compose_weather_alert', {
      condition: 'flood',
      regions: ['R'],
      severity: 'advisory',
      brand: 'nws',
    })) as { ok: false; reason: string; detail?: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no_preset_for_condition_severity_brand');
  });
});

describe('compose_forecast_map', () => {
  it('schema accepts minimal + full input', () => {
    const tool = getTool('compose_forecast_map');
    expect(() => tool.inputSchema.parse({ regions: ['UK'], days: 5, brand: 'bbc' })).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        regions: ['CONUS'],
        days: 0,
        brand: 'twc',
        register: 'radar',
      }),
    ).not.toThrow();
  });

  it('schema rejects bad brand / oversized regions / negative days / >14 days / extras', () => {
    const tool = getTool('compose_forecast_map');
    expect(() => tool.inputSchema.parse({ regions: ['UK'], days: 5, brand: 'cnn' })).toThrow();
    const big = Array.from({ length: 51 }, (_, i) => `R${i}`);
    expect(() => tool.inputSchema.parse({ regions: big, days: 5, brand: 'bbc' })).toThrow();
    expect(() => tool.inputSchema.parse({ regions: ['UK'], days: -1, brand: 'bbc' })).toThrow();
    expect(() => tool.inputSchema.parse({ regions: ['UK'], days: 15, brand: 'bbc' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ regions: ['UK'], days: 5, brand: 'bbc', rogue: 'x' }),
    ).toThrow();
  });

  it('dispatch matrix: BBC / Doppler / NEXRAD / TWC retrocast / TWC short-range radar / TWC multi-day', async () => {
    const cases: Array<{
      input: { brand: string; days: number; register?: string };
      presetId: string;
    }> = [
      { input: { brand: 'bbc', days: 5 }, presetId: 'bbc-mark-allen-clouds' },
      { input: { brand: 'doppler', days: 0 }, presetId: 'doppler-dbz-standard' },
      { input: { brand: 'nexrad', days: 0 }, presetId: 'doppler-dbz-standard' },
      { input: { brand: 'nws', days: 0 }, presetId: 'doppler-dbz-standard' },
      { input: { brand: 'twc', days: 0, register: 'retrocast' }, presetId: 'twc-retrocast-8bit' },
      { input: { brand: 'twc', days: 0, register: 'radar' }, presetId: 'doppler-dbz-standard' },
      { input: { brand: 'twc', days: 5 }, presetId: 'twc-immersive-mixed-reality' },
      {
        input: { brand: 'twc', days: 0, register: 'multi-day' },
        presetId: 'twc-immersive-mixed-reality',
      },
    ];
    for (const c of cases) {
      const out = (await invoke('compose_forecast_map', { ...c.input, regions: ['R'] })) as {
        ok: true;
        presetId: string;
      };
      expect(out.ok).toBe(true);
      expect(out.presetId).toBe(c.presetId);
    }
  });

  it('ambiguous TWC short-range with no register returns no_preset_for_brand_register', async () => {
    const out = (await invoke('compose_forecast_map', {
      regions: ['CONUS'],
      days: 0,
      brand: 'twc',
    })) as { ok: false; reason: string; detail?: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no_preset_for_brand_register');
  });
});

describe('compose_storm_track', () => {
  it('schema accepts minimal + full', () => {
    const tool = getTool('compose_storm_track');
    expect(() => tool.inputSchema.parse({ storm: { name: 'MARGOT' }, brand: 'nhc' })).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        storm: { name: 'HURRICANE MARGOT', advisoryNumber: 18 },
        path: [
          { lat: 24.5, lon: -76.2, intensity: 'H', timestamp: '2026-09-12T15:00Z' },
          { lat: 25.1, lon: -77.4, intensity: 'M' },
        ],
        brand: 'noaa',
        disclaimerText: 'Impacts extend beyond the cone',
      }),
    ).not.toThrow();
  });

  it('schema rejects out-of-range lat/lon, bad brand, extras', () => {
    const tool = getTool('compose_storm_track');
    expect(() =>
      tool.inputSchema.parse({
        storm: { name: 'M' },
        path: [{ lat: 95, lon: 0 }],
        brand: 'nhc',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        storm: { name: 'M' },
        path: [{ lat: 0, lon: 200 }],
        brand: 'nhc',
      }),
    ).toThrow();
    expect(() => tool.inputSchema.parse({ storm: { name: 'M' }, brand: 'cnn' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ storm: { name: 'M' }, brand: 'nhc', rogue: 'x' }),
    ).toThrow();
  });

  it('dispatch: nhc + noaa both → nhc-cone-of-uncertainty', async () => {
    for (const brand of ['nhc', 'noaa'] as const) {
      const out = (await invoke('compose_storm_track', { storm: { name: 'M' }, brand })) as {
        ok: true;
        presetId: string;
      };
      expect(out.ok).toBe(true);
      expect(out.presetId).toBe('nhc-cone-of-uncertainty');
    }
  });

  it('disclaimer pass-through: omitted → no key in props; supplied → verbatim in props', async () => {
    const omitted = (await invoke('compose_storm_track', {
      storm: { name: 'M' },
      brand: 'nhc',
    })) as { ok: true; props: Record<string, unknown> };
    expect(omitted.ok).toBe(true);
    expect('disclaimerText' in omitted.props).toBe(false);

    const supplied = (await invoke('compose_storm_track', {
      storm: { name: 'M' },
      brand: 'nhc',
      disclaimerText: 'Los impactos se extienden más allá del cono',
    })) as { ok: true; props: Record<string, unknown> };
    expect(supplied.props.disclaimerText).toBe('Los impactos se extienden más allá del cono');
  });
});

describe('compose_temperature_map', () => {
  it('schema accepts minimal', () => {
    const tool = getTool('compose_temperature_map');
    expect(() =>
      tool.inputSchema.parse({ regions: ['CONUS'], unit: 'F', brand: 'meriam' }),
    ).not.toThrow();
  });

  it('schema rejects bad brand / bad unit / extras / empty regions', () => {
    const tool = getTool('compose_temperature_map');
    expect(() => tool.inputSchema.parse({ regions: ['R'], unit: 'F', brand: 'cnn' })).toThrow();
    expect(() => tool.inputSchema.parse({ regions: ['R'], unit: 'K', brand: 'meriam' })).toThrow();
    expect(() => tool.inputSchema.parse({ regions: [], unit: 'F', brand: 'meriam' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ regions: ['R'], unit: 'F', brand: 'meriam', rogue: 'x' }),
    ).toThrow();
  });

  it('dispatch: meriam / esri / nws-meriam all → heat-map-cool-to-warm', async () => {
    for (const brand of ['meriam', 'esri', 'nws-meriam'] as const) {
      const out = (await invoke('compose_temperature_map', {
        regions: ['R'],
        unit: 'F',
        brand,
      })) as { ok: true; presetId: string };
      expect(out.presetId).toBe('heat-map-cool-to-warm');
    }
  });
});

describe('cluster-c-compose dispatch coverage', () => {
  it('all 6 Cluster C preset ids are reachable', async () => {
    const reached = new Set<string>();
    const cases: Array<{ tool: string; input: unknown }> = [
      // bbc-mark-allen-clouds
      { tool: 'compose_forecast_map', input: { regions: ['UK'], days: 5, brand: 'bbc' } },
      // doppler-dbz-standard
      { tool: 'compose_forecast_map', input: { regions: ['R'], days: 0, brand: 'doppler' } },
      // heat-map-cool-to-warm
      { tool: 'compose_temperature_map', input: { regions: ['R'], unit: 'F', brand: 'meriam' } },
      // nhc-cone-of-uncertainty
      { tool: 'compose_storm_track', input: { storm: { name: 'M' }, brand: 'nhc' } },
      // twc-retrocast-8bit
      {
        tool: 'compose_forecast_map',
        input: { regions: ['R'], days: 0, brand: 'twc', register: 'retrocast' },
      },
      // twc-immersive-mixed-reality
      {
        tool: 'compose_weather_alert',
        input: { condition: 'tornado', regions: ['R'], severity: 'warning', brand: 'twc' },
      },
    ];
    for (const c of cases) {
      const result = (await invoke(c.tool, c.input)) as { ok: boolean; presetId?: string };
      if (result.ok && result.presetId) reached.add(result.presetId);
    }
    for (const id of CLUSTER_C_PRESET_IDS) {
      expect(reached).toContain(id);
    }
    expect(reached.size).toBe(6);
  });

  it('handlers do not call ctx.patchSink (read-only / ToolContext)', async () => {
    const push = vi.fn();
    const pushAll = vi.fn();
    const probe = { patchSink: { push, pushAll } } as unknown as ToolContext;
    const inputs: Record<string, unknown> = {
      compose_weather_alert: {
        condition: 'hurricane',
        regions: ['R'],
        severity: 'warning',
        brand: 'nhc',
      },
      compose_forecast_map: { regions: ['R'], days: 5, brand: 'bbc' },
      compose_storm_track: { storm: { name: 'M' }, brand: 'nhc' },
      compose_temperature_map: { regions: ['R'], unit: 'F', brand: 'meriam' },
    };
    for (const handler of CLUSTER_C_COMPOSE_HANDLERS) {
      const input = inputs[handler.name];
      if (input === undefined) throw new Error(`unknown handler ${handler.name}`);
      const parsed = handler.inputSchema.parse(input);
      await handler.handle(parsed, probe);
    }
    expect(push).not.toHaveBeenCalled();
    expect(pushAll).not.toHaveBeenCalled();
  });

  it('determinism: same input twice yields deeply-equal output', async () => {
    const input = { regions: ['R'], days: 5, brand: 'bbc' as const };
    const a = await invoke('compose_forecast_map', input);
    const b = await invoke('compose_forecast_map', input);
    expect(a).toEqual(b);
  });
});

describe('barrel discipline', () => {
  it('CLUSTER_C_PRESET_IDS contains 6 entries', () => {
    expect(CLUSTER_C_PRESET_IDS.length).toBe(6);
  });

  it('handlers array length is 4', () => {
    expect(CLUSTER_C_COMPOSE_HANDLERS.length).toBe(4);
  });

  it('every handler declares bundle === "cluster-c-compose"', () => {
    for (const h of CLUSTER_C_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe(CLUSTER_C_COMPOSE_BUNDLE_NAME);
    }
  });

  it('tool definition names match handler names exactly', () => {
    const handlerNames = CLUSTER_C_COMPOSE_HANDLERS.map((h) => h.name).sort();
    const defNames = CLUSTER_C_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name).sort();
    expect(handlerNames).toEqual(defNames);
  });

  it('bundle name is the literal "cluster-c-compose"', () => {
    expect(CLUSTER_C_COMPOSE_BUNDLE_NAME).toBe('cluster-c-compose');
  });
});
