// packages/editor-shell/src/audience-join/audience-join-modal.test.tsx
// T-456 — `<AudienceJoinModal>` component tests.
//   - renders QR + room code when tenant audience is enabled
//   - renders disabled-notice when tenant audience is disabled
//   - close button invokes the supplied handler
//   - QR src is the data URL `qrcode` produced

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AudienceJoinModal } from './audience-join-modal.js';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async (_input: string) => 'data:image/png;base64,STUB'),
  },
}));

afterEach(() => {
  cleanup();
});

describe('<AudienceJoinModal>', () => {
  it('renders the QR image + room code when tenant audience is enabled', async () => {
    render(
      <AudienceJoinModal
        sessionId="session-foo"
        baseUrl="https://join.stageflip.app"
        tenantAudienceEnabled={true}
        onClose={() => {}}
      />,
    );

    // Room code present and 6 chars long (rendered after the async digest).
    const codeEl = await screen.findByTestId('audience-join-modal-room-code');
    expect(codeEl.textContent).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // QR image rendered with the data URL the stub returned.
    const qr = await screen.findByTestId('audience-join-modal-qr');
    expect(qr).toBeDefined();
    expect(qr.getAttribute('src')).toBe('data:image/png;base64,STUB');

    // Voter URL also surfaced for copy-to-clipboard.
    expect(screen.getByTestId('audience-join-modal-voter-url').textContent).toBe(
      'https://join.stageflip.app/session-foo',
    );
  });

  it('renders the disabled notice when tenantAudienceEnabled === false', () => {
    render(
      <AudienceJoinModal
        sessionId="s"
        baseUrl="https://join.stageflip.app"
        tenantAudienceEnabled={false}
        onClose={() => {}}
      />,
    );

    expect(screen.getByTestId('audience-join-modal-disabled-notice')).toBeDefined();
    expect(screen.queryByTestId('audience-join-modal-qr')).toBeNull();
    expect(screen.queryByTestId('audience-join-modal-room-code')).toBeNull();
  });

  it('invokes onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <AudienceJoinModal
        sessionId="s"
        baseUrl="https://join.stageflip.app"
        tenantAudienceEnabled={true}
        onClose={onClose}
      />,
    );

    const closeBtn = screen.getByTestId('audience-join-modal-close');
    closeBtn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders an error fallback when the QR generator throws', async () => {
    const qrcode = await import('qrcode');
    vi.mocked(qrcode.default.toDataURL).mockRejectedValueOnce(new Error('QR failed'));
    render(
      <AudienceJoinModal
        sessionId="s"
        baseUrl="https://join.stageflip.app"
        tenantAudienceEnabled={true}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByTestId('audience-join-modal-qr-error')).toBeDefined();
  });
});
