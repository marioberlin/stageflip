// apps/audience-join/src/components/live-quiz-voter-input.tsx
// T-465 — Voter UI for the `live-quiz` clip family. Active-question
// router: when `activeQuestionId === null` (or the id does not resolve)
// the voter sees the "Waiting for next question…" placeholder; when
// resolved the voter sees the active question's options as buttons.
// Tap submits a `LiveQuizVote` via `onSubmit`; after submit every
// option is disabled and a "Answer submitted" status appears. The
// per-question lock is cleared when `activeQuestionId` changes (the
// host has advanced to the next question).
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type { LiveQuizVote } from '@stageflip/audience-contract';
import { type ReactElement, useCallback, useEffect, useState } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Per-question definition consumed by the domain component. Mirrors the
 * `LiveQuizClipProps['questions'][i]` shape — kept locally to keep the
 * voter UI free of an explicit @stageflip/schema runtime import (the
 * dispatcher wrapper handles the schema-side adapter).
 */
export interface LiveQuizVoterInputQuestion {
  /** Stable question id; matches the discriminant on the matching `LiveQuizVote`. */
  readonly id: string;
  /** Question prompt rendered above the option buttons. */
  readonly text: string;
  /** Option labels — one button each. Bounded 2..6 by the schema. */
  readonly options: readonly string[];
}

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`LiveQuizVoterInput`) which adapts the
 * dispatcher's narrower `VoterInputProps` to this domain shape;
 * production wiring derives `questions` from the clip props the editor
 * authored, and `activeQuestionId` from the live aggregation feed.
 */
export interface LiveQuizVoterInputDomainProps {
  /** Per-question definitions; drives the option buttons when the matching id resolves. */
  readonly questions: readonly LiveQuizVoterInputQuestion[];
  /**
   * The currently-active question id from the live aggregation, or
   * `null` when the host has not opened a question yet (and between
   * questions).
   */
  readonly activeQuestionId: string | null;
  /** Submit callback — emits a `LiveQuizVote`. */
  readonly onSubmit: (vote: LiveQuizVote) => void;
  /** When true, every input is disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

/**
 * Presentational voter UI. Renders one of three states:
 *   - idle (`activeQuestionId === null` OR no matching question
 *     definition): "Waiting for next question…" placeholder.
 *   - active: the question's options as buttons; tap submits + locks.
 *   - submitted: every option disabled + "Answer submitted" status.
 *
 * The `activeQuestionId` change clears the local "submitted" memo so a
 * fresh question accepts a new answer.
 */
export function LiveQuizVoterInputDomain(props: LiveQuizVoterInputDomainProps): ReactElement {
  const { questions, activeQuestionId, onSubmit, disabled = false } = props;
  const [submittedFor, setSubmittedFor] = useState<string | null>(null);

  // Clear the submitted memo when the host advances the active question.
  useEffect(() => {
    if (submittedFor !== null && submittedFor !== activeQuestionId) {
      setSubmittedFor(null);
    }
  }, [activeQuestionId, submittedFor]);

  const activeQuestion =
    activeQuestionId !== null ? questions.find((q) => q.id === activeQuestionId) : undefined;

  const handleSelect = useCallback(
    (questionId: string, optionIndex: number) => {
      if (disabled) return;
      if (submittedFor === questionId) return;
      onSubmit({ kind: 'live-quiz', questionId, optionIndex });
      setSubmittedFor(questionId);
    },
    [disabled, onSubmit, submittedFor],
  );

  if (activeQuestion === undefined) {
    return (
      <section data-testid="voter-input-live-quiz">
        <p
          data-role="waiting-label"
          data-testid="voter-input-live-quiz-waiting"
          style={{ fontSize: '16px', color: '#6b7280' }}
        >
          Waiting for next question…
        </p>
      </section>
    );
  }

  const isSubmitted = submittedFor === activeQuestion.id;

  return (
    <section data-testid="voter-input-live-quiz" data-active-question-id={activeQuestion.id}>
      <h2
        data-role="question-text"
        data-testid="voter-input-live-quiz-question-text"
        style={{ marginBottom: '12px', fontSize: '16px', color: '#111827' }}
      >
        {activeQuestion.text}
      </h2>
      <div
        data-role="options"
        data-testid="voter-input-live-quiz-options"
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {activeQuestion.options.map((label, optIdx) => (
          <button
            key={`${activeQuestion.id}::${label}::${optIdx}`}
            type="button"
            data-testid={`voter-input-live-quiz-option-${optIdx}`}
            data-option-index={optIdx}
            disabled={disabled || isSubmitted}
            onClick={() => handleSelect(activeQuestion.id, optIdx)}
            style={{
              padding: '12px',
              fontSize: '14px',
              cursor: disabled || isSubmitted ? 'not-allowed' : 'pointer',
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              textAlign: 'left',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {isSubmitted ? (
        <p
          data-role="submit-status"
          data-testid="voter-input-live-quiz-submit-status"
          style={{ marginTop: '8px', color: '#065f46', fontWeight: 600 }}
        >
          Answer submitted
        </p>
      ) : null}
    </section>
  );
}

/**
 * Dispatcher-shape wrapper. The dispatcher passes only `sessionId` +
 * `clipKind`; T-465 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter that derives the questions from the authoring
 * stub and `activeQuestionId` from the live aggregation feed, and
 * forwards `onSubmit` to the `voterAppClient.submitVote` channel.
 *
 * For T-465 the wrapper renders the idle placeholder (no questions
 * resolved); the test verifies the dispatcher resolves the kind to
 * this component (not the unregistered fallback).
 */
export function LiveQuizVoterInput(props: VoterInputProps): ReactElement {
  return (
    <section
      data-testid="voter-input-live-quiz-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <LiveQuizVoterInputDomain
        questions={[]}
        activeQuestionId={null}
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
