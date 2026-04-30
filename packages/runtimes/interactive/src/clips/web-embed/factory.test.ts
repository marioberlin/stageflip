// packages/runtimes/interactive/src/clips/web-embed/factory.test.ts
// T-393 ACs #6–#18, #25 — webEmbedClipFactory unit tests. Sandboxed
// iframe + origin-filtered postMessage + dispose discipline.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ClipFactory, type MountContext, PERMISSIVE_TENANT_POLICY } from '../../contract.js';
import { WebEmbedClipFactoryBuilder, type WebEmbedClipFactoryOptions } from './factory.js';
import { type WebEmbedMessageEvent } from './types.js';

interface MakeContextArgs {
  emit?: MountContext['emitTelemetry'];
  signal?: AbortSignal;
  width?: number;
  height?: number;
  props?: Partial<{
    url: string;
    sandbox: string[];
    allowedOrigins: string[];
    width: number;
    height: number;
    posterFrame: number;
  }>;
  badProps?: Record<string, unknown>;
}

function makeContext(args: MakeContextArgs = {}): MountContext {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const props =
    args.badProps ??
    ({
      url: args.props?.url ?? 'https://example.com/embed',
      sandbox: args.props?.sandbox ?? [],
      ...(args.props?.allowedOrigins !== undefined
        ? { allowedOrigins: args.props.allowedOrigins }
        : {}),
      ...(args.props?.width !== undefined ? { width: args.props.width } : {}),
      ...(args.props?.height !== undefined ? { height: args.props.height } : {}),
      posterFrame: args.props?.posterFrame ?? 0,
    } satisfies Record<string, unknown>);
  return {
    clip: {
      id: 'test-web-embed-clip',
      type: 'interactive-clip',
      family: 'web-embed',
      transform: {
        x: 0,
        y: 0,
        width: args.width ?? 320,
        height: args.height ?? 200,
        rotation: 0,
        opacity: 1,
      },
      visible: true,
      locked: false,
      animations: [],
      staticFallback: [
        {
          id: 'sf',
          type: 'text',
          transform: { x: 0, y: 0, width: 320, height: 200, rotation: 0, opacity: 1 },
          visible: true,
          locked: false,
          animations: [],
          text: 'fallback',
          fontSize: 16,
        },
      ],
      liveMount: {
        component: { module: '@stageflip/runtimes-interactive/clips/web-embed#WebEmbedClip' },
        props,
        permissions: ['network'],
      },
    } as never,
    root,
    permissions: ['network'],
    tenantPolicy: PERMISSIVE_TENANT_POLICY,
    emitTelemetry: args.emit ?? (() => undefined),
    signal: args.signal ?? new AbortController().signal,
  };
}

function buildFactory(options: WebEmbedClipFactoryOptions = {}): ClipFactory {
  return WebEmbedClipFactoryBuilder.build(options);
}

describe('webEmbedClipFactory — registry + frameSource (T-393 AC #6, #7, #8)', () => {
  it('AC #6 — interactiveClipRegistry.resolve("web-embed") returns the factory after subpath import', async () => {
    await import('./index.js');
    const { interactiveClipRegistry } = await import('../../registry.js');
    expect(interactiveClipRegistry.resolve('web-embed')).toBeDefined();
  });

  it('AC #7 — re-registering throws InteractiveClipFamilyAlreadyRegisteredError', async () => {
    await import('./index.js');
    const { interactiveClipRegistry } = await import('../../registry.js');
    const { webEmbedClipFactory } = await import('./factory.js');
    expect(() => interactiveClipRegistry.register('web-embed', webEmbedClipFactory)).toThrow(
      /already/i,
    );
  });

  it('AC #8 — mount with frameSource: undefined succeeds', async () => {
    const factory = buildFactory();
    const ctx = makeContext();
    const handle = await factory(ctx);
    expect(handle).toBeDefined();
    handle.dispose();
  });
});

describe('webEmbedClipFactory — iframe creation (T-393 AC #9, #10)', () => {
  it('AC #9 — mount creates exactly one iframe under the root, with src + sandbox attribute', async () => {
    const factory = buildFactory();
    const ctx = makeContext({
      props: {
        url: 'https://example.com/embed',
        sandbox: ['allow-scripts', 'allow-same-origin'],
      },
    });
    const handle = await factory(ctx);
    const iframes = ctx.root.querySelectorAll('iframe');
    expect(iframes).toHaveLength(1);
    const iframe = iframes[0] as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('https://example.com/embed');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    handle.dispose();
  });

  it('AC #10 — width/height attributes match props.width / props.height when supplied', async () => {
    const factory = buildFactory();
    const ctx = makeContext({
      width: 320,
      height: 200,
      props: { width: 800, height: 600 },
    });
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('width')).toBe('800');
    expect(iframe.getAttribute('height')).toBe('600');
    handle.dispose();
  });

  it('AC #10 — width/height fall back to clip transform when props omit them', async () => {
    const factory = buildFactory();
    const ctx = makeContext({ width: 320, height: 200 });
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('width')).toBe('320');
    expect(iframe.getAttribute('height')).toBe('200');
    handle.dispose();
  });
});

describe('webEmbedClipFactory — reload + postMessage (T-393 AC #11, #12)', () => {
  it('AC #11 — reload() re-assigns iframe.src and emits web-embed-clip.reload', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory();
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    iframe.setAttribute('src', 'https://stale-after-iframe-mutated/');
    handle.reload();
    // After reload, src is reassigned to the configured URL.
    expect(iframe.getAttribute('src')).toBe('https://example.com/embed');
    expect(events.some(([e]) => e === 'web-embed-clip.reload')).toBe(true);
    handle.dispose();
  });

  it('AC #12 — postMessage(msg) calls iframe.contentWindow.postMessage with the URL origin (NOT "*")', async () => {
    const factory = buildFactory();
    const ctx = makeContext({ props: { url: 'https://example.com/embed' } });
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    const cw = iframe.contentWindow;
    if (cw === null) throw new Error('expected iframe contentWindow');
    const spy = vi.spyOn(cw, 'postMessage');
    handle.postMessage({ hello: 'world' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ hello: 'world' }, 'https://example.com');
    spy.mockRestore();
    handle.dispose();
  });
});

describe('webEmbedClipFactory — onMessage filtering (T-393 AC #13, #14, #15)', () => {
  it('AC #13 — handlers fire ONLY when source matches contentWindow AND origin is in allowlist', async () => {
    const factory = buildFactory();
    const ctx = makeContext({
      props: {
        url: 'https://example.com/embed',
        allowedOrigins: ['https://example.com'],
      },
    });
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    const cw = iframe.contentWindow;
    if (cw === null) throw new Error('expected iframe contentWindow');

    const seen: WebEmbedMessageEvent[] = [];
    handle.onMessage((e) => seen.push(e));

    // Valid: source = contentWindow, origin allowlisted.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ok: 1 },
        source: cw,
        origin: 'https://example.com',
      }),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]?.data).toEqual({ ok: 1 });
    expect(seen[0]?.origin).toBe('https://example.com');

    handle.dispose();
  });

  it('AC #14 — origin-not-allowed: source matches but origin is NOT in allowlist → reason "origin-not-allowed"', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory();
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      props: {
        url: 'https://example.com/embed',
        allowedOrigins: ['https://example.com'],
      },
    });
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    const cw = iframe.contentWindow;
    if (cw === null) throw new Error('expected iframe contentWindow');

    const seen: WebEmbedMessageEvent[] = [];
    handle.onMessage((e) => seen.push(e));

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { rogue: true },
        source: cw,
        origin: 'https://attacker.example',
      }),
    );

    expect(seen).toHaveLength(0);
    const dropped = events.find(([e]) => e === 'web-embed-clip.message.dropped');
    expect(dropped).toBeDefined();
    expect(dropped?.[1].reason).toBe('origin-not-allowed');
    handle.dispose();
  });

  it('AC #14 — source-mismatch: origin allowlisted but event.source is NOT contentWindow → reason "source-mismatch"', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory();
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      props: {
        url: 'https://example.com/embed',
        allowedOrigins: ['https://example.com'],
      },
    });
    const handle = await factory(ctx);

    const seen: WebEmbedMessageEvent[] = [];
    handle.onMessage((e) => seen.push(e));

    // Forge a message with source = window (NOT the iframe's contentWindow)
    // but with an allowlisted origin. This is the rogue-nested-iframe case.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { spoofed: true },
        source: window,
        origin: 'https://example.com',
      }),
    );

    expect(seen).toHaveLength(0);
    const dropped = events.find(([e]) => e === 'web-embed-clip.message.dropped');
    expect(dropped).toBeDefined();
    expect(dropped?.[1].reason).toBe('source-mismatch');
    handle.dispose();
  });

  it('AC #14 — handlers do NOT fire when allowedOrigins is undefined', async () => {
    const factory = buildFactory();
    const ctx = makeContext({
      props: { url: 'https://example.com/embed' },
    });
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    const cw = iframe.contentWindow;
    if (cw === null) throw new Error('expected iframe contentWindow');

    const seen: WebEmbedMessageEvent[] = [];
    handle.onMessage((e) => seen.push(e));

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { x: 1 },
        source: cw,
        origin: 'https://example.com',
      }),
    );
    expect(seen).toHaveLength(0);
    handle.dispose();
  });

  it('AC #15 — onMessage returns an unsubscribe function that removes the handler', async () => {
    const factory = buildFactory();
    const ctx = makeContext({
      props: {
        url: 'https://example.com/embed',
        allowedOrigins: ['https://example.com'],
      },
    });
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    const cw = iframe.contentWindow;
    if (cw === null) throw new Error('expected iframe contentWindow');

    const seen: WebEmbedMessageEvent[] = [];
    const unsubscribe = handle.onMessage((e) => seen.push(e));
    unsubscribe();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { after: 'unsubscribe' },
        source: cw,
        origin: 'https://example.com',
      }),
    );
    expect(seen).toHaveLength(0);
    handle.dispose();
  });
});

describe('webEmbedClipFactory — resource cleanup (T-393 AC #16)', () => {
  it('AC #16 — dispose() removes window listener, sets iframe.src to about:blank, detaches iframe, and is idempotent', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const factory = buildFactory();
    const ctx = makeContext();
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    handle.dispose();
    // iframe.src reset to about:blank BEFORE detach (D-T393-7 step 2).
    expect(iframe.getAttribute('src')).toBe('about:blank');
    // iframe detached from the root.
    expect(ctx.root.querySelector('iframe')).toBeNull();
    // window message listener removed.
    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
    // Idempotent — second + third dispose is a no-op.
    expect(() => {
      handle.dispose();
      handle.dispose();
    }).not.toThrow();
    removeSpy.mockRestore();
  });
});

describe('webEmbedClipFactory — failure paths (invalid props)', () => {
  it('rejects with mount.failure invalid-props on a malformed schema', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory();
    const ctx = makeContext({
      badProps: { url: 'not-a-url' },
      emit: (e, a) => events.push([e, a]),
    });
    await expect(factory(ctx)).rejects.toThrow();
    expect(
      events.some(([e, a]) => e === 'web-embed-clip.mount.failure' && a.reason === 'invalid-props'),
    ).toBe(true);
  });
});

describe('webEmbedClipFactory — telemetry privacy (T-393 AC #17)', () => {
  it('AC #17 — message.received attributes contain integer byteLength + origin but NEVER the body', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory();
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      props: {
        url: 'https://example.com/embed',
        allowedOrigins: ['https://example.com'],
      },
    });
    const handle = await factory(ctx);
    const iframe = ctx.root.querySelector('iframe') as HTMLIFrameElement;
    const cw = iframe.contentWindow;
    if (cw === null) throw new Error('expected iframe contentWindow');

    const secret = 'CONFIDENTIAL_MESSAGE_BODY';
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { secret },
        source: cw,
        origin: 'https://example.com',
      }),
    );
    const received = events.find(([e]) => e === 'web-embed-clip.message.received');
    expect(received).toBeDefined();
    expect(received?.[1].origin).toBe('https://example.com');
    expect(typeof received?.[1].byteLength).toBe('number');
    // The full serialised event log MUST NOT contain the secret body.
    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain(secret);
    handle.dispose();
  });

  it('AC #17 — message.outbound attributes carry byteLength + targetOrigin only (no body)', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory();
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      props: { url: 'https://example.com/embed' },
    });
    const handle = await factory(ctx);
    const secret = 'OUTBOUND_LEAKING_BODY';
    handle.postMessage({ secret });
    const outbound = events.find(([e]) => e === 'web-embed-clip.message.outbound');
    expect(outbound).toBeDefined();
    expect(outbound?.[1].targetOrigin).toBe('https://example.com');
    expect(typeof outbound?.[1].byteLength).toBe('number');
    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain(secret);
    handle.dispose();
  });
});

describe('webEmbedClipFactory — permission posture (T-393 AC #18)', () => {
  it('AC #18 — mount with permissions: ["network"] succeeds; permissionPrePrompt is unset on context', async () => {
    const factory = buildFactory();
    const ctx = makeContext();
    expect(ctx.permissionPrePrompt).toBeUndefined();
    const handle = await factory(ctx);
    expect(handle).toBeDefined();
    handle.dispose();
  });
});

describe('clip directory hard-rule compliance (T-393 AC #25)', () => {
  it('AC #25 — clip directory contains no direct fetch / XMLHttpRequest / sendBeacon references', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir).filter((f) => {
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) return false;
      if (f.endsWith('.snap')) return false;
      const full = join(dir, f);
      return statSync(full).isFile();
    });
    for (const f of files) {
      const content = readFileSync(join(dir, f), 'utf8');
      const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(stripped, `forbidden network primitive in ${f}`).not.toMatch(/\bfetch\s*\(/);
      expect(stripped, `forbidden network primitive in ${f}`).not.toMatch(/\bXMLHttpRequest\b/);
      expect(stripped, `forbidden network primitive in ${f}`).not.toMatch(/\bsendBeacon\b/);
    }
  });
});

beforeEach(() => {
  /* singleton registration accumulates across tests within a file */
});

afterEach(() => {
  /* leave registrations intact */
});
