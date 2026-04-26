// apps/stageflip-slide/src/components/dialogs/loss-flag-reporter/loss-flag-row.test.tsx

import type { LossFlag } from '@stageflip/loss-flags';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LossFlagRow } from './loss-flag-row';

afterEach(() => cleanup());

function makeFlag(overrides: Partial<LossFlag> = {}): LossFlag {
  return {
    id: 'flag-1',
    source: 'pptx',
    code: 'LF-PPTX-CUSTOM-GEOMETRY',
    severity: 'warn',
    category: 'shape',
    location: { slideId: 's1', elementId: 'e1' },
    message: 'Custom geometry could not be parsed',
    ...overrides,
  };
}

describe('<LossFlagRow />', () => {
  it("renders the flag's code, message, source, and severity", () => {
    render(
      <LossFlagRow
        flag={makeFlag()}
        onDismiss={() => undefined}
        onLocate={() => undefined}
        locateAvailable
      />,
    );
    const row = screen.getByTestId('loss-flag-row');
    expect(row.textContent).toContain('LF-PPTX-CUSTOM-GEOMETRY');
    expect(row.textContent).toContain('Custom geometry could not be parsed');
    expect(row.textContent).toContain('pptx');
    expect(row.getAttribute('data-severity')).toBe('warn');
  });

  it('fires onDismiss with the flag id when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <LossFlagRow
        flag={makeFlag({ id: 'X' })}
        onDismiss={onDismiss}
        onLocate={() => undefined}
        locateAvailable
      />,
    );
    fireEvent.click(screen.getByTestId('loss-flag-row-dismiss'));
    expect(onDismiss).toHaveBeenCalledWith('X');
  });

  it('fires onLocate with the flag when the location label is clicked', () => {
    const onLocate = vi.fn();
    const f = makeFlag();
    render(
      <LossFlagRow flag={f} onDismiss={() => undefined} onLocate={onLocate} locateAvailable />,
    );
    fireEvent.click(screen.getByTestId('loss-flag-row-locate'));
    expect(onLocate).toHaveBeenCalledWith(f);
  });

  it('marks the locate label aria-disabled when locateAvailable is false (AC #18)', () => {
    render(
      <LossFlagRow
        flag={makeFlag()}
        onDismiss={() => undefined}
        onLocate={() => undefined}
        locateAvailable={false}
      />,
    );
    const locate = screen.getByTestId('loss-flag-row-locate');
    expect(locate.getAttribute('aria-disabled')).toBe('true');
  });

  it('does not fire onLocate when locateAvailable is false', () => {
    const onLocate = vi.fn();
    render(
      <LossFlagRow
        flag={makeFlag()}
        onDismiss={() => undefined}
        onLocate={onLocate}
        locateAvailable={false}
      />,
    );
    fireEvent.click(screen.getByTestId('loss-flag-row-locate'));
    expect(onLocate).not.toHaveBeenCalled();
  });
});
