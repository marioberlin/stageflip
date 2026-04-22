// packages/runtimes/frame-runtime-bridge/src/clips/pull-quote.tsx
// T-131b.3 port of reference/slidemotion/.../clips/pull-quote.tsx.
// Oversized quote mark (spring-scaled) + typewriter quote body + attribution
// that slides in after the type completes.

import {
  cubicBezier,
  interpolate,
  linear,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const EASE = cubicBezier(0.16, 1, 0.3, 1);

export const pullQuotePropsSchema = z
  .object({
    // `.min(1)` so an empty-string quote is rejected at validation time.
    // Without it, the typewriter renders zero chars forever and the
    // attribution slides in at frame 0 (visually broken).
    quote: z.string().min(1).optional(),
    attributionName: z.string().optional(),
    attributionTitle: z.string().optional(),
    accentColor: z.string().optional(),
    textColor: z.string().optional(),
    background: z.string().optional(),
    fontSize: z.number().positive().optional(),
  })
  .strict();

export type PullQuoteProps = z.infer<typeof pullQuotePropsSchema>;

export function PullQuote({
  quote = 'This product changed the way our team works every single day.',
  attributionName = 'Jane Doe',
  attributionTitle = 'VP of Product, Acme Co.',
  accentColor = '#81aeff',
  textColor = '#1a1a2e',
  background = '#ffffff',
  fontSize = 56,
}: PullQuoteProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const markScale = spring({
    frame,
    fps,
    damping: 12,
    mass: 0.8,
    stiffness: 200,
  });
  const markOpacity = interpolate(frame, [0, fps * 0.4], [0, 0.18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });

  const quoteStart = Math.ceil(fps * 0.3);
  const quoteEnd = Math.max(quoteStart + 1, durationInFrames - Math.ceil(fps * 0.8));
  const charsToShow = Math.floor(
    interpolate(frame, [quoteStart, quoteEnd], [0, quote.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: linear,
    }),
  );

  const typingDone = charsToShow >= quote.length;
  const caretPeriod = Math.max(1, Math.round(fps * 0.5));
  const caretOn = Math.round(fps * 0.3);
  const showCaret = !typingDone && frame % caretPeriod < caretOn;

  const attrStart = quoteEnd;
  const attrOpacity = interpolate(frame, [attrStart, attrStart + fps * 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  const attrY = interpolate(frame, [attrStart, attrStart + fps * 0.5], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });

  return (
    <div
      data-testid="pull-quote-clip"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8% 10%',
        boxSizing: 'border-box',
        position: 'relative',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}
    >
      <div
        data-testid="pull-quote-mark"
        style={{
          position: 'absolute',
          top: '4%',
          left: '6%',
          fontSize: 320,
          lineHeight: 1,
          color: accentColor,
          opacity: markOpacity,
          transform: `scale(${markScale})`,
          transformOrigin: 'top left',
          fontWeight: 800,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        &ldquo;
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 32,
          maxWidth: '80%',
          zIndex: 1,
        }}
      >
        <div
          data-testid="pull-quote-body"
          style={{
            fontSize,
            fontWeight: 700,
            color: textColor,
            lineHeight: 1.25,
            letterSpacing: '-0.015em',
          }}
        >
          {quote.slice(0, charsToShow)}
          <span
            data-testid="pull-quote-caret"
            style={{
              opacity: showCaret ? 1 : 0,
              color: accentColor,
              marginLeft: 2,
            }}
          >
            |
          </span>
        </div>

        <div
          data-testid="pull-quote-attribution"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            opacity: attrOpacity,
            transform: `translateY(${attrY}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 32,
                height: 3,
                backgroundColor: accentColor,
                borderRadius: 9999,
              }}
            />
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: textColor,
                letterSpacing: '-0.005em',
              }}
            >
              {attributionName}
            </span>
          </div>
          <span
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: textColor,
              opacity: 0.6,
              marginLeft: 44,
            }}
          >
            {attributionTitle}
          </span>
        </div>
      </div>
    </div>
  );
}

export const pullQuoteClip: ClipDefinition<unknown> = defineFrameClip<PullQuoteProps>({
  kind: 'pull-quote',
  component: PullQuote,
  propsSchema: pullQuotePropsSchema,
  themeSlots: {
    accentColor: { kind: 'palette', role: 'primary' },
    textColor: { kind: 'palette', role: 'foreground' },
    background: { kind: 'palette', role: 'surface' },
  },
  // Quote body uses 700, attribution-title uses 500, mark uses 800 — list
  // all three so the T-072 FontManager preloads each face.
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 500 },
    { family: 'Plus Jakarta Sans', weight: 700 },
    { family: 'Plus Jakarta Sans', weight: 800 },
  ],
});
