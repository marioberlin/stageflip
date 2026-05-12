// apps/audience-join/src/components/live-poll-open-text-voter-input.tsx
// T-462 — Voter UI for the `live-poll-open-text` clip family. Renders
// the question + a free-text textarea with a maxLength matching the
// clip's `maxLength` prop. Submitting fires `onSubmit({ kind:
// 'live-poll-open-text', text })` and disables the input. The component
// is presentation-only — the caller wires the `onSubmit` callback to
// `voterAppClient.submitVote`.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type { LivePollOpenTextVote } from '@stageflip/audience-contract';
import { type ReactElement, useCallback, useState } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`LivePollOpenTextVoterInput`) which adapts
 * the dispatcher's narrower `VoterInputProps` to this domain shape;
 * production wiring derives `question` + `maxLength` from the first
 * aggregation snapshot the WebSocket yields.
 */
export interface LivePollOpenTextVoterInputDomainProps {
  /** Question text shown above the input. */
  readonly question: string;
  /** Server-enforced maximum length of the voter's submission. */
  readonly maxLength: number;
  /** Submit callback. Invoked exactly once per mount. */
  readonly onSubmit: (vote: LivePollOpenTextVote) => void;
  /** When true, the input + button are disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

/**
 * Presentational voter UI. A `<textarea>` with `maxLength` matching the
 * clip's `maxLength` + a submit button. Submission is once-per-mount;
 * after submit the controls disable and a "Vote submitted" status
 * appears.
 */
export function LivePollOpenTextVoterInputDomain(
  props: LivePollOpenTextVoterInputDomainProps,
): ReactElement {
  const { question, maxLength, onSubmit, disabled = false } = props;
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(() => {
    if (submitted || disabled) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSubmit({ kind: 'live-poll-open-text', text: trimmed });
    setSubmitted(true);
  }, [submitted, disabled, onSubmit, text]);

  const inputDisabled = submitted || disabled;
  const submitDisabled = inputDisabled || text.trim().length === 0;

  return (
    <section data-testid="voter-input-live-poll-open-text">
      <h2 data-role="question">{question}</h2>
      <textarea
        data-testid="voter-input-textarea"
        data-max-length={maxLength}
        maxLength={maxLength}
        disabled={inputDisabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '16px',
          boxSizing: 'border-box',
          resize: 'vertical',
        }}
      />
      <button
        type="button"
        data-testid="voter-input-submit"
        disabled={submitDisabled}
        onClick={handleSubmit}
        style={{
          marginTop: '8px',
          width: '100%',
          padding: '12px',
          fontSize: '16px',
          cursor: submitDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        Submit
      </button>
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
 * `clipKind`; T-462 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter that derives the question + maxLength from
 * the live aggregation feed and forwards `onSubmit` to the
 * `voterAppClient.submitVote` channel.
 *
 * For T-462 the wrapper renders a placeholder voter card that includes
 * the session id; the test verifies the dispatcher resolves the kind
 * to this component (not the unregistered fallback).
 */
export function LivePollOpenTextVoterInput(props: VoterInputProps): ReactElement {
  return (
    <section
      data-testid="voter-input-live-poll-open-text-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <LivePollOpenTextVoterInputDomain
        question="Waiting for the question…"
        maxLength={280}
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
