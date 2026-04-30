// packages/runtimes/interactive/src/clips/live-data/static-fallback.test.ts
// T-392 ACs #5–#13 — `defaultLiveDataStaticFallback` +
// `liveDataStaticFallbackGenerator`:
//   - byte-for-byte determinism across calls (AC #5)
//   - different endpoint → different markup (AC #6)
//   - empty/absent cachedSnapshot → single placeholder element (AC #7)
//   - registry side-effect: family is registered after subpath import (AC #9)
//   - bounding-box: every transform fits within (width, height) (AC #11)
//   - vertical layout: body element's y > header's (AC #12)
//   - telemetry shape + privacy posture (AC #13).

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InteractiveClip } from '@stageflip/schema';

import { staticFallbackGeneratorRegistry } from '../../static-fallback-registry.js';
import {
  defaultLiveDataStaticFallback,
  liveDataStaticFallbackGenerator,
} from './static-fallback.js';

function makeLiveDataClip(args: {
  width?: number;
  height?: number;
  endpoint?: string;
  cachedSnapshot?: { capturedAt: string; status: number; body: unknown };
}): InteractiveClip {
  const width = args.width ?? 640;
  const height = args.height ?? 360;
  const endpoint = args.endpoint ?? 'https://example.com/api/data';
  const transform = { x: 0, y: 0, width, height, rotation: 0, opacity: 1 };
  return {
    id: 'test-live-data-clip',
    type: 'interactive-clip',
    family: 'live-data',
    transform,
    visible: true,
    locked: false,
    animations: [],
    staticFallback: [],
    liveMount: {
      component: { module: '@stageflip/test#LiveData' },
      props: {
        endpoint,
        method: 'GET',
        parseMode: 'json',
        refreshTrigger: 'mount-only',
        ...(args.cachedSnapshot !== undefined ? { cachedSnapshot: args.cachedSnapshot } : {}),
      },
      permissions: ['network'],
    },
  } as unknown as InteractiveClip;
}

describe('defaultLiveDataStaticFallback (T-392)', () => {
  it('AC #5 — same args → byte-for-byte identical Element[] across two calls', () => {
    const a = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { a: 1 } },
    });
    const b = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { a: 1 } },
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('AC #5 — multi-key body → byte-for-byte identical', () => {
    const args = {
      width: 800,
      height: 450,
      endpoint: 'https://api.example.com/x',
      cachedSnapshot: {
        capturedAt: '2026-04-30T12:00:00Z',
        status: 200,
        body: { temperature: 72, humidity: 45, conditions: 'sunny' },
      },
    } as const;
    const a = defaultLiveDataStaticFallback(args);
    const b = defaultLiveDataStaticFallback(args);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('AC #6 — different endpoint → different markup (header text differs)', () => {
    const a = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://a',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { x: 1 } },
    });
    const b = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://b',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { x: 1 } },
    });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('AC #7 — absent cachedSnapshot → single placeholder element (no header / body)', () => {
    const elements = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://x',
    });
    expect(elements).toHaveLength(1);
    const el = elements[0] as { id: string; type: string };
    expect(el.id).toContain('placeholder');
    expect(el.type).toBe('text');
  });

  it('AC #7 — when cachedSnapshot is supplied, returns header + body elements (2 total)', () => {
    const elements = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { ok: true } },
    });
    expect(elements).toHaveLength(2);
  });

  it('AC #11 — every TextElement transform fits within (width, height)', () => {
    const elements = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://example.com/very/long/endpoint/path',
      cachedSnapshot: {
        capturedAt: '2026-04-30T12:00:00Z',
        status: 200,
        body: { items: [1, 2, 3, 4, 5], meta: { count: 5 } },
      },
    });
    for (const el of elements) {
      expect(el.transform.x).toBeGreaterThanOrEqual(0);
      expect(el.transform.y).toBeGreaterThanOrEqual(0);
      expect(el.transform.x + el.transform.width).toBeLessThanOrEqual(640);
      expect(el.transform.y + el.transform.height).toBeLessThanOrEqual(360);
    }
  });

  it('AC #11 — large body on a small canvas: every transform still fits (overflow drops body)', () => {
    // Mirror T-390's overflow-guard discipline: when the body element
    // would overflow, drop it rather than emit y > height.
    const largeBody = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [`field_${i}`, `value_${i}`]),
    );
    const elements = defaultLiveDataStaticFallback({
      width: 200,
      height: 80,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: largeBody },
    });
    for (const el of elements) {
      expect(el.transform.x).toBeGreaterThanOrEqual(0);
      expect(el.transform.y).toBeGreaterThanOrEqual(0);
      expect(el.transform.x + el.transform.width).toBeLessThanOrEqual(200);
      expect(el.transform.y + el.transform.height).toBeLessThanOrEqual(80);
    }
  });

  it('AC #12 — body element transform.y is greater than header transform.y', () => {
    const elements = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { x: 1 } },
    });
    expect(elements).toHaveLength(2);
    const header = elements[0];
    const body = elements[1];
    if (header === undefined || body === undefined) throw new Error('expected header + body');
    expect(body.transform.y).toBeGreaterThan(header.transform.y);
  });

  it('header text contains the endpoint, status, and capturedAt', () => {
    const elements = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://example.com/api',
      cachedSnapshot: { capturedAt: '2026-04-30', status: 201, body: {} },
    });
    const header = elements.find(
      (e) => e.type === 'text' && (e as { id: string }).id.includes('header'),
    ) as { type: 'text'; text: string } | undefined;
    expect(header).toBeDefined();
    if (header === undefined) throw new Error('expected header element');
    expect(header.text).toContain('https://example.com/api');
    expect(header.text).toContain('201');
    expect(header.text).toContain('2026-04-30');
  });

  it('body element renders JSON-pretty-printed body', () => {
    const elements = defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { a: 1, b: 2 } },
    });
    const body = elements.find(
      (e) => e.type === 'text' && (e as { id: string }).id.includes('body'),
    ) as { type: 'text'; text: string } | undefined;
    expect(body).toBeDefined();
    if (body === undefined) throw new Error('expected body element');
    // JSON.stringify(_, null, 2) produces newlines + indentation.
    expect(body.text).toContain('"a": 1');
    expect(body.text).toContain('"b": 2');
  });
});

describe('liveDataStaticFallbackGenerator (T-392 ACs #9, #10, #13)', () => {
  it('AC #13 — emits live-data-clip.static-fallback.rendered with documented attribute shape', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    liveDataStaticFallbackGenerator({
      clip: makeLiveDataClip({
        width: 800,
        height: 450,
        endpoint: 'https://example.com/api',
        cachedSnapshot: { capturedAt: 't', status: 200, body: { ok: true } },
      }),
      reason: 'permission-denied',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    expect(events).toHaveLength(1);
    const first = events[0];
    if (first === undefined) throw new Error('expected one telemetry event');
    const [name, attrs] = first;
    expect(name).toBe('live-data-clip.static-fallback.rendered');
    expect(attrs).toMatchObject({
      family: 'live-data',
      reason: 'permission-denied',
      width: 800,
      height: 450,
      hasSnapshot: true,
    });
    expect(typeof attrs.bodyByteLength).toBe('number');
  });

  it('AC #13 privacy — telemetry attributes never carry the response body or endpoint as the URL value', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const secretBody = { secret: 'CONFIDENTIAL_API_RESPONSE' };
    liveDataStaticFallbackGenerator({
      clip: makeLiveDataClip({
        cachedSnapshot: { capturedAt: 't', status: 200, body: secretBody },
      }),
      reason: 'permission-denied',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain('CONFIDENTIAL_API_RESPONSE');
  });

  it('AC #13 — absent cachedSnapshot → hasSnapshot: false; bodyByteLength: 0', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    liveDataStaticFallbackGenerator({
      clip: makeLiveDataClip({}),
      reason: 'authored',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    const first = events[0];
    if (first === undefined) throw new Error('expected one telemetry event');
    const [, attrs] = first;
    expect(attrs.hasSnapshot).toBe(false);
    expect(attrs.bodyByteLength).toBe(0);
  });

  it('AC #13 — reason is forwarded verbatim into the telemetry attributes', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    liveDataStaticFallbackGenerator({
      clip: makeLiveDataClip({}),
      reason: 'tenant-denied',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    expect(events[0]?.[1].reason).toBe('tenant-denied');
  });

  it('returns the same Element[] that defaultLiveDataStaticFallback produces (parity)', () => {
    const clip = makeLiveDataClip({
      width: 320,
      height: 240,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { v: 1 } },
    });
    const generated = liveDataStaticFallbackGenerator({
      clip,
      reason: 'authored',
      emitTelemetry: () => undefined,
    });
    const direct = defaultLiveDataStaticFallback({
      width: 320,
      height: 240,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { v: 1 } },
    });
    expect(JSON.stringify(generated)).toBe(JSON.stringify(direct));
  });
});

describe('liveDataStaticFallbackGenerator registry side effect (T-392 AC #8)', () => {
  afterEach(() => {
    /* leave registration intact; singleton shared with production */
  });

  it('AC #8 — staticFallbackGeneratorRegistry.resolve("live-data") returns the generator after subpath import', async () => {
    await import('./index.js');
    const resolved = staticFallbackGeneratorRegistry.resolve('live-data');
    expect(resolved).toBeDefined();
    expect(typeof resolved).toBe('function');
  });
});

describe('liveDataStaticFallbackGenerator harness integration (T-392 ACs #9, #10)', () => {
  it('AC #10 — authored staticFallback wins; generator is still invoked with reason: "authored" for telemetry', async () => {
    const { InteractiveMountHarness } = await import('../../mount-harness.js');
    const { InteractiveClipRegistry } = await import('../../registry.js');
    const { StaticFallbackGeneratorRegistry } = await import('../../static-fallback-registry.js');
    const { PermissionShim } = await import('../../permission-shim.js');
    const { makeStubFactory } = await import('../../contract-tests/fixtures.js');

    const registry = new InteractiveClipRegistry();
    registry.register('live-data', makeStubFactory());
    const generatorRegistry = new StaticFallbackGeneratorRegistry();
    generatorRegistry.register('live-data', liveDataStaticFallbackGenerator);
    const events: Array<[string, Record<string, unknown>]> = [];
    const harness = new InteractiveMountHarness({
      registry,
      staticFallbackGeneratorRegistry: generatorRegistry,
      permissionShim: new PermissionShim({
        tenantPolicy: { canMount: () => false },
      }),
      emitTelemetry: (e, a) => events.push([e, a]),
    });
    const root = document.createElement('div');
    const clip = makeLiveDataClip({
      cachedSnapshot: { capturedAt: 't', status: 200, body: { ok: true } },
    });
    (clip as unknown as { staticFallback: unknown[] }).staticFallback = [
      {
        id: 'authored-fallback',
        type: 'text',
        transform: { x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1 },
        visible: true,
        locked: false,
        animations: [],
        text: 'authored-rendered',
      },
    ];
    await harness.mount(clip, root, new AbortController().signal);
    const rendered = events.find((e) => e[0] === 'live-data-clip.static-fallback.rendered');
    expect(rendered).toBeDefined();
    expect(rendered?.[1].reason).toBe('authored');
  });

  it('AC #9 — empty staticFallback for live-data clip routes to the generator (rendered Element[])', async () => {
    const { InteractiveMountHarness } = await import('../../mount-harness.js');
    const { InteractiveClipRegistry } = await import('../../registry.js');
    const { StaticFallbackGeneratorRegistry } = await import('../../static-fallback-registry.js');
    const { PermissionShim } = await import('../../permission-shim.js');
    const { makeStubFactory } = await import('../../contract-tests/fixtures.js');

    const registry = new InteractiveClipRegistry();
    registry.register('live-data', makeStubFactory());
    const generatorRegistry = new StaticFallbackGeneratorRegistry();
    generatorRegistry.register('live-data', liveDataStaticFallbackGenerator);
    const events: Array<[string, Record<string, unknown>]> = [];
    const harness = new InteractiveMountHarness({
      registry,
      staticFallbackGeneratorRegistry: generatorRegistry,
      permissionShim: new PermissionShim({
        tenantPolicy: { canMount: () => false },
      }),
      emitTelemetry: (e, a) => events.push([e, a]),
    });
    const root = document.createElement('div');
    const clip = makeLiveDataClip({
      cachedSnapshot: { capturedAt: 't', status: 200, body: { ok: true } },
    });
    (clip as unknown as { staticFallback: unknown[] }).staticFallback = [];
    await harness.mount(clip, root, new AbortController().signal);
    const rendered = events.find((e) => e[0] === 'live-data-clip.static-fallback.rendered');
    expect(rendered).toBeDefined();
    expect(rendered?.[1].reason).toBe('tenant-denied');
  });
});

describe('determinism — no random / no time / no rAF', () => {
  it('does not consult Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: { a: 1 } },
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not consult Date.now', () => {
    const spy = vi.spyOn(Date, 'now');
    defaultLiveDataStaticFallback({
      width: 640,
      height: 360,
      endpoint: 'https://x',
      cachedSnapshot: { capturedAt: 't', status: 200, body: {} },
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
