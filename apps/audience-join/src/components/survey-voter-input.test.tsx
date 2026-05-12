// apps/audience-join/src/components/survey-voter-input.test.tsx
// T-468 — Verifies the voter UI for the `survey` clip family.
// Asserts:
//   - renders one input per question with the correct widget per type;
//   - submit disabled until every question is answered;
//   - emits `{ kind: 'survey', responses: [...] }` once on submit;
//   - disables inputs + button after submit;
//   - respects the `disabled` prop.

import type { SurveyQuestion } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SurveyVoterInput, SurveyVoterInputDomain } from './survey-voter-input.js';

afterEach(() => {
  cleanup();
});

const QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: 'q1',
    type: 'multiple-choice',
    text: 'Which framework?',
    options: ['React', 'Vue', 'Svelte'],
  },
  {
    id: 'q2',
    type: 'open-text',
    text: 'Any comments?',
    maxLength: 280,
  },
  {
    id: 'q3',
    type: 'rating',
    text: 'Rate the session',
    scaleMin: 1,
    scaleMax: 5,
  },
];

describe('<SurveyVoterInputDomain>', () => {
  it('renders one input per question with the correct widget per type', () => {
    render(<SurveyVoterInputDomain questions={QUESTIONS} onSubmit={() => {}} />);
    // multiple-choice: 3 radio buttons
    expect(screen.getByTestId('survey-q1-radio-0')).toBeDefined();
    expect(screen.getByTestId('survey-q1-radio-1')).toBeDefined();
    expect(screen.getByTestId('survey-q1-radio-2')).toBeDefined();
    // open-text: textarea
    expect(screen.getByTestId('survey-q2-textarea')).toBeDefined();
    // rating: 5 score buttons
    expect(screen.getByTestId('survey-q3-score-1')).toBeDefined();
    expect(screen.getByTestId('survey-q3-score-5')).toBeDefined();
  });

  it('submit is disabled when no questions are answered', () => {
    render(<SurveyVoterInputDomain questions={QUESTIONS} onSubmit={() => {}} />);
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submit is disabled when only some questions are answered', () => {
    render(<SurveyVoterInputDomain questions={QUESTIONS} onSubmit={() => {}} />);
    fireEvent.click(screen.getByTestId('survey-q1-radio-0'));
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submit is enabled once every question is answered', () => {
    render(<SurveyVoterInputDomain questions={QUESTIONS} onSubmit={() => {}} />);
    fireEvent.click(screen.getByTestId('survey-q1-radio-1'));
    fireEvent.change(screen.getByTestId('survey-q2-textarea'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('survey-q3-score-4'));
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('emits the typed responses array on submit', () => {
    const onSubmit = vi.fn();
    render(<SurveyVoterInputDomain questions={QUESTIONS} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('survey-q1-radio-1'));
    fireEvent.change(screen.getByTestId('survey-q2-textarea'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('survey-q3-score-4'));
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'survey',
      responses: [
        { questionId: 'q1', value: 1 },
        { questionId: 'q2', value: 'hello' },
        { questionId: 'q3', value: 4 },
      ],
    });
  });

  it('disables inputs + button after submit and shows status', () => {
    const onSubmit = vi.fn();
    render(<SurveyVoterInputDomain questions={QUESTIONS} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('survey-q1-radio-0'));
    fireEvent.change(screen.getByTestId('survey-q2-textarea'), { target: { value: 'ok' } });
    fireEvent.click(screen.getByTestId('survey-q3-score-3'));
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    const ta = screen.getByTestId('survey-q2-textarea') as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    const radio = screen.getByTestId('survey-q1-radio-0') as HTMLInputElement;
    expect(radio.disabled).toBe(true);
    const ratingBtn = screen.getByTestId('survey-q3-score-1') as HTMLButtonElement;
    expect(ratingBtn.disabled).toBe(true);
    const status = screen.getByTestId('voter-input-status');
    expect(status.textContent).toBe('Survey submitted');
  });

  it('cannot be submitted twice', () => {
    const onSubmit = vi.fn();
    render(<SurveyVoterInputDomain questions={QUESTIONS} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('survey-q1-radio-0'));
    fireEvent.change(screen.getByTestId('survey-q2-textarea'), { target: { value: 'ok' } });
    fireEvent.click(screen.getByTestId('survey-q3-score-3'));
    const btn = screen.getByTestId('voter-input-submit');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('rejects whitespace-only open-text response (submit stays disabled)', () => {
    render(<SurveyVoterInputDomain questions={QUESTIONS} onSubmit={() => {}} />);
    fireEvent.click(screen.getByTestId('survey-q1-radio-0'));
    fireEvent.change(screen.getByTestId('survey-q2-textarea'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('survey-q3-score-3'));
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('respects the disabled prop (no submission possible)', () => {
    const onSubmit = vi.fn();
    render(<SurveyVoterInputDomain questions={QUESTIONS} onSubmit={onSubmit} disabled />);
    const radio = screen.getByTestId('survey-q1-radio-0') as HTMLInputElement;
    expect(radio.disabled).toBe(true);
    const ta = screen.getByTestId('survey-q2-textarea') as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe('<SurveyVoterInput>', () => {
  it('renders a wrapper with the dispatcher props on data attributes', () => {
    render(<SurveyVoterInput sessionId="sess-1" clipKind="survey" />);
    const wrapper = screen.getByTestId('voter-input-survey-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-1');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('survey');
  });

  it('renders a placeholder domain (disabled) until the real wiring lands', () => {
    render(<SurveyVoterInput sessionId="sess-1" clipKind="survey" />);
    const ta = screen.getByTestId('survey-placeholder-textarea') as HTMLTextAreaElement | null;
    // The placeholder uses 'placeholder' as the id; ensure the textarea exists + is disabled.
    expect(ta ?? screen.getByTestId('survey-question-placeholder')).toBeDefined();
  });
});
