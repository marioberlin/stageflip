// packages/runtimes/interactive/src/clips/voice/transcription-provider.ts
// `TranscriptionProvider` interface + two implementations for T-387
// (D-T387-5):
//
//   1. `WebSpeechApiTranscriptionProvider` — wraps `window.SpeechRecognition`
//      / `webkitSpeechRecognition`. Feature-detected; throws
//      `WebSpeechApiUnavailableError` if neither global is present.
//   2. `InMemoryTranscriptionProvider` — emits a scripted sequence of
//      `TranscriptEvent` over time. Used by the factory tests and by host
//      integration tests that don't want to stub Web Speech globally.
//
// Cloud providers (Whisper / Deepgram / AssemblyAI) are out-of-scope here
// per D-T387-5 — Phase 14 ADR-006 covers the cloud adapter shape.
//
// BROWSER-SAFE — no Node-only imports. Web Speech API is feature-detected;
// the file imports cleanly in a server-side bundle (it just won't be
// callable there).

import type { TranscriptEvent } from './types.js';

/**
 * Arguments handed to `TranscriptionProvider.start`. The provider OWNS
 * the lifecycle from `start` through the returned `stop()` — including
 * draining any in-flight transcription request and surfacing terminal
 * events on the `onTranscript` channel before resolving `stop()`.
 */
export interface TranscriptionStartArgs {
  /**
   * Live microphone stream. The provider may consume it (Web Audio
   * pipeline, server upload) but MUST NOT stop tracks — the factory
   * owns the stream's teardown via `MediaGraph.dispose()`.
   */
  stream: MediaStream;
  /** BCP-47 language tag forwarded to the recogniser. */
  language: string;
  /** When `true`, partial / interim transcripts are emitted. */
  partial: boolean;
  /** Subscriber the provider calls for every event. */
  onTranscript: (event: TranscriptEvent) => void;
}

/**
 * The transcription seam. Two implementations ship with T-387; future
 * cloud providers add a third (Phase 14).
 */
export interface TranscriptionProvider {
  /**
   * Begin streaming transcription from `args.stream`. Resolves with a
   * `{ stop }` handle that tears down the in-flight transcription
   * synchronously (no remaining events surface after `stop()` returns).
   *
   * Rejections from `start()` route via the factory's mount.failure
   * telemetry.
   */
  start(args: TranscriptionStartArgs): Promise<{ stop: () => void }>;
}

/**
 * Thrown by `WebSpeechApiTranscriptionProvider.start` when neither
 * `window.SpeechRecognition` nor `window.webkitSpeechRecognition` is
 * available on the active page. The factory surfaces this as
 * `voice-clip.mount.failure` with reason `'web-speech-unavailable'`.
 */
export class WebSpeechApiUnavailableError extends Error {
  constructor() {
    super(
      'Web Speech API is not available on this browser. Inject an InMemoryTranscriptionProvider or a future cloud provider.',
    );
    this.name = 'WebSpeechApiUnavailableError';
  }
}

// ---------- Web Speech API typings ----------

/**
 * Minimal structural typing for `SpeechRecognition`. We intentionally
 * avoid `lib.dom.d.ts`'s declarations (which vary by TS version) and
 * model only the surface we touch.
 */
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  // Index 0 is the highest-confidence alternative.
  readonly [index: number]: { transcript: string };
  readonly length: number;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionGlobals {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

/**
 * Detect a `SpeechRecognition` constructor on the supplied global object.
 * The factory calls this with `window`; tests pass a stubbed object.
 */
function detectSpeechRecognitionCtor(
  globalObj: SpeechRecognitionGlobals | undefined,
): SpeechRecognitionCtor | undefined {
  if (globalObj === undefined) return undefined;
  return globalObj.SpeechRecognition ?? globalObj.webkitSpeechRecognition;
}

// ---------- providers ----------

export interface WebSpeechApiTranscriptionProviderOptions {
  /**
   * Override the global object used for feature detection. Defaults to
   * `window` in browsers, `globalThis` otherwise. Tests inject a stub
   * that exposes a custom `SpeechRecognition` constructor.
   */
  globalObj?: SpeechRecognitionGlobals;
}

/**
 * `TranscriptionProvider` backed by the Web Speech API. Feature-detected;
 * throws `WebSpeechApiUnavailableError` from `start()` if no constructor
 * is available.
 *
 * The provider does NOT consume `args.stream` — the Web Speech API
 * captures audio from the microphone independently. The stream argument
 * is taken so the public seam is uniform across providers; future cloud
 * providers will read it.
 */
export class WebSpeechApiTranscriptionProvider implements TranscriptionProvider {
  private readonly globalObj: SpeechRecognitionGlobals | undefined;

  constructor(options: WebSpeechApiTranscriptionProviderOptions = {}) {
    this.globalObj =
      options.globalObj ??
      (typeof window !== 'undefined'
        ? (window as unknown as SpeechRecognitionGlobals)
        : (globalThis as unknown as SpeechRecognitionGlobals));
  }

  async start(args: TranscriptionStartArgs): Promise<{ stop: () => void }> {
    const Ctor = detectSpeechRecognitionCtor(this.globalObj);
    if (Ctor === undefined) {
      throw new WebSpeechApiUnavailableError();
    }
    const recognition = new Ctor();
    recognition.lang = args.language;
    recognition.continuous = true;
    recognition.interimResults = args.partial;

    let stopped = false;

    recognition.onresult = (event) => {
      if (stopped) return;
      const tsRef = nowMs();
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result === undefined) continue;
        const alt = result[0];
        if (alt === undefined) continue;
        const text = alt.transcript;
        if (result.isFinal) {
          args.onTranscript({ kind: 'final', text, timestampMs: tsRef });
        } else if (args.partial) {
          args.onTranscript({ kind: 'partial', text, timestampMs: tsRef });
        }
      }
    };
    recognition.onerror = (event) => {
      if (stopped) return;
      const message = event.message ?? event.error ?? 'Web Speech recognition error';
      args.onTranscript({ kind: 'error', message });
    };
    recognition.onend = () => {
      // The recogniser ends naturally on silence; the factory's stop()
      // path drives our local cleanup. No-op here intentionally.
    };

    try {
      recognition.start();
    } catch (err) {
      // Some browsers reject re-entrant `.start()` synchronously.
      stopped = true;
      throw err instanceof Error ? err : new Error(String(err));
    }

    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        try {
          recognition.abort();
        } catch {
          // Browser may throw if the recogniser already ended; safe to ignore.
        }
      },
    };
  }
}

/**
 * `nowMs()` — wall-clock timestamp helper. The interactive tier is
 * exempt from `check-determinism`'s broad rule (ADR-003 §D5); voice
 * timestamps are wall-clock by definition.
 */
function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

// ---------- in-memory provider ----------

/**
 * A scripted entry: an event paired with its delivery delay (in ms,
 * relative to `start()`).
 */
export interface ScriptedTranscriptStep {
  /** Delay in ms after `start()` before the event is emitted. */
  delayMs: number;
  event: TranscriptEvent;
}

export interface InMemoryTranscriptionProviderOptions {
  /**
   * Sequence of scripted events. Emitted in array order; `delayMs` is the
   * delay relative to `start()` (NOT relative to the previous step). The
   * provider does NOT sort — sequence is what the test says.
   */
  scripted: ReadonlyArray<ScriptedTranscriptStep>;
  /**
   * Override the timer host. Defaults to `setTimeout` / `clearTimeout`
   * on the active global. Tests can inject a fake timer to drive
   * deterministic emission.
   */
  timers?: {
    setTimeout: (cb: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
  };
}

/**
 * `TranscriptionProvider` that emits a hard-coded sequence of events.
 * Used by the factory tests; production code never instantiates this.
 *
 * The seam is intentionally narrow — sequencing is the ONE thing tests
 * need, and a scripted-step list keeps the test fixture obvious.
 */
export class InMemoryTranscriptionProvider implements TranscriptionProvider {
  private readonly scripted: ReadonlyArray<ScriptedTranscriptStep>;
  private readonly timerSet: (cb: () => void, ms: number) => unknown;
  private readonly timerClear: (handle: unknown) => void;

  constructor(options: InMemoryTranscriptionProviderOptions) {
    this.scripted = options.scripted;
    if (options.timers !== undefined) {
      this.timerSet = options.timers.setTimeout;
      this.timerClear = options.timers.clearTimeout;
    } else {
      // Default to the global; happy-dom + jsdom both provide setTimeout.
      this.timerSet = (cb, ms) => setTimeout(cb, ms);
      this.timerClear = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>);
    }
  }

  async start(args: TranscriptionStartArgs): Promise<{ stop: () => void }> {
    let stopped = false;
    const handles: unknown[] = [];

    for (const step of this.scripted) {
      const handle = this.timerSet(() => {
        if (stopped) return;
        // `partial` events suppressed when the caller asked for finals only.
        if (step.event.kind === 'partial' && !args.partial) {
          return;
        }
        args.onTranscript(step.event);
      }, step.delayMs);
      handles.push(handle);
    }

    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        for (const h of handles) this.timerClear(h);
      },
    };
  }
}
