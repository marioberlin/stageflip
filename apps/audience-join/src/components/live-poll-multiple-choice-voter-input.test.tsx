// apps/audience-join/src/components/live-poll-multiple-choice-voter-input.test.tsx
// T-461 — RTL tests for the `LivePollMultipleChoiceVoterInputDomain`
// presentational component + the dispatcher-shape wrapper.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LivePollMultipleChoiceVoterInput,
  LivePollMultipleChoiceVoterInputDomain,
} from './live-poll-multiple-choice-voter-input';

afterEach(() => {
  cleanup();
});

describe('<LivePollMultipleChoiceVoterInputDomain>', () => {
  it('renders the question + one button per option', () => {
    render(
      <LivePollMultipleChoiceVoterInputDomain
        question="Pick one"
        options={['Red', 'Green', 'Blue']}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText('Pick one')).toBeDefined();
    expect(screen.getByTestId('voter-input-option-0').textContent).toBe('Red');
    expect(screen.getByTestId('voter-input-option-1').textContent).toBe('Green');
    expect(screen.getByTestId('voter-input-option-2').textContent).toBe('Blue');
  });

  it('clicking an option fires onSubmit with the correct vote payload', () => {
    const onSubmit = vi.fn();
    render(
      <LivePollMultipleChoiceVoterInputDomain
        question="q"
        options={['A', 'B']}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-option-1'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'live-poll-multiple-choice',
      optionIndex: 1,
    });
  });

  it('disables every button after the first submission', () => {
    const onSubmit = vi.fn();
    render(
      <LivePollMultipleChoiceVoterInputDomain
        question="q"
        options={['A', 'B']}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-option-0'));
    expect((screen.getByTestId('voter-input-option-0') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('voter-input-option-1') as HTMLButtonElement).disabled).toBe(true);
    // A second click does not fire onSubmit again.
    fireEvent.click(screen.getByTestId('voter-input-option-1'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows a "Vote submitted" status after submission', () => {
    render(
      <LivePollMultipleChoiceVoterInputDomain
        question="q"
        options={['A', 'B']}
        onSubmit={() => {}}
      />,
    );
    expect(screen.queryByTestId('voter-input-status')).toBeNull();
    fireEvent.click(screen.getByTestId('voter-input-option-0'));
    expect(screen.getByTestId('voter-input-status').textContent).toBe('Vote submitted');
  });

  it('disabled prop disables every button without submitting', () => {
    const onSubmit = vi.fn();
    render(
      <LivePollMultipleChoiceVoterInputDomain
        question="q"
        options={['A', 'B']}
        onSubmit={onSubmit}
        disabled
      />,
    );
    expect((screen.getByTestId('voter-input-option-0') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('voter-input-option-0'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('<LivePollMultipleChoiceVoterInput> (dispatcher wrapper)', () => {
  it('forwards sessionId + clipKind to the wrapper attributes', () => {
    render(
      <LivePollMultipleChoiceVoterInput sessionId="sess-99" clipKind="live-poll-multiple-choice" />,
    );
    const wrapper = screen.getByTestId('voter-input-live-poll-multiple-choice-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-99');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-poll-multiple-choice');
  });
});
