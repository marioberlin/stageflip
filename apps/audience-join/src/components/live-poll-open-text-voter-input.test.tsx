// apps/audience-join/src/components/live-poll-open-text-voter-input.test.tsx
// T-462 — RTL tests for the `LivePollOpenTextVoterInputDomain`
// presentational component + the dispatcher-shape wrapper.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LivePollOpenTextVoterInput,
  LivePollOpenTextVoterInputDomain,
} from './live-poll-open-text-voter-input';

afterEach(() => {
  cleanup();
});

describe('<LivePollOpenTextVoterInputDomain>', () => {
  it('renders the question + a textarea with maxLength + a submit button', () => {
    render(
      <LivePollOpenTextVoterInputDomain
        question="What did you think?"
        maxLength={280}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText('What did you think?')).toBeDefined();
    const textarea = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(280);
    expect(textarea.getAttribute('data-max-length')).toBe('280');
    expect(screen.getByTestId('voter-input-submit')).toBeDefined();
  });

  it('submit button is disabled when the input is empty', () => {
    render(<LivePollOpenTextVoterInputDomain question="q" maxLength={100} onSubmit={() => {}} />);
    expect((screen.getByTestId('voter-input-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('submitting fires onSubmit with the trimmed text payload', () => {
    const onSubmit = vi.fn();
    render(<LivePollOpenTextVoterInputDomain question="q" maxLength={100} onSubmit={onSubmit} />);
    const textarea = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '  great talk  ' } });
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'live-poll-open-text',
      text: 'great talk',
    });
  });

  it('disables the input + button after the first submission', () => {
    const onSubmit = vi.fn();
    render(<LivePollOpenTextVoterInputDomain question="q" maxLength={100} onSubmit={onSubmit} />);
    const textarea = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(textarea.disabled).toBe(true);
    expect((screen.getByTestId('voter-input-submit') as HTMLButtonElement).disabled).toBe(true);
    // A second click does not fire onSubmit again.
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows a "Vote submitted" status after submission', () => {
    render(<LivePollOpenTextVoterInputDomain question="q" maxLength={100} onSubmit={() => {}} />);
    expect(screen.queryByTestId('voter-input-status')).toBeNull();
    fireEvent.change(screen.getByTestId('voter-input-textarea'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(screen.getByTestId('voter-input-status').textContent).toBe('Vote submitted');
  });

  it('does not submit when the input is whitespace-only', () => {
    const onSubmit = vi.fn();
    render(<LivePollOpenTextVoterInputDomain question="q" maxLength={100} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('voter-input-textarea'), { target: { value: '    ' } });
    expect((screen.getByTestId('voter-input-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disabled prop disables the input + button without submitting', () => {
    const onSubmit = vi.fn();
    render(
      <LivePollOpenTextVoterInputDomain
        question="q"
        maxLength={100}
        onSubmit={onSubmit}
        disabled
      />,
    );
    expect((screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId('voter-input-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('<LivePollOpenTextVoterInput> (dispatcher wrapper)', () => {
  it('forwards sessionId + clipKind to the wrapper attributes', () => {
    render(<LivePollOpenTextVoterInput sessionId="sess-99" clipKind="live-poll-open-text" />);
    const wrapper = screen.getByTestId('voter-input-live-poll-open-text-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-99');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('live-poll-open-text');
  });
});
