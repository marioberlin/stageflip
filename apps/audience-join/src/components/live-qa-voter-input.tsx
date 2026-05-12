// apps/audience-join/src/components/live-qa-voter-input.tsx
// T-464 — Voter UI for the `live-qa` clip family. Tabbed surface with
// two tabs: `Submit` (textarea + submit) and `Browse` (live questions
// list with upvote affordances). Tap-submit emits a `LiveQAVote` via
// the `onSubmit` callback; the upvote flow is per-question with a
// client-side memo (component state) to disable already-cast upvotes.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type { LiveQAAggregation, LiveQAVote } from '@stageflip/audience-contract';
import { type ReactElement, useCallback, useState } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`LiveQAVoterInput`) which adapts the
 * dispatcher's narrower `VoterInputProps` to this domain shape;
 * production wiring derives `topic` + `maxLength` + `allowUpvoting`
 * from the clip props the editor authored, and `questionsSnapshot`
 * from the live aggregation feed.
 */
export interface LiveQAVoterInputDomainProps {
  /** Topic prompt shown in the header. */
  readonly topic: string;
  /** Bounds the textarea's `maxLength`. */
  readonly maxLength: number;
  /** When false, the Browse tab hides upvote affordances. */
  readonly allowUpvoting: boolean;
  /**
   * The most-recent live aggregation snapshot. Drives the Browse-tab
   * list. Optional — when absent the tab renders a "Waiting for
   * questions…" placeholder.
   */
  readonly questionsSnapshot?: LiveQAAggregation;
  /** Submit callback — both submit + upvote actions flow through this. */
  readonly onSubmit: (vote: LiveQAVote) => void;
  /** When true, every input is disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

type Tab = 'submit' | 'browse';

/**
 * Presentational voter UI. Tabbed surface. The Submit tab is a
 * once-per-tab `<textarea>` + button; the Browse tab renders the
 * live aggregation snapshot's questions with per-question upvote
 * buttons. Upvotes are remembered locally to disable the matching
 * button after the first cast.
 */
export function LiveQAVoterInputDomain(props: LiveQAVoterInputDomainProps): ReactElement {
  const { topic, maxLength, allowUpvoting, questionsSnapshot, onSubmit, disabled = false } = props;
  const [activeTab, setActiveTab] = useState<Tab>('submit');
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [upvoted, setUpvoted] = useState<ReadonlySet<string>>(() => new Set());

  const canSubmit = !disabled && text.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit({ kind: 'live-qa', action: 'submit', text: text.trim() });
    setText('');
    setSubmitted(true);
  }, [canSubmit, onSubmit, text]);

  const handleUpvote = useCallback(
    (questionId: string) => {
      if (disabled) return;
      if (upvoted.has(questionId)) return;
      onSubmit({ kind: 'live-qa', action: 'upvote', questionId });
      setUpvoted((prev) => {
        const next = new Set(prev);
        next.add(questionId);
        return next;
      });
    },
    [disabled, onSubmit, upvoted],
  );

  const tabButtonStyle = (tab: Tab): React.CSSProperties => ({
    flex: '1 1 0',
    padding: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    background: activeTab === tab ? '#3b82f6' : '#f3f4f6',
    color: activeTab === tab ? '#ffffff' : '#111827',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #1d4ed8' : '2px solid transparent',
  });

  return (
    <section data-testid="voter-input-live-qa">
      <h2 data-role="topic">{topic}</h2>
      <div
        data-role="tabs"
        data-testid="voter-input-live-qa-tabs"
        style={{ display: 'flex', marginBottom: '12px' }}
      >
        <button
          type="button"
          data-testid="voter-input-live-qa-tab-submit"
          data-tab="submit"
          data-active={activeTab === 'submit'}
          onClick={() => setActiveTab('submit')}
          style={tabButtonStyle('submit')}
        >
          Submit
        </button>
        <button
          type="button"
          data-testid="voter-input-live-qa-tab-browse"
          data-tab="browse"
          data-active={activeTab === 'browse'}
          onClick={() => setActiveTab('browse')}
          style={tabButtonStyle('browse')}
        >
          Browse
        </button>
      </div>
      {activeTab === 'submit' ? (
        <div data-role="submit-tab" data-testid="voter-input-live-qa-submit-panel">
          <textarea
            data-testid="voter-input-live-qa-textarea"
            value={text}
            maxLength={maxLength}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your question…"
            style={{
              width: '100%',
              minHeight: '96px',
              padding: '8px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            data-testid="voter-input-live-qa-submit-button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            style={{
              marginTop: '8px',
              padding: '12px',
              fontSize: '14px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            Submit question
          </button>
          {submitted ? (
            <p data-testid="voter-input-live-qa-submit-status" data-role="submit-status">
              Question submitted
            </p>
          ) : null}
        </div>
      ) : (
        <div data-role="browse-tab" data-testid="voter-input-live-qa-browse-panel">
          {questionsSnapshot === undefined || questionsSnapshot.questions.length === 0 ? (
            <p data-testid="voter-input-live-qa-browse-empty" data-role="browse-empty">
              Waiting for questions…
            </p>
          ) : (
            <ul
              data-role="browse-list"
              data-testid="voter-input-live-qa-browse-list"
              style={{ listStyle: 'none', padding: 0, margin: 0 }}
            >
              {questionsSnapshot.questions.map((q, index) => (
                <li
                  key={q.id}
                  data-testid={`voter-input-live-qa-browse-item-${index}`}
                  data-question-id={q.id}
                  style={{
                    padding: '8px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span data-role="browse-text" style={{ flex: '1 1 auto' }}>
                    {q.text}
                  </span>
                  <span
                    data-role="browse-upvote-count"
                    data-testid={`voter-input-live-qa-browse-count-${index}`}
                  >
                    {q.upvotes}
                  </span>
                  {allowUpvoting ? (
                    <button
                      type="button"
                      data-testid={`voter-input-live-qa-browse-upvote-${index}`}
                      data-question-id={q.id}
                      disabled={disabled || upvoted.has(q.id)}
                      onClick={() => handleUpvote(q.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        cursor: disabled || upvoted.has(q.id) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {upvoted.has(q.id) ? 'Upvoted' : 'Upvote'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Dispatcher-shape wrapper. The dispatcher passes only `sessionId` +
 * `clipKind`; T-464 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter that derives the topic + clip props from the
 * authoring stub and `questionsSnapshot` from the live aggregation
 * feed, and forwards `onSubmit` to the `voterAppClient.submitVote`
 * channel.
 *
 * For T-464 the wrapper renders a placeholder voter card that includes
 * the session id; the test verifies the dispatcher resolves the kind to
 * this component (not the unregistered fallback).
 */
export function LiveQAVoterInput(props: VoterInputProps): ReactElement {
  return (
    <section
      data-testid="voter-input-live-qa-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <LiveQAVoterInputDomain
        topic="Waiting for the topic…"
        maxLength={500}
        allowUpvoting
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
