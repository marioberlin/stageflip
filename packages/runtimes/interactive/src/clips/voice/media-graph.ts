// packages/runtimes/interactive/src/clips/voice/media-graph.ts
// `MediaGraph` — glue between the captured `MediaStream` and the two
// downstream consumers the voice clip wires up:
//
//   1. `MediaRecorder` — encodes the live stream into the configured MIME
//      type. The factory uses this for opt-in audio-blob retention; in
//      T-387 we emit start/stop telemetry only and discard the blob (host
//      apps consume the in-memory transcript stream).
//   2. `Web Audio AnalyserNode` — frequency / amplitude data for the
//      level-meter UI.
//
// `dispose()` is the highest-attention path in T-387 (D-T387-8 + AC #18-#23).
// A leaked recorder, undisposed analyser, or unstopped track produces a
// user-visible browser recording-indicator. The graph is structured so
// `dispose()` can be a single call that cleanly tears down every resource
// in reverse-construction order; it is idempotent.
//
// BROWSER-SAFE — feature-detected. The class still imports cleanly in a
// server-side bundle; instantiation is the gate.

/**
 * The browser surface this module depends on. Extracted so tests can
 * inject fakes without monkey-patching the global.
 */
export interface MediaGraphBrowserApi {
  /**
   * Constructor reference for `MediaRecorder`. Throws if the browser
   * lacks `MediaRecorder` entirely; the factory routes that to
   * `mount.failure` reason `'web-audio-unavailable'`.
   */
  MediaRecorder: typeof MediaRecorder;
  /**
   * Constructor reference for `AudioContext`. Some Safari builds expose
   * `webkitAudioContext`; resolve at construction.
   */
  AudioContext: typeof AudioContext;
  /**
   * `MediaRecorder.isTypeSupported(mime)` — feature-detect at MIME level.
   */
  isMimeTypeSupported: (mime: string) => boolean;
}

/**
 * Resolve the browser APIs the graph depends on. Returns `undefined` if
 * the active environment does not support both required globals.
 * happy-dom does not implement either; the factory tests always inject
 * a fake.
 */
export function defaultMediaGraphBrowserApi(): MediaGraphBrowserApi | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const webkitCtx = (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
    .webkitAudioContext;
  if (typeof AudioContext === 'undefined' && webkitCtx === undefined) {
    return undefined;
  }
  const Ctx =
    typeof AudioContext !== 'undefined' ? AudioContext : (webkitCtx as typeof AudioContext);
  return {
    MediaRecorder,
    AudioContext: Ctx,
    isMimeTypeSupported: (mime) => {
      try {
        return MediaRecorder.isTypeSupported(mime);
      } catch {
        return false;
      }
    },
  };
}

export interface MediaGraphOptions {
  /** Live stream from `getUserMedia({audio:true})`. The graph OWNS its teardown. */
  stream: MediaStream;
  /** Configured MIME type from the schema. */
  mimeType: string;
  /** Browser API surface — defaults to live `MediaRecorder` + `AudioContext`. */
  browser: MediaGraphBrowserApi;
}

/**
 * Resource holder + teardown choreographer for a single voice-clip mount.
 *
 * Invariants:
 *   - `dispose()` stops the recorder, disconnects the analyser, closes
 *     the audio context, and stops every track on the captured stream.
 *   - `dispose()` is idempotent — second call is a no-op.
 *   - `mimeType` falls back to the recorder's chosen default when the
 *     configured value is unsupported (the factory consults
 *     `isMimeTypeSupported` BEFORE constructing the graph and routes to
 *     mount.failure when the configured MIME is invalid; this class
 *     therefore expects a known-good mimeType — failure is the factory's
 *     job, not the graph's).
 */
export class MediaGraph {
  readonly stream: MediaStream;
  readonly recorder: MediaRecorder;
  readonly analyser: AnalyserNode;

  private readonly audioContext: AudioContext;
  private readonly sourceNode: MediaStreamAudioSourceNode;
  private disposed = false;
  private recordingStarted = false;
  private recordingStartTimeMs: number | undefined;

  constructor(options: MediaGraphOptions) {
    this.stream = options.stream;
    this.recorder = new options.browser.MediaRecorder(options.stream, {
      mimeType: options.mimeType,
    });
    this.audioContext = new options.browser.AudioContext();
    this.sourceNode = this.audioContext.createMediaStreamSource(options.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.sourceNode.connect(this.analyser);
  }

  /** Begin encoding. Returns the wall-clock timestamp the recorder started. */
  startRecording(): number {
    if (this.recordingStarted) {
      return this.recordingStartTimeMs ?? 0;
    }
    this.recorder.start();
    this.recordingStarted = true;
    this.recordingStartTimeMs = nowMs();
    return this.recordingStartTimeMs;
  }

  /**
   * Stop encoding. Returns the elapsed duration in ms since
   * `startRecording`, or 0 if no recording was active.
   */
  stopRecording(): number {
    if (!this.recordingStarted) return 0;
    const start = this.recordingStartTimeMs ?? nowMs();
    try {
      if (this.recorder.state === 'recording') {
        this.recorder.stop();
      }
    } catch {
      // Some browsers throw if state has already advanced; safe to swallow.
    }
    this.recordingStarted = false;
    return Math.max(0, nowMs() - start);
  }

  /** Whether the recorder is currently active. */
  isRecording(): boolean {
    return this.recordingStarted;
  }

  /**
   * Tear down every owned resource. Idempotent — second call is a no-op.
   * Order: stop recorder → disconnect analyser → close audio context →
   * stop every stream track. Reverse of construction.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.recordingStarted) {
      try {
        if (this.recorder.state === 'recording') {
          this.recorder.stop();
        }
      } catch {
        /* swallow — already-stopped recorder throws on second .stop() */
      }
      this.recordingStarted = false;
    }

    try {
      this.analyser.disconnect();
    } catch {
      /* defensive — analyser may already be disconnected */
    }
    try {
      this.sourceNode.disconnect();
    } catch {
      /* defensive */
    }
    try {
      // `AudioContext.close()` may return a promise; we don't await it
      // because dispose is synchronous. Browsers proceed with teardown
      // regardless of whether the close-promise is observed.
      void this.audioContext.close();
    } catch {
      /* defensive */
    }
    for (const track of this.stream.getTracks()) {
      try {
        track.stop();
      } catch {
        /* defensive */
      }
    }
  }
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
