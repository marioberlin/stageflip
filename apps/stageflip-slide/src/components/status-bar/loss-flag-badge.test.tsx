// apps/stageflip-slide/src/components/status-bar/loss-flag-badge.test.tsx

import { EditorShell, importLossFlagsAtom, useEditorShellSetAtom } from '@stageflip/editor-shell';
import type { LossFlag } from '@stageflip/loss-flags';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { LossFlagBadge } from './loss-flag-badge';

afterEach(() => cleanup());

function makeFlag(overrides: Partial<LossFlag> = {}): LossFlag {
  return {
    id: `id-${Math.random().toString(36).slice(2, 10)}`,
    source: 'pptx',
    code: 'LF-PPTX-CUSTOM-GEOMETRY',
    severity: 'info',
    category: 'shape',
    location: {},
    message: 'Lossy translation',
    ...overrides,
  };
}

function Seed({ flags }: { flags: readonly LossFlag[] }): null {
  const set = useEditorShellSetAtom(importLossFlagsAtom);
  useEffect(() => {
    set(flags);
  }, [set, flags]);
  return null;
}

function mount(flags: readonly LossFlag[]) {
  return render(
    <EditorShell>
      <Seed flags={flags} />
      <LossFlagBadge />
    </EditorShell>,
  );
}

describe('<LossFlagBadge />', () => {
  it('renders no DOM node when there are no flags (AC #6)', () => {
    mount([]);
    expect(screen.queryByRole('button', { name: /import diagnostics/i })).toBeNull();
    expect(screen.queryByTestId('loss-flag-badge')).toBeNull();
  });

  it('shows count "3" with info-severity color when 3 info flags (AC #7)', () => {
    mount([
      makeFlag({ id: '1', severity: 'info' }),
      makeFlag({ id: '2', severity: 'info' }),
      makeFlag({ id: '3', severity: 'info' }),
    ]);
    const badge = screen.getByTestId('loss-flag-badge');
    expect(badge.textContent).toContain('3');
    expect(badge.getAttribute('data-severity')).toBe('info');
  });

  it('with 1 info + 2 warn shows count "3" with warn color (AC #8)', () => {
    mount([
      makeFlag({ id: '1', severity: 'info' }),
      makeFlag({ id: '2', severity: 'warn' }),
      makeFlag({ id: '3', severity: 'warn' }),
    ]);
    const badge = screen.getByTestId('loss-flag-badge');
    expect(badge.textContent).toContain('3');
    expect(badge.getAttribute('data-severity')).toBe('warn');
  });

  it('with 1 info + 2 warn + 1 error shows count "4" with error color (AC #9)', () => {
    mount([
      makeFlag({ id: '1', severity: 'info' }),
      makeFlag({ id: '2', severity: 'warn' }),
      makeFlag({ id: '3', severity: 'warn' }),
      makeFlag({ id: '4', severity: 'error' }),
    ]);
    const badge = screen.getByTestId('loss-flag-badge');
    expect(badge.textContent).toContain('4');
    expect(badge.getAttribute('data-severity')).toBe('error');
  });

  it('clicking the badge opens the reporter modal (AC #10)', () => {
    mount([makeFlag({ id: '1', severity: 'info' })]);
    expect(screen.queryByTestId('modal-loss-flag-reporter')).toBeNull();
    fireEvent.click(screen.getByTestId('loss-flag-badge'));
    expect(screen.getByTestId('modal-loss-flag-reporter')).toBeTruthy();
  });

  it('exposes an accessible name on the badge button (AC #11)', () => {
    mount([makeFlag({ id: '1', severity: 'info' })]);
    expect(screen.getByRole('button', { name: /import diagnostics/i })).toBeTruthy();
  });
});
