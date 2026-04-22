// packages/runtimes/frame-runtime-bridge/src/clips/subtitle-overlay.tsx
// T-131b.2 port of reference/slidemotion/.../clips/subtitle-overlay.tsx.
// Karaoke-style word-by-word subtitle with active/past highlighting.

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const wordTimingSchema = z
  .object({
    text: z.string(),
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
  })
  .strict();

export const subtitleOverlayPropsSchema = z
  .object({
    words: z.array(wordTimingSchema).optional(),
    text: z.string().optional(),
    color: z.string().optional(),
    activeColor: z.string().optional(),
    background: z.string().optional(),
    fontSize: z.number().positive().optional(),
    position: z.enum(['top', 'center', 'bottom']).optional(),
  })
  .strict();

export type SubtitleOverlayProps = z.infer<typeof subtitleOverlayPropsSchema>;

const WORDS_PER_LINE = 8;
const FADE_IN_FRAMES = 10;
const DEFAULT_TEXT = 'The quick brown fox jumps over the lazy dog';

export function SubtitleOverlay({
  words: wordsProp,
  text = DEFAULT_TEXT,
  color = '#ffffff80',
  activeColor = '#0c1116',
  background = 'transparent',
  fontSize = 48,
  position = 'bottom',
}: SubtitleOverlayProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const words =
    wordsProp ??
    (() => {
      const split = text.split(/\s+/).filter((w) => w.length > 0);
      const totalMs = (durationInFrames / fps) * 1000;
      const per = split.length === 0 ? totalMs : totalMs / split.length;
      return split.map((w, i) => ({
        text: w,
        startMs: i * per,
        endMs: (i + 1) * per,
      }));
    })();

  const lines: (typeof words)[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
    lines.push(words.slice(i, i + WORDS_PER_LINE));
  }

  // Find the line containing the currently-active word. When no word is
  // active (between words OR after the last word ended), hold the most
  // recently started line — never snap back to line 0 in the tail of the
  // composition. `findLastIndex` would be cleaner but is ES2023; the manual
  // reverse loop keeps us on ES2022.
  const activeIdx = lines.findIndex((line) =>
    line.some((w) => currentTimeMs >= w.startMs && currentTimeMs < w.endMs),
  );
  let currentLineIndex = 0;
  if (activeIdx >= 0) {
    currentLineIndex = activeIdx;
  } else {
    for (let li = lines.length - 1; li >= 0; li--) {
      const line = lines[li];
      const firstWord = line?.[0];
      if (firstWord !== undefined && currentTimeMs >= firstWord.startMs) {
        currentLineIndex = li;
        break;
      }
    }
  }
  const currentLine = lines[currentLineIndex] ?? lines[0] ?? [];

  const positionStyle: CSSProperties =
    position === 'top'
      ? { top: 80 }
      : position === 'center'
        ? { top: '50%', transform: 'translateY(-50%)' }
        : { bottom: 80 };

  const opacity = interpolate(frame, [0, FADE_IN_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      data-testid="subtitle-overlay-clip"
      style={{ width: '100%', height: '100%', backgroundColor: background, position: 'relative' }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          ...positionStyle,
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '0.25em',
          padding: '0 10%',
          opacity,
        }}
      >
        {currentLine.map((word, i) => {
          const isActive = currentTimeMs >= word.startMs && currentTimeMs < word.endMs;
          const isPast = currentTimeMs >= word.endMs;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: currentLine is positional within currentLineIndex; pair (line, slot) is the stable identity for the same word across the active line's lifetime.
              key={`${currentLineIndex}-${i}`}
              data-testid={isActive ? 'subtitle-active-word' : undefined}
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize,
                fontWeight: 800,
                color: isActive || isPast ? activeColor : color,
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                display: 'inline-block',
                whiteSpace: 'pre',
                textShadow: isActive ? '0 0 30px rgba(129,174,255,0.5)' : 'none',
              }}
            >
              {word.text}{' '}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const subtitleOverlayClip: ClipDefinition<unknown> = defineFrameClip<SubtitleOverlayProps>({
  kind: 'subtitle-overlay',
  component: SubtitleOverlay,
  propsSchema: subtitleOverlayPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'foreground' },
    activeColor: { kind: 'palette', role: 'background' },
    background: { kind: 'palette', role: 'surface' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 800 }],
});
