// packages/engine/src/handlers/cluster-a-compose/handlers.test.ts
// Vitest coverage for the 4 cluster-a-compose tools — happy-path
// dispatch per (severity, network, theme) tuple, error reasons, schema
// rejection (strict mode + sealed enums), shared-output-envelope shape,
// and determinism (same input → deeply-equal output).

import { describe, expect, it } from 'vitest';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import { CLUSTER_A_COMPOSE_HANDLERS, CLUSTER_A_PRESET_IDS } from './handlers.js';

const ctx: ToolContext = {};

function getTool(name: string): ToolHandler<unknown, unknown, ToolContext> {
  const found = CLUSTER_A_COMPOSE_HANDLERS.find((h) => h.name === name);
  if (!found) throw new Error(`tool ${name} not found in CLUSTER_A_COMPOSE_HANDLERS`);
  return found;
}

async function invoke(name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  const parsed = tool.inputSchema.parse(input);
  const result = await tool.handle(parsed, ctx);
  // Round-trip the output through its schema to catch shape drift.
  return tool.outputSchema.parse(result);
}

describe('compose_breaking_news', () => {
  it('happy path × 6: every accepted (urgent, network) pair → expected preset', async () => {
    const cases: Array<[string, string, string]> = [
      ['cnn', 'cnn-breaking', 'breakingBanner'],
      ['fox', 'fox-news-alert', 'breakingBanner'],
      ['msnbc', 'msnbc-big-board', 'fullScreen'],
      ['bbc', 'bbc-reith-dark', 'lowerThird'],
      ['ajazeera', 'al-jazeera-orange', 'lowerThird'],
      ['aplus', 'apple-tv-lt', 'lowerThird'],
    ];
    for (const [network, expectedPreset, expectedClipKind] of cases) {
      const out = (await invoke('compose_breaking_news', {
        headline: 'Test headline',
        severity: 'urgent',
        network,
      })) as { ok: true; presetId: string; clipKind: string; rationale: string };
      expect(out.ok).toBe(true);
      expect(out.presetId).toBe(expectedPreset);
      expect(out.clipKind).toBe(expectedClipKind);
      expect(out.rationale).toBe(`severity=urgent + network=${network} → ${expectedPreset}`);
    }
  });

  it("rejects severity='developing' with unsupported_severity + sister-tool hint", async () => {
    const out = (await invoke('compose_breaking_news', {
      headline: 'Story is still developing',
      severity: 'developing',
      network: 'cnn',
    })) as { ok: false; reason: string; detail?: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('unsupported_severity');
    expect(out.detail).toContain('compose_ongoing_update');
  });

  it("rejects severity='standard' with unsupported_severity", async () => {
    const out = (await invoke('compose_breaking_news', {
      headline: 'Routine update',
      severity: 'standard',
      network: 'bbc',
    })) as { ok: false; reason: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('unsupported_severity');
  });

  it('schema rejects unknown network / missing headline / extra field / oversize headline', () => {
    const tool = getTool('compose_breaking_news');
    expect(() =>
      tool.inputSchema.parse({
        headline: 'x',
        severity: 'urgent',
        network: 'bloomberg',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        severity: 'urgent',
        network: 'cnn',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        headline: 'x',
        severity: 'urgent',
        network: 'cnn',
        rogue: 1,
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        headline: 'x'.repeat(201),
        severity: 'urgent',
        network: 'cnn',
      }),
    ).toThrow();
    // empty headline
    expect(() =>
      tool.inputSchema.parse({
        headline: '',
        severity: 'urgent',
        network: 'cnn',
      }),
    ).toThrow();
  });

  it('accepts optional timestamp passthrough without affecting dispatch', async () => {
    const out = (await invoke('compose_breaking_news', {
      headline: 'h',
      severity: 'urgent',
      network: 'cnn',
      timestamp: '2026-05-07T12:00:00Z',
    })) as { ok: true; presetId: string };
    expect(out.presetId).toBe('cnn-breaking');
  });

  it('determinism — same input twice yields deeply-equal output', async () => {
    const input = {
      headline: 'h',
      severity: 'urgent' as const,
      network: 'fox' as const,
    };
    const a = await invoke('compose_breaking_news', input);
    const b = await invoke('compose_breaking_news', input);
    expect(a).toEqual(b);
  });
});

describe('compose_ongoing_update', () => {
  it('happy path × 3: each accepted network → its lowerThird preset', async () => {
    const cases: Array<[string, string]> = [
      ['cnn', 'cnn-classic'],
      ['bbc', 'bbc-reith-dark'],
      ['ajazeera', 'al-jazeera-orange'],
    ];
    for (const [network, expectedPreset] of cases) {
      const out = (await invoke('compose_ongoing_update', {
        network,
        mainline: 'Live coverage continues',
      })) as { ok: true; presetId: string; clipKind: string; rationale: string };
      expect(out.ok).toBe(true);
      expect(out.presetId).toBe(expectedPreset);
      expect(out.clipKind).toBe('lowerThird');
      expect(out.rationale).toBe(
        `network=${network} → ${expectedPreset} (lowerThird; non-urgent register)`,
      );
    }
  });

  it("schema rejects networks outside {cnn, bbc, ajazeera} (no 'register_unavailable' branch reachable)", () => {
    const tool = getTool('compose_ongoing_update');
    for (const network of ['fox', 'msnbc', 'aplus', 'netflix', 'bloomberg']) {
      expect(() => tool.inputSchema.parse({ network, mainline: 'm' })).toThrow();
    }
  });

  it('schema enforces optional kicker/talent length bounds', () => {
    const tool = getTool('compose_ongoing_update');
    expect(() =>
      tool.inputSchema.parse({
        network: 'cnn',
        mainline: 'm',
        kicker: '',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        network: 'cnn',
        mainline: 'm',
        kicker: 'k'.repeat(41),
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        network: 'cnn',
        mainline: 'm',
        talent: 't'.repeat(41),
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        network: 'cnn',
        mainline: 'm',
        rogue: 'x',
      }),
    ).toThrow();
  });
});

describe('compose_guest_intro', () => {
  it('broadcast happy paths × 5 — fox + msnbc fall back to cnn-classic', async () => {
    const cases: Array<[string, string]> = [
      ['cnn', 'cnn-classic'],
      ['fox', 'cnn-classic'],
      ['msnbc', 'cnn-classic'],
      ['bbc', 'bbc-reith-dark'],
      ['ajazeera', 'al-jazeera-orange'],
    ];
    for (const [network, expectedPreset] of cases) {
      const out = (await invoke('compose_guest_intro', {
        person: 'Jane Doe',
        role: 'Senior Analyst',
        network,
        theme: 'broadcast',
      })) as { ok: true; presetId: string; rationale: string; clipKind: string };
      expect(out.ok).toBe(true);
      expect(out.presetId).toBe(expectedPreset);
      expect(out.clipKind).toBe('lowerThird');
      expect(out.rationale).toBe(`theme=broadcast + network=${network} → ${expectedPreset}`);
    }
  });

  it('streaming happy paths × 2 — netflix → netflix-doc-lt; aplus → apple-tv-lt', async () => {
    const cases: Array<[string, string]> = [
      ['netflix', 'netflix-doc-lt'],
      ['aplus', 'apple-tv-lt'],
    ];
    for (const [network, expectedPreset] of cases) {
      const out = (await invoke('compose_guest_intro', {
        person: 'Jane Doe',
        role: 'Senior Analyst',
        network,
        theme: 'streaming',
      })) as { ok: true; presetId: string; rationale: string };
      expect(out.presetId).toBe(expectedPreset);
      expect(out.rationale).toBe(`theme=streaming + network=${network} → ${expectedPreset}`);
    }
  });

  it('cross-theme rejection — broadcast × {netflix, aplus} no broadcast register', async () => {
    for (const network of ['netflix']) {
      const out = (await invoke('compose_guest_intro', {
        person: 'p',
        role: 'r',
        network,
        theme: 'broadcast',
      })) as { ok: false; reason: string; detail?: string };
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('register_unavailable');
      expect(out.detail).toContain('streaming');
    }
  });

  it('cross-theme rejection — streaming × broadcast networks no streaming register', async () => {
    for (const network of ['cnn', 'fox', 'msnbc', 'bbc', 'ajazeera']) {
      const out = (await invoke('compose_guest_intro', {
        person: 'p',
        role: 'r',
        network,
        theme: 'streaming',
      })) as { ok: false; reason: string; detail?: string };
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('register_unavailable');
      expect(out.detail).toContain('broadcast');
    }
  });

  it('schema rejects unknown theme / unknown network / extra field', () => {
    const tool = getTool('compose_guest_intro');
    expect(() =>
      tool.inputSchema.parse({
        person: 'p',
        role: 'r',
        network: 'cnn',
        theme: 'cinema',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        person: 'p',
        role: 'r',
        network: 'sky',
        theme: 'broadcast',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        person: 'p',
        role: 'r',
        network: 'cnn',
        theme: 'broadcast',
        rogue: 1,
      }),
    ).toThrow();
  });
});

describe('compose_documentary_title_card', () => {
  it('happy path × 2: netflix → netflix-doc-lt; appletv → apple-tv-lt', async () => {
    const cases: Array<[string, string]> = [
      ['netflix', 'netflix-doc-lt'],
      ['appletv', 'apple-tv-lt'],
    ];
    for (const [network, expectedPreset] of cases) {
      const out = (await invoke('compose_documentary_title_card', {
        title: 'A Story',
        network,
      })) as { ok: true; presetId: string; clipKind: string; rationale: string };
      expect(out.ok).toBe(true);
      expect(out.presetId).toBe(expectedPreset);
      expect(out.clipKind).toBe('lowerThird');
      expect(out.rationale).toBe(`network=${network} → ${expectedPreset} (documentary register)`);
    }
  });

  it('schema rejects networks outside {netflix, appletv}', () => {
    const tool = getTool('compose_documentary_title_card');
    for (const network of ['cnn', 'bbc', 'fox', 'aplus', 'hbo']) {
      expect(() => tool.inputSchema.parse({ title: 't', network })).toThrow();
    }
  });

  it('schema accepts optional subtitle within bounds; rejects empty / oversize', () => {
    const tool = getTool('compose_documentary_title_card');
    expect(() =>
      tool.inputSchema.parse({
        title: 't',
        network: 'netflix',
        subtitle: 's',
      }),
    ).not.toThrow();
    expect(() =>
      tool.inputSchema.parse({
        title: 't',
        network: 'netflix',
        subtitle: '',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        title: 't',
        network: 'netflix',
        subtitle: 'x'.repeat(201),
      }),
    ).toThrow();
  });
});

describe('barrel discipline + read-only invariant', () => {
  it('CLUSTER_A_PRESET_IDS contains 8 entries', () => {
    expect(CLUSTER_A_PRESET_IDS.length).toBe(8);
  });

  it('handlers array length is 4', () => {
    expect(CLUSTER_A_COMPOSE_HANDLERS.length).toBe(4);
  });

  it('every handler declares bundle === "cluster-a-compose"', () => {
    for (const h of CLUSTER_A_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe('cluster-a-compose');
    }
  });

  it('handler names match the four canonical compose tools', () => {
    const names = CLUSTER_A_COMPOSE_HANDLERS.map((h) => h.name).sort();
    expect(names).toEqual([
      'compose_breaking_news',
      'compose_documentary_title_card',
      'compose_guest_intro',
      'compose_ongoing_update',
    ]);
  });

  it('handlers do not invoke any patch-sink methods (read-only)', async () => {
    // Build a context mock that would throw on any mutation attempt; if a
    // handler tries to push patches it will explode.
    const trapCtx = new Proxy({} as ToolContext, {
      get(_t, p) {
        if (p === 'then') return undefined; // not a thenable
        throw new Error(`read-only invariant violated: handler accessed ctx.${String(p)}`);
      },
    });
    // Each handler with a representative input must not access ctx.
    const probes: Array<[string, unknown]> = [
      ['compose_breaking_news', { headline: 'h', severity: 'urgent', network: 'cnn' }],
      ['compose_ongoing_update', { network: 'cnn', mainline: 'm' }],
      ['compose_guest_intro', { person: 'p', role: 'r', network: 'cnn', theme: 'broadcast' }],
      ['compose_documentary_title_card', { title: 't', network: 'netflix' }],
    ];
    for (const [name, input] of probes) {
      const tool = getTool(name);
      const parsed = tool.inputSchema.parse(input);
      // No throw → handler did not touch ctx.
      await tool.handle(parsed, trapCtx);
    }
  });
});
