// packages/runtimes/interactive/src/frame-budget.test.ts
// T-403 R-6 — unit tests for the frame-budget monitor. Mock-clock-driven
// so the verdict logic is exercised without real wall-clock.

import { describe, expect, it } from 'vitest';

import {
  FRAME_BUDGET_CEILING_MS,
  FRAME_BUDGET_DEFAULT_MS,
  FRAME_BUDGET_MIN_MS,
  createFrameBudgetMonitor,
} from './frame-budget.js';

function mockClock(initial: number): { read: () => number; advance: (delta: number) => void } {
  let now = initial;
  return {
    read: () => now,
    advance: (delta) => {
      now += delta;
    },
  };
}

describe('createFrameBudgetMonitor (T-403 R-6)', () => {
  it('verdict ok when elapsed under warn budget', () => {
    const clock = mockClock(0);
    const monitor = createFrameBudgetMonitor({ clockMs: clock.read });
    monitor.start();
    clock.advance(2);
    const m = monitor.record();
    expect(m.verdict).toBe('ok');
    expect(m.elapsedMs).toBe(2);
    expect(m.frameCount).toBe(1);
    expect(monitor.hasWarned()).toBe(false);
    expect(monitor.isKilled()).toBe(false);
  });

  it('verdict warn when elapsed at/above warn but below kill', () => {
    const clock = mockClock(1000);
    const monitor = createFrameBudgetMonitor({ clockMs: clock.read });
    monitor.start();
    clock.advance(FRAME_BUDGET_DEFAULT_MS); // exactly at threshold = warn
    const m = monitor.record();
    expect(m.verdict).toBe('warn');
    expect(monitor.hasWarned()).toBe(true);
    expect(monitor.isKilled()).toBe(false);
  });

  it('verdict kill when elapsed at/above ceiling — default budget exceeded by 250ms frame', () => {
    const clock = mockClock(0);
    const monitor = createFrameBudgetMonitor({ clockMs: clock.read });
    monitor.start();
    clock.advance(250);
    const m = monitor.record();
    expect(m.verdict).toBe('kill');
    expect(m.elapsedMs).toBe(250);
    expect(monitor.isKilled()).toBe(true);
  });

  it('custom warn=50, kill=80 — frame at 40ms is ok', () => {
    const clock = mockClock(0);
    const monitor = createFrameBudgetMonitor({
      warnBudgetMs: 50,
      killBudgetMs: 80,
      clockMs: clock.read,
    });
    monitor.start();
    clock.advance(40);
    expect(monitor.record().verdict).toBe('ok');
  });

  it('custom warn=50, kill=80 — frame at 60ms is warn', () => {
    const clock = mockClock(0);
    const monitor = createFrameBudgetMonitor({
      warnBudgetMs: 50,
      killBudgetMs: 80,
      clockMs: clock.read,
    });
    monitor.start();
    clock.advance(60);
    expect(monitor.record().verdict).toBe('warn');
  });

  it('custom warn=50, kill=80 — frame at 90ms is kill', () => {
    const clock = mockClock(0);
    const monitor = createFrameBudgetMonitor({
      warnBudgetMs: 50,
      killBudgetMs: 80,
      clockMs: clock.read,
    });
    monitor.start();
    clock.advance(90);
    expect(monitor.record().verdict).toBe('kill');
  });

  it('frame counter advances monotonically across multiple records', () => {
    const clock = mockClock(0);
    const monitor = createFrameBudgetMonitor({ clockMs: clock.read });
    for (let i = 1; i <= 5; i += 1) {
      monitor.start();
      clock.advance(1);
      expect(monitor.record().frameCount).toBe(i);
    }
  });

  it('rejects warnBudgetMs below FRAME_BUDGET_MIN_MS', () => {
    expect(() => createFrameBudgetMonitor({ warnBudgetMs: FRAME_BUDGET_MIN_MS - 1 })).toThrow(
      /below minimum/,
    );
  });

  it('rejects killBudgetMs above FRAME_BUDGET_CEILING_MS', () => {
    expect(() => createFrameBudgetMonitor({ killBudgetMs: FRAME_BUDGET_CEILING_MS + 1 })).toThrow(
      /above ceiling/,
    );
  });

  it('rejects warn >= kill', () => {
    expect(() => createFrameBudgetMonitor({ warnBudgetMs: 50, killBudgetMs: 50 })).toThrow(
      /must be </,
    );
    expect(() => createFrameBudgetMonitor({ warnBudgetMs: 60, killBudgetMs: 50 })).toThrow(
      /must be </,
    );
  });

  it('hasWarned + isKilled are sticky across subsequent ok frames', () => {
    const clock = mockClock(0);
    const monitor = createFrameBudgetMonitor({
      warnBudgetMs: 10,
      killBudgetMs: 100,
      clockMs: clock.read,
    });
    monitor.start();
    clock.advance(20); // warn
    monitor.record();
    monitor.start();
    clock.advance(1); // ok again
    monitor.record();
    expect(monitor.hasWarned()).toBe(true);
    expect(monitor.isKilled()).toBe(false);
  });
});
