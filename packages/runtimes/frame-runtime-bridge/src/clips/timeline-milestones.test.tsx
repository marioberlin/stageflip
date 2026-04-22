// packages/runtimes/frame-runtime-bridge/src/clips/timeline-milestones.test.tsx
// T-131f.1 — timelineMilestonesClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  TimelineMilestones,
  type TimelineMilestonesProps,
  timelineMilestonesClip,
  timelineMilestonesPropsSchema,
} from './timeline-milestones.js';

afterEach(cleanup);

const SAMPLE: TimelineMilestonesProps['milestones'] = [
  { date: '2026-Q1', title: 'Kickoff' },
  { date: '2026-Q2', title: 'MVP', description: 'Initial cut' },
  { date: '2026-Q3', title: 'GA' },
];

function renderAt(frame: number, props: TimelineMilestonesProps, durationInFrames = 120) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <TimelineMilestones {...props} />
    </FrameProvider>,
  );
}

describe('TimelineMilestones component (T-131f.1)', () => {
  it('renders one milestone wrapper per entry', () => {
    renderAt(120, { milestones: SAMPLE });
    expect(screen.getByTestId('timeline-milestone-0')).toBeDefined();
    expect(screen.getByTestId('timeline-milestone-1')).toBeDefined();
    expect(screen.getByTestId('timeline-milestone-2')).toBeDefined();
  });

  it('renders both axis layers (background track + progress fill)', () => {
    renderAt(60, { milestones: SAMPLE });
    expect(screen.getByTestId('timeline-milestones-axis-track')).toBeDefined();
    expect(screen.getByTestId('timeline-milestones-axis-fill')).toBeDefined();
  });

  it('axis fill width is 0% at start and grows over time', () => {
    const { unmount } = renderAt(0, { milestones: SAMPLE });
    const fill0 = screen.getByTestId('timeline-milestones-axis-fill') as HTMLElement;
    expect(fill0.style.width).toBe('0%');
    unmount();
    renderAt(120, { milestones: SAMPLE }, 120);
    const fillEnd = screen.getByTestId('timeline-milestones-axis-fill') as HTMLElement;
    // Width should be near (but not exactly) the full axis span (84%).
    const widthPct = Number.parseFloat(fillEnd.style.width.replace('%', ''));
    expect(widthPct).toBeGreaterThan(80);
    expect(widthPct).toBeLessThanOrEqual(84);
  });

  it('renders the title when supplied', () => {
    renderAt(60, { milestones: SAMPLE, title: 'Roadmap' });
    expect(screen.getByTestId('timeline-milestones-title').textContent).toBe('Roadmap');
  });

  it('milestone description appears in the label block when present', () => {
    renderAt(120, { milestones: SAMPLE });
    expect(screen.getByTestId('timeline-milestone-1-label').textContent).toContain('Initial cut');
    expect(screen.getByTestId('timeline-milestone-0-label').textContent).not.toContain(
      'Initial cut',
    );
  });

  it('handles a single-milestone case without dividing by zero', () => {
    expect(() => renderAt(60, { milestones: [{ date: 'now', title: 'Only one' }] })).not.toThrow();
  });
});

describe('timelineMilestonesClip definition (T-131f.1)', () => {
  it("registers under kind 'timeline-milestones' with four themeSlots", () => {
    expect(timelineMilestonesClip.kind).toBe('timeline-milestones');
    expect(timelineMilestonesClip.propsSchema).toBe(timelineMilestonesPropsSchema);
    expect(timelineMilestonesClip.themeSlots).toEqual({
      accentColor: { kind: 'palette', role: 'primary' },
      bioColor: { kind: 'palette', role: 'accent' },
      textColor: { kind: 'palette', role: 'foreground' },
      background: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema rejects empty milestones array', () => {
    expect(timelineMilestonesPropsSchema.safeParse({ milestones: [] }).success).toBe(false);
  });
});
