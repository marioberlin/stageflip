// packages/runtimes/interactive/src/clips/voice/factory.ts
// `voiceClipFactory` — produces the `ClipFactory` for `family: 'voice'`
// (T-387 D-T387-1, D-T387-4). Standalone interactive-tier clip — no §3
// runtime to wrap, no `frameSource` dependency (D-T387-7), no convergence
// test (D-T387-6). Mounts a small React tree (record button + level meter
// + transcript live region), captures microphone audio via `MediaRecorder`,
// streams a transcript via the configured `TranscriptionProvider`.
//
// CRITICAL — D-T387-8: `dispose()` MUST tear down every resource. A leaked
// recorder, undisposed analyser, or unstopped track produces a user-visible
// browser recording-indicator that does not go away. The factory's
// teardown sequence is the architectural floor of T-387 (AC #18-#23).
//
// CRITICAL — D-T387-9 + AC #16, #24: telemetry NEVER carries transcript text
// body. Only `textLength` integers per privacy posture.
//
// Browser-safe: React 19 + DOM. No Node imports.

import { type VoiceClipProps, voiceClipPropsSchema } from '@stageflip/schema';
import { createElement, useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';

import type { ClipFactory, MountContext } from '../../contract.js';
import {
  MediaGraph,
  type MediaGraphBrowserApi,
  defaultMediaGraphBrowserApi,
} from './media-graph.js';
import {
  type TranscriptionProvider,
  WebSpeechApiTranscriptionProvider,
} from './transcription-provider.js';
import type {
  TranscriptEvent,
  TranscriptHandler,
  VoiceClipMountHandle,
  VoiceMountFailureReason,
} from './types.js';

/**
 * Browser API surface the factory relies on. Extracted so tests can
 * inject fakes for `MediaRecorder` / `AudioContext` / `getUserMedia`
 * without monkey-patching the global `window` / `navigator`.
 */
export interface VoiceClipFactoryBrowserApi {
  /** `navigator.mediaDevices.getUserMedia({audio:true})` adapter. */
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  /** `MediaRecorder` + `AudioContext` constructors and feature-detect. */
  mediaGraph: MediaGraphBrowserApi;
}

/**
 * Caller-injected hooks.
 */
export interface VoiceClipFactoryOptions {
  /** Override the browser API surface — tests inject a complete fake. */
  browser?: VoiceClipFactoryBrowserApi;
  /**
   * Override the transcription provider. Defaults to
   * `WebSpeechApiTranscriptionProvider`. Tests inject
   * `InMemoryTranscriptionProvider`.
   */
  transcriptionProvider?: TranscriptionProvider;
}

interface VoiceMountState {
  reactRoot: Root;
  mediaGraph: MediaGraph | undefined;
  transcriptionStop: (() => void) | undefined;
  handlers: Set<TranscriptHandler>;
  autoStopTimer: ReturnType<typeof setTimeout> | undefined;
  disposed: boolean;
}

/**
 * Convenience namespace for the factory builder. Mirrors the T-384 shape;
 * top-level functions per T-309a's tightening (the determinism sub-rule
 * does not apply to `clips/voice/**` — voice is event-driven, not frame-
 * driven — but we use the same shape for consistency across γ factories).
 */
export const VoiceClipFactoryBuilder = {
  build(options: VoiceClipFactoryOptions = {}): ClipFactory {
    return (ctx: MountContext) => mountVoiceClip(ctx, options);
  },
};

/**
 * Resolve the browser API surface. Defaults to the real `navigator` +
 * `MediaRecorder` + `AudioContext`; tests inject a complete fake.
 */
function resolveBrowserApi(
  options: VoiceClipFactoryOptions,
): VoiceClipFactoryBrowserApi | undefined {
  if (options.browser !== undefined) return options.browser;
  if (typeof navigator === 'undefined') return undefined;
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return undefined;
  }
  const mediaGraph = defaultMediaGraphBrowserApi();
  if (mediaGraph === undefined) return undefined;
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    mediaGraph,
  };
}

/**
 * Mount routine. Top-level function — voice lives outside the shader sub-
 * rule scope, so this file's structural shape is purely for consistency.
 */
async function mountVoiceClip(
  ctx: MountContext,
  options: VoiceClipFactoryOptions,
): Promise<VoiceClipMountHandle> {
  const family = ctx.clip.family;

  // 1. Parse + narrow `liveMount.props`.
  const propsResult = voiceClipPropsSchema.safeParse(ctx.clip.liveMount.props);
  if (!propsResult.success) {
    ctx.emitTelemetry('voice-clip.mount.failure', {
      family,
      reason: 'invalid-props' satisfies VoiceMountFailureReason,
      issues: propsResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    throw new Error(
      `voiceClipFactory: liveMount.props failed voiceClipPropsSchema — ${propsResult.error.message}`,
    );
  }
  const props: VoiceClipProps = propsResult.data;

  // 2. Resolve browser APIs. happy-dom does not provide MediaRecorder /
  //    AudioContext — tests always inject a fake browser surface.
  const browser = resolveBrowserApi(options);
  if (browser === undefined) {
    ctx.emitTelemetry('voice-clip.mount.failure', {
      family,
      reason: 'web-audio-unavailable' satisfies VoiceMountFailureReason,
    });
    throw new Error('voiceClipFactory: Web Audio / MediaRecorder unavailable in this environment.');
  }

  // 3. MIME-type pre-flight (D-T387-2 + AC #10). The configured MIME
  //    must be supported by the active browser; failure is reported via
  //    mount.failure with reason 'media-recorder-unsupported-mime'.
  if (!browser.mediaGraph.isMimeTypeSupported(props.mimeType)) {
    ctx.emitTelemetry('voice-clip.mount.failure', {
      family,
      reason: 'media-recorder-unsupported-mime' satisfies VoiceMountFailureReason,
      mimeType: props.mimeType,
    });
    throw new Error(
      `voiceClipFactory: MIME type '${props.mimeType}' is not supported by MediaRecorder on this browser.`,
    );
  }

  // 4. Telemetry — mount.start. NOTE: text body never appears in
  //    telemetry attributes (privacy posture, AC #16 + #24).
  ctx.emitTelemetry('voice-clip.mount.start', {
    family,
    language: props.language,
    partialTranscripts: props.partialTranscripts,
  });

  // 5. Resolve transcription provider. Default is Web Speech API; tests
  //    inject an in-memory provider.
  const transcriptionProvider: TranscriptionProvider =
    options.transcriptionProvider ?? new WebSpeechApiTranscriptionProvider();

  // 6. Build the React root + initial render. The mount handle drives
  //    the recording lifecycle from outside React; React owns only the
  //    visual surface (button, level-meter canvas, transcript live region).
  const state: VoiceMountState = {
    reactRoot: createRoot(ctx.root),
    mediaGraph: undefined,
    transcriptionStop: undefined,
    handlers: new Set(),
    autoStopTimer: undefined,
    disposed: false,
  };
  flushSync(() => {
    state.reactRoot.render(createElement(VoiceClipMount, {}));
  });

  // Telemetry — mount.success.
  ctx.emitTelemetry('voice-clip.mount.success', { family });

  // ----- private helpers -----

  /** Dispatch one transcript event to every subscriber + emit telemetry. */
  const dispatchTranscript = (event: TranscriptEvent): void => {
    if (event.kind === 'partial') {
      ctx.emitTelemetry('voice-clip.transcript.partial', {
        family,
        textLength: event.text.length,
      });
    } else if (event.kind === 'final') {
      ctx.emitTelemetry('voice-clip.transcript.final', {
        family,
        textLength: event.text.length,
      });
    }
    // 'error' events do not produce a transcript-text telemetry entry.
    for (const handler of state.handlers) {
      try {
        handler(event);
      } catch {
        /* swallow — one handler's throw must not break siblings */
      }
    }
  };

  const startRecording = async (): Promise<void> => {
    if (state.disposed) return;
    if (state.mediaGraph !== undefined) {
      // Already recording — second start is a no-op.
      return;
    }
    // Acquire the microphone stream. The permission shim has already
    // vetted; we re-acquire our OWN stream per shim contract (the shim's
    // probe stream was stopped immediately after permission grant).
    const stream = await browser.getUserMedia({ audio: true });

    const mediaGraph = new MediaGraph({
      stream,
      mimeType: props.mimeType,
      browser: browser.mediaGraph,
    });
    state.mediaGraph = mediaGraph;
    mediaGraph.startRecording();

    ctx.emitTelemetry('voice-clip.recording.started', {
      family,
      mimeType: props.mimeType,
    });

    // Start transcription.
    try {
      const handle = await transcriptionProvider.start({
        stream,
        language: props.language,
        partial: props.partialTranscripts,
        onTranscript: dispatchTranscript,
      });
      if (state.disposed) {
        // Disposed while transcription was starting — tear it down now.
        handle.stop();
        return;
      }
      state.transcriptionStop = handle.stop;
    } catch (err) {
      // Surface as mount.failure — transcription seam is required for the
      // clip's primary function. Tear down the partial graph.
      const isWebSpeech = err instanceof Error && err.name === 'WebSpeechApiUnavailableError';
      ctx.emitTelemetry('voice-clip.mount.failure', {
        family,
        reason: (isWebSpeech
          ? 'web-speech-unavailable'
          : 'web-speech-unavailable') satisfies VoiceMountFailureReason,
      });
      mediaGraph.dispose();
      state.mediaGraph = undefined;
      throw err;
    }

    // Auto-stop timer (D-T387-2 + AC #12).
    state.autoStopTimer = setTimeout(() => {
      void stopRecording();
    }, props.maxDurationMs);
  };

  const stopRecording = async (): Promise<void> => {
    if (state.autoStopTimer !== undefined) {
      clearTimeout(state.autoStopTimer);
      state.autoStopTimer = undefined;
    }
    const graph = state.mediaGraph;
    if (graph === undefined) return;
    const durationMs = graph.stopRecording();
    // Stop transcription FIRST so no stray events surface after the
    // recording.stopped telemetry.
    if (state.transcriptionStop !== undefined) {
      try {
        state.transcriptionStop();
      } catch {
        /* defensive */
      }
      state.transcriptionStop = undefined;
    }
    // Now tear down the graph (stops tracks, disconnects analyser, closes
    // the AudioContext). Set to undefined first so a re-entry cannot
    // double-dispose.
    state.mediaGraph = undefined;
    graph.dispose();
    ctx.emitTelemetry('voice-clip.recording.stopped', {
      family,
      durationMs,
    });
  };

  const dispose = (): void => {
    if (state.disposed) return;
    state.disposed = true;
    if (state.autoStopTimer !== undefined) {
      clearTimeout(state.autoStopTimer);
      state.autoStopTimer = undefined;
    }
    if (state.transcriptionStop !== undefined) {
      try {
        state.transcriptionStop();
      } catch {
        /* defensive */
      }
      state.transcriptionStop = undefined;
    }
    if (state.mediaGraph !== undefined) {
      const graph = state.mediaGraph;
      state.mediaGraph = undefined;
      graph.dispose();
    }
    state.handlers.clear();
    state.reactRoot.unmount();
    ctx.emitTelemetry('voice-clip.dispose', { family });
  };

  return {
    updateProps: () => {
      // Voice clip props are mount-time configuration; runtime updates
      // are out-of-scope for T-387. No-op.
    },
    dispose,
    startRecording,
    stopRecording,
    onTranscript: (handler: TranscriptHandler) => {
      state.handlers.add(handler);
      return () => {
        state.handlers.delete(handler);
      };
    },
  };
}

/**
 * Minimal React tree for the voice clip's visual surface. Per CLAUDE.md
 * §10, no English UI strings ship in the package — host apps style and
 * label via `data-*` attributes the surface exposes.
 */
function VoiceClipMount(): ReturnType<typeof createElement> {
  // Local recording-state mirror for visual polish only (button label
  // selector via data-recording attribute). The mount handle owns the
  // actual recording state; this is a passive mirror.
  const [isRecording] = useState(false);
  const noopClick = useCallback(() => {
    /* host wires up via the MountHandle's startRecording / stopRecording */
  }, []);
  // useEffect intentionally empty — no global side-effects from the
  // visual layer; the factory's mount routine owns lifecycle.
  useEffect(() => {
    /* no-op */
  }, []);

  return createElement(
    'div',
    { 'data-stageflip-voice-clip': 'true' },
    createElement('button', {
      type: 'button',
      'data-action': 'record',
      'data-recording': isRecording ? 'true' : 'false',
      onClick: noopClick,
    }),
    createElement('canvas', { 'data-role': 'level-meter' }),
    createElement('output', { 'data-role': 'transcript-live' }),
  );
}

/**
 * The default factory instance — no options, real browser surface. The
 * `clips/voice/index.ts` subpath registers this against
 * `interactiveClipRegistry` at import time.
 */
export const voiceClipFactory: ClipFactory = VoiceClipFactoryBuilder.build();
