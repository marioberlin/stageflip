// packages/runtimes/interactive/src/clips/web-embed/static-fallback.test.ts
// T-394 ACs #6–#12 — `defaultWebEmbedStaticFallback` +
// `webEmbedStaticFallbackGenerator`:
//   - byte-for-byte determinism across calls (AC #6)
//   - different posterImage.src → different markup (AC #7)
//   - absent posterImage → single placeholder element (AC #8)
//   - registry side-effect: family is registered after subpath import (AC #9)
//   - authored-path telemetry contract (AC #10)
//   - telemetry shape + privacy posture (AC #11)
//   - bounding box: every transform fits within (width, height) (AC #12).

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InteractiveClip } from '@stageflip/schema';

import { staticFallbackGeneratorRegistry } from '../../static-fallback-registry.js';
import {
  defaultWebEmbedStaticFallback,
  webEmbedStaticFallbackGenerator,
} from './static-fallback.js';

const SAMPLE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';

function makeWebEmbedClip(args: {
  width?: number;
  height?: number;
  url?: string;
  posterImage?: { src: string; contentType?: string };
}): InteractiveClip {
  const width = args.width ?? 640;
  const height = args.height ?? 360;
  const url = args.url ?? 'https://example.com/embed';
  const transform = { x: 0, y: 0, width, height, rotation: 0, opacity: 1 };
  return {
    id: 'test-web-embed-clip',
    type: 'interactive-clip',
    family: 'web-embed',
    transform,
    visible: true,
    locked: false,
    animations: [],
    staticFallback: [],
    liveMount: {
      component: { module: '@stageflip/test#WebEmbed' },
      props: {
        url,
        sandbox: [],
        ...(args.posterImage !== undefined ? { posterImage: args.posterImage } : {}),
      },
      permissions: ['network'],
    },
  } as unknown as InteractiveClip;
}

describe('defaultWebEmbedStaticFallback (T-394)', () => {
  it('AC #6 — same args → byte-for-byte identical Element[] across two calls', () => {
    const a = defaultWebEmbedStaticFallback({
      width: 640,
      height: 360,
      posterImage: { src: SAMPLE_DATA_URL, contentType: 'image/png' },
    });
    const b = defaultWebEmbedStaticFallback({
      width: 640,
      height: 360,
      posterImage: { src: SAMPLE_DATA_URL, contentType: 'image/png' },
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('AC #7 — different posterImage.src → different markup', () => {
    const otherDataUrl = 'data:image/png;base64,DIFFERENT_PAYLOAD';
    const a = defaultWebEmbedStaticFallback({
      width: 640,
      height: 360,
      posterImage: { src: SAMPLE_DATA_URL },
    });
    const b = defaultWebEmbedStaticFallback({
      width: 640,
      height: 360,
      posterImage: { src: otherDataUrl },
    });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('AC #8 — absent posterImage → single placeholder TextElement (no ImageElement)', () => {
    const elements = defaultWebEmbedStaticFallback({
      width: 640,
      height: 360,
    });
    expect(elements).toHaveLength(1);
    const el = elements[0] as { id: string; type: string };
    expect(el.id).toContain('placeholder');
    expect(el.type).toBe('text');
  });

  it('AC #8 — present posterImage → single ImageElement (no placeholder)', () => {
    const elements = defaultWebEmbedStaticFallback({
      width: 640,
      height: 360,
      posterImage: { src: SAMPLE_DATA_URL },
    });
    expect(elements).toHaveLength(1);
    const el = elements[0] as { id: string; type: string };
    expect(el.id).toContain('poster');
    expect(el.type).toBe('image');
  });

  it('AC #12 — ImageElement transform fills the canvas exactly', () => {
    const elements = defaultWebEmbedStaticFallback({
      width: 800,
      height: 450,
      posterImage: { src: SAMPLE_DATA_URL },
    });
    expect(elements).toHaveLength(1);
    const el = elements[0];
    if (el === undefined) throw new Error('expected one element');
    expect(el.transform.x).toBe(0);
    expect(el.transform.y).toBe(0);
    expect(el.transform.width).toBe(800);
    expect(el.transform.height).toBe(450);
  });

  it('AC #12 — placeholder TextElement transform fits within (width, height)', () => {
    const elements = defaultWebEmbedStaticFallback({
      width: 200,
      height: 100,
    });
    for (const el of elements) {
      expect(el.transform.x).toBeGreaterThanOrEqual(0);
      expect(el.transform.y).toBeGreaterThanOrEqual(0);
      expect(el.transform.x + el.transform.width).toBeLessThanOrEqual(200);
      expect(el.transform.y + el.transform.height).toBeLessThanOrEqual(100);
    }
  });

  it('ImageElement carries the verbatim posterImage.src', () => {
    const elements = defaultWebEmbedStaticFallback({
      width: 640,
      height: 360,
      posterImage: { src: SAMPLE_DATA_URL },
    });
    const img = elements[0] as { type: string; src: string };
    expect(img.src).toBe(SAMPLE_DATA_URL);
  });
});

describe('webEmbedStaticFallbackGenerator (T-394 ACs #9, #10, #11)', () => {
  it('AC #11 — emits web-embed-clip.static-fallback.rendered with documented attribute shape', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    webEmbedStaticFallbackGenerator({
      clip: makeWebEmbedClip({
        width: 800,
        height: 450,
        posterImage: { src: SAMPLE_DATA_URL },
      }),
      reason: 'permission-denied',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    expect(events).toHaveLength(1);
    const first = events[0];
    if (first === undefined) throw new Error('expected one telemetry event');
    const [name, attrs] = first;
    expect(name).toBe('web-embed-clip.static-fallback.rendered');
    expect(attrs).toMatchObject({
      family: 'web-embed',
      reason: 'permission-denied',
      width: 800,
      height: 450,
      hasPoster: true,
    });
    expect(typeof attrs.posterSrcLength).toBe('number');
    expect(attrs.posterSrcLength).toBe(SAMPLE_DATA_URL.length);
  });

  it('AC #11 privacy — telemetry attributes never carry the poster URL string itself', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const secretDataUrl = 'data:image/png;base64,SECRET_POSTER_PAYLOAD_DO_NOT_LEAK';
    webEmbedStaticFallbackGenerator({
      clip: makeWebEmbedClip({
        posterImage: { src: secretDataUrl },
      }),
      reason: 'permission-denied',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain('SECRET_POSTER_PAYLOAD_DO_NOT_LEAK');
  });

  it('AC #11 — absent posterImage → hasPoster: false; posterSrcLength: 0', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    webEmbedStaticFallbackGenerator({
      clip: makeWebEmbedClip({}),
      reason: 'authored',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    const first = events[0];
    if (first === undefined) throw new Error('expected one telemetry event');
    const [, attrs] = first;
    expect(attrs.hasPoster).toBe(false);
    expect(attrs.posterSrcLength).toBe(0);
  });

  it('AC #11 — reason is forwarded verbatim into the telemetry attributes', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    webEmbedStaticFallbackGenerator({
      clip: makeWebEmbedClip({}),
      reason: 'tenant-denied',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    expect(events[0]?.[1].reason).toBe('tenant-denied');
  });

  it('returns the same Element[] that defaultWebEmbedStaticFallback produces (parity)', () => {
    const clip = makeWebEmbedClip({
      width: 320,
      height: 240,
      posterImage: { src: SAMPLE_DATA_URL },
    });
    const generated = webEmbedStaticFallbackGenerator({
      clip,
      reason: 'authored',
      emitTelemetry: () => undefined,
    });
    const direct = defaultWebEmbedStaticFallback({
      width: 320,
      height: 240,
      posterImage: { src: SAMPLE_DATA_URL },
    });
    expect(JSON.stringify(generated)).toBe(JSON.stringify(direct));
  });
});

describe('webEmbedStaticFallbackGenerator registry side effect (T-394 AC #9)', () => {
  afterEach(() => {
    /* leave registration intact; singleton shared with production */
  });

  it('AC #9 — staticFallbackGeneratorRegistry.resolve("web-embed") returns the generator after subpath import', async () => {
    await import('./index.js');
    const resolved = staticFallbackGeneratorRegistry.resolve('web-embed');
    expect(resolved).toBeDefined();
    expect(typeof resolved).toBe('function');
  });
});

describe('webEmbedStaticFallbackGenerator harness integration (T-394 AC #10)', () => {
  it('AC #10 — authored staticFallback wins; generator is still invoked with reason: "authored" for telemetry', async () => {
    const { InteractiveMountHarness } = await import('../../mount-harness.js');
    const { InteractiveClipRegistry } = await import('../../registry.js');
    const { StaticFallbackGeneratorRegistry } = await import('../../static-fallback-registry.js');
    const { PermissionShim } = await import('../../permission-shim.js');
    const { makeStubFactory } = await import('../../contract-tests/fixtures.js');

    const registry = new InteractiveClipRegistry();
    registry.register('web-embed', makeStubFactory());
    const generatorRegistry = new StaticFallbackGeneratorRegistry();
    generatorRegistry.register('web-embed', webEmbedStaticFallbackGenerator);
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
    const clip = makeWebEmbedClip({
      posterImage: { src: SAMPLE_DATA_URL },
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
    const rendered = events.find((e) => e[0] === 'web-embed-clip.static-fallback.rendered');
    expect(rendered).toBeDefined();
    expect(rendered?.[1].reason).toBe('authored');
  });
});

describe('determinism — no random / no time / no rAF', () => {
  it('does not consult Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    defaultWebEmbedStaticFallback({
      width: 640,
      height: 360,
      posterImage: { src: SAMPLE_DATA_URL },
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not consult Date.now', () => {
    const spy = vi.spyOn(Date, 'now');
    defaultWebEmbedStaticFallback({
      width: 640,
      height: 360,
      posterImage: { src: SAMPLE_DATA_URL },
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
