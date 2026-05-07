// packages/engine/src/handlers/cluster-e-compose/handlers.test.ts
// Vitest coverage for the 5 cluster-e-compose tools — schema accept /
// reject per tool, dispatch table per (tool, input gate) pair, all 6
// Cluster E preset ids reachable, output schema round-trip, no patch
// sink touched.

import { describe, expect, it, vi } from 'vitest';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_E_COMPOSE_BUNDLE_NAME,
  CLUSTER_E_COMPOSE_HANDLERS,
  CLUSTER_E_COMPOSE_TOOL_DEFINITIONS,
  CLUSTER_E_PRESET_IDS,
} from './handlers.js';

const ctx: ToolContext = {};

function getTool(name: string): ToolHandler<unknown, unknown, ToolContext> {
  const found = CLUSTER_E_COMPOSE_HANDLERS.find((h) => h.name === name);
  if (!found) throw new Error(`tool ${name} not found in CLUSTER_E_COMPOSE_HANDLERS`);
  return found;
}

async function invoke(name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  const parsed = tool.inputSchema.parse(input);
  const result = await tool.handle(parsed, ctx);
  // Round-trip the output through its schema to catch shape drift.
  return tool.outputSchema.parse(result);
}

describe('compose_live_data', () => {
  it('schema accepts minimal + full input', () => {
    const tool = getTool('compose_live_data');
    expect(() => tool.inputSchema.parse({ domain: 'politics', layout: 'wall' })).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        domain: 'finance',
        layout: 'big-number',
        state: { ts: 0 },
        brand: 'reuters',
        locale: 'ja-JP',
      }),
    ).not.toThrow();
  });

  it('schema rejects bad domain / bad layout / extras', () => {
    const tool = getTool('compose_live_data');
    expect(() => tool.inputSchema.parse({ domain: 'bogus', layout: 'wall' })).toThrow();
    expect(() => tool.inputSchema.parse({ domain: 'finance', layout: 'tile' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ domain: 'finance', layout: 'wall', rogue: 'x' }),
    ).toThrow();
    // missing required
    expect(() => tool.inputSchema.parse({ domain: 'finance' })).toThrow();
  });

  it('dispatch: layout=wall → magic-wall-drilldown; layout=big-number → big-number-stat-impact', async () => {
    const wall = (await invoke('compose_live_data', {
      domain: 'politics',
      layout: 'wall',
    })) as { ok: true; presetId: string; dispatchedLayout: string; props: Record<string, unknown> };
    expect(wall.ok).toBe(true);
    expect(wall.presetId).toBe('magic-wall-drilldown');
    expect(wall.dispatchedLayout).toBe('wall');
    expect(wall.props.domain).toBe('politics');

    const bn = (await invoke('compose_live_data', {
      domain: 'finance',
      layout: 'big-number',
      state: { ts: 1 },
      brand: 'reuters',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(bn.presetId).toBe('big-number-stat-impact');
    expect(bn.props.brand).toBe('reuters');
    expect(bn.props.state).toEqual({ ts: 1 });
  });

  it('rejects (olympic, wall) → unsupported_domain', async () => {
    const out = (await invoke('compose_live_data', {
      domain: 'olympic',
      layout: 'wall',
    })) as { ok: false; reason: string; detail?: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('unsupported_domain');
    expect(out.detail).toContain('compose_stat_callout');
  });
});

describe('compose_market_ticker', () => {
  it('schema accepts minimal + full', () => {
    const tool = getTool('compose_market_ticker');
    expect(() => tool.inputSchema.parse({ symbols: ['AAPL'] })).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        symbols: ['AAPL', 'MSFT'],
        deltas: [0.5, -0.2],
        brand: 'bloomberg',
        locale: 'en-US',
      }),
    ).not.toThrow();
  });

  it('schema rejects empty / oversized symbols, deltas mismatch, bad brand, extras', () => {
    const tool = getTool('compose_market_ticker');
    expect(() => tool.inputSchema.parse({ symbols: [] })).toThrow();
    const big = Array.from({ length: 65 }, (_, i) => `S${i}`);
    expect(() => tool.inputSchema.parse({ symbols: big })).toThrow();
    expect(() => tool.inputSchema.parse({ symbols: ['AAPL'], deltas: [0.1, 0.2] })).toThrow();
    expect(() => tool.inputSchema.parse({ symbols: ['AAPL'], brand: 'reuters' })).toThrow();
    expect(() => tool.inputSchema.parse({ symbols: ['AAPL'], rogue: 'x' })).toThrow();
    // empty symbol string rejected (min(1))
    expect(() => tool.inputSchema.parse({ symbols: [''] })).toThrow();
    // 9-char symbol rejected (max(8))
    expect(() => tool.inputSchema.parse({ symbols: ['ABCDEFGHI'] })).toThrow();
  });

  it('dispatch: always bloomberg-ticker', async () => {
    const a = (await invoke('compose_market_ticker', {
      symbols: ['AAPL'],
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(a.ok).toBe(true);
    expect(a.presetId).toBe('bloomberg-ticker');
    expect(a.props.symbols).toEqual(['AAPL']);

    const b = (await invoke('compose_market_ticker', {
      symbols: ['AAPL', 'MSFT'],
      deltas: [0.5, -0.2],
      brand: 'generic',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(b.presetId).toBe('bloomberg-ticker');
    expect(b.props.brand).toBe('generic');
    expect(b.props.deltas).toEqual([0.5, -0.2]);
  });
});

describe('compose_election_board', () => {
  it('schema accepts minimal + full', () => {
    const tool = getTool('compose_election_board');
    expect(() => tool.inputSchema.parse({ states: ['Pennsylvania'] })).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        states: ['PA', 'OH'],
        leaders: { PA: 'X' },
        statePalette: { PA: '#0066B3' },
      }),
    ).not.toThrow();
  });

  it('schema rejects empty / oversized states, bad hex, extras', () => {
    const tool = getTool('compose_election_board');
    expect(() => tool.inputSchema.parse({ states: [] })).toThrow();
    const big = Array.from({ length: 61 }, (_, i) => `S${i}`);
    expect(() => tool.inputSchema.parse({ states: big })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ states: ['PA'], statePalette: { PA: '#ZZZ' } }),
    ).toThrow();
    expect(() => tool.inputSchema.parse({ states: ['PA'], rogue: 'x' })).toThrow();
    // states entry too short (1 char) — min(2)
    expect(() => tool.inputSchema.parse({ states: ['P'] })).toThrow();
  });

  it('dispatch: always magic-wall-drilldown', async () => {
    const out = (await invoke('compose_election_board', {
      states: ['PA', 'OH'],
      leaders: { PA: 'X', OH: 'Y' },
      statePalette: { PA: '#0066B3' },
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(out.ok).toBe(true);
    expect(out.presetId).toBe('magic-wall-drilldown');
    expect(out.props.states).toEqual(['PA', 'OH']);
    expect(out.props.leaders).toEqual({ PA: 'X', OH: 'Y' });
    expect(out.props.statePalette).toEqual({ PA: '#0066B3' });
  });
});

describe('compose_big_number', () => {
  it('schema accepts minimal + full + sport: null', () => {
    const tool = getTool('compose_big_number');
    expect(() => tool.inputSchema.parse({ figure: '$3.2M' })).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        figure: '87%',
        label: 'of Americans',
        magnitude: 'm',
        sport: 'f1',
        theme: 'broadcast',
      }),
    ).not.toThrow();
    expect(() => tool.inputSchema.parse({ figure: '12', sport: null })).not.toThrow();
  });

  it('schema rejects empty figure, bad magnitude / sport, oversized label, extras', () => {
    const tool = getTool('compose_big_number');
    expect(() => tool.inputSchema.parse({ figure: '' })).toThrow();
    expect(() => tool.inputSchema.parse({ figure: '12', magnitude: 'mega' })).toThrow();
    expect(() => tool.inputSchema.parse({ figure: '12', sport: 'cricket' })).toThrow();
    expect(() => tool.inputSchema.parse({ figure: '12', label: 'x'.repeat(121) })).toThrow();
    expect(() => tool.inputSchema.parse({ figure: '12', rogue: 'x' })).toThrow();
  });

  it('dispatch: sport=f1 → f1-sector-purple-green; default → big-number-stat-impact', async () => {
    const a = (await invoke('compose_big_number', {
      figure: '12.4M',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(a.ok).toBe(true);
    expect(a.presetId).toBe('big-number-stat-impact');
    expect(a.props.figure).toBe('12.4M');

    const b = (await invoke('compose_big_number', {
      figure: '12.4M',
      sport: 'f1',
      label: 'sector 2',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(b.presetId).toBe('f1-sector-purple-green');
    expect(b.props.sport).toBe('f1');
    expect(b.props.label).toBe('sector 2');

    const c = (await invoke('compose_big_number', {
      figure: '12',
      sport: null,
    })) as { ok: true; presetId: string };
    expect(c.presetId).toBe('big-number-stat-impact');
  });
});

describe('compose_stat_callout', () => {
  it('schema accepts minimal + full + sport: null', () => {
    const tool = getTool('compose_stat_callout');
    expect(() => tool.inputSchema.parse({ stat: '87 off 42' })).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        stat: 'P3 → P1',
        sport: 'f1',
        context: 'final lap',
        brand: 'sky',
      }),
    ).not.toThrow();
    expect(() => tool.inputSchema.parse({ stat: 'medal #21', sport: null })).not.toThrow();
  });

  it('schema rejects empty stat, bad sport, oversized context, extras', () => {
    const tool = getTool('compose_stat_callout');
    expect(() => tool.inputSchema.parse({ stat: '' })).toThrow();
    expect(() => tool.inputSchema.parse({ stat: 'x', sport: 'football' })).toThrow();
    expect(() => tool.inputSchema.parse({ stat: 'x', context: 'c'.repeat(241) })).toThrow();
    expect(() => tool.inputSchema.parse({ stat: 'x', rogue: 'x' })).toThrow();
    // 121-char stat rejected (max(120))
    expect(() => tool.inputSchema.parse({ stat: 'x'.repeat(121) })).toThrow();
  });

  it('dispatch: cricket / f1 / olympic / default', async () => {
    const cricket = (await invoke('compose_stat_callout', {
      stat: '87 off 42',
      sport: 'cricket',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(cricket.presetId).toBe('cricket-ball-by-ball-dots');
    expect(cricket.props.sport).toBe('cricket');

    const f1 = (await invoke('compose_stat_callout', {
      stat: 'P3 → P1',
      sport: 'f1',
    })) as { ok: true; presetId: string };
    expect(f1.presetId).toBe('f1-sector-purple-green');

    const olympic = (await invoke('compose_stat_callout', {
      stat: 'gold #1',
      sport: 'olympic',
    })) as { ok: true; presetId: string };
    expect(olympic.presetId).toBe('olympic-medal-tracker');

    const dflt = (await invoke('compose_stat_callout', {
      stat: 'misc',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(dflt.presetId).toBe('big-number-stat-impact');
    expect(dflt.props.sport).toBeUndefined();

    const dfltNull = (await invoke('compose_stat_callout', {
      stat: 'misc',
      sport: null,
    })) as { ok: true; presetId: string };
    expect(dfltNull.presetId).toBe('big-number-stat-impact');
  });
});

describe('cluster-e-compose dispatch coverage', () => {
  it('all 6 Cluster E preset ids are reachable', async () => {
    const reached = new Set<string>();
    const cases: Array<{ tool: string; input: unknown }> = [
      { tool: 'compose_live_data', input: { domain: 'politics', layout: 'wall' } },
      { tool: 'compose_live_data', input: { domain: 'finance', layout: 'big-number' } },
      { tool: 'compose_market_ticker', input: { symbols: ['AAPL'] } },
      { tool: 'compose_election_board', input: { states: ['PA'] } },
      { tool: 'compose_big_number', input: { figure: '12' } },
      { tool: 'compose_big_number', input: { figure: '12', sport: 'f1' } },
      { tool: 'compose_stat_callout', input: { stat: 's', sport: 'cricket' } },
      { tool: 'compose_stat_callout', input: { stat: 's', sport: 'olympic' } },
    ];
    for (const c of cases) {
      const result = (await invoke(c.tool, c.input)) as { ok: boolean; presetId?: string };
      if (result.ok && result.presetId) reached.add(result.presetId);
    }
    for (const id of CLUSTER_E_PRESET_IDS) {
      expect(reached).toContain(id);
    }
    expect(reached.size).toBe(6);
  });

  it('handlers do not call ctx.patchSink (read-only / ToolContext)', async () => {
    // Create a context shape that includes a patchSink with mocks; even though
    // ToolContext does not require it, this catches any handler that
    // accidentally widens the context and pushes patches.
    const push = vi.fn();
    const pushAll = vi.fn();
    const probe = { patchSink: { push, pushAll } } as unknown as ToolContext;
    for (const handler of CLUSTER_E_COMPOSE_HANDLERS) {
      let input: unknown;
      switch (handler.name) {
        case 'compose_live_data':
          input = { domain: 'politics', layout: 'wall' };
          break;
        case 'compose_market_ticker':
          input = { symbols: ['AAPL'] };
          break;
        case 'compose_election_board':
          input = { states: ['PA'] };
          break;
        case 'compose_big_number':
          input = { figure: '12' };
          break;
        case 'compose_stat_callout':
          input = { stat: 's' };
          break;
        default:
          throw new Error(`unknown handler ${handler.name}`);
      }
      const parsed = handler.inputSchema.parse(input);
      await handler.handle(parsed, probe);
    }
    expect(push).not.toHaveBeenCalled();
    expect(pushAll).not.toHaveBeenCalled();
  });

  it('determinism: same input twice yields deeply-equal output', async () => {
    const input = { domain: 'finance' as const, layout: 'big-number' as const, state: { ts: 1 } };
    const a = await invoke('compose_live_data', input);
    const b = await invoke('compose_live_data', input);
    expect(a).toEqual(b);
  });
});

describe('barrel discipline', () => {
  it('CLUSTER_E_PRESET_IDS contains 6 entries', () => {
    expect(CLUSTER_E_PRESET_IDS.length).toBe(6);
  });

  it('handlers array length is 5', () => {
    expect(CLUSTER_E_COMPOSE_HANDLERS.length).toBe(5);
  });

  it('every handler declares bundle === "cluster-e-compose"', () => {
    for (const h of CLUSTER_E_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe(CLUSTER_E_COMPOSE_BUNDLE_NAME);
    }
  });

  it('tool definition names match handler names exactly', () => {
    const handlerNames = CLUSTER_E_COMPOSE_HANDLERS.map((h) => h.name).sort();
    const defNames = CLUSTER_E_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name).sort();
    expect(handlerNames).toEqual(defNames);
  });
});
