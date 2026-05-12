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

import { LivePollMultipleChoiceVoterInput } from './live-poll-multiple-choice-voter-input';
import { LivePollOpenTextVoterInput } from './live-poll-open-text-voter-input';
import { LivePollRatingVoterInput } from './live-poll-rating-voter-input';
import { LiveQAVoterInput } from './live-qa-voter-input';
import { LiveQuizVoterInput } from './live-quiz-voter-input';

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
 * quiz); T-466..T-471 add the remaining sibling kinds. Exported so the
 * voter
 * app's `<VoterAppClient>` can pass it in, and so tests can verify the
 * registered + unregistered code paths.
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
