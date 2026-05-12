// apps/audience-join/src/components/voter-input-dispatcher.tsx
// T-456 — Per-clip-kind voter UI dispatcher. Switches on `clipKind` and
// renders the registered voter input component, or a generic
// `<UnregisteredKindFallback>` for kinds not yet wired (T-461..T-471
// each register their per-kind UI alongside the clip definition).
//
// T-456 ships an EMPTY registry — every kind currently falls through to
// the placeholder. The shape mirrors `audienceClipRegistry` from
// `@stageflip/runtimes-audience` so the registration call site is
// consistent across editor + voter app.

'use client';

import type { AudienceClipKind } from '@stageflip/audience-contract';
import type { ComponentType, ReactElement } from 'react';

import { LeaderboardViewOnly } from './leaderboard-view-only';
import { LivePollMultipleChoiceVoterInput } from './live-poll-multiple-choice-voter-input';
import { LivePollOpenTextVoterInput } from './live-poll-open-text-voter-input';
import { LivePollRatingVoterInput } from './live-poll-rating-voter-input';
import { LiveQAVoterInput } from './live-qa-voter-input';
import { LiveQuizVoterInput } from './live-quiz-voter-input';
import { SurveyVoterInput } from './survey-voter-input';
import { WordCloudVoterInput } from './word-cloud-voter-input';

/**
 * Props handed to every per-kind voter input. The dispatcher itself is
 * shape-agnostic; per-kind components widen the contract as needed.
 */
export interface VoterInputProps {
  readonly sessionId: string;
  readonly clipKind: AudienceClipKind;
}

/**
 * Inputs for `<VoterInputDispatcher>`. The registry is supplied so
 * tests can inject stubs without polluting the module-level singleton.
 * Production callers pass `defaultVoterInputRegistry`.
 */
export interface VoterInputDispatcherProps extends VoterInputProps {
  readonly registry?: VoterInputRegistry;
}

/** Type of the per-kind voter input registry. */
export type VoterInputRegistry = ReadonlyMap<AudienceClipKind, ComponentType<VoterInputProps>>;

/**
 * Default registry — entries land per clip-family task. T-461 adds
 * `live-poll-multiple-choice` as the inaugural entry; T-462 adds
 * `live-poll-open-text` as the second entry; T-463 adds
 * `live-poll-rating` as the third entry (closes the LivePoll family);
 * T-464 adds `live-qa` as the fourth entry (first non-LivePoll family);
 * T-465 adds `live-quiz` as the fifth entry (competitive multi-question
 * quiz); T-466 adds `leaderboard` as the sixth entry — the FIRST
 * view-only clip kind (per ADR-010 §D2 `LeaderboardVote = never`; the
 * registered component is a results-display notice that NEVER invokes
 * `onSubmit`, setting the precedent for future view-only siblings);
 * T-467 adds `word-cloud` as the seventh entry (live aggregating word
 * weights — voter UI parses a comma-separated list, slices to
 * `maxWordsPerVoter`, truncates over-long words client-side);
 * T-468 adds `survey` as the eighth entry (multi-question pre/post
 * survey — voter UI is a vertical form with one input per question;
 * closes the standard-family v1 set);
 * T-469..T-471 add the remaining sibling kinds. Exported so the voter
 * app's `<VoterAppClient>` can pass it in, and so tests can verify the
 * registered + unregistered code paths.
 *
 * NB: the registry's component contract is `ComponentType<VoterInputProps>`
 * — the dispatcher passes `sessionId` + `clipKind` only and never an
 * `onSubmit` callback. View-only kinds (per T-466 the leaderboard is
 * the first) accept the same props shape; they render results-display
 * content with no interactive elements that could emit votes.
 */
export const defaultVoterInputRegistry: VoterInputRegistry = new Map<
  AudienceClipKind,
  ComponentType<VoterInputProps>
>([
  // T-461 — first audience clip family. Sets the precedent for T-462..T-471.
  ['live-poll-multiple-choice', LivePollMultipleChoiceVoterInput],
  // T-462 — second audience clip family. Open-text variant of LivePoll.
  ['live-poll-open-text', LivePollOpenTextVoterInput],
  // T-463 — third audience clip family. Likert / rating variant of LivePoll
  // (closes the LivePoll family).
  ['live-poll-rating', LivePollRatingVoterInput],
  // T-464 — fourth audience clip family. Q&A — voters submit + upvote
  // questions; first non-LivePoll family.
  ['live-qa', LiveQAVoterInput],
  // T-465 — fifth audience clip family. Competitive multi-question quiz
  // (live + final-round snapshot; per-question result + active-question
  // pointer).
  ['live-quiz', LiveQuizVoterInput],
  // T-466 — sixth audience clip family. FIRST view-only kind: the
  // leaderboard is a DERIVED clip per ADR-010 §D2 (`LeaderboardVote =
  // never`); the registered component renders a results-display notice
  // and NEVER emits a vote. Sets the precedent for future view-only
  // siblings (e.g., future results-only display kinds).
  ['leaderboard', LeaderboardViewOnly],
  // T-467 — seventh audience clip family. Live aggregating word weights
  // — voters submit one or more words; the server aggregates per-word
  // frequency. Voter UI parses a comma-separated textarea, slices to
  // `maxWordsPerVoter`, truncates over-long words client-side.
  ['word-cloud', WordCloudVoterInput],
  // T-468 — eighth audience clip family. Multi-question pre/post
  // survey — three question types (`multiple-choice` / `open-text` /
  // `rating`); voter UI is a vertical form with one input per
  // question + a single submit button at the bottom. Closes the
  // standard-family v1 set.
  ['survey', SurveyVoterInput],
]);

/**
 * Generic placeholder rendered when no per-kind component is registered
 * for the supplied `clipKind`. Will fire for every kind in T-456; the
 * registry fills in over T-461..T-471.
 */
export function UnregisteredKindFallback(props: VoterInputProps): ReactElement {
  return (
    <section data-testid="voter-input-unregistered" data-clip-kind={props.clipKind}>
      <h2>Voting unavailable</h2>
      <p>
        Voting for clip kind <code>{props.clipKind}</code> is not yet available in this build.
      </p>
    </section>
  );
}

/**
 * Renders the per-kind voter input for `clipKind`, falling back to
 * `<UnregisteredKindFallback>` when no registry entry is present.
 */
export function VoterInputDispatcher(props: VoterInputDispatcherProps): ReactElement {
  const { registry = defaultVoterInputRegistry, sessionId, clipKind } = props;
  const Component = registry.get(clipKind);
  if (Component === undefined) {
    return <UnregisteredKindFallback sessionId={sessionId} clipKind={clipKind} />;
  }
  return <Component sessionId={sessionId} clipKind={clipKind} />;
}
