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

function lastMessageOfRole(role: 'user' | 'assistant' | 'system'): HTMLElement | null {
  const items = screen
    .getAllByRole('listitem')
    .filter((el) => el.getAttribute('data-role') === role);
  return items[items.length - 1] ?? null;
}

describe('<AiCopilot>', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(withShell(<AiCopilot open={false} onClose={() => undefined} />));
    expect(container.querySelector('[data-testid="ai-copilot"]')).toBeNull();
  });

  it('renders the sidebar + welcome system message when open', () => {
    render(withShell(<AiCopilot open onClose={() => undefined} />));
    expect(screen.getByTestId('ai-copilot')).toBeTruthy();
    const systemMsgs = screen
      .getAllByRole('listitem')
      .filter((el) => el.getAttribute('data-role') === 'system');
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
      expect(lastMessageOfRole('user')?.textContent).toBe('Add a title slide');
    });
    expect(input.value).toBe('');
    expect(executor).toHaveBeenCalledWith('Add a title slide');
    await waitFor(() => {
      const assistant = lastMessageOfRole('assistant');
      expect(assistant?.textContent).toMatch(/Phase 7/i);
      expect(assistant?.textContent).toMatch(/phase-7/);
    });
  });

  it('renders per-id testids so multi-turn submits do not collide', async () => {
    const executor = vi.fn().mockResolvedValue({
      kind: 'pending',
      message: 'x',
      phase: 'phase-7',
    } as AgentExecuteResult);
    render(withShell(<AiCopilot open onClose={() => undefined} executor={executor} />));
    const input = screen.getByTestId('ai-copilot-input') as HTMLTextAreaElement;
    for (const prompt of ['first prompt', 'second prompt']) {
      fireEvent.change(input, { target: { value: prompt } });
      fireEvent.submit(screen.getByTestId('ai-copilot-form'));
      await waitFor(() => {
        expect(lastMessageOfRole('user')?.textContent).toBe(prompt);
      });
    }
    const userMsgs = screen
      .getAllByRole('listitem')
      .filter((el) => el.getAttribute('data-role') === 'user');
    expect(userMsgs.length).toBe(2);
    // Per-id testids are unique; strict-mode queries do not throw.
    const testIds = new Set(userMsgs.map((el) => el.getAttribute('data-testid')));
    expect(testIds.size).toBe(2);
  });

  it('renders the not_configured hint when the route returns 503 (T-170)', async () => {
    const executor = vi.fn().mockResolvedValue({
      kind: 'not_configured',
      message: 'Agent orchestrator is not configured. Set ANTHROPIC_API_KEY and retry.',
    } as AgentExecuteResult);
    render(withShell(<AiCopilot open onClose={() => undefined} executor={executor} />));
    const input = screen.getByTestId('ai-copilot-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'anything' } });
    fireEvent.submit(screen.getByTestId('ai-copilot-form'));
    await waitFor(() => {
      expect(lastMessageOfRole('assistant')?.textContent).toMatch(/ANTHROPIC_API_KEY/i);
    });
    // Status returns to idle (not error) — the user can configure and retry.
    expect(screen.getByTestId('ai-command-bar').getAttribute('data-status')).toBe('idle');
  });

  it('renders a step-count + validation summary on applied results (T-170)', async () => {
    const executor = vi.fn().mockResolvedValue({
      kind: 'applied',
      message: 'Applied.',
      payload: {
        plan: { steps: [{}, {}, {}] },
        events: [],
        finalDocument: {},
        validation: { tier: 'pass-with-notes' },
      },
    } as AgentExecuteResult);
    render(withShell(<AiCopilot open onClose={() => undefined} executor={executor} />));
    const input = screen.getByTestId('ai-copilot-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Build me a deck' } });
    fireEvent.submit(screen.getByTestId('ai-copilot-form'));
    await waitFor(() => {
      const text = lastMessageOfRole('assistant')?.textContent ?? '';
      expect(text).toContain('3 steps');
      expect(text).toContain('pass-with-notes');
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
      expect(lastMessageOfRole('assistant')?.textContent).toMatch(/offline/);
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
    // `useRegisterShortcuts` runs before the `if (!open) return null`
    // early-out in the component, so the shortcut IS registered even
    // while the sidebar is hidden. This test verifies the `when: () => open`
    // gate blocks the handler — not that the shortcut is absent. Moving
    // the hook below the early return would break the test and the
    // component's contract with consumers.
    const onClose = vi.fn();
    render(withShell(<AiCopilot open={false} onClose={onClose} />));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
