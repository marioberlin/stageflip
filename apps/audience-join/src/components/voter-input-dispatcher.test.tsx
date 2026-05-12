// apps/audience-join/src/components/voter-input-dispatcher.test.tsx
// T-456 — Verifies the dispatcher routes to a registered per-kind
// component and falls back to the placeholder for unregistered kinds.

import { AUDIENCE_CLIP_KINDS, type AudienceClipKind } from '@stageflip/audience-contract';
import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  UnregisteredKindFallback,
  VoterInputDispatcher,
  type VoterInputProps,
  type VoterInputRegistry,
  defaultVoterInputRegistry,
} from './voter-input-dispatcher.js';

afterEach(() => {
  cleanup();
});

describe('defaultVoterInputRegistry', () => {
  it('contains the live-poll-multiple-choice + live-poll-open-text + live-poll-rating + live-qa + live-quiz + leaderboard + word-cloud entries (T-461..T-467)', () => {
    // T-461 added the first entry; T-462 added the second; T-463 added the third;
    // T-464 added the fourth (first non-LivePoll family); T-465 added the fifth
    // (competitive multi-question quiz); T-466 added the sixth — first view-only
    // kind (leaderboard; `LeaderboardVote = never` per ADR-010 §D2);
    // T-467 added the seventh — word-cloud (live aggregating word weights;
    // voter UI parses a comma-separated list). Bumped 6 → 7.
    expect(defaultVoterInputRegistry.size).toBe(7);
    expect(defaultVoterInputRegistry.has('live-poll-multiple-choice')).toBe(true);
    expect(defaultVoterInputRegistry.has('live-poll-open-text')).toBe(true);
    expect(defaultVoterInputRegistry.has('live-poll-rating')).toBe(true);
    expect(defaultVoterInputRegistry.has('live-qa')).toBe(true);
    expect(defaultVoterInputRegistry.has('live-quiz')).toBe(true);
    expect(defaultVoterInputRegistry.has('leaderboard')).toBe(true);
    expect(defaultVoterInputRegistry.has('word-cloud')).toBe(true);
  });
});

describe('<VoterInputDispatcher>', () => {
  it.each<AudienceClipKind>(
    AUDIENCE_CLIP_KINDS.filter(
      (k) =>
        k !== 'live-poll-multiple-choice' &&
        k !== 'live-poll-open-text' &&
        k !== 'live-poll-rating' &&
        k !== 'live-qa' &&
        k !== 'live-quiz' &&
        k !== 'leaderboard' &&
        k !== 'word-cloud',
    ),
  )('falls back to UnregisteredKindFallback for unregistered kind %s', (kind) => {
    render(<VoterInputDispatcher sessionId="s" clipKind={kind} />);
    const placeholder = screen.getByTestId('voter-input-unregistered');
    expect(placeholder.getAttribute('data-clip-kind')).toBe(kind);
  });

  it('resolves live-poll-multiple-choice to the LivePollMultipleChoiceVoterInput (T-461)', () => {
    render(<VoterInputDispatcher sessionId="sess-default" clipKind="live-poll-multiple-choice" />);
    const wrapper = screen.getByTestId('voter-input-live-poll-multiple-choice-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-default');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-poll-multiple-choice');
    expect(screen.queryByTestId('voter-input-unregistered')).toBeNull();
  });

  it('resolves live-poll-open-text to the LivePollOpenTextVoterInput (T-462)', () => {
    render(<VoterInputDispatcher sessionId="sess-ot" clipKind="live-poll-open-text" />);
    const wrapper = screen.getByTestId('voter-input-live-poll-open-text-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-ot');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-poll-open-text');
    expect(screen.queryByTestId('voter-input-unregistered')).toBeNull();
  });

  it('resolves live-poll-rating to the LivePollRatingVoterInput (T-463)', () => {
    render(<VoterInputDispatcher sessionId="sess-rating" clipKind="live-poll-rating" />);
    const wrapper = screen.getByTestId('voter-input-live-poll-rating-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-rating');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-poll-rating');
    expect(screen.queryByTestId('voter-input-unregistered')).toBeNull();
  });

  it('resolves live-qa to the LiveQAVoterInput (T-464)', () => {
    render(<VoterInputDispatcher sessionId="sess-qa" clipKind="live-qa" />);
    const wrapper = screen.getByTestId('voter-input-live-qa-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-qa');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-qa');
    expect(screen.queryByTestId('voter-input-unregistered')).toBeNull();
  });

  it('resolves live-quiz to the LiveQuizVoterInput (T-465)', () => {
    render(<VoterInputDispatcher sessionId="sess-quiz" clipKind="live-quiz" />);
    const wrapper = screen.getByTestId('voter-input-live-quiz-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-quiz');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-quiz');
    expect(screen.queryByTestId('voter-input-unregistered')).toBeNull();
  });

  it('resolves word-cloud to the WordCloudVoterInput (T-467)', () => {
    render(<VoterInputDispatcher sessionId="sess-wc" clipKind="word-cloud" />);
    const wrapper = screen.getByTestId('voter-input-word-cloud-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-wc');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('word-cloud');
    expect(screen.queryByTestId('voter-input-unregistered')).toBeNull();
  });

  it('resolves leaderboard to the LeaderboardViewOnly (T-466 — view-only)', () => {
    render(<VoterInputDispatcher sessionId="sess-lb" clipKind="leaderboard" />);
    const wrapper = screen.getByTestId('voter-input-leaderboard-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-lb');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('leaderboard');
    expect(screen.queryByTestId('voter-input-unregistered')).toBeNull();
    // T-466 — view-only kinds NEVER emit votes. The dispatched component
    // must not introduce vote-emitting controls.
    const notice = screen.getByTestId('voter-input-leaderboard-notice');
    expect(notice.textContent).toMatch(/results display/i);
    expect(document.querySelectorAll('button').length).toBe(0);
  });

  it('renders the registered component when one is supplied', () => {
    const Stub: ComponentType<VoterInputProps> = ({ sessionId, clipKind }) => (
      <div data-testid="stub-voter-input" data-session-id={sessionId} data-clip-kind={clipKind} />
    );
    const registry: VoterInputRegistry = new Map<AudienceClipKind, ComponentType<VoterInputProps>>([
      ['live-poll-multiple-choice', Stub],
    ]);

    render(
      <VoterInputDispatcher
        sessionId="sess-1"
        clipKind="live-poll-multiple-choice"
        registry={registry}
      />,
    );

    const el = screen.getByTestId('stub-voter-input');
    expect(el.getAttribute('data-session-id')).toBe('sess-1');
    expect(el.getAttribute('data-clip-kind')).toBe('live-poll-multiple-choice');
    expect(screen.queryByTestId('voter-input-unregistered')).toBeNull();
  });
});

describe('<UnregisteredKindFallback>', () => {
  it('mentions the clip kind in the body', () => {
    render(<UnregisteredKindFallback sessionId="s" clipKind="heatmap" />);
    expect(screen.getByText(/heatmap/)).toBeDefined();
  });
});
