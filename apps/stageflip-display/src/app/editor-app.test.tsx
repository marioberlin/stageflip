// apps/stageflip-display/src/app/editor-app.test.tsx
// Smoke coverage for the StageFlip.Display walking skeleton (T-207).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorAppClient } from './editor-app-client';

afterEach(() => cleanup());

describe('<EditorAppClient>', () => {
  it('mounts the editor shell and shows the seeded document title', () => {
    render(<EditorAppClient />);
    expect(screen.getByTestId('app-display-root')).toBeTruthy();
    expect(screen.getByText('Walking skeleton — StageFlip.Display')).toBeTruthy();
  });

  it('reports mode: display in the badge', () => {
    render(<EditorAppClient />);
    expect(screen.getByTestId('app-display-mode-badge').textContent).toContain('display');
  });

  it('surfaces the IAB 150 KB budget in the header', () => {
    render(<EditorAppClient />);
    expect(screen.getByTestId('app-display-budget-cap').textContent).toBe('150 KB');
  });

  it('renders the multi-size banner grid', () => {
    render(<EditorAppClient />);
    expect(screen.getByTestId('sf-banner-grid')).toBeTruthy();
  });

  it('renders one cell per canonical IAB size', () => {
    render(<EditorAppClient />);
    expect(screen.getByTestId('app-display-cell-300x250')).toBeTruthy();
    expect(screen.getByTestId('app-display-cell-728x90')).toBeTruthy();
    expect(screen.getByTestId('app-display-cell-160x600')).toBeTruthy();
  });

  it('reports the dimensions inside each cell', () => {
    render(<EditorAppClient />);
    const mpu = screen.getByTestId('app-display-cell-300x250');
    expect(mpu.textContent).toContain('300×250');
  });
});
