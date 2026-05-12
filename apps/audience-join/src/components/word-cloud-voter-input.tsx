// apps/audience-join/src/components/word-cloud-voter-input.tsx
// T-467 — Voter UI for the `word-cloud` clip family. Renders the
// prompt + a free-text `<textarea>` for comma-separated word entry +
// a submit button. On submit, parses `text.split(',').map(trim).filter
// (Boolean).slice(0, maxWordsPerVoter)`, additionally truncates each
// word to MAX_WORD_LENGTH characters (per the audience-contract
// `WordCloudVote` constraint of ≤ 32 chars per word). Fires `onSubmit
// ({ kind: 'word-cloud', words: [...] })` and disables the input.
//
// The component is presentation-only — the caller wires the `onSubmit`
// callback to `voterAppClient.submitVote`.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type { WordCloudVote } from '@stageflip/audience-contract';
import { type ReactElement, useCallback, useState } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Maximum allowed length of any single submitted word, per the
 * `audience-contract` `WordCloudVote` shape (≤ 32 chars per the inline
 * contract comment). The voter UI truncates over-length words client-
 * side; the server-side authoritative check still applies.
 */
export const MAX_WORD_LENGTH = 32;

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`WordCloudVoterInput`) which adapts the
 * dispatcher's narrower `VoterInputProps` to this domain shape;
 * production wiring derives `prompt` + `maxWordsPerVoter` from the
 * first aggregation snapshot the WebSocket yields.
 */
export interface WordCloudVoterInputDomainProps {
  /** Prompt text shown above the input. */
  readonly prompt: string;
  /** Maximum number of words this voter may submit per vote. */
  readonly maxWordsPerVoter: number;
  /** Submit callback. Invoked at most once per mount. */
  readonly onSubmit: (vote: WordCloudVote) => void;
  /** When true, the input + button are disabled (e.g. session closed). */
  readonly disabled?: boolean;
}

/**
 * Parse the textarea's raw value into the submitted-words array.
 * Splits on commas, trims, filters empties, slices to `maxWordsPerVoter`,
 * and truncates each word to `MAX_WORD_LENGTH` characters.
 * Exported for the test surface.
 */
export function parseSubmittedWords(input: {
  readonly text: string;
  readonly maxWordsPerVoter: number;
}): string[] {
  const { text, maxWordsPerVoter } = input;
  const parts = text.split(',');
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    out.push(trimmed.length > MAX_WORD_LENGTH ? trimmed.slice(0, MAX_WORD_LENGTH) : trimmed);
    if (out.length >= maxWordsPerVoter) break;
  }
  return out;
}

/**
 * Presentational voter UI. A `<textarea>` for comma-separated word
 * entry plus a submit button. Submission is once-per-mount; after
 * submit the controls disable and a "Words submitted" status appears.
 *
 * Empty / whitespace-only submissions are rejected silently (button is
 * disabled when the parsed-words array would be empty).
 */
export function WordCloudVoterInputDomain(props: WordCloudVoterInputDomainProps): ReactElement {
  const { prompt, maxWordsPerVoter, onSubmit, disabled = false } = props;
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(() => {
    if (submitted || disabled) return;
    const words = parseSubmittedWords({ text, maxWordsPerVoter });
    if (words.length === 0) return;
    onSubmit({ kind: 'word-cloud', words });
    setSubmitted(true);
  }, [submitted, disabled, onSubmit, text, maxWordsPerVoter]);

  const inputDisabled = submitted || disabled;
  // Precompute parsed-words count to disable submit on empty input.
  const parsedCount = parseSubmittedWords({ text, maxWordsPerVoter }).length;
  const submitDisabled = inputDisabled || parsedCount === 0;

  return (
    <section data-testid="voter-input-word-cloud">
      <h2 data-role="prompt">{prompt}</h2>
      <textarea
        data-testid="voter-input-textarea"
        data-max-words-per-voter={maxWordsPerVoter}
        placeholder={`Enter up to ${maxWordsPerVoter} words, comma-separated`}
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
          Words submitted
        </p>
      ) : null}
    </section>
  );
}

/**
 * Dispatcher-shape wrapper. The dispatcher passes only `sessionId` +
 * `clipKind`; T-467 wires this wrapper into the dispatcher registry to
 * register the kind. In production the wrapper is replaced by a
 * snapshot-aware adapter that derives the prompt + maxWordsPerVoter
 * from the live aggregation feed and forwards `onSubmit` to the
 * `voterAppClient.submitVote` channel.
 *
 * For T-467 the wrapper renders a placeholder voter card that includes
 * the session id; the test verifies the dispatcher resolves the kind
 * to this component (not the unregistered fallback).
 */
export function WordCloudVoterInput(props: VoterInputProps): ReactElement {
  return (
    <section
      data-testid="voter-input-word-cloud-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <WordCloudVoterInputDomain
        prompt="Waiting for the prompt…"
        maxWordsPerVoter={3}
        onSubmit={() => {
          /* placeholder — real submit wires through voterAppClient.submitVote */
        }}
        disabled
      />
    </section>
  );
}
