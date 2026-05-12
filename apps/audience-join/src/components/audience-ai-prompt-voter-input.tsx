// apps/audience-join/src/components/audience-ai-prompt-voter-input.tsx
// T-471 — Voter UI for the `audience-ai-prompt` clip family. Tabbed
// surface mirroring T-464's LiveQA pattern: `Submit` (textarea + submit)
// and `Browse` (prompt feed with per-row upvote affordances).
//
// Vote shape (per `AudienceAiPromptVote`):
//   - Submit tab → `{ kind: 'audience-ai-prompt', action: 'submit', text }`.
//   - Browse tab → `{ kind: 'audience-ai-prompt', action: 'upvote', promptId }`.
//
// Lock-when-winner-set: once `winnerPromptId !== null`, both tabs
// disable + the component renders a "Voting ended. Winner: …" status
// line. This is the audience-ai-prompt-specific addition on top of the
// LiveQA pattern.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type {
  AudienceAiPromptAggregation,
  AudienceAiPromptVote,
} from '@stageflip/audience-contract';
import { type ReactElement, useCallback, useState } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`AudienceAiPromptVoterInput`) which adapts
 * the dispatcher's narrower `VoterInputProps` to this domain shape;
 * production wiring derives `prompt` + `maxPromptLength` from the clip
 * props the editor authored, and `promptsSnapshot` from the live
 * aggregation feed.
 */
export interface AudienceAiPromptVoterInputDomainProps {
  /** Question text shown in the header. */
  readonly prompt: string;
  /** Bounds the textarea's `maxLength`. */
  readonly maxPromptLength: number;
  /**
   * The most-recent live aggregation snapshot. Drives the Browse-tab
   * list. Optional — when absent the tab renders a "Waiting for
   * prompts…" placeholder.
   */
  readonly promptsSnapshot?: AudienceAiPromptAggregation;
  /**
   * When set (i.e. `!== null`), both tabs disable + a "Voting ended.
   * Winner: …" status line replaces the input affordances. Reflects
   * the server-side winner declaration.
   */
  readonly winnerPromptId?: string | null;
  /** Submit callback — both submit + upvote actions flow through this. */
  readonly onSubmit: (vote: AudienceAiPromptVote) => void;
  /** When true, every input is disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

type Tab = 'submit' | 'browse';

/**
 * Presentational voter UI. Tabbed surface. The Submit tab is a
 * once-per-tab `<textarea>` + button; the Browse tab renders the
 * live aggregation snapshot's prompts with per-row upvote buttons.
 * Upvotes are remembered locally to disable the matching button after
 * the first cast. When `winnerPromptId !== null`, both tabs lock.
 */
export function AudienceAiPromptVoterInputDomain(
  props: AudienceAiPromptVoterInputDomainProps,
): ReactElement {
  const {
    prompt,
    maxPromptLength,
    promptsSnapshot,
    winnerPromptId = null,
    onSubmit,
    disabled = false,
  } = props;
  const locked = winnerPromptId !== null;
  const inputsDisabled = disabled || locked;

  const [activeTab, setActiveTab] = useState<Tab>('submit');
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [upvoted, setUpvoted] = useState<ReadonlySet<string>>(() => new Set());

  const canSubmit = !inputsDisabled && text.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit({ kind: 'audience-ai-prompt', action: 'submit', text: text.trim() });
    setText('');
    setSubmitted(true);
  }, [canSubmit, onSubmit, text]);

  const handleUpvote = useCallback(
    (promptId: string) => {
      if (inputsDisabled) return;
      if (upvoted.has(promptId)) return;
      onSubmit({ kind: 'audience-ai-prompt', action: 'upvote', promptId });
      setUpvoted((prev) => {
        const next = new Set(prev);
        next.add(promptId);
        return next;
      });
    },
    [inputsDisabled, onSubmit, upvoted],
  );

  const tabButtonStyle = (tab: Tab): React.CSSProperties => ({
    flex: '1 1 0',
    padding: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    background: activeTab === tab ? '#7c3aed' : '#f3f4f6',
    color: activeTab === tab ? '#ffffff' : '#111827',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #5b21b6' : '2px solid transparent',
  });

  // Winner text (for the locked-state status line).
  const winner = promptsSnapshot?.prompts.find((p) => p.id === winnerPromptId);

  return (
    <section data-testid="voter-input-audience-ai-prompt">
      <h2 data-role="prompt">{prompt}</h2>
      {locked ? (
        <p
          data-role="locked-status"
          data-testid="voter-input-audience-ai-prompt-locked"
          style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0' }}
        >
          {winner !== undefined
            ? `Voting ended. Winner: ${winner.text}`
            : 'Voting ended. Winner selected.'}
        </p>
      ) : null}
      <div
        data-role="tabs"
        data-testid="voter-input-audience-ai-prompt-tabs"
        style={{ display: 'flex', marginBottom: '12px' }}
      >
        <button
          type="button"
          data-testid="voter-input-audience-ai-prompt-tab-submit"
          data-tab="submit"
          data-active={activeTab === 'submit'}
          onClick={() => setActiveTab('submit')}
          style={tabButtonStyle('submit')}
        >
          Submit
        </button>
        <button
          type="button"
          data-testid="voter-input-audience-ai-prompt-tab-browse"
          data-tab="browse"
          data-active={activeTab === 'browse'}
          onClick={() => setActiveTab('browse')}
          style={tabButtonStyle('browse')}
        >
          Browse
        </button>
      </div>
      {activeTab === 'submit' ? (
        <div data-role="submit-tab" data-testid="voter-input-audience-ai-prompt-submit-panel">
          <textarea
            data-testid="voter-input-audience-ai-prompt-textarea"
            value={text}
            maxLength={maxPromptLength}
            disabled={inputsDisabled}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your prompt…"
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
            data-testid="voter-input-audience-ai-prompt-submit-button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            style={{
              marginTop: '8px',
              padding: '12px',
              fontSize: '14px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            Submit prompt
          </button>
          {submitted ? (
            <p data-testid="voter-input-audience-ai-prompt-submit-status" data-role="submit-status">
              Prompt submitted
            </p>
          ) : null}
        </div>
      ) : (
        <div data-role="browse-tab" data-testid="voter-input-audience-ai-prompt-browse-panel">
          {promptsSnapshot === undefined || promptsSnapshot.prompts.length === 0 ? (
            <p data-testid="voter-input-audience-ai-prompt-browse-empty" data-role="browse-empty">
              Waiting for prompts…
            </p>
          ) : (
            <ul
              data-role="browse-list"
              data-testid="voter-input-audience-ai-prompt-browse-list"
              style={{ listStyle: 'none', padding: 0, margin: 0 }}
            >
              {promptsSnapshot.prompts.map((p, index) => (
                <li
                  key={p.id}
                  data-testid={`voter-input-audience-ai-prompt-browse-item-${index}`}
                  data-prompt-id={p.id}
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
                    {p.text}
                  </span>
                  <span
                    data-role="browse-upvote-count"
                    data-testid={`voter-input-audience-ai-prompt-browse-count-${index}`}
                  >
                    {p.upvotes}
                  </span>
                  <button
                    type="button"
                    data-testid={`voter-input-audience-ai-prompt-browse-upvote-${index}`}
                    data-prompt-id={p.id}
                    disabled={inputsDisabled || upvoted.has(p.id)}
                    onClick={() => handleUpvote(p.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: inputsDisabled || upvoted.has(p.id) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {upvoted.has(p.id) ? 'Upvoted' : 'Upvote'}
                  </button>
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
 * `clipKind`; T-471 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter that derives the prompt + clip props from the
 * authoring stub and `promptsSnapshot` from the live aggregation feed,
 * and forwards `onSubmit` to the `voterAppClient.submitVote` channel.
 *
 * For T-471 the wrapper renders a placeholder voter card that includes
 * the session id; the test verifies the dispatcher resolves the kind to
 * this component (not the unregistered fallback).
 */
export function AudienceAiPromptVoterInput(props: VoterInputProps): ReactElement {
  return (
    <section
      data-testid="voter-input-audience-ai-prompt-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <AudienceAiPromptVoterInputDomain
        prompt="Waiting for the prompt…"
        maxPromptLength={200}
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
