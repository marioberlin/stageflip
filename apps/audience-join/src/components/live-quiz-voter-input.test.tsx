// apps/audience-join/src/components/live-quiz-voter-input.test.tsx
// T-465 — RTL tests for the `LiveQuizVoterInputDomain` presentational
// component + the dispatcher-shape wrapper.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LiveQuizVoterInput,
  LiveQuizVoterInputDomain,
  type LiveQuizVoterInputQuestion,
} from './live-quiz-voter-input';

afterEach(() => {
  cleanup();
});

const QUESTIONS: readonly LiveQuizVoterInputQuestion[] = [
  {
    id: 'q1',
    text: 'Capital of France?',
    options: ['London', 'Paris', 'Berlin', 'Madrid'],
  },
  {
    id: 'q2',
    text: '2 + 2 = ?',
    options: ['3', '4', '5', '6'],
  },
];

describe('<LiveQuizVoterInputDomain>', () => {
  it('renders the idle placeholder when activeQuestionId is null', () => {
    render(
      <LiveQuizVoterInputDomain
        questions={QUESTIONS}
        activeQuestionId={null}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId('voter-input-live-quiz-waiting').textContent).toBe(
      'Waiting for next question…',
    );
    expect(screen.queryByTestId('voter-input-live-quiz-options')).toBeNull();
  });

  it('renders the idle placeholder when activeQuestionId does not resolve', () => {
    render(
      <LiveQuizVoterInputDomain
        questions={QUESTIONS}
        activeQuestionId="q-unknown"
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId('voter-input-live-quiz-waiting')).toBeDefined();
  });

  it('renders the active question text + option buttons when resolved', () => {
    render(
      <LiveQuizVoterInputDomain questions={QUESTIONS} activeQuestionId="q1" onSubmit={() => {}} />,
    );
    expect(screen.getByTestId('voter-input-live-quiz-question-text').textContent).toBe(
      'Capital of France?',
    );
    expect(screen.getByTestId('voter-input-live-quiz-option-0').textContent).toBe('London');
    expect(screen.getByTestId('voter-input-live-quiz-option-1').textContent).toBe('Paris');
    expect(screen.getByTestId('voter-input-live-quiz-option-2').textContent).toBe('Berlin');
    expect(screen.getByTestId('voter-input-live-quiz-option-3').textContent).toBe('Madrid');
  });

  it('clicking an option fires onSubmit with the questionId + optionIndex', () => {
    const onSubmit = vi.fn();
    render(
      <LiveQuizVoterInputDomain questions={QUESTIONS} activeQuestionId="q1" onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByTestId('voter-input-live-quiz-option-1'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'live-quiz',
      questionId: 'q1',
      optionIndex: 1,
    });
  });

  it('shows the "Answer submitted" status after a tap', () => {
    render(
      <LiveQuizVoterInputDomain questions={QUESTIONS} activeQuestionId="q1" onSubmit={() => {}} />,
    );
    fireEvent.click(screen.getByTestId('voter-input-live-quiz-option-1'));
    expect(screen.getByTestId('voter-input-live-quiz-submit-status').textContent).toBe(
      'Answer submitted',
    );
  });

  it('locks every option after submit (no further onSubmit fires)', () => {
    const onSubmit = vi.fn();
    render(
      <LiveQuizVoterInputDomain questions={QUESTIONS} activeQuestionId="q1" onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByTestId('voter-input-live-quiz-option-1'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Every option button is now disabled.
    for (let i = 0; i < 4; i += 1) {
      const btn = screen.getByTestId(`voter-input-live-quiz-option-${i}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    }
    fireEvent.click(screen.getByTestId('voter-input-live-quiz-option-0'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('clears the lock when activeQuestionId changes (next question)', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <LiveQuizVoterInputDomain questions={QUESTIONS} activeQuestionId="q1" onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByTestId('voter-input-live-quiz-option-2'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    rerender(
      <LiveQuizVoterInputDomain questions={QUESTIONS} activeQuestionId="q2" onSubmit={onSubmit} />,
    );
    // q2 is now active; options should accept a new tap.
    expect(screen.getByTestId('voter-input-live-quiz-question-text').textContent).toBe('2 + 2 = ?');
    const btn = screen.getByTestId('voter-input-live-quiz-option-1') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith({
      kind: 'live-quiz',
      questionId: 'q2',
      optionIndex: 1,
    });
  });

  it('disabled prop disables every option', () => {
    const onSubmit = vi.fn();
    render(
      <LiveQuizVoterInputDomain
        questions={QUESTIONS}
        activeQuestionId="q1"
        onSubmit={onSubmit}
        disabled
      />,
    );
    for (let i = 0; i < 4; i += 1) {
      const btn = screen.getByTestId(`voter-input-live-quiz-option-${i}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    }
    fireEvent.click(screen.getByTestId('voter-input-live-quiz-option-0'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('<LiveQuizVoterInput> (dispatcher wrapper)', () => {
  it('forwards sessionId + clipKind to the wrapper attributes', () => {
    render(<LiveQuizVoterInput sessionId="sess-99" clipKind="live-quiz" />);
    const wrapper = screen.getByTestId('voter-input-live-quiz-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-99');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-quiz');
  });
});
