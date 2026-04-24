// packages/runtimes/frame-runtime-bridge/src/clips/countdown.test.tsx
// T-202 — Countdown clip behaviour + propsSchema + helpers.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  Countdown,
  type CountdownProps,
  countdownClip,
  countdownPropsSchema,
  formatCountdown,
  secondsRemaining,
} from './countdown.js';

afterEach(cleanup);

function renderAt(frame: number, props: CountdownProps, fps = 24, durationInFrames = 360) {
  return render(
    <FrameProvider frame={frame} config={{ width: 300, height: 250, fps, durationInFrames }}>
      <Countdown {...props} />
    </FrameProvider>,
  );
}

describe('secondsRemaining', () => {
  it('returns the start value at frame 0', () => {
    expect(secondsRemaining(15, 0, 24)).toBe(15);
  });

  it('decrements linearly as frames advance', () => {
    expect(secondsRemaining(15, 24, 24)).toBe(14);
    expect(secondsRemaining(15, 48, 24)).toBe(13);
  });

  it('clamps to 0 once the countdown expires', () => {
    expect(secondsRemaining(10, 24 * 30, 24)).toBe(0);
  });

  it('never returns negative values', () => {
    expect(secondsRemaining(1, 24 * 100, 24)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('formats mm:ss', () => {
    expect(formatCountdown(65, 'mm:ss')).toBe('01:05');
    expect(formatCountdown(0, 'mm:ss')).toBe('00:00');
  });

  it('formats hh:mm:ss', () => {
    expect(formatCountdown(3700, 'hh:mm:ss')).toBe('01:01:40');
  });

  it('formats dd hh:mm:ss', () => {
    expect(formatCountdown(90061, 'dd hh:mm:ss')).toBe('01d 01:01:01');
  });

  it('floors fractional seconds', () => {
    expect(formatCountdown(59.9, 'mm:ss')).toBe('00:59');
  });
});

describe('<Countdown>', () => {
  it('renders the starting value at frame 0', () => {
    renderAt(0, { startFromSeconds: 15 });
    expect(screen.getByTestId('countdown-digits').textContent).toBe('00:15');
  });

  it('ticks down as frames advance', () => {
    renderAt(24 * 5, { startFromSeconds: 15 });
    expect(screen.getByTestId('countdown-digits').textContent).toBe('00:10');
  });

  it('renders 00:00 when expired', () => {
    renderAt(24 * 30, { startFromSeconds: 10 });
    expect(screen.getByTestId('countdown-digits').textContent).toBe('00:00');
  });

  it('renders the label when provided', () => {
    renderAt(0, { startFromSeconds: 15, label: 'Sale ends in' });
    expect(screen.getByTestId('countdown-label').textContent).toBe('Sale ends in');
  });

  it('omits the label element when label is empty', () => {
    renderAt(0, { startFromSeconds: 15, label: '' });
    expect(screen.queryByTestId('countdown-label')).toBeNull();
  });

  it('switches format on demand', () => {
    renderAt(0, { startFromSeconds: 3661, format: 'hh:mm:ss' });
    expect(screen.getByTestId('countdown-digits').textContent).toBe('01:01:01');
  });
});

describe('countdownPropsSchema', () => {
  it('rejects negative startFromSeconds', () => {
    expect(countdownPropsSchema.safeParse({ startFromSeconds: -1 }).success).toBe(false);
  });

  it('rejects unknown formats', () => {
    expect(countdownPropsSchema.safeParse({ startFromSeconds: 15, format: 'ss' }).success).toBe(
      false,
    );
  });

  it('accepts a complete config', () => {
    expect(
      countdownPropsSchema.safeParse({
        startFromSeconds: 3600,
        format: 'hh:mm:ss',
        label: 'Flash sale',
        accent: '#ff0',
        textColor: '#000',
        background: '#fff',
      }).success,
    ).toBe(true);
  });
});

describe('countdownClip', () => {
  it('declares kind and fonts', () => {
    expect(countdownClip.kind).toBe('countdown');
    const fonts = countdownClip.fontRequirements?.({
      startFromSeconds: 15,
    } as CountdownProps);
    expect(fonts).toEqual([
      { family: 'Plus Jakarta Sans', weight: 500 },
      { family: 'JetBrains Mono', weight: 700 },
    ]);
  });
});
