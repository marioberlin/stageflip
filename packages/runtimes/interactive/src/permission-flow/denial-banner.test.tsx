// packages/runtimes/interactive/src/permission-flow/denial-banner.test.tsx
// T-385 AC #10–#12, #14, #18 — visual surface contract for
// `<PermissionDenialBanner>`.

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PermissionDenialBanner } from './denial-banner.js';
import type { PermissionDenialMessages } from './types.js';

const messages: PermissionDenialMessages = {
  title: 'TITLE',
  description: 'DESCRIPTION',
  retryLabel: 'RETRY',
  browserSettingsHint: 'HINT',
  dismissLabel: 'DISMISS',
};

describe('PermissionDenialBanner', () => {
  it('AC #10 — renders required text from props (no English defaults)', () => {
    const { getByRole, container } = render(
      <PermissionDenialBanner
        state={{ kind: 'denied', reason: 'permission-denied', deniedPermission: 'mic' }}
        messages={messages}
        onRetry={() => undefined}
      />,
    );
    expect(getByRole('alert').textContent).toContain('TITLE');
    expect(getByRole('alert').textContent).toContain('DESCRIPTION');
    expect(getByRole('alert').textContent).toContain('HINT');
    expect(getByRole('alert').textContent).toContain('RETRY');
    expect(
      container.querySelector('[data-stageflip-denial-reason="permission-denied"]'),
    ).not.toBeNull();
  });

  it('AC #11 — onRetry fires exactly once per click', () => {
    const onRetry = vi.fn();
    const { container } = render(
      <PermissionDenialBanner
        state={{ kind: 'denied', reason: 'permission-denied' }}
        messages={messages}
        onRetry={onRetry}
      />,
    );
    const retryButton = container.querySelector('[data-stageflip-action="retry"]');
    expect(retryButton).not.toBeNull();
    fireEvent.click(retryButton as Element);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('AC #11 — onDismiss is optional; absent → no dismiss button', () => {
    const { container } = render(
      <PermissionDenialBanner
        state={{ kind: 'denied', reason: 'permission-denied' }}
        messages={messages}
        onRetry={() => undefined}
      />,
    );
    expect(container.querySelector('[data-stageflip-action="dismiss"]')).toBeNull();
  });

  it('AC #11 — onDismiss fires when supplied + clicked', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <PermissionDenialBanner
        state={{ kind: 'denied', reason: 'permission-denied' }}
        messages={messages}
        onRetry={() => undefined}
        onDismiss={onDismiss}
      />,
    );
    const dismissButton = container.querySelector('[data-stageflip-action="dismiss"]');
    expect(dismissButton).not.toBeNull();
    fireEvent.click(dismissButton as Element);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders no hint slot when browserSettingsHint is empty string', () => {
    const { container } = render(
      <PermissionDenialBanner
        state={{ kind: 'denied', reason: 'permission-denied' }}
        messages={{ ...messages, browserSettingsHint: '' }}
        onRetry={() => undefined}
      />,
    );
    expect(container.querySelector('[data-stageflip-slot="browser-settings-hint"]')).toBeNull();
  });

  it('AC #14 — forwards data-testid to the root element', () => {
    const { getByTestId } = render(
      <PermissionDenialBanner
        state={{ kind: 'denied', reason: 'permission-denied' }}
        messages={messages}
        onRetry={() => undefined}
        data-testid="banner-under-test"
      />,
    );
    expect(getByTestId('banner-under-test')).not.toBeNull();
  });

  it('AC #12 — does NOT touch any browser API (smoke: render does not call getUserMedia)', () => {
    // happy-dom does not expose getUserMedia by default, so the strongest
    // assertion is that render does not throw and produces no media tracks.
    expect(() =>
      render(
        <PermissionDenialBanner
          state={{ kind: 'denied', reason: 'permission-denied' }}
          messages={messages}
          onRetry={() => undefined}
        />,
      ),
    ).not.toThrow();
  });

  it('renders dismiss button only when both onDismiss AND messages.dismissLabel are supplied', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <PermissionDenialBanner
        state={{ kind: 'denied', reason: 'permission-denied' }}
        messages={{ ...messages, dismissLabel: undefined }}
        onRetry={() => undefined}
        onDismiss={onDismiss}
      />,
    );
    expect(container.querySelector('[data-stageflip-action="dismiss"]')).toBeNull();
  });
});
