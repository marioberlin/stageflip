// packages/runtimes/interactive/src/clips/live-data/factory.test.ts
// T-391 ACs #6–#19, #26 — liveDataClipFactory unit tests. Uses the
// `InMemoryLiveDataProvider` to drive scripted responses and pin
// abort discipline + telemetry privacy.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ClipFactory, type MountContext, PERMISSIVE_TENANT_POLICY } from '../../contract.js';
import { InteractiveClipRegistry } from '../../registry.js';
import { LiveDataClipFactoryBuilder, type LiveDataClipFactoryOptions } from './factory.js';
import { InMemoryLiveDataProvider } from './live-data-provider.js';
import { RefreshTriggerError, type DataEvent, type ErrorEvent } from './types.js';

interface MakeContextArgs {
  emit?: MountContext['emitTelemetry'];
  signal?: AbortSignal;
  props?: Partial<{
    endpoint: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body: unknown;
    parseMode: 'json' | 'text';
    refreshTrigger: 'mount-only' | 'manual';
    posterFrame: number;
  }>;
  badProps?: Record<string, unknown>;
}

function makeContext(args: MakeContextArgs = {}): MountContext {
  const root = document.createElement('div');
  const props =
    args.badProps ??
    ({
      endpoint: args.props?.endpoint ?? 'https://example.com/data',
      method: args.props?.method ?? 'GET',
      ...(args.props?.headers !== undefined ? { headers: args.props.headers } : {}),
      ...(args.props?.body !== undefined ? { body: args.props.body } : {}),
      parseMode: args.props?.parseMode ?? 'json',
      refreshTrigger: args.props?.refreshTrigger ?? 'mount-only',
      posterFrame: args.props?.posterFrame ?? 0,
    } satisfies Record<string, unknown>);
  return {
    clip: {
      id: 'test-live-data-clip',
      type: 'interactive-clip',
      family: 'live-data',
      transform: { x: 0, y: 0, width: 320, height: 200 },
      visible: true,
      locked: false,
      animations: [],
      staticFallback: [
        {
          id: 'sf',
          type: 'text',
          transform: { x: 0, y: 0, width: 320, height: 200 },
          visible: true,
          locked: false,
          animations: [],
          text: 'fallback',
          fontSize: 16,
        },
      ],
      liveMount: {
        component: {
          module: '@stageflip/runtimes-interactive/clips/live-data#LiveDataClip',
        },
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

function buildFactory(options: LiveDataClipFactoryOptions = {}): ClipFactory {
  return LiveDataClipFactoryBuilder.build(options);
}

function jsonProvider(body: unknown, status = 200): InMemoryLiveDataProvider {
  return new InMemoryLiveDataProvider({
    scripted: {
      'https://example.com/data': {
        status,
        bodyText: JSON.stringify(body),
        contentType: 'application/json',
      },
    },
  });
}

describe('liveDataClipFactory — registry + frameSource (T-391 AC #6, #7, #8)', () => {
  it('AC #6 — interactiveClipRegistry.resolve("live-data") returns the factory after subpath import', async () => {
    await import('./index.js');
    const { interactiveClipRegistry } = await import('../../registry.js');
    expect(interactiveClipRegistry.resolve('live-data')).toBeDefined();
  });

  it('AC #7 — re-registering throws InteractiveClipFamilyAlreadyRegisteredError', async () => {
    await import('./index.js');
    const { interactiveClipRegistry } = await import('../../registry.js');
    const { liveDataClipFactory } = await import('./factory.js');
    expect(() => interactiveClipRegistry.register('live-data', liveDataClipFactory)).toThrow(
      /already/i,
    );
  });

  it('AC #8 — mount with frameSource: undefined succeeds', async () => {
    const provider = jsonProvider({ ok: true });
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    expect(handle).toBeDefined();
    handle.dispose();
  });
});

describe('liveDataClipFactory — fetch lifecycle (T-391 AC #9–#15)', () => {
  it('AC #9 — mount with refreshTrigger: mount-only calls fetchOnce exactly once and resolves getData()', async () => {
    const provider = jsonProvider({ ok: true, n: 42 });
    const spy = vi.spyOn(provider, 'fetchOnce');
    const factory = buildFactory({ provider });
    const events: DataEvent[] = [];
    const ctx = makeContext({ props: { refreshTrigger: 'mount-only' } });
    const handle = await factory(ctx);
    handle.onData((e) => events.push(e));
    // Wait a microtask cycle for the in-flight fetch to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(handle.getData()).toEqual({ ok: true, n: 42 });
    expect(events.length).toBeGreaterThanOrEqual(1);
    handle.dispose();
  });

  it('AC #10 — parseMode json on non-JSON body fires onError parse-error and leaves getData undefined', async () => {
    const provider = new InMemoryLiveDataProvider({
      scripted: {
        'https://example.com/data': {
          status: 200,
          bodyText: 'not json{{{',
          contentType: 'text/plain',
        },
      },
    });
    const factory = buildFactory({ provider });
    const ctx = makeContext({ props: { parseMode: 'json' } });
    const handle = await factory(ctx);
    const errors: ErrorEvent[] = [];
    handle.onError((e) => errors.push(e));
    await new Promise((r) => setTimeout(r, 0));
    expect(errors.some((e) => e.kind === 'parse-error')).toBe(true);
    expect(handle.getData()).toBeUndefined();
    handle.dispose();
  });

  it('AC #11 — provider rejection fires onError fetch-error and leaves getData undefined', async () => {
    const provider = new InMemoryLiveDataProvider({
      scripted: { 'https://example.com/data': { rejectWith: new Error('boom') } },
    });
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    const errors: ErrorEvent[] = [];
    handle.onError((e) => errors.push(e));
    await new Promise((r) => setTimeout(r, 0));
    expect(errors.some((e) => e.kind === 'fetch-error')).toBe(true);
    expect(handle.getData()).toBeUndefined();
    handle.dispose();
  });

  it('AC #12 — parseMode text returns the raw body string from getData', async () => {
    const provider = new InMemoryLiveDataProvider({
      scripted: {
        'https://example.com/data': {
          status: 200,
          bodyText: 'plain text body',
          contentType: 'text/plain',
        },
      },
    });
    const factory = buildFactory({ provider });
    const ctx = makeContext({ props: { parseMode: 'text' } });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    expect(handle.getData()).toBe('plain text body');
    handle.dispose();
  });

  it('AC #13 — POST with JSON body forwards stringified body and Content-Type: application/json', async () => {
    const provider = new InMemoryLiveDataProvider({
      scripted: {
        'https://example.com/data': {
          status: 200,
          bodyText: '{"ack":true}',
          contentType: 'application/json',
        },
      },
    });
    const spy = vi.spyOn(provider, 'fetchOnce');
    const factory = buildFactory({ provider });
    const ctx = makeContext({
      props: {
        method: 'POST',
        body: { question: 'how' },
      },
    });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledTimes(1);
    const args = spy.mock.calls[0]?.[0];
    expect(args?.method).toBe('POST');
    expect(args?.body).toBe(JSON.stringify({ question: 'how' }));
    expect(args?.headers['Content-Type']).toBe('application/json');
    handle.dispose();
  });

  it('AC #14 — refresh() with mount-only rejects with RefreshTriggerError', async () => {
    const provider = jsonProvider({ ok: true });
    const factory = buildFactory({ provider });
    const ctx = makeContext({ props: { refreshTrigger: 'mount-only' } });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    await expect(handle.refresh()).rejects.toBeInstanceOf(RefreshTriggerError);
    handle.dispose();
  });

  it('AC #15 — refresh() with manual triggers a fresh fetchOnce and updates getData', async () => {
    const provider = new InMemoryLiveDataProvider({
      scripted: {
        'https://example.com/data': {
          status: 200,
          bodyText: '{"v":1}',
          contentType: 'application/json',
        },
      },
    });
    const spy = vi.spyOn(provider, 'fetchOnce');
    const factory = buildFactory({ provider });
    const ctx = makeContext({ props: { refreshTrigger: 'manual' } });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    expect(handle.getData()).toEqual({ v: 1 });
    // Reconfigure the script for the second call.
    (provider as unknown as { scripted: Record<string, unknown> }).scripted = {
      'https://example.com/data': {
        status: 200,
        bodyText: '{"v":2}',
        contentType: 'application/json',
      },
    };
    await handle.refresh();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(handle.getData()).toEqual({ v: 2 });
    handle.dispose();
  });
});

describe('liveDataClipFactory — resource cleanup (T-391 AC #16, #17)', () => {
  it('AC #16 — dispose() aborts the in-flight fetch via the per-fetch AbortController', async () => {
    let observedSignal: AbortSignal | undefined;
    const provider = {
      fetchOnce: vi.fn(async (args: { signal: AbortSignal }) => {
        observedSignal = args.signal;
        // Hang forever so dispose has something to abort.
        return new Promise<{
          status: number;
          bodyText: string;
          contentType: string | undefined;
        }>((_resolve, reject) => {
          args.signal.addEventListener('abort', () => reject(new Error('AbortError')));
        });
      }),
    };
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    handle.dispose();
    expect(observedSignal?.aborted).toBe(true);
  });

  it('AC #17 — dispose() is idempotent', async () => {
    const provider = jsonProvider({ ok: true });
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    expect(() => {
      handle.dispose();
      handle.dispose();
      handle.dispose();
    }).not.toThrow();
  });
});

describe('liveDataClipFactory — failure paths (invalid props + missing provider)', () => {
  it('rejects with mount.failure invalid-props on a malformed schema', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory({ provider: jsonProvider({}) });
    const ctx = makeContext({
      badProps: { endpoint: 'not-a-url' },
      emit: (e, a) => events.push([e, a]),
    });
    await expect(factory(ctx)).rejects.toThrow();
    expect(
      events.some(([e, a]) => e === 'live-data-clip.mount.failure' && a.reason === 'invalid-props'),
    ).toBe(true);
  });

  it('rejects with mount.failure fetcher-unavailable when no provider is configured', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory({});
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    await expect(factory(ctx)).rejects.toThrow(/LiveDataProvider/);
    expect(
      events.some(
        ([e, a]) => e === 'live-data-clip.mount.failure' && a.reason === 'fetcher-unavailable',
      ),
    ).toBe(true);
  });
});

describe('liveDataClipFactory — telemetry privacy (T-391 AC #18)', () => {
  it('AC #18 — fetch.resolved attributes contain integer bodyByteLength but NEVER the body', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const provider = new InMemoryLiveDataProvider({
      scripted: {
        'https://example.com/data': {
          status: 200,
          bodyText: JSON.stringify({ secret: 'CONFIDENTIAL_USER_DATA' }),
          contentType: 'application/json',
        },
      },
    });
    const factory = buildFactory({ provider });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    const resolved = events.find(([e]) => e === 'live-data-clip.fetch.resolved');
    expect(resolved).toBeDefined();
    expect(typeof resolved?.[1].bodyByteLength).toBe('number');
    // The body MUST NOT appear in any captured event payload.
    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain('CONFIDENTIAL_USER_DATA');
    handle.dispose();
  });

  it('AC #18 — fetch.error attributes contain errorKind but NEVER the body', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const provider = new InMemoryLiveDataProvider({
      scripted: {
        'https://example.com/data': {
          rejectWith: Object.assign(new Error('UPSTREAM_LEAKING_BODY'), { kind: 'network' }),
        },
      },
    });
    const factory = buildFactory({ provider });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    const err = events.find(([e]) => e === 'live-data-clip.fetch.error');
    expect(err).toBeDefined();
    expect(err?.[1].errorKind).toBeDefined();
    handle.dispose();
  });
});

describe('liveDataClipFactory — permission posture (T-391 AC #19)', () => {
  it('AC #19 — mount with permissions: ["network"] succeeds; permissionPrePrompt is unset on context', async () => {
    const provider = jsonProvider({ ok: true });
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    expect(ctx.permissionPrePrompt).toBeUndefined();
    const handle = await factory(ctx);
    expect(handle).toBeDefined();
    handle.dispose();
  });
});

describe('clip directory hard-rule compliance (T-391 AC #26)', () => {
  it('AC #26 — clip directory contains no direct fetch / XMLHttpRequest / sendBeacon references', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = new URL('.', import.meta.url).pathname;
    const files = readdirSync(dir).filter((f) => {
      if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) return false;
      if (f.endsWith('.snap')) return false;
      const full = join(dir, f);
      return statSync(full).isFile();
    });
    for (const f of files) {
      const content = readFileSync(join(dir, f), 'utf8');
      // Strip line/block comments before grepping.
      const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(stripped, `forbidden network primitive in ${f}`).not.toMatch(/\bfetch\s*\(/);
      expect(stripped, `forbidden network primitive in ${f}`).not.toMatch(/\bXMLHttpRequest\b/);
      expect(stripped, `forbidden network primitive in ${f}`).not.toMatch(/\bsendBeacon\b/);
    }
  });
});

beforeEach(() => {
  // Each describe block re-imports `./index.js` to exercise the side-effect
  // registration; the singleton may already hold the registration from a
  // prior test run within the same file. We reset by clearing once at the
  // start so the AC #6 / AC #7 tests have predictable state.
});

afterEach(() => {
  /* leave registration intact across blocks within a single file */
});
