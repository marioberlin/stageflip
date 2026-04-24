// apps/stageflip-video/src/app/editor-app.test.tsx
// Smoke coverage for the StageFlip.Video walking skeleton (T-187a).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorAppClient } from './editor-app-client';

afterEach(() => cleanup());

describe('<EditorAppClient>', () => {
  it('mounts the editor shell and shows the seeded document title', () => {
    render(<EditorAppClient />);
    expect(screen.getByTestId('app-video-root')).toBeTruthy();
    expect(screen.getByText('Walking skeleton — StageFlip.Video')).toBeTruthy();
  });

  it('reports mode: video in the badge', () => {
    render(<EditorAppClient />);
    expect(screen.getByTestId('app-video-mode-badge').textContent).toContain('video');
  });

  it('renders one row per seeded track', () => {
    render(<EditorAppClient />);
    expect(screen.getByTestId('app-video-track-row-track-visual-1')).toBeTruthy();
    expect(screen.getByTestId('app-video-track-row-track-audio-1')).toBeTruthy();
    expect(screen.getByTestId('app-video-track-row-track-caption-1')).toBeTruthy();
  });

  it('exposes the track kind on each row via data-track-kind', () => {
    render(<EditorAppClient />);
    expect(
      screen.getByTestId('app-video-track-row-track-visual-1').getAttribute('data-track-kind'),
    ).toBe('visual');
    expect(
      screen.getByTestId('app-video-track-row-track-audio-1').getAttribute('data-track-kind'),
    ).toBe('audio');
    expect(
      screen.getByTestId('app-video-track-row-track-caption-1').getAttribute('data-track-kind'),
    ).toBe('caption');
  });
});
