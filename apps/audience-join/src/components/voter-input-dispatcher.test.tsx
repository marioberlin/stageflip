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
  it('contains the live-poll-multiple-choice + live-poll-open-text entries (T-461 + T-462)', () => {
    // T-461 added the first entry; T-462 added the second. Bumped 1 → 2.
    expect(defaultVoterInputRegistry.size).toBe(2);
    expect(defaultVoterInputRegistry.has('live-poll-multiple-choice')).toBe(true);
    expect(defaultVoterInputRegistry.has('live-poll-open-text')).toBe(true);
  });
});

describe('<VoterInputDispatcher>', () => {
  it.each<AudienceClipKind>(
    AUDIENCE_CLIP_KINDS.filter(
      (k) => k !== 'live-poll-multiple-choice' && k !== 'live-poll-open-text',
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
