// apps/audience-join/src/components/survey-voter-input.tsx
// T-468 — Voter UI for the `survey` clip family. Renders one
// vertically-scrolling form with three question-type inputs:
//   - `multiple-choice` → radio buttons (one per option).
//   - `open-text` → <textarea> bounded by `maxLength`.
//   - `rating` → row of `scaleMax` buttons (current selection highlighted).
//
// Submit button at the bottom is disabled until every question has a
// response. On submit, emits `{ kind: 'survey', responses: [...] }`
// where each response carries the typed value (number for mc /
// rating, string for open-text). All inputs + button disable after
// submit; "Survey submitted" status appears.
//
// The component is presentation-only — the caller wires the
// `onSubmit` callback to `voterAppClient.submitVote`.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type { SurveyVote, SurveyVoteResponseValue } from '@stageflip/audience-contract';
import type { SurveyQuestion } from '@stageflip/schema';
import { type ReactElement, useCallback, useState } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`SurveyVoterInput`) which adapts the
 * dispatcher's narrower `VoterInputProps` to this domain shape;
 * production wiring derives the question array from the first
 * aggregation snapshot (or from the live-mount props).
 */
export interface SurveyVoterInputDomainProps {
  /** Per-question schema array from `clip.props.questions`. */
  readonly questions: readonly SurveyQuestion[];
  /** Submit callback. Invoked at most once per mount. */
  readonly onSubmit: (vote: SurveyVote) => void;
  /** When true, every input + button is disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

/**
 * Per-question response value type. `number` for multiple-choice
 * (the option index) + rating (the score), `string` for open-text.
 * `null` represents "no response yet".
 */
type ResponseValue = number | string | null;

/**
 * Validate whether a response is considered complete for a given
 * question. Used to gate the submit button.
 */
function isAnswered(question: SurveyQuestion, value: ResponseValue): boolean {
  if (value === null) return false;
  if (question.type === 'open-text') {
    return typeof value === 'string' && value.trim().length > 0;
  }
  if (question.type === 'multiple-choice' || question.type === 'rating') {
    return typeof value === 'number';
  }
  return false;
}

/**
 * Convert the internal `responses` state into the wire `SurveyVote`
 * shape. Caller guarantees every entry is non-null via the
 * submit-disabled gate.
 */
function buildVote(
  questions: readonly SurveyQuestion[],
  responses: ReadonlyMap<string, ResponseValue>,
): SurveyVote {
  const out: Array<{ questionId: string; value: SurveyVoteResponseValue }> = [];
  for (const q of questions) {
    const v = responses.get(q.id);
    if (v === null || v === undefined) continue;
    out.push({ questionId: q.id, value: v });
  }
  return { kind: 'survey', responses: out };
}

/**
 * Render the multiple-choice radio-group input for one question.
 */
function MultipleChoiceQuestion(props: {
  question: SurveyQuestion & { type: 'multiple-choice' };
  value: ResponseValue;
  disabled: boolean;
  onChange: (next: number) => void;
}): ReactElement {
  const { question, value, disabled, onChange } = props;
  return (
    <fieldset
      data-testid={`survey-question-${question.id}`}
      data-question-type="multiple-choice"
      style={{ border: 'none', padding: 0, margin: '0 0 16px 0' }}
    >
      <legend data-role="question-text" style={{ fontSize: '16px', fontWeight: 600 }}>
        {question.text}
      </legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
        {question.options.map((opt, i) => (
          <label
            key={`${question.id}-opt-${i}`}
            data-testid={`survey-${question.id}-option-${i}`}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
          >
            <input
              type="radio"
              name={`survey-${question.id}`}
              value={i}
              checked={value === i}
              disabled={disabled}
              onChange={() => onChange(i)}
              data-testid={`survey-${question.id}-radio-${i}`}
            />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Render the open-text textarea input for one question.
 */
function OpenTextQuestion(props: {
  question: SurveyQuestion & { type: 'open-text' };
  value: ResponseValue;
  disabled: boolean;
  onChange: (next: string) => void;
}): ReactElement {
  const { question, value, disabled, onChange } = props;
  const text = typeof value === 'string' ? value : '';
  return (
    <div
      data-testid={`survey-question-${question.id}`}
      data-question-type="open-text"
      style={{ margin: '0 0 16px 0' }}
    >
      <label data-role="question-text" style={{ fontSize: '16px', fontWeight: 600 }}>
        {question.text}
        <textarea
          data-testid={`survey-${question.id}-textarea`}
          data-max-length={question.maxLength}
          maxLength={question.maxLength}
          disabled={disabled}
          value={text}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '8px',
            padding: '8px',
            fontSize: '14px',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
      </label>
    </div>
  );
}

/**
 * Render the rating button-row input for one question.
 */
function RatingQuestion(props: {
  question: SurveyQuestion & { type: 'rating' };
  value: ResponseValue;
  disabled: boolean;
  onChange: (next: number) => void;
}): ReactElement {
  const { question, value, disabled, onChange } = props;
  const scaleMax = question.scaleMax;
  const buttons: ReactElement[] = [];
  for (let score = 1; score <= scaleMax; score += 1) {
    const isSelected = value === score;
    buttons.push(
      <button
        key={`${question.id}-score-${score}`}
        type="button"
        data-testid={`survey-${question.id}-score-${score}`}
        data-selected={isSelected ? 'true' : 'false'}
        disabled={disabled}
        onClick={() => onChange(score)}
        style={{
          flex: '1 1 auto',
          margin: '0 2px',
          padding: '8px',
          fontSize: '14px',
          background: isSelected ? '#3b82f6' : '#e5e7eb',
          color: isSelected ? '#ffffff' : '#111827',
          border: 'none',
          borderRadius: '4px',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {score}
      </button>,
    );
  }
  return (
    <div
      data-testid={`survey-question-${question.id}`}
      data-question-type="rating"
      style={{ margin: '0 0 16px 0' }}
    >
      <p data-role="question-text" style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
        {question.text}
      </p>
      <div style={{ display: 'flex', marginTop: '8px' }}>{buttons}</div>
    </div>
  );
}

/**
 * Presentational voter UI. A vertical form with one input per question
 * + a single submit button at the bottom. Submission is once-per-mount;
 * after submit the controls disable and a "Survey submitted" status
 * appears.
 */
export function SurveyVoterInputDomain(props: SurveyVoterInputDomainProps): ReactElement {
  const { questions, onSubmit, disabled = false } = props;
  const [responses, setResponses] = useState<ReadonlyMap<string, ResponseValue>>(() => {
    const init = new Map<string, ResponseValue>();
    for (const q of questions) init.set(q.id, null);
    return init;
  });
  const [submitted, setSubmitted] = useState(false);

  const setResponse = useCallback((id: string, value: ResponseValue) => {
    setResponses((prev) => {
      const next = new Map(prev);
      next.set(id, value);
      return next;
    });
  }, []);

  const inputDisabled = submitted || disabled;
  const allAnswered = questions.every((q) => isAnswered(q, responses.get(q.id) ?? null));
  const submitDisabled = inputDisabled || !allAnswered;

  const handleSubmit = useCallback(() => {
    if (submitted || disabled) return;
    if (!allAnswered) return;
    onSubmit(buildVote(questions, responses));
    setSubmitted(true);
  }, [submitted, disabled, allAnswered, onSubmit, questions, responses]);

  return (
    <section data-testid="voter-input-survey">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {questions.map((q) => {
          const value = responses.get(q.id) ?? null;
          if (q.type === 'multiple-choice') {
            return (
              <MultipleChoiceQuestion
                key={q.id}
                question={q}
                value={value}
                disabled={inputDisabled}
                onChange={(next) => setResponse(q.id, next)}
              />
            );
          }
          if (q.type === 'open-text') {
            return (
              <OpenTextQuestion
                key={q.id}
                question={q}
                value={value}
                disabled={inputDisabled}
                onChange={(next) => setResponse(q.id, next)}
              />
            );
          }
          // rating
          return (
            <RatingQuestion
              key={q.id}
              question={q}
              value={value}
              disabled={inputDisabled}
              onChange={(next) => setResponse(q.id, next)}
            />
          );
        })}
        <button
          type="submit"
          data-testid="voter-input-submit"
          disabled={submitDisabled}
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
      </form>
      {submitted ? (
        <p data-testid="voter-input-status" data-role="status">
          Survey submitted
        </p>
      ) : null}
    </section>
  );
}

/**
 * Dispatcher-shape wrapper. The dispatcher passes only `sessionId` +
 * `clipKind`; T-468 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter that derives the question array from the live
 * aggregation feed and forwards `onSubmit` to the
 * `voterAppClient.submitVote` channel.
 *
 * For T-468 the wrapper renders a placeholder voter card that includes
 * the session id; the test verifies the dispatcher resolves the kind
 * to this component (not the unregistered fallback).
 */
export function SurveyVoterInput(props: VoterInputProps): ReactElement {
  const placeholderQuestions: readonly SurveyQuestion[] = [
    {
      id: 'placeholder',
      type: 'open-text',
      text: 'Waiting for the survey…',
      maxLength: 280,
    },
  ];
  return (
    <section
      data-testid="voter-input-survey-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <SurveyVoterInputDomain
        questions={placeholderQuestions}
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
