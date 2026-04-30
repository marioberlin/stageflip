// packages/runtimes/interactive/src/clips/voice/media-graph.test.ts
// T-387 — MediaGraph resource management. AC #18-#22 cleanup invariants
// drive most of the suite; happy-dom does not provide MediaRecorder /
// AudioContext, so the tests inject a complete fake browser surface.

import { describe, expect, it, vi } from 'vitest';

import { MediaGraph, type MediaGraphBrowserApi } from './media-graph.js';

// ---------- fakes ----------

interface FakeRecorder {
  state: 'inactive' | 'recording' | 'paused';
  startCalled: number;
  stopCalled: number;
  start(): void;
  stop(): void;
}

interface FakeAnalyser {
  fftSize: number;
  disconnectCalled: number;
  disconnect(): void;
}

interface FakeSource {
  connectCalled: number;
  disconnectCalled: number;
  connect(_node: unknown): void;
  disconnect(): void;
}

interface FakeAudioContext {
  closeCalled: number;
  createMediaStreamSource(_stream: MediaStream): FakeSource;
  createAnalyser(): FakeAnalyser;
  close(): Promise<void>;
}

interface FakeTrack {
  stopCalled: number;
  stop(): void;
}

function makeFakeStream(trackCount = 1): { stream: MediaStream; tracks: FakeTrack[] } {
  const tracks: FakeTrack[] = [];
  for (let i = 0; i < trackCount; i += 1) {
    tracks.push({
      stopCalled: 0,
      stop() {
        this.stopCalled += 1;
      },
    });
  }
  const stream = {
    getTracks() {
      return tracks as unknown as MediaStreamTrack[];
    },
  } as unknown as MediaStream;
  return { stream, tracks };
}

interface FakeBrowserBundle extends MediaGraphBrowserApi {
  lastRecorder: FakeRecorder | undefined;
  lastAudioContext: FakeAudioContext | undefined;
  lastAnalyser: FakeAnalyser | undefined;
  lastSource: FakeSource | undefined;
  recorderConstructed: number;
}

function makeFakeBrowser(supportedMimes: string[] = ['audio/webm']): FakeBrowserBundle {
  const bundle = {
    lastRecorder: undefined as FakeRecorder | undefined,
    lastAudioContext: undefined as FakeAudioContext | undefined,
    lastAnalyser: undefined as FakeAnalyser | undefined,
    lastSource: undefined as FakeSource | undefined,
    recorderConstructed: 0,
    isMimeTypeSupported: (mime: string) => supportedMimes.includes(mime),
  } as FakeBrowserBundle;

  bundle.MediaRecorder = function (this: FakeRecorder, _stream: MediaStream) {
    const rec: FakeRecorder = {
      state: 'inactive',
      startCalled: 0,
      stopCalled: 0,
      start() {
        this.startCalled += 1;
        this.state = 'recording';
      },
      stop() {
        this.stopCalled += 1;
        this.state = 'inactive';
      },
    };
    bundle.lastRecorder = rec;
    bundle.recorderConstructed += 1;
    return rec;
  } as unknown as typeof MediaRecorder;

  bundle.AudioContext = function (this: FakeAudioContext) {
    const ctx: FakeAudioContext = {
      closeCalled: 0,
      createMediaStreamSource: (_stream: MediaStream) => {
        const src: FakeSource = {
          connectCalled: 0,
          disconnectCalled: 0,
          connect() {
            this.connectCalled += 1;
          },
          disconnect() {
            this.disconnectCalled += 1;
          },
        };
        bundle.lastSource = src;
        return src;
      },
      createAnalyser: () => {
        const a: FakeAnalyser = {
          fftSize: 0,
          disconnectCalled: 0,
          disconnect() {
            this.disconnectCalled += 1;
          },
        };
        bundle.lastAnalyser = a;
        return a;
      },
      close: () => {
        ctx.closeCalled += 1;
        return Promise.resolve();
      },
    };
    bundle.lastAudioContext = ctx;
    return ctx;
  } as unknown as typeof AudioContext;

  return bundle;
}

// ---------- tests ----------

describe('MediaGraph (T-387)', () => {
  it('constructor builds a recorder, audio context, source, and analyser', () => {
    const browser = makeFakeBrowser();
    const { stream } = makeFakeStream();
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    expect(browser.recorderConstructed).toBe(1);
    expect(browser.lastAudioContext).toBeDefined();
    expect(browser.lastAnalyser).toBeDefined();
    expect(browser.lastSource).toBeDefined();
    expect(browser.lastSource?.connectCalled).toBe(1);
    expect(browser.lastAnalyser?.fftSize).toBe(256);
    graph.dispose();
  });

  it('AC #18 — startRecording starts the recorder, stopRecording stops it', () => {
    const browser = makeFakeBrowser();
    const { stream } = makeFakeStream();
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    graph.startRecording();
    expect(browser.lastRecorder?.startCalled).toBe(1);
    expect(graph.isRecording()).toBe(true);
    const duration = graph.stopRecording();
    expect(browser.lastRecorder?.stopCalled).toBe(1);
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(graph.isRecording()).toBe(false);
    graph.dispose();
  });

  it('AC #18 — dispose() stops an active recorder', () => {
    const browser = makeFakeBrowser();
    const { stream } = makeFakeStream();
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    graph.startRecording();
    graph.dispose();
    expect(browser.lastRecorder?.stopCalled).toBe(1);
  });

  it('AC #19 — dispose() stops every track on the captured stream', () => {
    const browser = makeFakeBrowser();
    const { stream, tracks } = makeFakeStream(3);
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    graph.dispose();
    for (const track of tracks) {
      expect(track.stopCalled).toBe(1);
    }
  });

  it('AC #20 — dispose() disconnects the analyser', () => {
    const browser = makeFakeBrowser();
    const { stream } = makeFakeStream();
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    graph.dispose();
    expect(browser.lastAnalyser?.disconnectCalled).toBe(1);
    expect(browser.lastSource?.disconnectCalled).toBe(1);
    expect(browser.lastAudioContext?.closeCalled).toBe(1);
  });

  it('AC #22 — dispose() is idempotent', () => {
    const browser = makeFakeBrowser();
    const { stream, tracks } = makeFakeStream();
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    graph.dispose();
    graph.dispose();
    graph.dispose();
    expect(browser.lastAnalyser?.disconnectCalled).toBe(1);
    expect(tracks[0]?.stopCalled).toBe(1);
    expect(browser.lastAudioContext?.closeCalled).toBe(1);
  });

  it('startRecording() is idempotent (second call does not re-start the recorder)', () => {
    const browser = makeFakeBrowser();
    const { stream } = makeFakeStream();
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    graph.startRecording();
    graph.startRecording();
    expect(browser.lastRecorder?.startCalled).toBe(1);
    graph.dispose();
  });

  it('stopRecording() with no active recording returns 0 and is a no-op', () => {
    const browser = makeFakeBrowser();
    const { stream } = makeFakeStream();
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    expect(graph.stopRecording()).toBe(0);
    expect(browser.lastRecorder?.stopCalled).toBe(0);
    graph.dispose();
  });

  it('dispose() swallows recorder.stop throws (already-stopped recorder)', () => {
    const browser = makeFakeBrowser();
    const { stream } = makeFakeStream();
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    graph.startRecording();
    if (browser.lastRecorder !== undefined) {
      browser.lastRecorder.stop = () => {
        throw new Error('already stopped');
      };
    }
    expect(() => graph.dispose()).not.toThrow();
  });

  it('dispose() swallows analyser.disconnect throws', () => {
    const browser = makeFakeBrowser();
    const { stream } = makeFakeStream();
    const graph = new MediaGraph({ stream, mimeType: 'audio/webm', browser });
    if (browser.lastAnalyser !== undefined) {
      browser.lastAnalyser.disconnect = () => {
        throw new Error('disconnect failed');
      };
    }
    expect(() => graph.dispose()).not.toThrow();
  });
});

describe('MediaGraph — defaultMediaGraphBrowserApi feature detection', () => {
  it('returns undefined when MediaRecorder is missing (happy-dom case)', async () => {
    const { defaultMediaGraphBrowserApi } = await import('./media-graph.js');
    const original = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = undefined;
    try {
      expect(defaultMediaGraphBrowserApi()).toBeUndefined();
    } finally {
      (globalThis as { MediaRecorder?: unknown }).MediaRecorder = original;
    }
  });

  it('isMimeTypeSupported swallows isTypeSupported throws', async () => {
    const { defaultMediaGraphBrowserApi } = await import('./media-graph.js');
    const fakeRec = (() => {
      /* fake recorder — never instantiated */
    }) as unknown as typeof MediaRecorder;
    Object.defineProperty(fakeRec, 'isTypeSupported', {
      value: () => {
        throw new Error('boom');
      },
    });
    const fakeCtx = (() => {
      /* fake context */
    }) as unknown as typeof AudioContext;
    const originalRec = (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
    const originalCtx = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder = fakeRec;
    (globalThis as { AudioContext?: typeof AudioContext }).AudioContext = fakeCtx;
    try {
      const api = defaultMediaGraphBrowserApi();
      expect(api?.isMimeTypeSupported('audio/webm')).toBe(false);
    } finally {
      (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder = originalRec;
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext = originalCtx;
    }
  });
});

// `vi` is used in the imports above to keep the unused-import linter calm if
// future tests expand; current suite uses spies only via the fake harness.
void vi;
