// packages/renderer-cdp/src/adapter.test.ts

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import type { ClipDefinition, ClipRuntime } from '@stageflip/runtimes-contract';
import { __clearRuntimeRegistry, registerRuntime } from '@stageflip/runtimes-contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type CdpSession,
  type CompositionConfig,
  DispatchUnresolvedError,
  LiveTierAdapter,
  type SessionHandle,
} from './adapter';
import type { DispatchPlan } from './dispatch';

// --- fakes ------------------------------------------------------------------

interface RecordedCall {
  readonly op: 'mount' | 'seek' | 'capture' | 'close';
  readonly frame?: number;
  readonly handleId?: number;
}

class FakeCdpSession implements CdpSession {
  public readonly calls: RecordedCall[] = [];
  private nextHandleId = 1;

  async mount(
    plan: DispatchPlan,
    config: CompositionConfig,
    document: RIRDocument,
  ): Promise<SessionHandle> {
    const id = this.nextHandleId++;
    this.calls.push({ op: 'mount', handleId: id });
    // Stash plan + config + document on the handle so assertions can read them back.
    return {
      _handle: Symbol.for(`fake-session-${id}`),
      id,
      plan,
      config,
      document,
    } as SessionHandle & {
      id: number;
      plan: DispatchPlan;
      config: CompositionConfig;
      document: RIRDocument;
    };
  }

  async seek(handle: SessionHandle, frame: number): Promise<void> {
    const { id } = handle as SessionHandle & { id: number };
    this.calls.push({ op: 'seek', frame, handleId: id });
  }

  async capture(handle: SessionHandle): Promise<Uint8Array> {
    const { id } = handle as SessionHandle & { id: number };
    this.calls.push({ op: 'capture', handleId: id });
    return new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  }

  async close(handle: SessionHandle): Promise<void> {
    const { id } = handle as SessionHandle & { id: number };
    this.calls.push({ op: 'close', handleId: id });
  }
}

function stubRuntime(id: string, kinds: readonly string[]): ClipRuntime {
  const clips = new Map<string, ClipDefinition<unknown>>();
  for (const kind of kinds) clips.set(kind, { kind, render: () => null });
  return { id, tier: 'live', clips };
}

function clipElement(id: string, runtime: string, clipName: string): RIRElement {
  return {
    id,
    type: 'clip',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: { type: 'clip', runtime, clipName, params: {} },
  };
}

function doc(elements: readonly RIRElement[], overrides: Partial<RIRDocument> = {}): RIRDocument {
  return {
    id: 'doc-1',
    width: 1920,
    height: 1080,
    frameRate: 30,
    durationFrames: 300,
    mode: 'slide',
    elements: [...elements],
    stackingMap: {},
    fontRequirements: [],
    meta: {
      sourceDocId: 'src-1',
      sourceVersion: 1,
      compilerVersion: '0.0.0-test',
      digest: 'sha-test',
    },
    ...overrides,
  };
}

// --- tests ------------------------------------------------------------------

beforeEach(() => {
  __clearRuntimeRegistry();
});

afterEach(() => {
  __clearRuntimeRegistry();
});

describe('LiveTierAdapter', () => {
  it('mount → renderFrame → close drives session calls in the right order', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();
    const adapter = new LiveTierAdapter(session);

    const mounted = await adapter.mount(doc([clipElement('a', 'css', 'solid-background')]));
    const buf = await adapter.renderFrame(mounted, 5);
    await adapter.close(mounted);

    expect(session.calls.map((c) => c.op)).toEqual(['mount', 'seek', 'capture', 'close']);
    expect(session.calls[1]?.frame).toBe(5);
    expect(buf).toBeInstanceOf(Uint8Array);
  });

  it('passes the composition config to the session', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();
    const adapter = new LiveTierAdapter(session);

    const mounted = await adapter.mount(
      doc([clipElement('a', 'css', 'solid-background')], {
        width: 1280,
        height: 720,
        frameRate: 24,
        durationFrames: 48,
      }),
    );

    expect(mounted.config.width).toBe(1280);
    expect(mounted.config.height).toBe(720);
    expect(mounted.config.fps).toBe(24);
    expect(mounted.config.durationFrames).toBe(48);
  });

  it('throws DispatchUnresolvedError when any clip is unresolved', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();
    const adapter = new LiveTierAdapter(session);

    await expect(
      adapter.mount(doc([clipElement('missing', 'gsap', 'no-such-clip')])),
    ).rejects.toBeInstanceOf(DispatchUnresolvedError);

    // Mount must not have been called on the session — we fail fast.
    expect(session.calls).toHaveLength(0);
  });

  it('renderFrame rejects negative, non-integer, and out-of-range frames', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();
    const adapter = new LiveTierAdapter(session);

    const mounted = await adapter.mount(
      doc([clipElement('a', 'css', 'solid-background')], { durationFrames: 30 }),
    );

    await expect(adapter.renderFrame(mounted, -1)).rejects.toBeInstanceOf(RangeError);
    await expect(adapter.renderFrame(mounted, 0.5)).rejects.toBeInstanceOf(RangeError);
    await expect(adapter.renderFrame(mounted, 30)).rejects.toBeInstanceOf(RangeError); // exclusive upper
    await expect(adapter.renderFrame(mounted, 31)).rejects.toBeInstanceOf(RangeError);
  });

  it('single code path drives all 6 live-tier runtimes', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    registerRuntime(stubRuntime('gsap', ['motion-text-gsap']));
    registerRuntime(stubRuntime('lottie', ['lottie-logo']));
    registerRuntime(stubRuntime('shader', ['flash-through-white']));
    registerRuntime(stubRuntime('three', ['three-product-reveal']));
    registerRuntime(stubRuntime('frame-runtime', ['bridge-clip']));

    const session = new FakeCdpSession();
    const adapter = new LiveTierAdapter(session);

    const mounted = await adapter.mount(
      doc([
        clipElement('a', 'css', 'solid-background'),
        clipElement('b', 'gsap', 'motion-text-gsap'),
        clipElement('c', 'lottie', 'lottie-logo'),
        clipElement('d', 'shader', 'flash-through-white'),
        clipElement('e', 'three', 'three-product-reveal'),
        clipElement('f', 'frame-runtime', 'bridge-clip'),
      ]),
    );

    expect(mounted.plan.resolved).toHaveLength(6);
    expect(mounted.plan.unresolved).toHaveLength(0);
    expect(mounted.plan.resolved.map((r) => r.runtime.id).sort()).toEqual([
      'css',
      'frame-runtime',
      'gsap',
      'lottie',
      'shader',
      'three',
    ]);

    // Each render call is one seek + one capture — no per-kind branching.
    await adapter.renderFrame(mounted, 0);
    await adapter.renderFrame(mounted, 15);
    await adapter.close(mounted);

    const ops = session.calls.map((c) => c.op);
    expect(ops).toEqual(['mount', 'seek', 'capture', 'seek', 'capture', 'close']);
  });

  it('multiple independent compositions can be mounted concurrently on the same adapter', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();
    const adapter = new LiveTierAdapter(session);

    const [a, b] = await Promise.all([
      adapter.mount(doc([clipElement('x', 'css', 'solid-background')])),
      adapter.mount(doc([clipElement('y', 'css', 'solid-background')])),
    ]);

    expect(a.handle).not.toBe(b.handle);
    await adapter.close(a);
    await adapter.close(b);
  });
});
