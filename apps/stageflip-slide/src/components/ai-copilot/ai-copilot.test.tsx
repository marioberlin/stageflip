// apps/stageflip-slide/src/components/ai-copilot/ai-copilot.test.tsx

import { EditorShell } from '@stageflip/editor-shell';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiCopilot } from './ai-copilot';
import type { AgentExecuteResult } from './execute-agent';

afterEach(() => cleanup());

function withShell(ui: ReactElement): ReactElement {
  return <EditorShell>{ui}</EditorShell>;
}

describe('<AiCopilot>', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(withShell(<AiCopilot open={false} onClose={() => undefined} />));
    expect(container.querySelector('[data-testid="ai-copilot"]')).toBeNull();
  });

  it('renders the sidebar + welcome system message when open', () => {
    render(withShell(<AiCopilot open onClose={() => undefined} />));
    expect(screen.getByTestId('ai-copilot')).toBeTruthy();
    const systemMsgs = screen.getAllByTestId('ai-message-system');
    expect(systemMsgs.length).toBe(1);
    expect(systemMsgs[0]?.textContent).toMatch(/tweak slides/i);
  });

  it('disables Send while input is empty', () => {
    render(withShell(<AiCopilot open onClose={() => undefined} />));
    expect((screen.getByTestId('ai-copilot-send') as HTMLButtonElement).disabled).toBe(true);
  });

  it('submits the prompt, clears input, renders the user message, and shows the pending placeholder on 501', async () => {
    const executor = vi.fn().mockResolvedValue({
      kind: 'pending',
      message: 'not yet',
      phase: 'phase-7',
    } as AgentExecuteResult);
    render(withShell(<AiCopilot open onClose={() => undefined} executor={executor} />));
    const input = screen.getByTestId('ai-copilot-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Add a title slide' } });
    fireEvent.submit(screen.getByTestId('ai-copilot-form'));
    await waitFor(() => {
      expect(screen.getByTestId('ai-message-user').textContent).toBe('Add a title slide');
    });
    expect(input.value).toBe('');
    expect(executor).toHaveBeenCalledWith('Add a title slide');
    await waitFor(() => {
      const assistant = screen.getByTestId('ai-message-assistant');
      expect(assistant.textContent).toMatch(/Phase 7/i);
      expect(assistant.textContent).toMatch(/phase-7/);
    });
  });

  it('shows the error prefix on executor error and flips status to error', async () => {
    const executor = vi.fn().mockResolvedValue({
      kind: 'error',
      message: 'offline',
    } as AgentExecuteResult);
    render(withShell(<AiCopilot open onClose={() => undefined} executor={executor} />));
    const input = screen.getByTestId('ai-copilot-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'anything' } });
    fireEvent.submit(screen.getByTestId('ai-copilot-form'));
    await waitFor(() => {
      expect(screen.getByTestId('ai-message-assistant').textContent).toMatch(/offline/);
    });
    expect(screen.getByTestId('ai-command-bar').getAttribute('data-status')).toBe('error');
  });

  it('ignores empty / whitespace-only submissions', async () => {
    const executor = vi.fn();
    render(withShell(<AiCopilot open onClose={() => undefined} executor={executor} />));
    const input = screen.getByTestId('ai-copilot-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '   \t  ' } });
    fireEvent.submit(screen.getByTestId('ai-copilot-form'));
    await Promise.resolve();
    expect(executor).not.toHaveBeenCalled();
  });

  it('prevents parallel submissions while a request is in-flight', async () => {
    let resolve: ((v: AgentExecuteResult) => void) | null = null;
    const executor = vi.fn().mockImplementation(
      () =>
        new Promise<AgentExecuteResult>((r) => {
          resolve = r;
        }),
    );
    render(withShell(<AiCopilot open onClose={() => undefined} executor={executor} />));
    const input = screen.getByTestId('ai-copilot-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'first' } });
    fireEvent.submit(screen.getByTestId('ai-copilot-form'));
    expect((screen.getByTestId('ai-copilot-send') as HTMLButtonElement).disabled).toBe(true);
    // Try to fire a second submit while pending — executor should not be
    // called again. Simulate by typing + submitting; the disabled submit
    // button means the form handler short-circuits on the status guard.
    fireEvent.change(input, { target: { value: 'second' } });
    fireEvent.submit(screen.getByTestId('ai-copilot-form'));
    expect(executor).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve?.({ kind: 'pending', message: 'ok', phase: 'phase-7' });
    });
  });

  it('closes on Escape via the shortcut registry', () => {
    const onClose = vi.fn();
    render(withShell(<AiCopilot open onClose={onClose} />));
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not fire the Esc shortcut when closed (when-gate)', () => {
    const onClose = vi.fn();
    render(withShell(<AiCopilot open={false} onClose={onClose} />));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
