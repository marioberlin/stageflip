// packages/engine/src/handlers/cluster-g-compose/handlers.test.ts
// Vitest coverage for the 4 cluster-g-compose tools — happy-path
// dispatch per (intent, platform) tuple, error reasons, schema
// rejection, full Cluster G preset coverage, determinism + read-only
// invariants.

import { describe, expect, it } from 'vitest';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_G_COMPOSE_HANDLERS,
  CLUSTER_G_PRESET_IDS,
  CTA_INTENTS,
  CTA_PLATFORMS,
} from './handlers.js';

const ctx: ToolContext = {};

function getTool(name: string): ToolHandler<unknown, unknown, ToolContext> {
  const found = CLUSTER_G_COMPOSE_HANDLERS.find((h) => h.name === name);
  if (!found) throw new Error(`tool ${name} not found in CLUSTER_G_COMPOSE_HANDLERS`);
  return found;
}

async function invoke(name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  const parsed = tool.inputSchema.parse(input);
  const result = await tool.handle(parsed, ctx);
  // Round-trip the output through its schema to catch shape drift.
  return tool.outputSchema.parse(result);
}

const QR_MATRIX = 'data:image/png;base64,AAAA';

describe('compose_cta', () => {
  it('happy path: subscribe / youtube', async () => {
    const out = (await invoke('compose_cta', {
      intent: 'subscribe',
      platform: 'youtube',
      channelName: 'Acme Channel',
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(out.ok).toBe(true);
    expect(out.presetId).toBe('youtube-subscribe-bounce');
    expect(out.clipKind).toBe('subscribeButton');
    expect(out.props.platform).toBe('youtube');
    expect(out.props.channelName).toBe('Acme Channel');
    // intent is consumed by dispatch — not forwarded into props
    expect(out.props.intent).toBeUndefined();
  });

  it('happy path: follow / tiktok', async () => {
    const out = (await invoke('compose_cta', {
      intent: 'follow',
      platform: 'tiktok',
      channelName: 'Acme',
      subscriberCount: '847K',
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(out.presetId).toBe('tiktok-follow-pulse');
    expect(out.clipKind).toBe('followPrompt');
    expect(out.props.subscriberCount).toBe('847K');
  });

  it('happy path: subscribe / tiktok and follow / youtube (synonym semantics)', async () => {
    const subTik = (await invoke('compose_cta', {
      intent: 'subscribe',
      platform: 'tiktok',
      channelName: 'Acme',
    })) as { ok: true; presetId: string };
    expect(subTik.presetId).toBe('tiktok-follow-pulse');

    const folYt = (await invoke('compose_cta', {
      intent: 'follow',
      platform: 'youtube',
      channelName: 'Acme',
    })) as { ok: true; presetId: string };
    expect(folYt.presetId).toBe('youtube-subscribe-bounce');
  });

  it('happy path: link / instagram', async () => {
    const out = (await invoke('compose_cta', {
      intent: 'link',
      platform: 'instagram',
      url: 'https://example.com/promo',
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(out.presetId).toBe('instagram-link-sticker');
    expect(out.clipKind).toBe('linkSticker');
    expect(out.props.url).toBe('https://example.com/promo');
  });

  it('happy path: qr (theme defaulted to unbranded per Coinbase canon)', async () => {
    const out = (await invoke('compose_cta', {
      intent: 'qr',
      qrMatrix: QR_MATRIX,
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(out.presetId).toBe('coinbase-dvd-qr');
    expect(out.clipKind).toBe('qrBounce');
    expect(out.props.qrMatrix).toBe(QR_MATRIX);
    // PRESET_DEFAULTS injects theme='unbranded' (Coinbase canon)
    expect(out.props.theme).toBe('unbranded');
  });

  it('happy path: qr with explicit branded theme overrides Coinbase default', async () => {
    const out = (await invoke('compose_cta', {
      intent: 'qr',
      qrMatrix: QR_MATRIX,
      theme: 'branded',
      brand: { primary: '#0052FF' },
    })) as { ok: true; props: Record<string, unknown> };
    expect(out.props.theme).toBe('branded');
    expect(out.props.brand).toEqual({ primary: '#0052FF' });
  });

  it('happy path: social-handle', async () => {
    const handles = [
      { platform: 'instagram' as const, handle: 'acme' },
      { platform: 'tiktok' as const, handle: 'acmebrand' },
    ];
    const out = (await invoke('compose_cta', {
      intent: 'social-handle',
      handles,
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(out.presetId).toBe('social-handle-lower-third');
    expect(out.clipKind).toBe('lowerThird');
    expect(out.props.handles).toEqual(handles);
  });

  it('rejects subscribe / instagram with helpful detail pointing at link register', async () => {
    const out = (await invoke('compose_cta', {
      intent: 'subscribe',
      platform: 'instagram',
      channelName: 'Acme',
    })) as { ok: false; reason: string; detail?: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('invalid_platform_for_intent');
    expect(out.detail).toContain('Instagram has no subscribe-button');
    expect(out.detail).toContain('intent: "link"');
  });

  it('rejects missing-payload cases with the right reason for each intent', async () => {
    const subNoPlatform = (await invoke('compose_cta', {
      intent: 'subscribe',
      channelName: 'Acme',
    })) as { ok: false; reason: string };
    expect(subNoPlatform.reason).toBe('platform_required');

    const folNoPlatform = (await invoke('compose_cta', {
      intent: 'follow',
      channelName: 'Acme',
    })) as { ok: false; reason: string };
    expect(folNoPlatform.reason).toBe('platform_required');

    const linkNoUrl = (await invoke('compose_cta', {
      intent: 'link',
      platform: 'instagram',
    })) as { ok: false; reason: string };
    expect(linkNoUrl.reason).toBe('url_required');

    const qrNoMatrix = (await invoke('compose_cta', {
      intent: 'qr',
    })) as { ok: false; reason: string };
    expect(qrNoMatrix.reason).toBe('qr_matrix_required');

    const handleNoHandles = (await invoke('compose_cta', {
      intent: 'social-handle',
    })) as { ok: false; reason: string };
    expect(handleNoHandles.reason).toBe('handles_required');
  });

  it('schema rejects bad hex / bad enum / extra fields at root + nested', () => {
    const tool = getTool('compose_cta');
    // bad hex on brand.primary
    expect(() =>
      tool.inputSchema.parse({
        intent: 'subscribe',
        platform: 'youtube',
        channelName: 'Acme',
        brand: { primary: '#ZZZ' },
      }),
    ).toThrow();
    // 8-char hex is rejected
    expect(() =>
      tool.inputSchema.parse({
        intent: 'subscribe',
        platform: 'youtube',
        channelName: 'Acme',
        brand: { primary: '#FF00FF11' },
      }),
    ).toThrow();
    // missing-leading-hash is rejected
    expect(() =>
      tool.inputSchema.parse({
        intent: 'subscribe',
        platform: 'youtube',
        channelName: 'Acme',
        brand: { primary: 'FF00FF' },
      }),
    ).toThrow();
    // bad intent enum
    expect(() =>
      tool.inputSchema.parse({
        intent: 'unknown-intent',
        platform: 'youtube',
        channelName: 'Acme',
      }),
    ).toThrow();
    // missing required intent
    expect(() => tool.inputSchema.parse({ platform: 'youtube' })).toThrow();
    // extra root field
    expect(() =>
      tool.inputSchema.parse({
        intent: 'qr',
        qrMatrix: QR_MATRIX,
        rogue: 'x',
      }),
    ).toThrow();
    // extra nested field in handles[]
    expect(() =>
      tool.inputSchema.parse({
        intent: 'social-handle',
        handles: [{ platform: 'instagram', handle: 'acme', rogue: 'x' }],
      }),
    ).toThrow();
  });
});

describe('compose_subscribe_prompt', () => {
  it('happy path: youtube + tiktok', async () => {
    const yt = (await invoke('compose_subscribe_prompt', {
      platform: 'youtube',
      channelName: 'Acme',
      subscriberCount: '1.2M',
    })) as { ok: true; presetId: string; clipKind: string; rationale: string };
    expect(yt.presetId).toBe('youtube-subscribe-bounce');
    expect(yt.clipKind).toBe('subscribeButton');
    expect(yt.rationale).toBe('platform=youtube + channel=Acme → youtube-subscribe-bounce');

    const tt = (await invoke('compose_subscribe_prompt', {
      platform: 'tiktok',
      channelName: 'Acme',
    })) as { ok: true; presetId: string; clipKind: string; rationale: string };
    expect(tt.presetId).toBe('tiktok-follow-pulse');
    expect(tt.clipKind).toBe('followPrompt');
    expect(tt.rationale).toBe('platform=tiktok + channel=Acme → tiktok-follow-pulse');
  });

  it('schema rejects platform=instagram (sealed 2-value enum)', () => {
    const tool = getTool('compose_subscribe_prompt');
    expect(() => tool.inputSchema.parse({ platform: 'instagram', channelName: 'Acme' })).toThrow();
    // missing channelName
    expect(() => tool.inputSchema.parse({ platform: 'youtube' })).toThrow();
    // extra field
    expect(() =>
      tool.inputSchema.parse({
        platform: 'youtube',
        channelName: 'Acme',
        rogue: 'x',
      }),
    ).toThrow();
  });
});

describe('compose_social_handle', () => {
  it('happy path: minimal length-1 input + full input with brand + repetition + duration', async () => {
    const minimal = (await invoke('compose_social_handle', {
      handles: [{ platform: 'instagram', handle: 'acme' }],
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(minimal.presetId).toBe('social-handle-lower-third');
    expect(minimal.clipKind).toBe('lowerThird');
    // Defaults from PRESET_DEFAULTS (no caller override): repetition=1, duration=6
    expect(minimal.props.repetition).toBe(1);
    expect(minimal.props.duration).toBe(6);

    const full = (await invoke('compose_social_handle', {
      handles: [
        { platform: 'instagram', handle: 'acme' },
        { platform: 'tiktok', handle: 'acmebrand' },
      ],
      brand: { primary: '#FF6600', accent: '#000000', font: 'Inter' },
      repetition: 3,
      duration: 8,
    })) as { ok: true; props: Record<string, unknown> };
    expect(full.props.repetition).toBe(3);
    expect(full.props.duration).toBe(8);
    expect(full.props.brand).toEqual({ primary: '#FF6600', accent: '#000000', font: 'Inter' });
  });

  it('schema boundary: handles min=1 / max=6', () => {
    const tool = getTool('compose_social_handle');
    expect(() => tool.inputSchema.parse({ handles: [] })).toThrow();
    const seven = Array.from({ length: 7 }, () => ({
      platform: 'instagram' as const,
      handle: 'a',
    }));
    expect(() => tool.inputSchema.parse({ handles: seven })).toThrow();
    // Exactly 6 is accepted
    const six = Array.from({ length: 6 }, () => ({
      platform: 'instagram' as const,
      handle: 'a',
    }));
    expect(() => tool.inputSchema.parse({ handles: six })).not.toThrow();
  });
});

describe('compose_qr_bounce', () => {
  it('happy path: minimal + full input', async () => {
    const minimal = (await invoke('compose_qr_bounce', {
      qrMatrix: QR_MATRIX,
    })) as {
      ok: true;
      presetId: string;
      clipKind: string;
      props: Record<string, unknown>;
      rationale: string;
    };
    expect(minimal.presetId).toBe('coinbase-dvd-qr');
    expect(minimal.clipKind).toBe('qrBounce');
    // Coinbase canon default theme
    expect(minimal.props.theme).toBe('unbranded');
    expect(minimal.rationale).toContain('unbranded register');

    const full = (await invoke('compose_qr_bounce', {
      qrMatrix: QR_MATRIX,
      url: 'https://example.com',
      brand: { primary: '#0052FF' },
      theme: 'unbranded',
      bounceSpeed: 'fast',
    })) as { ok: true; props: Record<string, unknown> };
    expect(full.props.bounceSpeed).toBe('fast');
    expect(full.props.theme).toBe('unbranded');
    expect(full.props.url).toBe('https://example.com');
  });

  it('schema rejects empty qrMatrix / extra field', () => {
    const tool = getTool('compose_qr_bounce');
    expect(() => tool.inputSchema.parse({ qrMatrix: '' })).toThrow();
    expect(() => tool.inputSchema.parse({})).toThrow();
    expect(() => tool.inputSchema.parse({ qrMatrix: QR_MATRIX, rogue: 'x' })).toThrow();
  });
});

describe('cluster G coverage', () => {
  it('every Cluster G preset id is reachable from at least one (tool, input) pair', async () => {
    const reached = new Set<string>();

    const a = (await invoke('compose_cta', {
      intent: 'subscribe',
      platform: 'youtube',
      channelName: 'A',
    })) as { presetId: string };
    reached.add(a.presetId);

    const b = (await invoke('compose_cta', {
      intent: 'follow',
      platform: 'tiktok',
      channelName: 'A',
    })) as { presetId: string };
    reached.add(b.presetId);

    const c = (await invoke('compose_cta', {
      intent: 'link',
      platform: 'instagram',
      url: 'https://example.com',
    })) as { presetId: string };
    reached.add(c.presetId);

    const d = (await invoke('compose_cta', {
      intent: 'qr',
      qrMatrix: QR_MATRIX,
    })) as { presetId: string };
    reached.add(d.presetId);

    const e = (await invoke('compose_cta', {
      intent: 'social-handle',
      handles: [{ platform: 'instagram', handle: 'a' }],
    })) as { presetId: string };
    reached.add(e.presetId);

    expect(reached).toEqual(new Set(CLUSTER_G_PRESET_IDS));
  });
});

describe('barrel + invariants', () => {
  it('CLUSTER_G_PRESET_IDS contains exactly 5 entries', () => {
    expect(CLUSTER_G_PRESET_IDS.length).toBe(5);
  });

  it('CTA_INTENTS contains exactly 5 entries', () => {
    expect(CTA_INTENTS.length).toBe(5);
  });

  it('CTA_PLATFORMS contains exactly 4 entries', () => {
    expect(CTA_PLATFORMS.length).toBe(4);
  });

  it('handlers array length is 4', () => {
    expect(CLUSTER_G_COMPOSE_HANDLERS.length).toBe(4);
  });

  it('every handler declares bundle === "cluster-g-compose"', () => {
    for (const h of CLUSTER_G_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe('cluster-g-compose');
    }
  });

  it('determinism — same input twice yields deeply-equal output for each tool', async () => {
    const cases: Array<[string, unknown]> = [
      ['compose_cta', { intent: 'subscribe', platform: 'youtube', channelName: 'Acme' }],
      ['compose_subscribe_prompt', { platform: 'tiktok', channelName: 'Acme' }],
      ['compose_social_handle', { handles: [{ platform: 'instagram', handle: 'acme' }] }],
      ['compose_qr_bounce', { qrMatrix: QR_MATRIX }],
    ];
    for (const [name, input] of cases) {
      const a = await invoke(name, input);
      const b = await invoke(name, input);
      expect(a).toEqual(b);
    }
  });

  it('read-only posture — handlers do not call patchSink (none exists on ToolContext)', async () => {
    // ToolContext has no `patchSink` field by type contract; this test
    // asserts that handler invocation with a bare ToolContext succeeds
    // without runtime error (no field-access on a non-existent sink).
    const bareCtx: ToolContext = {};
    for (const h of CLUSTER_G_COMPOSE_HANDLERS) {
      // sample input per tool — we only care that the handler doesn't
      // throw a TypeError from missing context fields.
      const sample =
        h.name === 'compose_cta'
          ? { intent: 'qr', qrMatrix: QR_MATRIX }
          : h.name === 'compose_subscribe_prompt'
            ? { platform: 'youtube', channelName: 'Acme' }
            : h.name === 'compose_social_handle'
              ? { handles: [{ platform: 'instagram', handle: 'acme' }] }
              : { qrMatrix: QR_MATRIX };
      const parsed = h.inputSchema.parse(sample);
      const result = await h.handle(parsed, bareCtx);
      expect(result).toBeDefined();
    }
  });
});
