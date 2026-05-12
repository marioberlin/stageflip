// apps/audience-join/src/components/live-qa-voter-input.test.tsx
// T-464 — RTL tests for the `LiveQAVoterInputDomain` presentational
// component + the dispatcher-shape wrapper.

import type { LiveQAAggregation } from '@stageflip/audience-contract';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LiveQAVoterInput, LiveQAVoterInputDomain } from './live-qa-voter-input';

afterEach(() => {
  cleanup();
});

const SNAPSHOT: LiveQAAggregation = {
  kind: 'live-qa',
  questions: [
    {
      id: 'q1',
      text: 'How do hooks work?',
      upvotes: 12,
      submittedAt: '2026-05-12T10:00:00Z',
    },
    {
      id: 'q2',
      text: 'When is the next release?',
      upvotes: 8,
      submittedAt: '2026-05-12T10:01:00Z',
    },
  ],
  totalQuestions: 2,
};

describe('<LiveQAVoterInputDomain>', () => {
  it('renders the topic + tabs', () => {
    render(
      <LiveQAVoterInputDomain
        topic="Ask the speaker"
        maxLength={500}
        allowUpvoting
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText('Ask the speaker')).toBeDefined();
    expect(screen.getByTestId('voter-input-live-qa-tab-submit')).toBeDefined();
    expect(screen.getByTestId('voter-input-live-qa-tab-browse')).toBeDefined();
  });

  it('starts on the Submit tab and shows the textarea', () => {
    render(<LiveQAVoterInputDomain topic="t" maxLength={500} allowUpvoting onSubmit={() => {}} />);
    expect(screen.getByTestId('voter-input-live-qa-submit-panel')).toBeDefined();
    expect(screen.queryByTestId('voter-input-live-qa-browse-panel')).toBeNull();
    expect(screen.getByTestId('voter-input-live-qa-textarea')).toBeDefined();
  });

  it('switches to the Browse tab when its button is clicked', () => {
    render(
      <LiveQAVoterInputDomain
        topic="t"
        maxLength={500}
        allowUpvoting
        questionsSnapshot={SNAPSHOT}
        onSubmit={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-live-qa-tab-browse'));
    expect(screen.getByTestId('voter-input-live-qa-browse-panel')).toBeDefined();
    expect(screen.queryByTestId('voter-input-live-qa-submit-panel')).toBeNull();
  });

  it('clicking submit fires onSubmit with action="submit" + the text', () => {
    const onSubmit = vi.fn();
    render(<LiveQAVoterInputDomain topic="t" maxLength={500} allowUpvoting onSubmit={onSubmit} />);
    const textarea = screen.getByTestId('voter-input-live-qa-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello?' } });
    fireEvent.click(screen.getByTestId('voter-input-live-qa-submit-button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'live-qa',
      action: 'submit',
      text: 'Hello?',
    });
  });

  it('shows "Question submitted" status after submission and clears the textarea', () => {
    render(<LiveQAVoterInputDomain topic="t" maxLength={500} allowUpvoting onSubmit={() => {}} />);
    const textarea = screen.getByTestId('voter-input-live-qa-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'My question' } });
    fireEvent.click(screen.getByTestId('voter-input-live-qa-submit-button'));
    expect(screen.getByTestId('voter-input-live-qa-submit-status').textContent).toBe(
      'Question submitted',
    );
    expect(textarea.value).toBe('');
  });

  it('disables submit when the textarea is empty (or whitespace-only)', () => {
    const onSubmit = vi.fn();
    render(<LiveQAVoterInputDomain topic="t" maxLength={500} allowUpvoting onSubmit={onSubmit} />);
    const button = screen.getByTestId('voter-input-live-qa-submit-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const textarea = screen.getByTestId('voter-input-live-qa-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Browse tab renders a placeholder when no snapshot is provided', () => {
    render(<LiveQAVoterInputDomain topic="t" maxLength={500} allowUpvoting onSubmit={() => {}} />);
    fireEvent.click(screen.getByTestId('voter-input-live-qa-tab-browse'));
    expect(screen.getByTestId('voter-input-live-qa-browse-empty').textContent).toBe(
      'Waiting for questions…',
    );
  });

  it('Browse tab renders the questions list with upvote buttons when allowUpvoting=true', () => {
    render(
      <LiveQAVoterInputDomain
        topic="t"
        maxLength={500}
        allowUpvoting
        questionsSnapshot={SNAPSHOT}
        onSubmit={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-live-qa-tab-browse'));
    expect(screen.getByTestId('voter-input-live-qa-browse-item-0')).toBeDefined();
    expect(screen.getByTestId('voter-input-live-qa-browse-item-1')).toBeDefined();
    expect(screen.getByTestId('voter-input-live-qa-browse-upvote-0')).toBeDefined();
    expect(screen.getByTestId('voter-input-live-qa-browse-upvote-1')).toBeDefined();
  });

  it('Browse tab hides upvote buttons when allowUpvoting=false', () => {
    render(
      <LiveQAVoterInputDomain
        topic="t"
        maxLength={500}
        allowUpvoting={false}
        questionsSnapshot={SNAPSHOT}
        onSubmit={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-live-qa-tab-browse'));
    expect(screen.getByTestId('voter-input-live-qa-browse-item-0')).toBeDefined();
    expect(screen.queryByTestId('voter-input-live-qa-browse-upvote-0')).toBeNull();
    expect(screen.queryByTestId('voter-input-live-qa-browse-upvote-1')).toBeNull();
  });

  it('clicking an upvote button fires onSubmit with action="upvote" + questionId', () => {
    const onSubmit = vi.fn();
    render(
      <LiveQAVoterInputDomain
        topic="t"
        maxLength={500}
        allowUpvoting
        questionsSnapshot={SNAPSHOT}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-live-qa-tab-browse'));
    fireEvent.click(screen.getByTestId('voter-input-live-qa-browse-upvote-0'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'live-qa',
      action: 'upvote',
      questionId: 'q1',
    });
  });

  it('disables an already-upvoted question button (per-questionId memo)', () => {
    const onSubmit = vi.fn();
    render(
      <LiveQAVoterInputDomain
        topic="t"
        maxLength={500}
        allowUpvoting
        questionsSnapshot={SNAPSHOT}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-live-qa-tab-browse'));
    fireEvent.click(screen.getByTestId('voter-input-live-qa-browse-upvote-0'));
    const btn0 = screen.getByTestId('voter-input-live-qa-browse-upvote-0') as HTMLButtonElement;
    expect(btn0.disabled).toBe(true);
    expect(btn0.textContent).toBe('Upvoted');
    // A second click on the same question does not fire onSubmit again.
    fireEvent.click(btn0);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // A different question's button is still enabled and works.
    const btn1 = screen.getByTestId('voter-input-live-qa-browse-upvote-1') as HTMLButtonElement;
    expect(btn1.disabled).toBe(false);
    fireEvent.click(btn1);
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith({
      kind: 'live-qa',
      action: 'upvote',
      questionId: 'q2',
    });
  });

  it('disabled prop disables every input', () => {
    const onSubmit = vi.fn();
    render(
      <LiveQAVoterInputDomain
        topic="t"
        maxLength={500}
        allowUpvoting
        questionsSnapshot={SNAPSHOT}
        onSubmit={onSubmit}
        disabled
      />,
    );
    const textarea = screen.getByTestId('voter-input-live-qa-textarea') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
    const submitBtn = screen.getByTestId('voter-input-live-qa-submit-button') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('voter-input-live-qa-tab-browse'));
    const upvote0 = screen.getByTestId('voter-input-live-qa-browse-upvote-0') as HTMLButtonElement;
    expect(upvote0.disabled).toBe(true);
    fireEvent.click(upvote0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('respects maxLength on the textarea', () => {
    render(<LiveQAVoterInputDomain topic="t" maxLength={42} allowUpvoting onSubmit={() => {}} />);
    const textarea = screen.getByTestId('voter-input-live-qa-textarea') as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(42);
  });
});

describe('<LiveQAVoterInput> (dispatcher wrapper)', () => {
  it('forwards sessionId + clipKind to the wrapper attributes', () => {
    render(<LiveQAVoterInput sessionId="sess-99" clipKind="live-qa" />);
    const wrapper = screen.getByTestId('voter-input-live-qa-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-99');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-qa');
  });
});
