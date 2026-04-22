// apps/stageflip-slide/src/components/ai-copilot/ai-copilot.tsx
// AI copilot sidebar: chat-style input backed by /api/agent/execute.

/**
 * Phase 6 stub. The route returns 501 today, so every submit round-trips
 * through `executeAgent` → `{ kind: 'pending' }` and renders a placeholder
 * assistant message citing the Phase 7 wiring. Three invariants hold now
 * that Phase 7 will keep:
 *
 *   1. Messages flow one-way into a local array; the copilot never mutates
 *      the document. When Phase 7 introduces `applied` kinds, the outer
 *      host will own the diff-preview modal and the copilot will emit an
 *      event — it is not responsible for the commit path.
 *   2. Input is cleared on submit; submission is disabled while a request
 *      is pending so parallel submits can't interleave messages out of
 *      order.
 *   3. `open=false` short-circuits the render so the copilot is a no-op
 *      when the user has closed it — the host drives visibility.
 *
 * The component renders as a fixed-position right rail (`<aside>`). Native
 * `<dialog>` was considered (handover §3.8 prefers it for overlays), but
 * the copilot is a persistent side panel rather than a modal — `<aside>`
 * with `role="complementary"` matches the semantics and keeps focus in
 * the main canvas unless the user explicitly focuses the input.
 */

'use client';

import { t, useRegisterShortcuts } from '@stageflip/editor-shell';
import type { Shortcut } from '@stageflip/editor-shell';
import {
  type FormEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AiCommandBar, type AiStatus } from './ai-command-bar';
import { AiVariantPanel, type Variant } from './ai-variant-panel';
import { type AgentExecuteResult, executeAgent } from './execute-agent';

export interface AiCopilotProps {
  open: boolean;
  onClose: () => void;
  /** Test seam — injected executor bypasses real fetch. */
  executor?: (prompt: string) => Promise<AgentExecuteResult>;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

export function AiCopilot({ open, onClose, executor }: AiCopilotProps): ReactElement | null {
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 'welcome', role: 'system', content: t('copilot.welcome') },
  ]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AiStatus>('idle');
  const messageIdRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Phase 6 stub: variants are never populated. Phase 7 will lift this
  // into state driven by the agent's variant-proposing tools.
  const variants: ReadonlyArray<Variant> = useMemo(() => [], []);

  // Focus the input when the copilot opens so users can type immediately.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  // Close on Escape. Scoped shortcut rather than a raw keydown listener so
  // the cheat sheet and focus-zone suppression work consistently.
  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        id: 'ai.close',
        combo: 'Escape',
        description: t('copilot.close'),
        category: 'essential',
        when: () => open,
        handler: () => {
          onClose();
          return undefined;
        },
      },
    ],
    [open, onClose],
  );
  useRegisterShortcuts(shortcuts);

  const appendMessage = useCallback((role: MessageRole, content: string) => {
    messageIdRef.current += 1;
    const id = `m-${messageIdRef.current}`;
    setMessages((prev) => [...prev, { id, role, content }]);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const prompt = input.trim();
      if (!prompt || status === 'pending') return;
      setInput('');
      setStatus('pending');
      appendMessage('user', prompt);
      const run = executor ?? ((p: string) => executeAgent({ prompt: p }));
      const result = await run(prompt);
      if (result.kind === 'error') {
        appendMessage('assistant', `${t('copilot.errorPrefix')} ${result.message}`);
        setStatus('error');
        return;
      }
      if (result.kind === 'pending') {
        appendMessage('assistant', `${t('copilot.notWired')} (${result.phase})`);
        setStatus('idle');
        return;
      }
      appendMessage('assistant', result.message);
      setStatus('idle');
    },
    [input, status, appendMessage, executor],
  );

  if (!open) return null;

  return (
    <aside data-testid="ai-copilot" aria-label={t('copilot.title')} style={asideStyle}>
      <AiCommandBar status={status} onClose={onClose} />
      <AiVariantPanel variants={variants} onSelect={() => undefined} showEmptyState />
      <ol data-testid="ai-copilot-messages" style={messagesStyle}>
        {messages.map((m) => (
          <li
            key={m.id}
            data-role={m.role}
            data-testid={`ai-message-${m.role}`}
            style={messageStyle(m.role)}
          >
            {m.content}
          </li>
        ))}
      </ol>
      <form data-testid="ai-copilot-form" onSubmit={handleSubmit} style={formStyle}>
        <textarea
          ref={inputRef}
          data-testid="ai-copilot-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('copilot.placeholder')}
          rows={2}
          style={textareaStyle}
          aria-label={t('copilot.placeholder')}
        />
        <button
          type="submit"
          data-testid="ai-copilot-send"
          disabled={status === 'pending' || input.trim().length === 0}
          style={sendButtonStyle}
        >
          {t('copilot.send')}
        </button>
      </form>
    </aside>
  );
}

const asideStyle: React.CSSProperties = {
  position: 'fixed',
  top: 24,
  right: 24,
  bottom: 24,
  width: 360,
  background: 'rgba(8, 15, 21, 0.95)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(129, 174, 255, 0.15)',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  color: '#ebf1fa',
  boxShadow: '0 20px 48px rgba(0, 114, 229, 0.12)',
  zIndex: 40,
};

const messagesStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  listStyle: 'none',
  margin: 0,
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

function messageStyle(role: MessageRole): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.4,
    padding: '8px 10px',
    borderRadius: 8,
    maxWidth: '100%',
    whiteSpace: 'pre-wrap',
  };
  if (role === 'user') {
    return { ...base, background: 'rgba(129, 174, 255, 0.15)', alignSelf: 'flex-end' };
  }
  if (role === 'assistant') {
    return { ...base, background: 'rgba(90, 248, 251, 0.08)', alignSelf: 'flex-start' };
  }
  return { ...base, color: '#a5acb4', alignSelf: 'center', textAlign: 'center' };
}

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderTop: '1px solid rgba(129, 174, 255, 0.15)',
};

const textareaStyle: React.CSSProperties = {
  resize: 'none',
  background: '#151c23',
  color: '#ebf1fa',
  border: '1px solid rgba(129, 174, 255, 0.2)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
};

const sendButtonStyle: React.CSSProperties = {
  alignSelf: 'flex-end',
  background: '#81aeff',
  color: '#080f15',
  border: 'none',
  borderRadius: 6,
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
