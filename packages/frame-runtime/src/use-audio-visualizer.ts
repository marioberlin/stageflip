// packages/frame-runtime/src/use-audio-visualizer.ts
// useAudioVisualizer — wires an HTMLMediaElement through a Web Audio
// AnalyserNode and exposes per-frame frequency + waveform data.
//
// Not determinism-clean by design. The hook reads the AnalyserNode during
// render, which is a wall-clock-driven side effect; output depends on how
// much audio the browser has actually decoded. This is editor / preview
// code only. Deterministic export paths (Phase 4 CDP renderer) must read
// pre-rendered audio samples via a different code path, not this hook.
//
// Lazy-loaded in the Web-Audio sense: `AudioContext` creation is deferred
// until mount (browsers disallow AudioContext creation before user gesture,
// so no ctor runs at module-load time). The `audioContextFactory` option
// is the seam for tests and for environments where a custom context is
// already in play.

import { type RefObject, useEffect, useRef } from 'react';

import { useCurrentFrame } from './frame-context.js';

export interface AudioVisualizerOptions {
  /** AnalyserNode.fftSize. Power of two in [32, 32768]. Default 256. */
  fftSize?: number;
  /** AnalyserNode.smoothingTimeConstant. Float in [0, 1]. Default 0.8. */
  smoothingTimeConstant?: number;
  /** Factory for the AudioContext — defaults to `new AudioContext()`. Exposed for tests + custom contexts. */
  audioContextFactory?: () => AudioContext;
}

export interface AudioVisualizerSnapshot {
  /** Byte frequency data (0..255). Length = fftSize / 2. */
  frequency: Uint8Array;
  /** Byte time-domain (waveform) data (0..255, 128 = silence). Length = fftSize. */
  waveform: Uint8Array;
  /** Normalised RMS amplitude 0..1 computed from the waveform. */
  volume: number;
}

interface AudioState {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  frequency: Uint8Array;
  waveform: Uint8Array;
}

/**
 * Hook that exposes Web Audio analyser data for an attached media element.
 * Call once per component; the returned snapshot refreshes on every frame.
 *
 * Not deterministic — see file header. Editor / preview use only.
 */
export function useAudioVisualizer(
  ref: RefObject<HTMLMediaElement | null>,
  options: AudioVisualizerOptions = {},
): AudioVisualizerSnapshot {
  // Read the current frame so the hook re-runs when it advances. The
  // returned snapshot is recomputed from fresh analyser data each render.
  useCurrentFrame();

  const fftSize = options.fftSize ?? 256;
  validateFftSize(fftSize);

  const smoothing = options.smoothingTimeConstant ?? 0.8;
  validateSmoothing(smoothing);

  const stateRef = useRef<AudioState | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;

    const factory = options.audioContextFactory ?? defaultAudioContextFactory;
    const context = factory();
    const source = context.createMediaElementSource(el);
    const analyser = context.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothing;
    source.connect(analyser);
    analyser.connect(context.destination);

    stateRef.current = {
      context,
      source,
      analyser,
      frequency: new Uint8Array(analyser.frequencyBinCount),
      waveform: new Uint8Array(analyser.fftSize),
    };

    return () => {
      try {
        source.disconnect();
        analyser.disconnect();
      } finally {
        context.close();
      }
      stateRef.current = null;
    };
  }, [ref, fftSize, smoothing, options.audioContextFactory]);

  const state = stateRef.current;
  if (state === null) {
    return {
      frequency: new Uint8Array(fftSize / 2),
      waveform: new Uint8Array(fftSize),
      volume: 0,
    };
  }

  state.analyser.getByteFrequencyData(state.frequency);
  state.analyser.getByteTimeDomainData(state.waveform);
  const volume = computeRmsVolume(state.waveform);

  return {
    frequency: state.frequency,
    waveform: state.waveform,
    volume,
  };
}

function defaultAudioContextFactory(): AudioContext {
  return new AudioContext();
}

function validateFftSize(fftSize: number): void {
  if (!Number.isInteger(fftSize)) {
    throw new Error(`useAudioVisualizer: fftSize must be an integer (got ${fftSize})`);
  }
  if (fftSize < 32) {
    throw new Error(`useAudioVisualizer: fftSize must be >= 32 (got ${fftSize})`);
  }
  if (fftSize > 32768) {
    throw new Error(`useAudioVisualizer: fftSize must be <= 32768 (got ${fftSize})`);
  }
  // Power of two check: only one bit set.
  if ((fftSize & (fftSize - 1)) !== 0) {
    throw new Error(`useAudioVisualizer: fftSize must be a power of 2 (got ${fftSize})`);
  }
}

function validateSmoothing(smoothing: number): void {
  if (Number.isNaN(smoothing) || smoothing < 0 || smoothing > 1) {
    throw new Error(
      `useAudioVisualizer: smoothingTimeConstant must be in [0, 1] (got ${smoothing})`,
    );
  }
}

function computeRmsVolume(waveform: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < waveform.length; i++) {
    const sample = ((waveform[i] as number) - 128) / 128;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / waveform.length);
  return rms > 1 ? 1 : rms;
}
