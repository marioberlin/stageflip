// apps/dev-harness/src/compositions.tsx
// Demo compositions for the dev harness. Each one exercises a different slice
// of the @stageflip/frame-runtime surface so a human can scrub through and
// confirm the primitives render as expected.

import {
  EASINGS,
  Loop,
  Sequence,
  Series,
  interpolate,
  interpolateColors,
  registerComposition,
  spring,
  useAudioVisualizer,
  useCurrentFrame,
  useMediaSync,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import { useMemo, useRef, useState } from 'react';

const WIDTH = 960;
const HEIGHT = 540;
const FPS = 30;

function Centered({
  children,
  background,
}: {
  children: React.ReactNode;
  background: string;
}): React.ReactElement {
  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#fff',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
}

/** Fade + color-shift title. Exercises `interpolate` + `interpolateColors`. */
function FadeTitle({ label }: { label: string }): React.ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
    easing: EASINGS['ease-out'],
  });
  const color = interpolateColors(frame, [0, durationInFrames], ['#ff0080', '#00d4ff']);
  return (
    <Centered background="#0b0f14">
      <h1 style={{ fontSize: 96, margin: 0, opacity, color, letterSpacing: '-0.04em' }}>{label}</h1>
    </Centered>
  );
}

/** Spring-driven scale. Exercises `spring`. */
function BouncingBall(): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, from: 0.3, to: 1, damping: 8 });
  return (
    <Centered background="#140b14">
      <div
        style={{
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'radial-gradient(#ffd5f0, #ff0080)',
          transform: `scale(${scale})`,
          boxShadow: '0 20px 60px rgba(255, 0, 128, 0.35)',
        }}
      />
    </Centered>
  );
}

/** Three-phase Series: fade / spring / loop. Exercises Sequence + Series + Loop. */
function SeriesDemo(): React.ReactElement {
  return (
    <Series>
      <Series.Sequence durationInFrames={60}>
        <FadeTitle label="fade" />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60}>
        <BouncingBall />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60}>
        <Centered background="#0b1414">
          <Loop durationInFrames={30}>
            <PulseDot />
          </Loop>
        </Centered>
      </Series.Sequence>
    </Series>
  );
}

function PulseDot(): React.ReactElement {
  const frame = useCurrentFrame();
  const radius = interpolate(frame, [0, 15, 30], [40, 120, 40], {
    easing: EASINGS['ease-in-out'],
  });
  return (
    <div
      style={{
        width: radius * 2,
        height: radius * 2,
        borderRadius: '50%',
        background: '#00d4ff',
      }}
    />
  );
}

/** Nested Sequence: demo of mount gate + frame remap. */
function SequenceDemo(): React.ReactElement {
  return (
    <Centered background="#0b140b">
      <Sequence from={15} durationInFrames={60}>
        <FadeTitle label="sequence" />
      </Sequence>
    </Centered>
  );
}

/**
 * Instrumentation view of useMediaSync + useAudioVisualizer. Mounts a hidden
 * `<audio>` element with a generated sine-wave WAV (so the demo is offline /
 * deterministic), and prints the live hook outputs on the canvas. Click
 * "start audio" to unlock the AudioContext and get bouncing visualizer bars;
 * the useMediaSync readouts update regardless.
 */
function MediaHooksDemo(): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sineUrl = useMemo(makeSineWaveUrl, []);
  const [playing, setPlaying] = useState(false);

  useMediaSync(audioRef, { offsetMs: 0, durationMs: 3000 });
  const snap = useAudioVisualizer(audioRef, { fftSize: 128 });

  const currentMs = (frame / fps) * 1000;
  const targetSec = currentMs / 1000;
  const currentTime = audioRef.current?.currentTime ?? 0;
  const drift = Math.abs(currentTime - targetSec);

  const onToggle = (): void => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {
        /* autoplay policy — user feedback below */
      });
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <Centered background="#0b1014">
      {/* Hidden media element driven imperatively by the hooks. */}
      {/* biome-ignore lint/a11y/useMediaCaption: demo harness, no captions */}
      <audio ref={audioRef} src={sineUrl} loop style={{ display: 'none' }} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 32,
          padding: 32,
          width: '100%',
          fontFamily: '"JetBrains Mono", ui-monospace, SF Mono, Menlo, monospace',
          fontSize: 16,
        }}
      >
        <section>
          <h2 style={{ margin: 0, fontSize: 14, opacity: 0.6 }}>useMediaSync</h2>
          <dl style={demoRowStyle}>
            <dt>frame</dt>
            <dd>{frame}</dd>
            <dt>target (s)</dt>
            <dd>{targetSec.toFixed(3)}</dd>
            <dt>currentTime (s)</dt>
            <dd>{currentTime.toFixed(3)}</dd>
            <dt>drift (s)</dt>
            <dd>{drift.toFixed(4)}</dd>
            <dt>paused</dt>
            <dd>{String(audioRef.current?.paused ?? true)}</dd>
          </dl>
        </section>

        <section>
          <h2 style={{ margin: 0, fontSize: 14, opacity: 0.6 }}>useAudioVisualizer</h2>
          <dl style={demoRowStyle}>
            <dt>volume</dt>
            <dd>{snap.volume.toFixed(3)}</dd>
            <dt>bins</dt>
            <dd>{snap.frequency.length}</dd>
            <dt>samples</dt>
            <dd>{snap.waveform.length}</dd>
          </dl>
          <VisualizerBars snapshot={snap} />
        </section>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12 }}>
          <button type="button" onClick={onToggle} style={demoButtonStyle}>
            {playing ? 'pause audio' : 'start audio'}
          </button>
          <span style={{ alignSelf: 'center', fontSize: 12, opacity: 0.5 }}>
            playback unlocks the AnalyserNode; without it bars stay flat (all 128s).
          </span>
        </div>
      </div>
    </Centered>
  );
}

function VisualizerBars({
  snapshot,
}: {
  snapshot: { frequency: Uint8Array };
}): React.ReactElement {
  const bars: React.ReactElement[] = [];
  for (let i = 0; i < snapshot.frequency.length; i++) {
    const v = (snapshot.frequency[i] as number) / 255;
    bars.push(
      <div
        key={i}
        style={{
          flex: 1,
          height: `${v * 100}%`,
          background: '#00d4ff',
          minHeight: 1,
          alignSelf: 'end',
        }}
      />,
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        height: 80,
        marginTop: 12,
        background: '#14181e',
        padding: 6,
      }}
    >
      {bars}
    </div>
  );
}

const demoRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: 16,
  rowGap: 4,
  marginTop: 12,
  fontVariantNumeric: 'tabular-nums',
};

const demoButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: '#14181e',
  color: '#e7eaee',
  fontFamily: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
};

/**
 * Generate a 3-second 440 Hz sine wave WAV file and return a blob URL.
 * Kept offline so the harness doesn't depend on network assets. Called once
 * at mount via useMemo — the URL survives composition re-renders.
 */
function makeSineWaveUrl(): string {
  const sampleRate = 8000;
  const durationSec = 3;
  const freqHz = 440;
  const numSamples = sampleRate * durationSec;
  const byteLength = 44 + numSamples * 2;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  // WAV header (canonical 16-bit PCM mono).
  writeString(0, 'RIFF');
  view.setUint32(4, byteLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format = 1 (PCM)
  view.setUint16(22, 1, true); // channels = 1
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freqHz * t) * 0.4;
    const intSample = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    view.setInt16(44 + i * 2, intSample, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/** All the demo ids, in display order. */
export const DEMO_IDS = [
  'fade-title',
  'bouncing-ball',
  'series-demo',
  'sequence-demo',
  'media-hooks',
] as const;

export type DemoId = (typeof DEMO_IDS)[number];

export function registerDemoCompositions(): void {
  registerComposition<{ label: string }>({
    id: 'fade-title',
    component: FadeTitle,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    durationInFrames: 120,
    defaultProps: { label: 'stageflip' },
  });

  registerComposition({
    id: 'bouncing-ball',
    component: BouncingBall,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    durationInFrames: 90,
  });

  registerComposition({
    id: 'series-demo',
    component: SeriesDemo,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    durationInFrames: 180,
  });

  registerComposition({
    id: 'sequence-demo',
    component: SequenceDemo,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    durationInFrames: 120,
  });

  registerComposition({
    id: 'media-hooks',
    component: MediaHooksDemo,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    durationInFrames: 90,
  });
}
