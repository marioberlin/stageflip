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
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';

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

/** All the demo ids, in display order. */
export const DEMO_IDS = ['fade-title', 'bouncing-ball', 'series-demo', 'sequence-demo'] as const;

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
}
