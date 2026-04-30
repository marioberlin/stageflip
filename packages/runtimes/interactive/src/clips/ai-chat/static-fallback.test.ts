// packages/runtimes/interactive/src/clips/ai-chat/static-fallback.test.ts
// T-390 ACs #5–#13 — `defaultAiChatStaticFallback` + `aiChatStaticFallbackGenerator`:
//   - byte-for-byte determinism across calls (AC #5)
//   - different systemPrompt → different markup (AC #6)
//   - empty/absent capturedTranscript → systemPrompt + single placeholder (AC #7)
//   - registry side-effect: family is registered after subpath import (AC #8)
//   - bounding-box: every transform fits within (width, height) (AC #11)
//   - vertical layout: turn N's transform.y > turn N-1's (AC #12)
//   - telemetry shape + privacy posture (AC #13).

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InteractiveClip } from '@stageflip/schema';

import { staticFallbackGeneratorRegistry } from '../../static-fallback-registry.js';
import { aiChatStaticFallbackGenerator, defaultAiChatStaticFallback } from './static-fallback.js';

function makeAiChatClip(args: {
  width?: number;
  height?: number;
  systemPrompt?: string;
  capturedTranscript?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): InteractiveClip {
  const width = args.width ?? 640;
  const height = args.height ?? 360;
  const systemPrompt = args.systemPrompt ?? 'You are a helpful assistant.';
  const transform = { x: 0, y: 0, width, height, rotation: 0, opacity: 1 };
  return {
    id: 'test-ai-chat-clip',
    type: 'interactive-clip',
    family: 'ai-chat',
    transform,
    visible: true,
    locked: false,
    animations: [],
    staticFallback: [],
    liveMount: {
      component: { module: '@stageflip/test#AiChat' },
      props: {
        systemPrompt,
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        ...(args.capturedTranscript !== undefined
          ? { capturedTranscript: args.capturedTranscript }
          : {}),
      },
      permissions: ['network'],
    },
  } as unknown as InteractiveClip;
}

describe('defaultAiChatStaticFallback (T-390)', () => {
  it('AC #5 — same args → byte-for-byte identical Element[] across two calls', () => {
    const a = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'p',
      capturedTranscript: [{ role: 'user', text: 'hi' }],
    });
    const b = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'p',
      capturedTranscript: [{ role: 'user', text: 'hi' }],
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('AC #5 — same args (multi-turn) → byte-for-byte identical', () => {
    const turns: Array<{ role: 'user' | 'assistant'; text: string }> = [
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'hello' },
      { role: 'user', text: 'thanks' },
    ];
    const a = defaultAiChatStaticFallback({
      width: 800,
      height: 450,
      systemPrompt: 'You are helpful.',
      capturedTranscript: turns,
    });
    const b = defaultAiChatStaticFallback({
      width: 800,
      height: 450,
      systemPrompt: 'You are helpful.',
      capturedTranscript: turns,
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('AC #6 — different systemPrompt → different markup (text differs)', () => {
    const a = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'You are A.',
      capturedTranscript: [{ role: 'user', text: 'hi' }],
    });
    const b = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'You are B.',
      capturedTranscript: [{ role: 'user', text: 'hi' }],
    });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('AC #7 — empty capturedTranscript → systemPrompt + single placeholder element', () => {
    const elements = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'p',
      capturedTranscript: [],
    });
    // 1 system-prompt element + 1 placeholder = 2 elements.
    expect(elements).toHaveLength(2);
    const placeholder = elements.find(
      (e) => e.type === 'text' && (e as { id: string }).id.includes('placeholder'),
    );
    expect(placeholder).toBeDefined();
  });

  it('AC #7 — absent capturedTranscript → systemPrompt + single placeholder element', () => {
    const elements = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'p',
    });
    expect(elements).toHaveLength(2);
  });

  it('AC #11 — every TextElement transform fits within (width, height)', () => {
    const elements = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'You are a helpful assistant who explains everything carefully.',
      capturedTranscript: [
        { role: 'user', text: 'first turn' },
        { role: 'assistant', text: 'response one' },
        { role: 'user', text: 'second turn' },
        { role: 'assistant', text: 'response two' },
      ],
    });
    for (const el of elements) {
      expect(el.transform.x).toBeGreaterThanOrEqual(0);
      expect(el.transform.y).toBeGreaterThanOrEqual(0);
      expect(el.transform.x + el.transform.width).toBeLessThanOrEqual(640);
      expect(el.transform.y + el.transform.height).toBeLessThanOrEqual(360);
    }
  });

  it('AC #12 — turn N transform.y is greater than turn N-1 transform.y (vertical stacking)', () => {
    const elements = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'p',
      capturedTranscript: [
        { role: 'user', text: 'one' },
        { role: 'assistant', text: 'two' },
        { role: 'user', text: 'three' },
      ],
    });
    // Filter for turn elements (skip the systemPrompt element).
    const turnElements = elements.filter(
      (e) =>
        e.type === 'text' &&
        ((e as { id: string }).id.includes('-turn-') ||
          (e as Record<string, unknown>)['data-role'] === 'user' ||
          (e as Record<string, unknown>)['data-role'] === 'assistant'),
    );
    expect(turnElements.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < turnElements.length; i += 1) {
      const prev = turnElements[i - 1]!;
      const curr = turnElements[i]!;
      expect(curr.transform.y).toBeGreaterThan(prev.transform.y);
    }
  });

  it('systemPrompt longer than the truncation cap is truncated in the rendered text', () => {
    const long = 'A'.repeat(500);
    const elements = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: long,
    });
    const sp = elements.find(
      (e) => e.type === 'text' && (e as { id: string }).id.includes('system-prompt'),
    ) as { type: 'text'; text: string } | undefined;
    expect(sp).toBeDefined();
    if (sp === undefined) throw new Error('expected systemPrompt element');
    // Truncated form is shorter than the input.
    expect(sp.text.length).toBeLessThan(long.length);
  });

  it('placeholder TextElement has data-role="placeholder" via id naming', () => {
    const elements = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'p',
    });
    const placeholder = elements.find(
      (e) => e.type === 'text' && (e as { id: string }).id.includes('placeholder'),
    );
    expect(placeholder).toBeDefined();
  });

  it('per-turn TextElement carries text matching its turn body', () => {
    const elements = defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'p',
      capturedTranscript: [
        { role: 'user', text: 'alpha' },
        { role: 'assistant', text: 'beta' },
      ],
    });
    const texts = elements
      .filter((e) => e.type === 'text')
      .map((e) => (e as { text: string }).text);
    expect(texts).toContain('alpha');
    expect(texts).toContain('beta');
  });
});

describe('aiChatStaticFallbackGenerator (T-390 ACs #8, #10, #13)', () => {
  it('AC #13 — emits ai-chat-clip.static-fallback.rendered with integer length attributes only', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    aiChatStaticFallbackGenerator({
      clip: makeAiChatClip({
        width: 800,
        height: 450,
        systemPrompt: 'You are scoped.',
        capturedTranscript: [
          { role: 'user', text: 'a' },
          { role: 'assistant', text: 'b' },
        ],
      }),
      reason: 'permission-denied',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    expect(events).toHaveLength(1);
    const [name, attrs] = events[0]!;
    expect(name).toBe('ai-chat-clip.static-fallback.rendered');
    expect(attrs).toMatchObject({
      family: 'ai-chat',
      reason: 'permission-denied',
      width: 800,
      height: 450,
      transcriptTurnCount: 2,
      systemPromptLength: 'You are scoped.'.length,
    });
  });

  it('AC #13 privacy — telemetry attributes never carry the systemPrompt body or turn bodies', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const systemPrompt = 'SECRET-SYSTEM-PROMPT';
    const turnText = 'SECRET-TURN-BODY';
    aiChatStaticFallbackGenerator({
      clip: makeAiChatClip({
        systemPrompt,
        capturedTranscript: [{ role: 'user', text: turnText }],
      }),
      reason: 'permission-denied',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain(systemPrompt);
    expect(serialised).not.toContain(turnText);
  });

  it('AC #13 — absent capturedTranscript → transcriptTurnCount: 0', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    aiChatStaticFallbackGenerator({
      clip: makeAiChatClip({ systemPrompt: 'x' }),
      reason: 'authored',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    const [, attrs] = events[0]!;
    expect(attrs.transcriptTurnCount).toBe(0);
  });

  it('AC #13 — reason is forwarded verbatim into the telemetry attributes', () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    aiChatStaticFallbackGenerator({
      clip: makeAiChatClip({ systemPrompt: 'x' }),
      reason: 'tenant-denied',
      emitTelemetry: (e, attrs) => events.push([e, attrs]),
    });
    expect(events[0]?.[1].reason).toBe('tenant-denied');
  });

  it('returns the same Element[] that defaultAiChatStaticFallback produces (parity)', () => {
    const clip = makeAiChatClip({
      width: 320,
      height: 240,
      systemPrompt: 'p',
      capturedTranscript: [{ role: 'user', text: 'hi' }],
    });
    const generated = aiChatStaticFallbackGenerator({
      clip,
      reason: 'authored',
      emitTelemetry: () => undefined,
    });
    const direct = defaultAiChatStaticFallback({
      width: 320,
      height: 240,
      systemPrompt: 'p',
      capturedTranscript: [{ role: 'user', text: 'hi' }],
    });
    expect(JSON.stringify(generated)).toBe(JSON.stringify(direct));
  });
});

describe('aiChatStaticFallbackGenerator registry side effect (T-390 AC #8)', () => {
  // Importing the package's `clips/ai-chat` module side-effect-registers
  // both the factory AND the generator against the singletons. This
  // module imports from the same singleton so resolve must return the
  // generator after the import below.
  afterEach(() => {
    /* leave the registration intact for downstream tests; the singleton
       is shared with the production import path. */
  });

  it('AC #8 — staticFallbackGeneratorRegistry.resolve("ai-chat") returns the generator after subpath import', async () => {
    // Side-effect import. Importing twice would throw the dup-error; rely
    // on the package's own production index.ts running before us when
    // tests in this file are first evaluated. The import below is a
    // dynamic guard for explicit ordering — it's a no-op if already loaded.
    await import('./index.js');
    const resolved = staticFallbackGeneratorRegistry.resolve('ai-chat');
    expect(resolved).toBeDefined();
    expect(typeof resolved).toBe('function');
  });
});

describe('aiChatStaticFallbackGenerator harness integration (T-390 ACs #9, #10)', () => {
  // End-to-end via mount-harness: empty staticFallback for ai-chat routes
  // to the generator (AC #9); authored staticFallback wins but generator
  // STILL fires for telemetry (AC #10, T-388a D-T388a-3).
  it('AC #10 — authored staticFallback wins; generator is still invoked with reason: "authored" for telemetry', async () => {
    const { InteractiveMountHarness } = await import('../../mount-harness.js');
    const { InteractiveClipRegistry } = await import('../../registry.js');
    const { StaticFallbackGeneratorRegistry } = await import('../../static-fallback-registry.js');
    const { PermissionShim } = await import('../../permission-shim.js');
    const { makeStubFactory } = await import('../../contract-tests/fixtures.js');

    const registry = new InteractiveClipRegistry();
    registry.register('ai-chat', makeStubFactory());
    const generatorRegistry = new StaticFallbackGeneratorRegistry();
    generatorRegistry.register('ai-chat', aiChatStaticFallbackGenerator);
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
    const clip = makeAiChatClip({
      systemPrompt: 'p',
      capturedTranscript: [{ role: 'user', text: 'hi' }],
    });
    // Inject an authored staticFallback so the AC #10 path runs.
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
    const rendered = events.find((e) => e[0] === 'ai-chat-clip.static-fallback.rendered');
    expect(rendered).toBeDefined();
    expect(rendered?.[1].reason).toBe('authored');
  });

  it('AC #9 — empty staticFallback for ai-chat clip routes to the generator (rendered Element[])', async () => {
    const { InteractiveMountHarness } = await import('../../mount-harness.js');
    const { InteractiveClipRegistry } = await import('../../registry.js');
    const { StaticFallbackGeneratorRegistry } = await import('../../static-fallback-registry.js');
    const { PermissionShim } = await import('../../permission-shim.js');
    const { makeStubFactory } = await import('../../contract-tests/fixtures.js');

    const registry = new InteractiveClipRegistry();
    registry.register('ai-chat', makeStubFactory());
    const generatorRegistry = new StaticFallbackGeneratorRegistry();
    generatorRegistry.register('ai-chat', aiChatStaticFallbackGenerator);
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
    const clip = makeAiChatClip({
      systemPrompt: 'p',
      capturedTranscript: [{ role: 'user', text: 'hi' }],
    });
    (clip as unknown as { staticFallback: unknown[] }).staticFallback = [];
    await harness.mount(clip, root, new AbortController().signal);
    const rendered = events.find((e) => e[0] === 'ai-chat-clip.static-fallback.rendered');
    expect(rendered).toBeDefined();
    expect(rendered?.[1].reason).toBe('tenant-denied');
  });
});

describe('determinism — no random / no time / no rAF', () => {
  it('does not consult Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'p',
      capturedTranscript: [
        { role: 'user', text: 'a' },
        { role: 'assistant', text: 'b' },
      ],
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not consult Date.now', () => {
    const spy = vi.spyOn(Date, 'now');
    defaultAiChatStaticFallback({
      width: 640,
      height: 360,
      systemPrompt: 'p',
      capturedTranscript: [{ role: 'user', text: 'a' }],
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
