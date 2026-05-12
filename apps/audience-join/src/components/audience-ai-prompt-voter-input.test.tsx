// apps/audience-join/src/components/audience-ai-prompt-voter-input.test.tsx
// T-471 — RTL tests for the `AudienceAiPromptVoterInputDomain`
// presentational component + the dispatcher-shape wrapper.

import type { AudienceAiPromptAggregation } from '@stageflip/audience-contract';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AudienceAiPromptVoterInput,
  AudienceAiPromptVoterInputDomain,
} from './audience-ai-prompt-voter-input';

afterEach(() => {
  cleanup();
});

const SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: [
    { id: 'p1', text: 'A sunset over mountains', upvotes: 18 },
    { id: 'p2', text: 'A cat in space', upvotes: 12 },
  ],
  winnerPromptId: null,
  generatedAssetCacheKey: null,
};

describe('<AudienceAiPromptVoterInputDomain>', () => {
  it('renders the prompt + tabs', () => {
    render(
      <AudienceAiPromptVoterInputDomain
        prompt="What should we generate next?"
        maxPromptLength={200}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText('What should we generate next?')).toBeDefined();
    expect(screen.getByTestId('voter-input-audience-ai-prompt-tab-submit')).toBeDefined();
    expect(screen.getByTestId('voter-input-audience-ai-prompt-tab-browse')).toBeDefined();
  });

  it('starts on the Submit tab and shows the textarea', () => {
    render(
      <AudienceAiPromptVoterInputDomain prompt="p" maxPromptLength={200} onSubmit={() => {}} />,
    );
    expect(screen.getByTestId('voter-input-audience-ai-prompt-submit-panel')).toBeDefined();
    expect(screen.queryByTestId('voter-input-audience-ai-prompt-browse-panel')).toBeNull();
    expect(screen.getByTestId('voter-input-audience-ai-prompt-textarea')).toBeDefined();
  });

  it('switches to the Browse tab when its button is clicked', () => {
    render(
      <AudienceAiPromptVoterInputDomain
        prompt="p"
        maxPromptLength={200}
        promptsSnapshot={SNAPSHOT}
        onSubmit={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-tab-browse'));
    expect(screen.getByTestId('voter-input-audience-ai-prompt-browse-panel')).toBeDefined();
    expect(screen.queryByTestId('voter-input-audience-ai-prompt-submit-panel')).toBeNull();
  });

  it('clicking submit fires onSubmit with action="submit" + the text', () => {
    const onSubmit = vi.fn();
    render(
      <AudienceAiPromptVoterInputDomain prompt="p" maxPromptLength={200} onSubmit={onSubmit} />,
    );
    const textarea = screen.getByTestId(
      'voter-input-audience-ai-prompt-textarea',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'A purple dragon' } });
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-submit-button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'audience-ai-prompt',
      action: 'submit',
      text: 'A purple dragon',
    });
  });

  it('shows "Prompt submitted" status after submission and clears the textarea', () => {
    render(
      <AudienceAiPromptVoterInputDomain prompt="p" maxPromptLength={200} onSubmit={() => {}} />,
    );
    const textarea = screen.getByTestId(
      'voter-input-audience-ai-prompt-textarea',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'My prompt' } });
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-submit-button'));
    expect(screen.getByTestId('voter-input-audience-ai-prompt-submit-status').textContent).toBe(
      'Prompt submitted',
    );
    expect(textarea.value).toBe('');
  });

  it('disables submit when the textarea is empty (or whitespace-only)', () => {
    const onSubmit = vi.fn();
    render(
      <AudienceAiPromptVoterInputDomain prompt="p" maxPromptLength={200} onSubmit={onSubmit} />,
    );
    const button = screen.getByTestId(
      'voter-input-audience-ai-prompt-submit-button',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const textarea = screen.getByTestId(
      'voter-input-audience-ai-prompt-textarea',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Browse tab renders a placeholder when no snapshot is provided', () => {
    render(
      <AudienceAiPromptVoterInputDomain prompt="p" maxPromptLength={200} onSubmit={() => {}} />,
    );
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-tab-browse'));
    expect(screen.getByTestId('voter-input-audience-ai-prompt-browse-empty').textContent).toBe(
      'Waiting for prompts…',
    );
  });

  it('Browse tab renders the prompt list with upvote buttons', () => {
    render(
      <AudienceAiPromptVoterInputDomain
        prompt="p"
        maxPromptLength={200}
        promptsSnapshot={SNAPSHOT}
        onSubmit={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-tab-browse'));
    expect(screen.getByTestId('voter-input-audience-ai-prompt-browse-item-0')).toBeDefined();
    expect(screen.getByTestId('voter-input-audience-ai-prompt-browse-item-1')).toBeDefined();
    expect(screen.getByTestId('voter-input-audience-ai-prompt-browse-upvote-0')).toBeDefined();
    expect(screen.getByTestId('voter-input-audience-ai-prompt-browse-upvote-1')).toBeDefined();
  });

  it('clicking an upvote button fires onSubmit with action="upvote" + promptId', () => {
    const onSubmit = vi.fn();
    render(
      <AudienceAiPromptVoterInputDomain
        prompt="p"
        maxPromptLength={200}
        promptsSnapshot={SNAPSHOT}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-tab-browse'));
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-browse-upvote-0'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'audience-ai-prompt',
      action: 'upvote',
      promptId: 'p1',
    });
  });

  it('disables an already-upvoted prompt button (per-promptId memo)', () => {
    const onSubmit = vi.fn();
    render(
      <AudienceAiPromptVoterInputDomain
        prompt="p"
        maxPromptLength={200}
        promptsSnapshot={SNAPSHOT}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-tab-browse'));
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-browse-upvote-0'));
    const btn0 = screen.getByTestId(
      'voter-input-audience-ai-prompt-browse-upvote-0',
    ) as HTMLButtonElement;
    expect(btn0.disabled).toBe(true);
    expect(btn0.textContent).toBe('Upvoted');
    fireEvent.click(btn0);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // A different prompt's button is still enabled.
    const btn1 = screen.getByTestId(
      'voter-input-audience-ai-prompt-browse-upvote-1',
    ) as HTMLButtonElement;
    expect(btn1.disabled).toBe(false);
    fireEvent.click(btn1);
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith({
      kind: 'audience-ai-prompt',
      action: 'upvote',
      promptId: 'p2',
    });
  });

  it('lock-when-winner-set: every input disabled + status line shows winner', () => {
    const onSubmit = vi.fn();
    const lockedSnapshot: AudienceAiPromptAggregation = {
      ...SNAPSHOT,
      winnerPromptId: 'p1',
    };
    render(
      <AudienceAiPromptVoterInputDomain
        prompt="p"
        maxPromptLength={200}
        promptsSnapshot={lockedSnapshot}
        winnerPromptId="p1"
        onSubmit={onSubmit}
      />,
    );
    // Status line present.
    const status = screen.getByTestId('voter-input-audience-ai-prompt-locked');
    expect(status.textContent).toBe('Voting ended. Winner: A sunset over mountains');
    // Submit tab inputs locked.
    const textarea = screen.getByTestId(
      'voter-input-audience-ai-prompt-textarea',
    ) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
    fireEvent.change(textarea, { target: { value: 'hi' } });
    const submitBtn = screen.getByTestId(
      'voter-input-audience-ai-prompt-submit-button',
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    fireEvent.click(submitBtn);
    expect(onSubmit).not.toHaveBeenCalled();
    // Browse tab upvotes locked.
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-tab-browse'));
    const upvote0 = screen.getByTestId(
      'voter-input-audience-ai-prompt-browse-upvote-0',
    ) as HTMLButtonElement;
    expect(upvote0.disabled).toBe(true);
    fireEvent.click(upvote0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disabled prop disables every input', () => {
    const onSubmit = vi.fn();
    render(
      <AudienceAiPromptVoterInputDomain
        prompt="p"
        maxPromptLength={200}
        promptsSnapshot={SNAPSHOT}
        onSubmit={onSubmit}
        disabled
      />,
    );
    const textarea = screen.getByTestId(
      'voter-input-audience-ai-prompt-textarea',
    ) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
    const submitBtn = screen.getByTestId(
      'voter-input-audience-ai-prompt-submit-button',
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('voter-input-audience-ai-prompt-tab-browse'));
    const upvote0 = screen.getByTestId(
      'voter-input-audience-ai-prompt-browse-upvote-0',
    ) as HTMLButtonElement;
    expect(upvote0.disabled).toBe(true);
    fireEvent.click(upvote0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('respects maxPromptLength on the textarea', () => {
    render(
      <AudienceAiPromptVoterInputDomain prompt="p" maxPromptLength={42} onSubmit={() => {}} />,
    );
    const textarea = screen.getByTestId(
      'voter-input-audience-ai-prompt-textarea',
    ) as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(42);
  });
});

describe('<AudienceAiPromptVoterInput> (dispatcher wrapper)', () => {
  it('forwards sessionId + clipKind to the wrapper attributes', () => {
    render(<AudienceAiPromptVoterInput sessionId="sess-99" clipKind="audience-ai-prompt" />);
    const wrapper = screen.getByTestId('voter-input-audience-ai-prompt-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-99');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('audience-ai-prompt');
  });

  it('renders a disabled placeholder until the real wiring lands', () => {
    render(<AudienceAiPromptVoterInput sessionId="sess-1" clipKind="audience-ai-prompt" />);
    const textarea = screen.getByTestId(
      'voter-input-audience-ai-prompt-textarea',
    ) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });
});
