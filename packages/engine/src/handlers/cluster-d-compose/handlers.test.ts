// packages/engine/src/handlers/cluster-d-compose/handlers.test.ts
// Vitest coverage for the 3 cluster-d-compose tools — schema accept /
// reject per tool, all 6 Cluster D preset ids reachable from each tool,
// composer-transparent optional-prop pass-through, no patch sink touched.

import { describe, expect, it, vi } from 'vitest';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_D_COMPOSE_BUNDLE_NAME,
  CLUSTER_D_COMPOSE_HANDLERS,
  CLUSTER_D_COMPOSE_TOOL_DEFINITIONS,
  CLUSTER_D_PRESET_IDS,
} from './handlers.js';

const ctx: ToolContext = {};

function getTool(name: string): ToolHandler<unknown, unknown, ToolContext> {
  const found = CLUSTER_D_COMPOSE_HANDLERS.find((h) => h.name === name);
  if (!found) throw new Error(`tool ${name} not found in CLUSTER_D_COMPOSE_HANDLERS`);
  return found;
}

async function invoke(name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  const parsed = tool.inputSchema.parse(input);
  const result = await tool.handle(parsed, ctx);
  return tool.outputSchema.parse(result);
}

describe('compose_title_sequence', () => {
  it('schema accepts minimal + full input', () => {
    const tool = getTool('compose_title_sequence');
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'stranger-things-benguiat',
        title: 'STRANGER THINGS',
      }),
    ).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'succession-home-video',
        title: 'SUCCESSION',
        subtitle: 'A family business',
        durationSeconds: 90,
        accentColor: '#c41e3a',
      }),
    ).not.toThrow();
  });

  it('schema rejects unknown preset / empty title / extras / bad accentColor', () => {
    const tool = getTool('compose_title_sequence');
    expect(() => tool.inputSchema.parse({ presetId: 'westworld-clockwork', title: 'X' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ presetId: 'stranger-things-benguiat', title: '' }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'stranger-things-benguiat',
        title: 'X',
        rogue: 'x',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'stranger-things-benguiat',
        title: 'X',
        accentColor: 'red',
      }),
    ).toThrow();
  });

  it('happy path: returns { presetId, props } with title; subtitle absent → key absent', async () => {
    const out = (await invoke('compose_title_sequence', {
      presetId: 'got-trajan-clockwork',
      title: 'GAME OF THRONES',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(out.ok).toBe(true);
    expect(out.presetId).toBe('got-trajan-clockwork');
    expect(out.props.title).toBe('GAME OF THRONES');
    expect('subtitle' in out.props).toBe(false);
    expect('durationSeconds' in out.props).toBe(false);
    expect('accentColor' in out.props).toBe(false);
  });

  it('passes through all optional fields when supplied', async () => {
    const out = (await invoke('compose_title_sequence', {
      presetId: 'severance-surreal-3d',
      title: 'SEVERANCE',
      subtitle: 'The work is mysterious and important.',
      durationSeconds: 60,
      accentColor: '#0a4',
    })) as { ok: true; props: Record<string, unknown> };
    expect(out.props.subtitle).toBe('The work is mysterious and important.');
    expect(out.props.durationSeconds).toBe(60);
    expect(out.props.accentColor).toBe('#0a4');
  });
});

describe('compose_segment_open', () => {
  it('schema accepts minimal + full input', () => {
    const tool = getTool('compose_segment_open');
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'true-detective-double-exposure',
        segmentTitle: 'Chapter 3',
      }),
    ).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'true-detective-double-exposure',
        segmentNumber: 3,
        segmentTitle: 'The Long Bright Dark',
        durationSeconds: 8,
      }),
    ).not.toThrow();
  });

  it('schema rejects unknown preset / empty segmentTitle / extras / non-int segmentNumber', () => {
    const tool = getTool('compose_segment_open');
    expect(() =>
      tool.inputSchema.parse({ presetId: 'wire-baltimore-gritty', segmentTitle: 'X' }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'true-detective-double-exposure',
        segmentTitle: '',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'true-detective-double-exposure',
        segmentTitle: 'X',
        rogue: 'x',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'true-detective-double-exposure',
        segmentTitle: 'X',
        segmentNumber: 1.5,
      }),
    ).toThrow();
  });

  it('happy path: returns { presetId, props } with segmentTitle; optionals absent → keys absent', async () => {
    const out = (await invoke('compose_segment_open', {
      presetId: 'squid-game-geometric',
      segmentTitle: 'Round 2',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(out.ok).toBe(true);
    expect(out.presetId).toBe('squid-game-geometric');
    expect(out.props.segmentTitle).toBe('Round 2');
    expect('segmentNumber' in out.props).toBe(false);
    expect('durationSeconds' in out.props).toBe(false);
  });

  it('passes through all optional fields when supplied', async () => {
    const out = (await invoke('compose_segment_open', {
      presetId: 'squid-game-geometric',
      segmentNumber: 4,
      segmentTitle: 'Marbles',
      durationSeconds: 6,
    })) as { ok: true; props: Record<string, unknown> };
    expect(out.props.segmentNumber).toBe(4);
    expect(out.props.durationSeconds).toBe(6);
  });
});

describe('compose_end_credits', () => {
  it('schema accepts minimal + full input', () => {
    const tool = getTool('compose_end_credits');
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'succession-home-video',
        credits: [{ role: 'Director', name: 'Mark Mylod' }],
      }),
    ).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'succession-home-video',
        credits: [
          { role: 'Director', name: 'Mark Mylod' },
          { role: 'Composer', name: 'Nicholas Britell' },
        ],
        scrollSpeed: 'slow',
      }),
    ).not.toThrow();
  });

  it('schema rejects empty credits array', () => {
    const tool = getTool('compose_end_credits');
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'succession-home-video',
        credits: [],
      }),
    ).toThrow();
  });

  it('schema rejects credits array > 64 entries', () => {
    const tool = getTool('compose_end_credits');
    const big = Array.from({ length: 65 }, (_, i) => ({
      role: `Role ${i}`,
      name: `Name ${i}`,
    }));
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'succession-home-video',
        credits: big,
      }),
    ).toThrow();
  });

  it('schema rejects unknown scrollSpeed / unknown preset / extras / empty role/name', () => {
    const tool = getTool('compose_end_credits');
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'succession-home-video',
        credits: [{ role: 'Director', name: 'X' }],
        scrollSpeed: 'instant',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'mad-men-typewriter',
        credits: [{ role: 'Director', name: 'X' }],
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'succession-home-video',
        credits: [{ role: 'Director', name: 'X' }],
        rogue: 'x',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        presetId: 'succession-home-video',
        credits: [{ role: '', name: 'X' }],
      }),
    ).toThrow();
  });

  it('happy path: returns { presetId, props } with credits; scrollSpeed absent → key absent', async () => {
    const out = (await invoke('compose_end_credits', {
      presetId: 'severance-surreal-3d',
      credits: [{ role: 'Created by', name: 'Dan Erickson' }],
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(out.ok).toBe(true);
    expect(out.presetId).toBe('severance-surreal-3d');
    expect(out.props.credits).toEqual([{ role: 'Created by', name: 'Dan Erickson' }]);
    expect('scrollSpeed' in out.props).toBe(false);
  });

  it('passes through scrollSpeed when supplied', async () => {
    const out = (await invoke('compose_end_credits', {
      presetId: 'severance-surreal-3d',
      credits: [{ role: 'Created by', name: 'Dan Erickson' }],
      scrollSpeed: 'fast',
    })) as { ok: true; props: Record<string, unknown> };
    expect(out.props.scrollSpeed).toBe('fast');
  });
});

describe('cluster-d-compose preset coverage + bundle invariants', () => {
  it('all 6 Cluster D preset ids are accepted by all 3 tools', async () => {
    for (const presetId of CLUSTER_D_PRESET_IDS) {
      const a = (await invoke('compose_title_sequence', { presetId, title: 'X' })) as {
        ok: true;
        presetId: string;
      };
      const b = (await invoke('compose_segment_open', { presetId, segmentTitle: 'X' })) as {
        ok: true;
        presetId: string;
      };
      const c = (await invoke('compose_end_credits', {
        presetId,
        credits: [{ role: 'X', name: 'Y' }],
      })) as { ok: true; presetId: string };
      expect(a.presetId).toBe(presetId);
      expect(b.presetId).toBe(presetId);
      expect(c.presetId).toBe(presetId);
    }
  });

  it('handlers do not call ctx.patchSink (read-only / ToolContext)', async () => {
    const push = vi.fn();
    const pushAll = vi.fn();
    const probe = { patchSink: { push, pushAll } } as unknown as ToolContext;
    const inputs: Record<string, unknown> = {
      compose_title_sequence: { presetId: 'stranger-things-benguiat', title: 'X' },
      compose_segment_open: { presetId: 'stranger-things-benguiat', segmentTitle: 'X' },
      compose_end_credits: {
        presetId: 'stranger-things-benguiat',
        credits: [{ role: 'X', name: 'Y' }],
      },
    };
    for (const handler of CLUSTER_D_COMPOSE_HANDLERS) {
      const input = inputs[handler.name];
      if (input === undefined) throw new Error(`unknown handler ${handler.name}`);
      const parsed = handler.inputSchema.parse(input);
      await handler.handle(parsed, probe);
    }
    expect(push).not.toHaveBeenCalled();
    expect(pushAll).not.toHaveBeenCalled();
  });

  it('determinism: same input twice yields deeply-equal output', async () => {
    const input = {
      presetId: 'got-trajan-clockwork' as const,
      title: 'GAME OF THRONES',
      subtitle: 'Winter is coming',
    };
    const a = await invoke('compose_title_sequence', input);
    const b = await invoke('compose_title_sequence', input);
    expect(a).toEqual(b);
  });
});

describe('barrel discipline', () => {
  it('CLUSTER_D_PRESET_IDS contains 6 entries', () => {
    expect(CLUSTER_D_PRESET_IDS.length).toBe(6);
  });

  it('handlers array length is 3', () => {
    expect(CLUSTER_D_COMPOSE_HANDLERS.length).toBe(3);
  });

  it('every handler declares bundle === "cluster-d-compose"', () => {
    for (const h of CLUSTER_D_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe(CLUSTER_D_COMPOSE_BUNDLE_NAME);
    }
  });

  it('tool definition names match handler names exactly', () => {
    const handlerNames = CLUSTER_D_COMPOSE_HANDLERS.map((h) => h.name).sort();
    const defNames = CLUSTER_D_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name).sort();
    expect(handlerNames).toEqual(defNames);
  });

  it('bundle name is the literal "cluster-d-compose"', () => {
    expect(CLUSTER_D_COMPOSE_BUNDLE_NAME).toBe('cluster-d-compose');
  });
});
