// apps/audience-join/src/components/live-poll-rating-voter-input.tsx
// T-463 — Voter UI for the `live-poll-rating` clip family. Renders the
// question + a row of `scaleMax` numbered rating buttons (typically 5).
// Tapping a button submits `{ kind: 'live-poll-rating', score: n }`
// (1-indexed) and disables the buttons. Optional left/right end labels
// render under the row's ends. The component is presentation-only — the
// caller wires the `onSubmit` callback to `voterAppClient.submitVote`.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type { LivePollRatingVote } from '@stageflip/audience-contract';
import { type ReactElement, useCallback, useState } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`LivePollRatingVoterInput`) which adapts the
 * dispatcher's narrower `VoterInputProps` to this domain shape;
 * production wiring derives `question` + `scaleMax` + `labels` from the
 * first aggregation snapshot the WebSocket yields.
 */
export interface LivePollRatingVoterInputDomainProps {
  /** Question text shown above the rating row. */
  readonly question: string;
  /**
   * Upper bound of the rating scale — buttons rendered are `1..scaleMax`.
   * Typically 5 (5-point Likert) or 10 (NPS).
   */
  readonly scaleMax: number;
  /**
   * Optional end-of-scale labels — only `labels[0]` + `labels[last]`
   * are surfaced (under the leftmost + rightmost buttons respectively).
   */
  readonly labels?: readonly string[];
  /** Submit callback. Invoked exactly once per mount. */
  readonly onSubmit: (vote: LivePollRatingVote) => void;
  /** When true, the buttons are disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

/**
 * Presentational voter UI. A row of `scaleMax` numbered rating buttons.
 * Submission is once-per-mount; after submit the controls disable and a
 * "Vote submitted" status appears.
 */
export function LivePollRatingVoterInputDomain(
  props: LivePollRatingVoterInputDomainProps,
): ReactElement {
  const { question, scaleMax, labels, onSubmit, disabled = false } = props;
  const [submitted, setSubmitted] = useState(false);

  const handleClick = useCallback(
    (score: number) => {
      if (submitted || disabled) return;
      onSubmit({ kind: 'live-poll-rating', score });
      setSubmitted(true);
    },
    [submitted, disabled, onSubmit],
  );

  const buttonsDisabled = submitted || disabled;
  const scores: number[] = [];
  for (let i = 1; i <= scaleMax; i++) scores.push(i);

  const showEndLabels = labels !== undefined && labels.length > 0;
  const leftLabel = showEndLabels ? labels[0] : undefined;
  const rightLabel = showEndLabels ? labels[labels.length - 1] : undefined;

  return (
    <section data-testid="voter-input-live-poll-rating">
      <h2 data-role="question">{question}</h2>
      <div
        data-role="rating-row"
        data-testid="voter-input-rating-row"
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
        }}
      >
        {scores.map((score) => (
          <button
            key={score}
            type="button"
            data-testid={`voter-input-rating-${score}`}
            data-rating-score={score}
            disabled={buttonsDisabled}
            onClick={() => handleClick(score)}
            style={{
              flex: '1 1 0',
              padding: '12px',
              fontSize: '16px',
              cursor: buttonsDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {score}
          </button>
        ))}
      </div>
      {showEndLabels ? (
        <div
          data-role="end-labels"
          data-testid="voter-input-rating-end-labels"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            color: '#6b7280',
            fontSize: '12px',
          }}
        >
          <span data-testid="voter-input-rating-label-left">{leftLabel ?? ''}</span>
          <span data-testid="voter-input-rating-label-right">{rightLabel ?? ''}</span>
        </div>
      ) : null}
      {submitted ? (
        <p data-testid="voter-input-status" data-role="status">
          Vote submitted
        </p>
      ) : null}
    </section>
  );
}

/**
 * Dispatcher-shape wrapper. The dispatcher passes only `sessionId` +
 * `clipKind`; T-463 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter that derives the question + scaleMax + labels
 * from the live aggregation feed and forwards `onSubmit` to the
 * `voterAppClient.submitVote` channel.
 *
 * For T-463 the wrapper renders a placeholder voter card that includes
 * the session id; the test verifies the dispatcher resolves the kind to
 * this component (not the unregistered fallback).
 */
export function LivePollRatingVoterInput(props: VoterInputProps): ReactElement {
  return (
    <section
      data-testid="voter-input-live-poll-rating-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <LivePollRatingVoterInputDomain
        question="Waiting for the question…"
        scaleMax={5}
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
