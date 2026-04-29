// packages/runtimes/interactive/src/permission-flow/pre-prompt-modal.test.tsx
// T-385 AC #13, #14, #18 — visual surface contract for
// `<PermissionPrePromptModal>`.

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PermissionPrePromptModal } from './pre-prompt-modal.js';
import type { PermissionPrePromptMessages } from './types.js';

const messages: PermissionPrePromptMessages = {
  title: 'PRE_TITLE',
  description: 'PRE_DESCRIPTION',
  confirmLabel: 'PRE_CONFIRM',
  cancelLabel: 'PRE_CANCEL',
};

describe('PermissionPrePromptModal', () => {
  it('AC #13 — renders confirm + cancel buttons with localised text', () => {
    const { getByRole, container } = render(
      <PermissionPrePromptModal
        state={{ kind: 'pre-prompt', permission: 'mic' }}
        messages={messages}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(getByRole('dialog').textContent).toContain('PRE_TITLE');
    expect(container.querySelector('[data-stageflip-action="confirm"]')?.textContent).toBe(
      'PRE_CONFIRM',
    );
    expect(container.querySelector('[data-stageflip-action="cancel"]')?.textContent).toBe(
      'PRE_CANCEL',
    );
  });

  it('AC #13 — confirm click fires onConfirm exactly once', () => {
    const onConfirm = vi.fn();
    const { container } = render(
      <PermissionPrePromptModal
        state={{ kind: 'pre-prompt', permission: 'mic' }}
        messages={messages}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );
    fireEvent.click(container.querySelector('[data-stageflip-action="confirm"]') as Element);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('AC #13 — cancel click fires onCancel exactly once', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <PermissionPrePromptModal
        state={{ kind: 'pre-prompt', permission: 'mic' }}
        messages={messages}
        onConfirm={() => undefined}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(container.querySelector('[data-stageflip-action="cancel"]') as Element);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('AC #14 — forwards data-testid to the root element', () => {
    const { getByTestId } = render(
      <PermissionPrePromptModal
        state={{ kind: 'pre-prompt', permission: 'mic' }}
        messages={messages}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        data-testid="pre-prompt-under-test"
      />,
    );
    expect(getByTestId('pre-prompt-under-test')).not.toBeNull();
  });

  it('exposes the requested permission via data attribute', () => {
    const { container } = render(
      <PermissionPrePromptModal
        state={{ kind: 'pre-prompt', permission: 'camera' }}
        messages={messages}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(container.querySelector('[data-stageflip-permission="camera"]')).not.toBeNull();
  });
});
