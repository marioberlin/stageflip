// apps/audience-join/src/components/live-poll-multiple-choice-voter-input.tsx
// T-461 — Voter UI for the `live-poll-multiple-choice` clip family.
// Renders the question + N tappable option buttons. Tapping an option
// fires `onSubmit({ kind: 'live-poll-multiple-choice', optionIndex })`
// and disables every button. The component is presentation-only — the
// caller wires the `onSubmit` callback to `voterAppClient.submitVote`.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type { LivePollMultipleChoiceVote } from '@stageflip/audience-contract';
import { type ReactElement, useCallback, useState } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`LivePollMultipleChoiceVoterInput`) which
 * adapts the dispatcher's narrower `VoterInputProps` to this domain
 * shape; production wiring derives `question` + `options` from the
 * first aggregation snapshot the WebSocket yields.
 */
export interface LivePollMultipleChoiceVoterInputDomainProps {
  /** Question text shown above the option buttons. */
  readonly question: string;
  /** Voter-pickable options, in option-index order. Length 2..10. */
  readonly options: readonly string[];
  /** Submit callback. Invoked exactly once per mount. */
  readonly onSubmit: (vote: LivePollMultipleChoiceVote) => void;
  /** When true, every option button is disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

/**
 * Presentational voter UI. One button per option; a click fires
 * `onSubmit({ kind, optionIndex })`. After submission the buttons
 * disable and a "Vote submitted" status appears.
 */
export function LivePollMultipleChoiceVoterInputDomain(
  props: LivePollMultipleChoiceVoterInputDomainProps,
): ReactElement {
  const { question, options, onSubmit, disabled = false } = props;
  const [submitted, setSubmitted] = useState(false);

  const handleClick = useCallback(
    (optionIndex: number) => {
      if (submitted || disabled) return;
      onSubmit({ kind: 'live-poll-multiple-choice', optionIndex });
      setSubmitted(true);
    },
    [submitted, disabled, onSubmit],
  );

  return (
    <section data-testid="voter-input-live-poll-multiple-choice">
      <h2 data-role="question">{question}</h2>
      <ul data-role="options" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {options.map((label, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: option index IS the stable identity here
          <li key={index} style={{ marginBottom: '8px' }}>
            <button
              type="button"
              data-testid={`voter-input-option-${index}`}
              data-option-index={index}
              disabled={submitted || disabled}
              onClick={() => handleClick(index)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                cursor: submitted || disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
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
 * `clipKind`; T-461 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter (T-462+ era) that derives the question +
 * options from the live aggregation feed and forwards `onSubmit` to
 * the `voterAppClient.submitVote` channel.
 *
 * For T-461 the wrapper renders a placeholder voter card that includes
 * the session id; the test verifies the dispatcher resolves the kind
 * to this component (not the unregistered fallback).
 */
export function LivePollMultipleChoiceVoterInput(props: VoterInputProps): ReactElement {
  return (
    <section
      data-testid="voter-input-live-poll-multiple-choice-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <LivePollMultipleChoiceVoterInputDomain
        question="Waiting for the question…"
        options={['Option 1', 'Option 2']}
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
