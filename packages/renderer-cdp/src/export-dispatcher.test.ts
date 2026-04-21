// packages/renderer-cdp/src/export-dispatcher.test.ts

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import type { ClipDefinition, ClipRuntime } from '@stageflip/runtimes-contract';
import { __clearRuntimeRegistry, registerRuntime } from '@stageflip/runtimes-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CdpSession, CompositionConfig, SessionHandle } from './adapter';
import type { DispatchPlan } from './dispatch';
import { PreflightBlockedError, exportDocument } from './export-dispatcher';
import { InMemoryFrameSink } from './frame-sink';

// --- fakes ------------------------------------------------------------------

interface FakeCdpOpts {
  captureBytes?: (frame: number) => Uint8Array;
  failCaptureAt?: number;
}

class FakeCdpSession implements CdpSession {
  public readonly calls: Array<{ op: string; frame?: number }> = [];

  constructor(private readonly opts: FakeCdpOpts = {}) {}

  async mount(_plan: DispatchPlan, _config: CompositionConfig): Promise<SessionHandle> {
    this.calls.push({ op: 'mount' });
    return { _handle: Symbol('fake') };
  }

  async seek(_handle: SessionHandle, frame: number): Promise<void> {
    this.calls.push({ op: 'seek', frame });
  }

  async capture(_handle: SessionHandle): Promise<Uint8Array> {
    const lastSeek = [...this.calls].reverse().find((c) => c.op === 'seek');
    const frame = lastSeek?.frame ?? 0;
    this.calls.push({ op: 'capture', frame });
    if (this.opts.failCaptureAt === frame) {
      throw new Error(`fake capture failure at frame ${frame}`);
    }
    return this.opts.captureBytes ? this.opts.captureBytes(frame) : new Uint8Array([frame & 0xff]);
  }

  async close(_handle: SessionHandle): Promise<void> {
    this.calls.push({ op: 'close' });
  }
}

function stubRuntime(
  id: string,
  kinds: readonly string[],
  tier: 'live' | 'bake' = 'live',
): ClipRuntime {
  const clips = new Map<string, ClipDefinition<unknown>>();
  for (const kind of kinds) clips.set(kind, { kind, render: () => null });
  return { id, tier, clips };
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

function doc(elements: readonly RIRElement[], durationFrames = 5): RIRDocument {
  return {
    id: 'doc-1',
    width: 320,
    height: 240,
    frameRate: 30,
    durationFrames,
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
  };
}

beforeEach(() => {
  __clearRuntimeRegistry();
});

afterEach(() => {
  __clearRuntimeRegistry();
});

// --- tests ------------------------------------------------------------------

describe('exportDocument — happy path', () => {
  it('renders every frame in [0, durationFrames) and emits through the sink', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();
    const sink = new InMemoryFrameSink();

    const result = await exportDocument(doc([clipElement('a', 'css', 'solid-background')], 3), {
      session,
      sink,
    });

    expect(result.framesRendered).toBe(3);
    expect(result.startFrame).toBe(0);
    expect(result.endFrame).toBe(3);
    expect(sink.frames.map((f) => f.frame)).toEqual([0, 1, 2]);
    expect(sink.isClosed).toBe(true);
    expect(session.calls.filter((c) => c.op === 'mount')).toHaveLength(1);
    expect(session.calls.filter((c) => c.op === 'close')).toHaveLength(1);
  });

  it('exercises all 6 live-tier runtimes through a single dispatch', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    registerRuntime(stubRuntime('gsap', ['motion-text-gsap']));
    registerRuntime(stubRuntime('lottie', ['lottie-logo']));
    registerRuntime(stubRuntime('shader', ['flash-through-white']));
    registerRuntime(stubRuntime('three', ['three-product-reveal']));
    registerRuntime(stubRuntime('frame-runtime', ['bridge-clip']));

    const session = new FakeCdpSession();
    const sink = new InMemoryFrameSink();

    const result = await exportDocument(
      doc(
        [
          clipElement('a', 'css', 'solid-background'),
          clipElement('b', 'gsap', 'motion-text-gsap'),
          clipElement('c', 'lottie', 'lottie-logo'),
          clipElement('d', 'shader', 'flash-through-white'),
          clipElement('e', 'three', 'three-product-reveal'),
          clipElement('f', 'frame-runtime', 'bridge-clip'),
        ],
        2,
      ),
      { session, sink },
    );

    expect(result.framesRendered).toBe(2);
    expect(result.preflight.liveTasks).toHaveLength(6);
    expect(result.preflight.bakeTasks).toHaveLength(0);
    expect(result.preflight.blockers).toHaveLength(0);
  });

  it('honours an explicit half-open frame range', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();
    const sink = new InMemoryFrameSink();

    const result = await exportDocument(doc([clipElement('a', 'css', 'solid-background')], 10), {
      session,
      sink,
      frameRange: { start: 4, end: 7 },
    });

    expect(result.framesRendered).toBe(3);
    expect(result.startFrame).toBe(4);
    expect(result.endFrame).toBe(7);
    expect(sink.frames.map((f) => f.frame)).toEqual([4, 5, 6]);
  });
});

describe('exportDocument — failure modes', () => {
  it('rejects with PreflightBlockedError when clips are unresolved, and does NOT open the session', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();
    const sink = new InMemoryFrameSink();

    await expect(
      exportDocument(doc([clipElement('bad', 'gsap', 'no-such-clip')]), {
        session,
        sink,
      }),
    ).rejects.toBeInstanceOf(PreflightBlockedError);

    expect(session.calls).toHaveLength(0);
    // Sink should still be closed — the caller passed it in and we own its lifecycle.
    expect(sink.isClosed).toBe(true);
  });

  it('rejects with PreflightBlockedError when bake-tier clips are present', async () => {
    registerRuntime(stubRuntime('bake-rt', ['heavy'], 'bake'));
    const session = new FakeCdpSession();
    const sink = new InMemoryFrameSink();

    await expect(
      exportDocument(doc([clipElement('b', 'bake-rt', 'heavy')]), { session, sink }),
    ).rejects.toBeInstanceOf(PreflightBlockedError);
  });

  it('closes adapter and sink even if a capture mid-loop throws', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession({ failCaptureAt: 2 });
    const sink = new InMemoryFrameSink();

    await expect(
      exportDocument(doc([clipElement('a', 'css', 'solid-background')], 5), {
        session,
        sink,
      }),
    ).rejects.toThrow(/fake capture failure/);

    expect(session.calls.filter((c) => c.op === 'close')).toHaveLength(1);
    expect(sink.isClosed).toBe(true);
    // Frames 0 and 1 did make it through before the failure.
    expect(sink.frames.map((f) => f.frame)).toEqual([0, 1]);
  });

  it('rejects an invalid frame range (negative, inverted, out-of-bounds)', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();

    const build = (range: { start: number; end: number }) => {
      const sink = new InMemoryFrameSink();
      const p = exportDocument(doc([clipElement('a', 'css', 'solid-background')], 10), {
        session,
        sink,
        frameRange: range,
      });
      return { p, sink };
    };

    for (const range of [
      { start: -1, end: 5 },
      { start: 0, end: 0 },
      { start: 5, end: 4 },
      { start: 0, end: 11 },
    ]) {
      const { p, sink } = build(range);
      await expect(p).rejects.toThrow(/frameRange/);
      // Ownership contract: dispatcher closes the sink even when the range
      // validator throws synchronously before the session opens.
      expect(sink.isClosed).toBe(true);
    }

    // And the session itself was never opened for any of these.
    expect(session.calls).toHaveLength(0);
  });

  it('frames are delivered to the sink in strictly ascending order', async () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const session = new FakeCdpSession();
    const sink = new InMemoryFrameSink();
    const onFrameSpy = vi.spyOn(sink, 'onFrame');

    await exportDocument(doc([clipElement('a', 'css', 'solid-background')], 4), {
      session,
      sink,
    });

    const sinkFrames = onFrameSpy.mock.calls.map((c) => c[0]);
    expect(sinkFrames).toEqual([0, 1, 2, 3]);
  });
});

describe('exportDocument — asset preflight integration (T-084a)', () => {
  function imageEl(id: string, srcUrl: string): RIRElement {
    return {
      id,
      type: 'image',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: { type: 'image', srcUrl, fit: 'cover' },
    };
  }

  it('rewrites URLs via the resolver before mounting the session', async () => {
    const session = new FakeCdpSession();
    const sink = new InMemoryFrameSink();
    const { InMemoryAssetResolver } = await import('./asset-resolver');
    const resolver = new InMemoryAssetResolver({
      'https://cdn/a.png': 'file:///cache/a.png',
    });

    const result = await exportDocument(doc([imageEl('i', 'https://cdn/a.png')], 1), {
      session,
      sink,
      assetResolver: resolver,
    });

    expect(result.lossFlags).toHaveLength(0);
    const firstEl = result.document.elements[0];
    expect(firstEl?.content.type === 'image' && firstEl.content.srcUrl).toBe('file:///cache/a.png');
    // Resolver was consulted exactly once — and before session.mount.
    expect(resolver.calls).toHaveLength(1);
  });

  it('surfaces loss-flagged refs and leaves their URLs remote', async () => {
    const session = new FakeCdpSession();
    const sink = new InMemoryFrameSink();
    const { InMemoryAssetResolver } = await import('./asset-resolver');
    const resolver = new InMemoryAssetResolver({}); // every URL misses → loss-flag

    const result = await exportDocument(doc([imageEl('i', 'https://cdn/missing.png')], 1), {
      session,
      sink,
      assetResolver: resolver,
    });

    expect(result.lossFlags).toHaveLength(1);
    expect(result.lossFlags[0]?.ref.url).toBe('https://cdn/missing.png');
    const firstEl = result.document.elements[0];
    expect(firstEl?.content.type === 'image' && firstEl.content.srcUrl).toBe(
      'https://cdn/missing.png',
    );
  });

  it('skips asset preflight entirely when no resolver is supplied', async () => {
    const session = new FakeCdpSession();
    const sink = new InMemoryFrameSink();

    const result = await exportDocument(doc([imageEl('i', 'https://cdn/a.png')], 1), {
      session,
      sink,
    });

    expect(result.lossFlags).toHaveLength(0);
    const firstEl = result.document.elements[0];
    expect(firstEl?.content.type === 'image' && firstEl.content.srcUrl).toBe(
      'https://cdn/a.png', // untouched
    );
  });
});
