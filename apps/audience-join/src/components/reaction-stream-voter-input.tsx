// apps/audience-join/src/components/reaction-stream-voter-input.tsx
// T-470 — Voter UI for the `reaction-stream` clip family. Renders a row
// of emoji buttons (one per `palette` entry). Tapping a button emits a
// `ReactionStreamVote` carrying the matching `emojiId`.
//
// Multi-tap support: voters may tap as many times as they like; there
// is NO client-side disable. Server-side rate-limiting (10 Hz per voter
// per ADR-009 §D3 line 231 override for reaction-stream) bounds spam.
//
// The component is presentation-only — the caller wires the
// `onSubmit` callback to `voterAppClient.submitVote`.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type { ReactionStreamVote } from '@stageflip/audience-contract';
import { type ReactElement, useCallback } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Single palette entry as rendered by the voter button. Matches the
 * shape exported by `@stageflip/schema`'s
 * `reactionStreamClipPropsSchema.palette[i]` (intentionally not imported
 * to avoid a schema-package dep from the voter app).
 */
export interface ReactionStreamPaletteEntry {
  readonly emojiId: string;
  readonly glyph: string;
}

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`ReactionStreamVoterInput`) which adapts the
 * dispatcher's narrower `VoterInputProps` to this domain shape;
 * production wiring derives the prompt + palette from the first
 * aggregation snapshot (or from the live-mount props).
 */
export interface ReactionStreamVoterInputDomainProps {
  /** Question text shown above the emoji-button row. */
  readonly prompt: string;
  /** Voter-facing emoji palette. 1..12 entries. */
  readonly palette: readonly ReactionStreamPaletteEntry[];
  /** Tap callback — invoked once per tap with the emojiId. */
  readonly onSubmit: (vote: ReactionStreamVote) => void;
  /** When true, every button is disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

/**
 * Presentational voter UI. The voter sees the prompt + a row of emoji
 * buttons. Tapping a button emits a single `ReactionStreamVote` with
 * the matching `emojiId`. No client-side disable on repeated taps —
 * server-side rate-limit bounds spam (per ADR-009 §D3 override for
 * reaction-stream).
 */
export function ReactionStreamVoterInputDomain(
  props: ReactionStreamVoterInputDomainProps,
): ReactElement {
  const { prompt, palette, onSubmit, disabled = false } = props;

  const handleTap = useCallback(
    (emojiId: string) => {
      if (disabled) return;
      onSubmit({ kind: 'reaction-stream', emojiId });
    },
    [disabled, onSubmit],
  );

  return (
    <section data-testid="voter-input-reaction-stream">
      <p
        data-testid="reaction-stream-voter-prompt"
        style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0' }}
      >
        {prompt}
      </p>
      <div
        data-role="emoji-row"
        data-testid="reaction-stream-voter-row"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center',
        }}
      >
        {palette.map((entry) => (
          <button
            key={entry.emojiId}
            type="button"
            data-testid={`reaction-stream-voter-button-${entry.emojiId}`}
            data-emoji-id={entry.emojiId}
            disabled={disabled}
            onClick={() => handleTap(entry.emojiId)}
            style={{
              fontSize: '32px',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '12px',
              background: disabled ? '#f3f4f6' : '#ffffff',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              minWidth: '64px',
              minHeight: '64px',
            }}
            aria-label={entry.emojiId}
          >
            <span aria-hidden="true">{entry.glyph}</span>
          </button>
        ))}
      </div>
      <p
        data-testid="reaction-stream-voter-status"
        style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}
      >
        {disabled ? 'Voting closed' : 'Tap any emoji — multi-tap allowed'}
      </p>
    </section>
  );
}

/**
 * Dispatcher-shape wrapper. The dispatcher passes only `sessionId` +
 * `clipKind`; T-470 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter that derives the prompt + palette from the
 * live aggregation feed and forwards `onSubmit` to the
 * `voterAppClient.submitVote` channel.
 *
 * For T-470 the wrapper renders a disabled placeholder card with a
 * minimal default palette so the dispatcher resolves the kind to this
 * component (not the unregistered fallback). Tests verify the wrapper
 * carries the session-id + clip-kind data attributes.
 */
export function ReactionStreamVoterInput(props: VoterInputProps): ReactElement {
  const PLACEHOLDER_PALETTE: readonly ReactionStreamPaletteEntry[] = [
    { emojiId: 'heart', glyph: '❤️' },
    { emojiId: 'thumbs-up', glyph: '👍' },
    { emojiId: 'fire', glyph: '🔥' },
  ];
  return (
    <section
      data-testid="voter-input-reaction-stream-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <ReactionStreamVoterInputDomain
        prompt="Waiting for the reaction prompt…"
        palette={PLACEHOLDER_PALETTE}
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
