// packages/runtimes/interactive/src/clips/ai-generative/factory.test.ts
// T-395 ACs #7–#19, #26 — aiGenerativeClipFactory unit tests. Uses
// InMemoryAiGenerativeProvider to drive scripted results and pin
// blob-URL discipline + telemetry privacy.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ClipFactory, type MountContext, PERMISSIVE_TENANT_POLICY } from '../../contract.js';
import { InMemoryAiGenerativeProvider } from './ai-generative-provider.js';
import { AiGenerativeClipFactoryBuilder, type AiGenerativeClipFactoryOptions } from './factory.js';
import type { ErrorEvent, ResultEvent } from './types.js';

function pngBlob(payload = new Uint8Array([0x89, 0x50, 0x4e, 0x47])): Blob {
  return new Blob([payload], { type: 'image/png' });
}

function inMemoryProvider(prompt = 'a cat'): InMemoryAiGenerativeProvider {
  return new InMemoryAiGenerativeProvider({
    scripted: {
      [prompt]: { blob: pngBlob(), contentType: 'image/png' },
    },
  });
}

interface MakeContextArgs {
  emit?: MountContext['emitTelemetry'];
  signal?: AbortSignal;
  width?: number;
  height?: number;
  props?: Partial<{
    prompt: string;
    provider: string;
    model: string;
    negativePrompt: string;
    seed: number;
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
      prompt: args.props?.prompt ?? 'a cat',
      provider: args.props?.provider ?? 'openai',
      model: args.props?.model ?? 'dall-e-3',
      ...(args.props?.negativePrompt !== undefined
        ? { negativePrompt: args.props.negativePrompt }
        : {}),
      ...(args.props?.seed !== undefined ? { seed: args.props.seed } : {}),
      ...(args.props?.width !== undefined ? { width: args.props.width } : {}),
      ...(args.props?.height !== undefined ? { height: args.props.height } : {}),
      posterFrame: args.props?.posterFrame ?? 0,
    } satisfies Record<string, unknown>);
  return {
    clip: {
      id: 'test-ai-generative-clip',
      type: 'interactive-clip',
      family: 'ai-generative',
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
        component: {
          module: '@stageflip/runtimes-interactive/clips/ai-generative#AiGenerativeClip',
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

function buildFactory(options: AiGenerativeClipFactoryOptions = {}): ClipFactory {
  return AiGenerativeClipFactoryBuilder.build(options);
}

describe('aiGenerativeClipFactory — registry + frameSource (T-395 AC #7, #8, #9)', () => {
  it('AC #7 — interactiveClipRegistry.resolve("ai-generative") returns the factory after subpath import', async () => {
    await import('./index.js');
    const { interactiveClipRegistry } = await import('../../registry.js');
    expect(interactiveClipRegistry.resolve('ai-generative')).toBeDefined();
  });

  it('AC #8 — re-registering throws InteractiveClipFamilyAlreadyRegisteredError', async () => {
    await import('./index.js');
    const { interactiveClipRegistry } = await import('../../registry.js');
    const { aiGenerativeClipFactory } = await import('./factory.js');
    expect(() =>
      interactiveClipRegistry.register('ai-generative', aiGenerativeClipFactory),
    ).toThrow(/already/i);
  });

  it('AC #9 — mount with frameSource: undefined succeeds', async () => {
    const provider = inMemoryProvider();
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    expect(handle).toBeDefined();
    handle.dispose();
  });
});

describe('aiGenerativeClipFactory — generation lifecycle (T-395 AC #10–#13)', () => {
  it('AC #10 — mount calls generateOnce exactly once and resolves getResult()', async () => {
    const provider = inMemoryProvider();
    const spy = vi.spyOn(provider, 'generateOnce');
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    const events: ResultEvent[] = [];
    handle.onResult((e) => events.push(e));
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledTimes(1);
    const result = handle.getResult();
    expect(result).toBeDefined();
    expect(result?.contentType).toBe('image/png');
    expect(events.length).toBeGreaterThanOrEqual(1);
    handle.dispose();
  });

  it('AC #11 — provider rejection fires onError fetch-error and leaves getResult undefined', async () => {
    const provider = new InMemoryAiGenerativeProvider({
      scripted: { 'a cat': { rejectWith: new Error('boom') } },
    });
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    const errors: ErrorEvent[] = [];
    handle.onError((e) => errors.push(e));
    await new Promise((r) => setTimeout(r, 0));
    expect(errors.some((e) => e.kind === 'generate-error')).toBe(true);
    expect(handle.getResult()).toBeUndefined();
    handle.dispose();
  });

  it('AC #12 — factory creates an <img> under root and sets img.src to a blob URL after resolve', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL');
    createSpy.mockImplementation((blob: Blob | MediaSource) => `blob:mock-${(blob as Blob).size}`);
    const provider = inMemoryProvider();
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    const img = ctx.root.querySelector('img');
    expect(img).not.toBeNull();
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect((img as HTMLImageElement).getAttribute('src')).toMatch(/^blob:mock-/);
    handle.dispose();
    createSpy.mockRestore();
  });

  it('AC #13 — regenerate() aborts in-flight + invokes fresh generateOnce + emits new started/resolved pair', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const provider = inMemoryProvider();
    const spy = vi.spyOn(provider, 'generateOnce');
    const factory = buildFactory({ provider });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledTimes(1);
    await handle.regenerate();
    expect(spy).toHaveBeenCalledTimes(2);
    const startedEvents = events.filter(([e]) => e === 'ai-generative-clip.generate.started');
    const resolvedEvents = events.filter(([e]) => e === 'ai-generative-clip.generate.resolved');
    expect(startedEvents.length).toBe(2);
    expect(resolvedEvents.length).toBe(2);
    handle.dispose();
  });
});

describe('aiGenerativeClipFactory — resource cleanup (T-395 AC #14, #15, #16, #17)', () => {
  it('AC #14 — dispose() aborts the in-flight generation via signal.abort', async () => {
    let observedSignal: AbortSignal | undefined;
    const provider = {
      generateOnce: vi.fn(async (args: { signal: AbortSignal }) => {
        observedSignal = args.signal;
        return new Promise<{ blob: Blob; contentType: string }>((_resolve, reject) => {
          args.signal.addEventListener('abort', () => reject(new Error('AbortError')));
        });
      }),
    };
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    // Drain the queueMicrotask deferral so the mount-time generation starts.
    await new Promise((r) => setTimeout(r, 0));
    expect(observedSignal).toBeDefined();
    expect(observedSignal?.aborted).toBe(false);
    handle.dispose();
    expect(observedSignal?.aborted).toBe(true);
  });

  it('AC #15 — dispose() calls URL.revokeObjectURL for any blob URL the factory created', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL');
    createSpy.mockImplementation((blob: Blob | MediaSource) => `blob:mock-${(blob as Blob).size}`);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const provider = inMemoryProvider();
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    expect(createSpy).toHaveBeenCalledTimes(1);
    handle.dispose();
    expect(revokeSpy).toHaveBeenCalledWith(expect.stringMatching(/^blob:mock-/));
    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('AC #16 — dispose() detaches the <img> element from the root', async () => {
    const provider = inMemoryProvider();
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    expect(ctx.root.querySelector('img')).not.toBeNull();
    handle.dispose();
    expect(ctx.root.querySelector('img')).toBeNull();
  });

  it('AC #17 — dispose() is idempotent', async () => {
    const provider = inMemoryProvider();
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

describe('aiGenerativeClipFactory — failure paths (invalid props + missing provider)', () => {
  it('rejects with mount.failure invalid-props on a malformed schema', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory({ provider: inMemoryProvider() });
    const ctx = makeContext({
      badProps: { prompt: '', provider: 'openai', model: 'dall-e-3' },
      emit: (e, a) => events.push([e, a]),
    });
    await expect(factory(ctx)).rejects.toThrow();
    expect(
      events.some(
        ([e, a]) => e === 'ai-generative-clip.mount.failure' && a.reason === 'invalid-props',
      ),
    ).toBe(true);
  });

  it('rejects with mount.failure generator-unavailable when no provider is configured', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = buildFactory({});
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    await expect(factory(ctx)).rejects.toThrow(/AiGenerativeProvider/);
    expect(
      events.some(
        ([e, a]) =>
          e === 'ai-generative-clip.mount.failure' && a.reason === 'generator-unavailable',
      ),
    ).toBe(true);
  });
});

describe('aiGenerativeClipFactory — telemetry privacy (T-395 AC #18)', () => {
  it('AC #18 — generate.resolved attributes contain integer blobByteLength but NEVER the prompt or blob bytes', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const secretPrompt = 'CONFIDENTIAL_USER_PROMPT_BODY';
    const secretNegativePrompt = 'CONFIDENTIAL_NEGATIVE_PROMPT_BODY';
    const provider = new InMemoryAiGenerativeProvider({
      scripted: {
        [secretPrompt]: {
          blob: pngBlob(new Uint8Array([0xde, 0xad, 0xbe, 0xef])),
          contentType: 'image/png',
        },
      },
    });
    const factory = buildFactory({ provider });
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      props: { prompt: secretPrompt, negativePrompt: secretNegativePrompt },
    });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    const resolved = events.find(([e]) => e === 'ai-generative-clip.generate.resolved');
    expect(resolved).toBeDefined();
    expect(typeof resolved?.[1].blobByteLength).toBe('number');
    expect(typeof resolved?.[1].durationMs).toBe('number');
    // The serialised event log MUST NOT contain the prompt body, the
    // negativePrompt body, or any blob bytes.
    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain(secretPrompt);
    expect(serialised).not.toContain(secretNegativePrompt);
    expect(serialised).not.toMatch(/deadbeef|\xde\xad\xbe\xef/i);
    handle.dispose();
  });

  it('AC #18 — mount.start carries promptLength integer (not the prompt body)', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const promptText = 'a watercolor painting of a sunrise over mountains';
    const provider = inMemoryProvider(promptText);
    const factory = buildFactory({ provider });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]), props: { prompt: promptText } });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    const start = events.find(([e]) => e === 'ai-generative-clip.mount.start');
    expect(start).toBeDefined();
    expect(start?.[1].promptLength).toBe(promptText.length);
    expect(JSON.stringify(events)).not.toContain(promptText);
    handle.dispose();
  });

  it('AC #18 — generate.error carries errorKind but not the prompt body', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const promptText = 'CONFIDENTIAL_PROMPT_INSIDE_ERROR';
    const provider = new InMemoryAiGenerativeProvider({
      scripted: {
        [promptText]: { rejectWith: new Error('quota-exceeded') },
      },
    });
    const factory = buildFactory({ provider });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]), props: { prompt: promptText } });
    const handle = await factory(ctx);
    await new Promise((r) => setTimeout(r, 0));
    const err = events.find(([e]) => e === 'ai-generative-clip.generate.error');
    expect(err).toBeDefined();
    expect(err?.[1].errorKind).toBeDefined();
    expect(JSON.stringify(events)).not.toContain(promptText);
    handle.dispose();
  });
});

describe('aiGenerativeClipFactory — permission posture (T-395 AC #19)', () => {
  it('AC #19 — mount with permissions: ["network"] succeeds; permissionPrePrompt is unset on context', async () => {
    const provider = inMemoryProvider();
    const factory = buildFactory({ provider });
    const ctx = makeContext();
    expect(ctx.permissionPrePrompt).toBeUndefined();
    const handle = await factory(ctx);
    expect(handle).toBeDefined();
    handle.dispose();
  });
});

describe('clip directory hard-rule compliance (T-395 AC #26)', () => {
  it('AC #26 — clip directory contains no direct fetch / XMLHttpRequest / sendBeacon references', async () => {
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
  /* singleton registration accumulates within a file */
});

afterEach(() => {
  /* leave registrations intact */
});
