// packages/runtimes/frame-runtime-bridge/src/clips/comparison-table.tsx
// T-131b.3 port of reference/slidemotion/.../clips/comparison-table.tsx.
// Two-column comparison with staggered row reveal — rows slide in from their
// respective sides.

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const EASE = cubicBezier(0.16, 1, 0.3, 1);

export const comparisonTablePropsSchema = z
  .object({
    leftHeading: z.string().optional(),
    rightHeading: z.string().optional(),
    leftColor: z.string().optional(),
    rightColor: z.string().optional(),
    leftRows: z.array(z.string()).optional(),
    rightRows: z.array(z.string()).optional(),
    title: z.string().optional(),
    background: z.string().optional(),
    textColor: z.string().optional(),
  })
  .strict();

export type ComparisonTableProps = z.infer<typeof comparisonTablePropsSchema>;

function Row({
  text,
  index,
  side,
  accent,
  textColor,
  frame,
  fps,
}: {
  text: string;
  index: number;
  side: 'left' | 'right';
  accent: string;
  textColor: string;
  frame: number;
  fps: number;
}): ReactElement {
  const rowStartFrame = Math.ceil(fps * 0.25);
  const rowStagger = Math.ceil(fps * 0.12);
  const rowDuration = Math.ceil(fps * 0.5);
  const delay = rowStartFrame + index * rowStagger;
  const rOpacity = interpolate(frame, [delay, delay + rowDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  const fromX = side === 'left' ? -60 : 60;
  const rX = interpolate(frame, [delay, delay + rowDuration], [fromX, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  return (
    <div
      data-testid={`comparison-row-${side}-${index}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.03)',
        opacity: rOpacity,
        transform: `translateX(${rX}px)`,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 9999,
          backgroundColor: accent,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 24,
          fontWeight: 500,
          color: textColor,
          lineHeight: 1.4,
        }}
      >
        {text}
      </span>
    </div>
  );
}

export function ComparisonTable({
  leftHeading = 'Option A',
  rightHeading = 'Option B',
  leftColor = '#81aeff',
  rightColor = '#5af8fb',
  leftRows = ['Feature one', 'Feature two', 'Feature three'],
  rightRows = ['Feature one', 'Feature two', 'Feature three'],
  title,
  background = '#ffffff',
  textColor = '#1a1a2e',
}: ComparisonTableProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  const headingY = interpolate(frame, [0, fps * 0.4], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });

  return (
    <div
      data-testid="comparison-table-clip"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        display: 'flex',
        flexDirection: 'column',
        padding: '6% 8%',
        boxSizing: 'border-box',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          data-testid="comparison-table-title"
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: textColor,
            marginBottom: 32,
            opacity: headingOpacity,
            transform: `translateY(${headingY}px)`,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 40,
          flex: 1,
          alignContent: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            data-testid="comparison-heading-left"
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: leftColor,
              paddingBottom: 12,
              borderBottom: `3px solid ${leftColor}`,
              opacity: headingOpacity,
              transform: `translateY(${headingY}px)`,
              letterSpacing: '-0.005em',
            }}
          >
            {leftHeading}
          </div>
          {leftRows.map((t, i) => (
            <Row
              // biome-ignore lint/suspicious/noArrayIndexKey: positional row data.
              key={i}
              text={t}
              index={i}
              side="left"
              accent={leftColor}
              textColor={textColor}
              frame={frame}
              fps={fps}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            data-testid="comparison-heading-right"
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: rightColor,
              paddingBottom: 12,
              borderBottom: `3px solid ${rightColor}`,
              opacity: headingOpacity,
              transform: `translateY(${headingY}px)`,
              letterSpacing: '-0.005em',
            }}
          >
            {rightHeading}
          </div>
          {rightRows.map((t, i) => (
            <Row
              // biome-ignore lint/suspicious/noArrayIndexKey: positional row data.
              key={i}
              text={t}
              index={i}
              side="right"
              accent={rightColor}
              textColor={textColor}
              frame={frame}
              fps={fps}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const comparisonTableClip: ClipDefinition<unknown> = defineFrameClip<ComparisonTableProps>({
  kind: 'comparison-table',
  component: ComparisonTable,
  propsSchema: comparisonTablePropsSchema,
  themeSlots: {
    leftColor: { kind: 'palette', role: 'primary' },
    rightColor: { kind: 'palette', role: 'accent' },
    textColor: { kind: 'palette', role: 'foreground' },
    background: { kind: 'palette', role: 'surface' },
  },
  // Headings render at weight 700; row text renders at weight 500 — list
  // both so the T-072 FontManager preloads each face.
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 500 },
    { family: 'Plus Jakarta Sans', weight: 700 },
  ],
});
