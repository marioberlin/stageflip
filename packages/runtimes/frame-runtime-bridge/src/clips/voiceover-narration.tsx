// packages/runtimes/frame-runtime-bridge/src/clips/voiceover-narration.tsx
// T-131e.2 port of reference/slidemotion/.../clips/voiceover-narration.tsx.
// Text + SVG-waveform visualization of timed narration segments. The
// reference clip is purely visual (no <Audio> import); this port adds
// an optional `audioUrl` prop that mounts a hidden <FrameAudio> so
// production decks get playback-clock-synced voiceover through the
// frame-runtime media-host (T-131e.0). Pass `audioUrl` when the deck
// embeds a real narration track; otherwise the clip degrades to a pure
// text-viz preview.

import { FrameAudio, interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const narrationSegmentSchema = z
  .object({
    text: z.string(),
    startMs: z.number(),
    endMs: z.number(),
  })
  .strict();

export type NarrationSegment = z.infer<typeof narrationSegmentSchema>;

export const voiceoverNarrationPropsSchema = z
  .object({
    segments: z.array(narrationSegmentSchema).optional(),
    text: z.string().optional(),
    speaker: z.string().optional(),
    title: z.string().optional(),
    audioUrl: z.string().optional(),
    color: z.string().optional(),
    background: z.string().optional(),
    textColor: z.string().optional(),
    showWaveform: z.boolean().optional(),
  })
  .strict();

export type VoiceoverNarrationProps = z.infer<typeof voiceoverNarrationPropsSchema>;

const WAVEFORM_BARS = 40;
const DEFAULT_TEXT = 'Welcome to our presentation. Today we will cover the key insights from Q4.';

function autoSegmentText(text: string, totalMs: number): NarrationSegment[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const segDuration = totalMs / sentences.length;
  return sentences.map((s, i) => ({
    text: s.trim(),
    startMs: i * segDuration,
    endMs: (i + 1) * segDuration,
  }));
}

export function VoiceoverNarration({
  segments: segmentsProp,
  text = DEFAULT_TEXT,
  speaker = 'Narrator',
  title,
  audioUrl,
  color = '#0072e5',
  background = '#080f15',
  textColor = '#ebf1fa',
  showWaveform = true,
}: VoiceoverNarrationProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;
  const totalMs = (durationInFrames / fps) * 1000;

  const segments = segmentsProp ?? autoSegmentText(text, totalMs);
  const activeIndex = segments.findIndex(
    (s) => currentTimeMs >= s.startMs && currentTimeMs < s.endMs,
  );
  const safeIndex = Math.max(0, activeIndex);
  const activeSegment = segments[safeIndex];
  const segmentProgress =
    activeSegment !== undefined && activeSegment.endMs !== activeSegment.startMs
      ? (currentTimeMs - activeSegment.startMs) / (activeSegment.endMs - activeSegment.startMs)
      : 0;
  const clampedProgress = Math.max(0, Math.min(1, segmentProgress));
  // Past the last segment's endMs, findIndex returns -1 and safeIndex
  // collapses to 0 — which would make the progress bar read near-zero
  // at the composition tail. Detect that explicitly and snap to 100%.
  const lastEndMs = segments[segments.length - 1]?.endMs ?? 0;
  const past = activeIndex === -1 && segments.length > 0 && currentTimeMs >= lastEndMs;
  const progressRatio = past
    ? 100
    : ((safeIndex + clampedProgress) / Math.max(1, segments.length)) * 100;

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const t = frame / fps;

  return (
    <div
      data-testid="voiceover-narration"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 120px',
        opacity: fadeIn,
        position: 'relative',
      }}
    >
      {audioUrl !== undefined ? <FrameAudio src={audioUrl} /> : null}

      {title !== undefined ? (
        <div
          data-testid="voiceover-narration-title"
          style={{
            position: 'absolute',
            top: 50,
            left: 120,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: textColor,
          }}
        >
          {title}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 48 }}>
        <div
          data-testid="voiceover-narration-avatar"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: `${color}20`,
            border: `2px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 24,
            fontWeight: 700,
            color,
          }}
        >
          {(speaker[0] ?? '').toUpperCase()}
        </div>

        <div>
          <div
            data-testid="voiceover-narration-speaker"
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 18,
              fontWeight: 600,
              color: textColor,
            }}
          >
            {speaker}
          </div>
          <div
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 12,
              color,
              opacity: 0.8,
            }}
          >
            Speaking...
          </div>
        </div>
      </div>

      {showWaveform ? (
        <div
          data-testid="voiceover-narration-waveform"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            height: 40,
            marginBottom: 40,
          }}
        >
          {Array.from({ length: WAVEFORM_BARS }, (_, i) => {
            const amplitude =
              activeIndex >= 0 ? 0.3 + Math.abs(Math.sin(t * 4.5 + i * 0.5)) * 0.7 : 0.15;
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length deterministic bar grid — index is the identity.
                key={i}
                style={{
                  width: 4,
                  height: `${amplitude * 100}%`,
                  backgroundColor: color,
                  borderRadius: 2,
                  opacity: 0.4 + amplitude * 0.6,
                }}
              />
            );
          })}
        </div>
      ) : null}

      <div
        data-testid="voiceover-narration-text"
        style={{
          maxWidth: 900,
          textAlign: 'center',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 36,
          fontWeight: 600,
          color: textColor,
          lineHeight: 1.6,
        }}
      >
        {activeSegment?.text ?? ''}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 50,
          width: '60%',
          height: 3,
          backgroundColor: '#151c23',
          borderRadius: 2,
        }}
      >
        <div
          data-testid="voiceover-narration-progress-fill"
          style={{
            width: `${progressRatio}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
      </div>

      <div
        data-testid="voiceover-narration-counter"
        style={{
          position: 'absolute',
          bottom: 60,
          right: 120,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 14,
          color: textColor,
          opacity: 0.6,
        }}
      >
        {Math.max(1, safeIndex + 1)} / {Math.max(1, segments.length)}
      </div>
    </div>
  );
}

export const voiceoverNarrationClip: ClipDefinition<unknown> =
  defineFrameClip<VoiceoverNarrationProps>({
    kind: 'voiceover-narration',
    component: VoiceoverNarration,
    propsSchema: voiceoverNarrationPropsSchema,
    themeSlots: {
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
      color: { kind: 'palette', role: 'primary' },
    },
    // Weight 600 — speaker name + narration text. Weight 700 — avatar
    // initial + optional title. Both are always rendered (avatar is
    // unconditional) so the list is static.
    fontRequirements: () => [
      { family: 'Plus Jakarta Sans', weight: 600 },
      { family: 'Plus Jakarta Sans', weight: 700 },
    ],
  });
