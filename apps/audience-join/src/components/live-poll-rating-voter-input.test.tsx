// apps/audience-join/src/components/live-poll-rating-voter-input.test.tsx
// T-463 — RTL tests for the `LivePollRatingVoterInputDomain`
// presentational component + the dispatcher-shape wrapper.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LivePollRatingVoterInput,
  LivePollRatingVoterInputDomain,
} from './live-poll-rating-voter-input';

afterEach(() => {
  cleanup();
});

describe('<LivePollRatingVoterInputDomain>', () => {
  it('renders the question + scaleMax rating buttons', () => {
    render(
      <LivePollRatingVoterInputDomain question="Rate the talk" scaleMax={5} onSubmit={() => {}} />,
    );
    expect(screen.getByText('Rate the talk')).toBeDefined();
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`voter-input-rating-${i}`)).toBeDefined();
    }
    // Sanity: the row exists.
    expect(screen.getByTestId('voter-input-rating-row')).toBeDefined();
  });

  it('renders different button counts for different scaleMax values', () => {
    render(<LivePollRatingVoterInputDomain question="NPS?" scaleMax={10} onSubmit={() => {}} />);
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByTestId(`voter-input-rating-${i}`)).toBeDefined();
    }
    expect(screen.queryByTestId('voter-input-rating-11')).toBeNull();
  });

  it('clicking a rating button fires onSubmit with the 1-indexed score', () => {
    const onSubmit = vi.fn();
    render(<LivePollRatingVoterInputDomain question="q" scaleMax={5} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('voter-input-rating-3'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'live-poll-rating',
      score: 3,
    });
  });

  it('disables all buttons after the first submission', () => {
    const onSubmit = vi.fn();
    render(<LivePollRatingVoterInputDomain question="q" scaleMax={5} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('voter-input-rating-2'));
    for (let i = 1; i <= 5; i++) {
      const btn = screen.getByTestId(`voter-input-rating-${i}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    }
    // A second click does not fire onSubmit again.
    fireEvent.click(screen.getByTestId('voter-input-rating-4'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows a "Vote submitted" status after submission', () => {
    render(<LivePollRatingVoterInputDomain question="q" scaleMax={5} onSubmit={() => {}} />);
    expect(screen.queryByTestId('voter-input-status')).toBeNull();
    fireEvent.click(screen.getByTestId('voter-input-rating-1'));
    expect(screen.getByTestId('voter-input-status').textContent).toBe('Vote submitted');
  });

  it('disabled prop disables the buttons without submitting', () => {
    const onSubmit = vi.fn();
    render(
      <LivePollRatingVoterInputDomain question="q" scaleMax={5} onSubmit={onSubmit} disabled />,
    );
    for (let i = 1; i <= 5; i++) {
      const btn = screen.getByTestId(`voter-input-rating-${i}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    }
    fireEvent.click(screen.getByTestId('voter-input-rating-3'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders end labels under the row when labels is supplied', () => {
    render(
      <LivePollRatingVoterInputDomain
        question="q"
        scaleMax={5}
        labels={['Strongly disagree', 'Strongly agree']}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId('voter-input-rating-label-left').textContent).toBe(
      'Strongly disagree',
    );
    expect(screen.getByTestId('voter-input-rating-label-right').textContent).toBe('Strongly agree');
  });

  it('omits end labels when labels is omitted', () => {
    render(<LivePollRatingVoterInputDomain question="q" scaleMax={5} onSubmit={() => {}} />);
    expect(screen.queryByTestId('voter-input-rating-end-labels')).toBeNull();
  });
});

describe('<LivePollRatingVoterInput> (dispatcher wrapper)', () => {
  it('forwards sessionId + clipKind to the wrapper attributes', () => {
    render(<LivePollRatingVoterInput sessionId="sess-99" clipKind="live-poll-rating" />);
    const wrapper = screen.getByTestId('voter-input-live-poll-rating-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-99');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-poll-rating');
  });
});
