// apps/audience-join/src/components/connection-status-banner.test.tsx
// T-456 — Verifies banner state transitions + loss-flag surface.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { type ConnectionState, ConnectionStatusBanner } from './connection-status-banner.js';

afterEach(() => {
  cleanup();
});

describe('<ConnectionStatusBanner>', () => {
  it.each<ConnectionState>([
    'idle',
    'joining',
    'connecting',
    'connected',
    'reconnecting',
    'disconnected',
    'error',
  ])('renders the banner for state=%s', (state) => {
    render(<ConnectionStatusBanner state={state} />);
    const banner = screen.getByTestId('connection-status-banner');
    expect(banner.getAttribute('data-state')).toBe(state);
    expect(screen.getByTestId('connection-status-text').textContent).toBeTruthy();
  });

  it('marks data-severity=info when connected', () => {
    render(<ConnectionStatusBanner state="connected" />);
    expect(screen.getByTestId('connection-status-banner').getAttribute('data-severity')).toBe(
      'info',
    );
  });

  it('marks data-severity=warn when reconnecting', () => {
    render(<ConnectionStatusBanner state="reconnecting" />);
    expect(screen.getByTestId('connection-status-banner').getAttribute('data-severity')).toBe(
      'warn',
    );
  });

  it('marks data-severity=error + role=alert when disconnected', () => {
    render(<ConnectionStatusBanner state="disconnected" />);
    const banner = screen.getByTestId('connection-status-banner');
    expect(banner.getAttribute('data-severity')).toBe('error');
    expect(banner.getAttribute('role')).toBe('alert');
  });

  it('renders the detail span when supplied', () => {
    render(<ConnectionStatusBanner state="error" detail="Token mint failed" />);
    expect(screen.getByTestId('connection-status-detail').textContent).toContain(
      'Token mint failed',
    );
  });

  it('omits the detail span when blank', () => {
    render(<ConnectionStatusBanner state="connected" detail="" />);
    expect(screen.queryByTestId('connection-status-detail')).toBeNull();
  });

  it('surfaces LF-AUDIENCE-CONNECTION-LOST when connectionLost=true', () => {
    render(<ConnectionStatusBanner state="disconnected" connectionLost={true} />);
    const lossEl = screen.getByTestId('connection-status-loss-flag');
    expect(lossEl.textContent).toContain('LF-AUDIENCE-CONNECTION-LOST');
  });

  it('omits the loss-flag span when not exhausted', () => {
    render(<ConnectionStatusBanner state="disconnected" />);
    expect(screen.queryByTestId('connection-status-loss-flag')).toBeNull();
  });
});
