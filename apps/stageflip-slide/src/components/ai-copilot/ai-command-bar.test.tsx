// apps/stageflip-slide/src/components/ai-copilot/ai-command-bar.test.tsx

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiCommandBar } from './ai-command-bar';

afterEach(() => cleanup());

describe('<AiCommandBar>', () => {
  it('renders the title, status label, and close button', () => {
    render(<AiCommandBar status="idle" onClose={() => undefined} />);
    expect(screen.getByTestId('ai-command-bar')).toBeTruthy();
    expect(screen.getByTestId('ai-command-bar-status').textContent).toMatch(/idle/i);
    expect(screen.getByTestId('ai-command-bar-close')).toBeTruthy();
  });

  it('surfaces the current status via data-status + a per-status label', () => {
    const { rerender } = render(<AiCommandBar status="idle" onClose={() => undefined} />);
    expect(screen.getByTestId('ai-command-bar').getAttribute('data-status')).toBe('idle');

    rerender(<AiCommandBar status="pending" onClose={() => undefined} />);
    expect(screen.getByTestId('ai-command-bar').getAttribute('data-status')).toBe('pending');
    expect(screen.getByTestId('ai-command-bar-status').textContent).toMatch(/thinking/i);

    rerender(<AiCommandBar status="error" onClose={() => undefined} />);
    expect(screen.getByTestId('ai-command-bar-status').textContent).toMatch(/error/i);
  });

  it('invokes onClose when the close affordance is clicked', () => {
    const onClose = vi.fn();
    render(<AiCommandBar status="idle" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('ai-command-bar-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
