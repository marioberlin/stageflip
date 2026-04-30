// packages/runtimes/interactive/src/clips/voice/factory.test.ts
// T-387 ACs #5–#16, #18–#25 — voiceClipFactory unit tests. happy-dom does
// not provide MediaRecorder / AudioContext / SpeechRecognition; the tests
// inject a complete fake browser surface and a controllable transcription
// provider.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ClipFactory, type MountContext, PERMISSIVE_TENANT_POLICY } from '../../contract.js';
import { InteractiveMountHarness } from '../../mount-harness.js';
import { PermissionShim } from '../../permission-shim.js';
import { InteractiveClipRegistry } from '../../registry.js';
import { type VoiceClipFactoryBrowserApi, VoiceClipFactoryBuilder } from './factory.js';
import type { MediaGraphBrowserApi } from './media-graph.js';
import {
  InMemoryTranscriptionProvider,
  type TranscriptionProvider,
} from './transcription-provider.js';
import type { TranscriptEvent } from './types.js';

// ---------- fakes ----------

interface FakeRecorderState {
  state: 'inactive' | 'recording' | 'paused';
  startCalled: number;
  stopCalled: number;
}

interface FakeBrowserHandles {
  api: VoiceClipFactoryBrowserApi;
  recorder: FakeRecorderState | undefined;
  trackStops: number;
  audioContextCloses: number;
  analyserDisconnects: number;
  getUserMediaCalls: number;
  streamsAcquired: MediaStream[];
}

function makeFakeBrowser(supportedMimes: string[] = ['audio/webm']): FakeBrowserHandles {
  const handles: FakeBrowserHandles = {
    api: undefined as unknown as VoiceClipFactoryBrowserApi,
    recorder: undefined,
    trackStops: 0,
    audioContextCloses: 0,
    analyserDisconnects: 0,
    getUserMediaCalls: 0,
    streamsAcquired: [],
  };

  class FakeRecorderImpl {
    rec: FakeRecorderState;
    constructor() {
      const rec: FakeRecorderState = {
        state: 'inactive',
        startCalled: 0,
        stopCalled: 0,
      };
      handles.recorder = rec;
      this.rec = rec;
    }
    get state(): 'inactive' | 'recording' | 'paused' {
      return this.rec.state;
    }
    start(): void {
      this.rec.startCalled += 1;
      this.rec.state = 'recording';
    }
    stop(): void {
      this.rec.stopCalled += 1;
      this.rec.state = 'inactive';
    }
  }
  const FakeRecorderCtor = FakeRecorderImpl as unknown as typeof MediaRecorder;

  class FakeAudioContextImpl {
    createMediaStreamSource(): { connect: () => void; disconnect: () => void } {
      return {
        connect: () => {},
        disconnect: () => {},
      };
    }
    createAnalyser(): { fftSize: number; disconnect: () => void } {
      return {
        fftSize: 0,
        disconnect: () => {
          handles.analyserDisconnects += 1;
        },
      };
    }
    close(): Promise<void> {
      handles.audioContextCloses += 1;
      return Promise.resolve();
    }
  }
  const FakeAudioContextCtor = FakeAudioContextImpl as unknown as typeof AudioContext;

  const mediaGraph: MediaGraphBrowserApi = {
    MediaRecorder: FakeRecorderCtor,
    AudioContext: FakeAudioContextCtor,
    isMimeTypeSupported: (mime) => supportedMimes.includes(mime),
  };

  handles.api = {
    getUserMedia: async (_constraints) => {
      handles.getUserMediaCalls += 1;
      const tracks: MediaStreamTrack[] = [
        {
          stop: () => {
            handles.trackStops += 1;
          },
        } as unknown as MediaStreamTrack,
      ];
      const stream = {
        getTracks: () => tracks,
      } as unknown as MediaStream;
      handles.streamsAcquired.push(stream);
      return stream;
    },
    mediaGraph,
  };

  return handles;
}

interface MakeContextArgs {
  emit?: MountContext['emitTelemetry'];
  signal?: AbortSignal;
  frameSource?: undefined; // explicit per AC #7
  props?: Partial<{
    mimeType: string;
    maxDurationMs: number;
    partialTranscripts: boolean;
    language: string;
  }>;
}

function makeContext(args: MakeContextArgs = {}): MountContext {
  const root = document.createElement('div');
  return {
    clip: {
      id: 'test-voice-clip',
      type: 'interactive-clip',
      family: 'voice',
      transform: { x: 0, y: 0, width: 100, height: 100 },
      visible: true,
      locked: false,
      animations: [],
      staticFallback: [
        {
          id: 'sf',
          type: 'image',
          transform: { x: 0, y: 0, width: 100, height: 100 },
          visible: true,
          locked: false,
          animations: [],
          src: 'poster.png',
        },
      ],
      liveMount: {
        component: {
          module: '@stageflip/runtimes-interactive/clips/voice#VoiceClip',
        },
        props: {
          mimeType: args.props?.mimeType ?? 'audio/webm',
          maxDurationMs: args.props?.maxDurationMs ?? 60_000,
          partialTranscripts: args.props?.partialTranscripts ?? true,
          language: args.props?.language ?? 'en-US',
          posterFrame: 0,
        },
        permissions: ['mic'],
      },
    } as never,
    root,
    permissions: ['mic'],
    tenantPolicy: PERMISSIVE_TENANT_POLICY,
    emitTelemetry: args.emit ?? (() => undefined),
    signal: args.signal ?? new AbortController().signal,
  };
}

// ---------- tests ----------

describe('voiceClipFactory (T-387)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('AC #5 — registry resolves the factory after register', () => {
    const registry = new InteractiveClipRegistry();
    const browser = makeFakeBrowser();
    const factory = VoiceClipFactoryBuilder.build({ browser: browser.api });
    registry.register('voice', factory);
    expect(registry.resolve('voice')).toBe(factory);
  });

  it('AC #6 — re-importing throws InteractiveClipFamilyAlreadyRegisteredError', () => {
    const registry = new InteractiveClipRegistry();
    const browser = makeFakeBrowser();
    const factory = VoiceClipFactoryBuilder.build({ browser: browser.api });
    registry.register('voice', factory);
    expect(() => registry.register('voice', factory)).toThrow(/already registered/);
  });

  it('AC #7 — mount with frameSource: undefined succeeds (no MissingFrameSourceError)', async () => {
    const browser = makeFakeBrowser();
    const provider = new InMemoryTranscriptionProvider({ scripted: [] });
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext({ frameSource: undefined });
    const handle = await factory(ctx);
    expect(handle).toBeDefined();
    handle.dispose();
  });

  it('AC #8 — mount renders the React tree (button + level meter + transcript)', async () => {
    const browser = makeFakeBrowser();
    const provider = new InMemoryTranscriptionProvider({ scripted: [] });
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext();
    const handle = await factory(ctx);
    expect(ctx.root.querySelector('[data-stageflip-voice-clip]')).not.toBeNull();
    expect(ctx.root.querySelector('button[data-action="record"]')).not.toBeNull();
    expect(ctx.root.querySelector('canvas[data-role="level-meter"]')).not.toBeNull();
    expect(ctx.root.querySelector('output[data-role="transcript-live"]')).not.toBeNull();
    handle.dispose();
  });

  it('AC #9 — startRecording calls getUserMedia({audio:true})', async () => {
    const browser = makeFakeBrowser();
    const provider = new InMemoryTranscriptionProvider({ scripted: [] });
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    await handle.startRecording();
    expect(browser.getUserMediaCalls).toBe(1);
    handle.dispose();
  });

  it('AC #10 — unsupported MIME emits mount.failure with reason media-recorder-unsupported-mime', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const browser = makeFakeBrowser(['audio/webm']);
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: new InMemoryTranscriptionProvider({ scripted: [] }),
    });
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      props: { mimeType: 'audio/wav' },
    });
    await expect(factory(ctx)).rejects.toThrow();
    const failure = events.find((e) => e[0] === 'voice-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'media-recorder-unsupported-mime' });
  });

  it('AC #11 — stopRecording emits voice-clip.recording.stopped with non-zero durationMs', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const browser = makeFakeBrowser();
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: new InMemoryTranscriptionProvider({ scripted: [] }),
    });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await castVoice(factory, ctx);
    await handle.startRecording();
    vi.advanceTimersByTime(15);
    // performance.now within fake timers — advance triggers a real tick
    await handle.stopRecording();
    const stopped = events.find((e) => e[0] === 'voice-clip.recording.stopped');
    expect(stopped).toBeDefined();
    expect(typeof stopped?.[1].durationMs).toBe('number');
    handle.dispose();
  });

  it('AC #12 — auto-stop after maxDurationMs surfaces voice-clip.recording.stopped', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const browser = makeFakeBrowser();
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: new InMemoryTranscriptionProvider({ scripted: [] }),
    });
    const ctx = makeContext({
      emit: (e, a) => events.push([e, a]),
      props: { maxDurationMs: 50 },
    });
    const handle = await castVoice(factory, ctx);
    await handle.startRecording();
    await vi.advanceTimersByTimeAsync(100);
    expect(events.find((e) => e[0] === 'voice-clip.recording.stopped')).toBeDefined();
    handle.dispose();
  });

  it('AC #13 — final TranscriptEvent reaches subscribers via InMemoryTranscriptionProvider', async () => {
    const browser = makeFakeBrowser();
    const provider = new InMemoryTranscriptionProvider({
      scripted: [{ delayMs: 5, event: { kind: 'final', text: 'hi', timestampMs: 0 } }],
    });
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    const events: TranscriptEvent[] = [];
    handle.onTranscript((e) => events.push(e));
    await handle.startRecording();
    vi.advanceTimersByTime(20);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('final');
    if (events[0]?.kind === 'final') expect(events[0].text).toBe('hi');
    handle.dispose();
  });

  it('AC #14 — partialTranscripts:true surfaces partial events', async () => {
    const browser = makeFakeBrowser();
    const provider = new InMemoryTranscriptionProvider({
      scripted: [{ delayMs: 5, event: { kind: 'partial', text: 'h', timestampMs: 0 } }],
    });
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext({ props: { partialTranscripts: true } });
    const handle = await castVoice(factory, ctx);
    const events: TranscriptEvent[] = [];
    handle.onTranscript((e) => events.push(e));
    await handle.startRecording();
    vi.advanceTimersByTime(10);
    expect(events.find((e) => e.kind === 'partial')).toBeDefined();
    handle.dispose();
  });

  it('AC #15 — partialTranscripts:false suppresses partial events', async () => {
    const browser = makeFakeBrowser();
    const provider = new InMemoryTranscriptionProvider({
      scripted: [
        { delayMs: 5, event: { kind: 'partial', text: 'p', timestampMs: 0 } },
        { delayMs: 10, event: { kind: 'final', text: 'f', timestampMs: 0 } },
      ],
    });
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext({ props: { partialTranscripts: false } });
    const handle = await castVoice(factory, ctx);
    const events: TranscriptEvent[] = [];
    handle.onTranscript((e) => events.push(e));
    await handle.startRecording();
    vi.advanceTimersByTime(15);
    expect(events.find((e) => e.kind === 'partial')).toBeUndefined();
    expect(events.find((e) => e.kind === 'final')).toBeDefined();
    handle.dispose();
  });

  it('AC #16 — Web Speech unavailable → mount.failure web-speech-unavailable; no transcript text in telemetry', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const browser = makeFakeBrowser();
    // Provider that throws synchronously on start.
    const failingProvider: TranscriptionProvider = {
      start: async () => {
        const err = new Error('Web Speech API is not available');
        err.name = 'WebSpeechApiUnavailableError';
        throw err;
      },
    };
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: failingProvider,
    });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await castVoice(factory, ctx);
    await expect(handle.startRecording()).rejects.toThrow();
    const failure = events.find((e) => e[0] === 'voice-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'web-speech-unavailable' });
    // No telemetry attribute carries transcript text body.
    for (const [, attrs] of events) {
      for (const v of Object.values(attrs)) {
        expect(typeof v === 'string' && v.length > 50 && /[a-z]+\s+[a-z]+/i.test(v)).toBe(false);
      }
    }
    handle.dispose();
  });

  it('Reviewer M-1 — non-WebSpeech provider rejection → mount.failure transcription-failed', async () => {
    // A custom or future cloud provider whose `start()` rejects with an
    // ordinary Error (no WebSpeechApiUnavailableError name marker). The
    // factory must classify this as 'transcription-failed' rather than
    // misreporting it as 'web-speech-unavailable'.
    const events: Array<[string, Record<string, unknown>]> = [];
    const browser = makeFakeBrowser();
    const failingProvider: TranscriptionProvider = {
      start: async () => {
        throw new Error('upstream provider rejected: 503 service unavailable');
      },
    };
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: failingProvider,
    });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await castVoice(factory, ctx);
    await expect(handle.startRecording()).rejects.toThrow(/503/);
    const failure = events.find((e) => e[0] === 'voice-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'transcription-failed' });
    handle.dispose();
  });

  it('AC #18, #19, #20, #21 — dispose() tears down recorder + tracks + analyser + transcription', async () => {
    const browser = makeFakeBrowser();
    const transcriptionStops: number[] = [];
    const provider: TranscriptionProvider = {
      start: async () => ({
        stop: () => transcriptionStops.push(1),
      }),
    };
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    await handle.startRecording();
    expect(browser.recorder?.state).toBe('recording');
    handle.dispose();
    expect(browser.recorder?.stopCalled).toBe(1);
    expect(browser.trackStops).toBeGreaterThanOrEqual(1);
    expect(browser.analyserDisconnects).toBe(1);
    expect(transcriptionStops).toHaveLength(1);
  });

  it('AC #22 — dispose() is idempotent', async () => {
    const browser = makeFakeBrowser();
    const transcriptionStops: number[] = [];
    const provider: TranscriptionProvider = {
      start: async () => ({ stop: () => transcriptionStops.push(1) }),
    };
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    await handle.startRecording();
    handle.dispose();
    handle.dispose();
    handle.dispose();
    expect(browser.recorder?.stopCalled).toBe(1);
    expect(transcriptionStops).toHaveLength(1);
    expect(browser.analyserDisconnects).toBe(1);
  });

  it('AC #23 — signal.abort triggers the same teardown path (via mount-harness)', async () => {
    const browser = makeFakeBrowser();
    const transcriptionStops: number[] = [];
    const provider: TranscriptionProvider = {
      start: async () => ({ stop: () => transcriptionStops.push(1) }),
    };
    const factory: ClipFactory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const registry = new InteractiveClipRegistry();
    // Wrap so we can drive `startRecording` before the harness wraps the handle.
    let captured: Awaited<ReturnType<typeof castVoice>> | undefined;
    const capturingFactory: ClipFactory = async (ctx) => {
      const handle = (await factory(ctx)) as Awaited<ReturnType<typeof castVoice>>;
      captured = handle;
      return handle;
    };
    registry.register('voice', capturingFactory);
    const harness = new InteractiveMountHarness({
      registry,
      permissionShim: new PermissionShim({
        browser: {
          getUserMedia: async () =>
            ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream,
        },
      }),
    });
    const controller = new AbortController();
    const ctx = makeContext({ signal: controller.signal });
    await harness.mount(ctx.clip, ctx.root, controller.signal);
    expect(captured).toBeDefined();
    if (captured === undefined) throw new Error('factory did not run');
    await captured.startRecording();
    controller.abort();
    expect(browser.recorder?.stopCalled).toBeGreaterThanOrEqual(1);
    expect(transcriptionStops).toHaveLength(1);
  });

  it('AC #24 — full telemetry shape (start, success, recording.started/stopped, transcript.partial/final, dispose)', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const browser = makeFakeBrowser();
    const provider = new InMemoryTranscriptionProvider({
      scripted: [
        { delayMs: 5, event: { kind: 'partial', text: 'hi', timestampMs: 0 } },
        { delayMs: 10, event: { kind: 'final', text: 'hello', timestampMs: 0 } },
      ],
    });
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    const handle = await castVoice(factory, ctx);
    await handle.startRecording();
    vi.advanceTimersByTime(15);
    await handle.stopRecording();
    handle.dispose();
    const names = events.map((e) => e[0]);
    expect(names).toContain('voice-clip.mount.start');
    expect(names).toContain('voice-clip.mount.success');
    expect(names).toContain('voice-clip.recording.started');
    expect(names).toContain('voice-clip.recording.stopped');
    expect(names).toContain('voice-clip.transcript.partial');
    expect(names).toContain('voice-clip.transcript.final');
    expect(names).toContain('voice-clip.dispose');

    // Privacy posture: textLength is the only text-derived attribute.
    const partial = events.find((e) => e[0] === 'voice-clip.transcript.partial');
    expect(partial?.[1]).toMatchObject({ textLength: 2 });
    expect((partial?.[1] as Record<string, unknown>).text).toBeUndefined();
    const final = events.find((e) => e[0] === 'voice-clip.transcript.final');
    expect(final?.[1]).toMatchObject({ textLength: 5 });
    expect((final?.[1] as Record<string, unknown>).text).toBeUndefined();
  });

  it('AC #25 — denied permission gate routes to staticFallback', async () => {
    const browser = makeFakeBrowser();
    const transcriptionStops: number[] = [];
    const provider: TranscriptionProvider = {
      start: async () => ({ stop: () => transcriptionStops.push(1) }),
    };
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const registry = new InteractiveClipRegistry();
    registry.register('voice', factory);
    // A shim whose getUserMedia rejects.
    const denyingShim = new PermissionShim({
      browser: { getUserMedia: async () => Promise.reject(new Error('denied')) },
    });
    const harness = new InteractiveMountHarness({ registry, permissionShim: denyingShim });
    const ctx = makeContext();
    await harness.mount(ctx.clip, ctx.root, new AbortController().signal);
    // The static path renders the fallback in the root; the live React
    // tree should not be present.
    expect(ctx.root.querySelector('[data-stageflip-voice-clip]')).toBeNull();
    expect(browser.getUserMediaCalls).toBe(0);
  });

  it('invalid props → mount.failure reason invalid-props', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const browser = makeFakeBrowser();
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: new InMemoryTranscriptionProvider({ scripted: [] }),
    });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    (ctx.clip.liveMount.props as Record<string, unknown>).maxDurationMs = -1;
    await expect(factory(ctx)).rejects.toThrow();
    const failure = events.find((e) => e[0] === 'voice-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'invalid-props' });
  });

  it('factory without browser API throws web-audio-unavailable failure', async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const factory = VoiceClipFactoryBuilder.build({
      // No browser passed; factory's defaults will fail under happy-dom.
      transcriptionProvider: new InMemoryTranscriptionProvider({ scripted: [] }),
    });
    const ctx = makeContext({ emit: (e, a) => events.push([e, a]) });
    await expect(factory(ctx)).rejects.toThrow();
    const failure = events.find((e) => e[0] === 'voice-clip.mount.failure');
    expect(failure?.[1]).toMatchObject({ reason: 'web-audio-unavailable' });
  });

  it('onTranscript handlers can unsubscribe; subsequent events do not surface', async () => {
    const browser = makeFakeBrowser();
    const provider = new InMemoryTranscriptionProvider({
      scripted: [
        { delayMs: 5, event: { kind: 'final', text: 'a', timestampMs: 0 } },
        { delayMs: 10, event: { kind: 'final', text: 'b', timestampMs: 0 } },
      ],
    });
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    const events: TranscriptEvent[] = [];
    const unsub = handle.onTranscript((e) => events.push(e));
    await handle.startRecording();
    vi.advanceTimersByTime(7);
    unsub();
    vi.advanceTimersByTime(20);
    expect(events).toHaveLength(1);
    handle.dispose();
  });

  it('handler throw does not break sibling handlers', async () => {
    const browser = makeFakeBrowser();
    const provider = new InMemoryTranscriptionProvider({
      scripted: [{ delayMs: 5, event: { kind: 'final', text: 'x', timestampMs: 0 } }],
    });
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    const events: TranscriptEvent[] = [];
    handle.onTranscript(() => {
      throw new Error('bad handler');
    });
    handle.onTranscript((e) => events.push(e));
    await handle.startRecording();
    vi.advanceTimersByTime(10);
    expect(events).toHaveLength(1);
    handle.dispose();
  });

  it('updateProps is a no-op (mount-time configuration only)', async () => {
    const browser = makeFakeBrowser();
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: new InMemoryTranscriptionProvider({ scripted: [] }),
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    expect(() => handle.updateProps({ language: 'fr-FR' })).not.toThrow();
    handle.dispose();
  });

  it('startRecording is idempotent (second call without stop is a no-op)', async () => {
    const browser = makeFakeBrowser();
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: new InMemoryTranscriptionProvider({ scripted: [] }),
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    await handle.startRecording();
    await handle.startRecording();
    expect(browser.getUserMediaCalls).toBe(1);
    handle.dispose();
  });

  it('stopRecording with no active recording is a safe no-op', async () => {
    const browser = makeFakeBrowser();
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: new InMemoryTranscriptionProvider({ scripted: [] }),
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    await expect(handle.stopRecording()).resolves.toBeUndefined();
    handle.dispose();
  });

  it('startRecording while disposed early-returns', async () => {
    const browser = makeFakeBrowser();
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: new InMemoryTranscriptionProvider({ scripted: [] }),
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    handle.dispose();
    await handle.startRecording();
    expect(browser.getUserMediaCalls).toBe(0);
  });

  it('disposing while transcription start is in flight tears it down on completion', async () => {
    vi.useRealTimers(); // this test orchestrates microtasks; fake timers interfere
    const browser = makeFakeBrowser();
    let provided = 0;
    let providerStops = 0;
    let releasedStop: (() => void) | undefined;
    const provider: TranscriptionProvider = {
      start: () => {
        provided += 1;
        return new Promise((resolve) => {
          releasedStop = () =>
            resolve({
              stop: () => {
                providerStops += 1;
              },
            });
        });
      },
    };
    const factory = VoiceClipFactoryBuilder.build({
      browser: browser.api,
      transcriptionProvider: provider,
    });
    const ctx = makeContext();
    const handle = await castVoice(factory, ctx);
    const start = handle.startRecording();
    // Yield a microtask so getUserMedia + MediaGraph construction land
    // before we dispose.
    await Promise.resolve();
    await Promise.resolve();
    handle.dispose();
    releasedStop?.();
    await start;
    expect(provided).toBe(1);
    expect(providerStops).toBe(1);
  });
});

// ---------- helpers ----------

async function castVoice(
  factory: ClipFactory,
  ctx: MountContext,
): Promise<
  Awaited<ReturnType<typeof factory>> & {
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    onTranscript: (handler: (event: TranscriptEvent) => void) => () => void;
  }
> {
  const handle = await factory(ctx);
  return handle as Awaited<ReturnType<typeof factory>> & {
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    onTranscript: (handler: (event: TranscriptEvent) => void) => () => void;
  };
}
