// apps/stageflip-slide/src/components/presentation/presentation-mode.test.tsx
// Tests for the full-screen presentation player (T-139c).

import { EditorShell } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PresentationMode } from './presentation-mode';

afterEach(() => cleanup());

function makeDoc(): Document {
  return {
    meta: {
      id: 'd',
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: {
      mode: 'slide',
      slides: [
        { id: 's1', notes: 'First slide notes', elements: [] },
        { id: 's2', elements: [] },
        { id: 's3', notes: 'Third', elements: [] },
      ],
    },
  };
}

function mount(overrides: Partial<React.ComponentProps<typeof PresentationMode>> = {}): void {
  const props: React.ComponentProps<typeof PresentationMode> = {
    open: overrides.open ?? true,
    onClose: overrides.onClose ?? (() => undefined),
    initialFrame: overrides.initialFrame ?? 0,
    ...(overrides.startSlideId !== undefined ? { startSlideId: overrides.startSlideId } : {}),
    ...(overrides.fps !== undefined ? { fps: overrides.fps } : {}),
  };
  render(
    <EditorShell initialDocument={makeDoc()}>
      <PresentationMode {...props} />
    </EditorShell>,
  );
}

describe('<PresentationMode />', () => {
  it('renders nothing when closed', () => {
    mount({ open: false });
    expect(screen.queryByTestId('presentation')).toBeNull();
  });

  it('renders the first slide by default', () => {
    mount();
    expect(screen.getByTestId('presentation')).toBeTruthy();
    expect(screen.getByTestId('presentation-counter').textContent).toContain('1 / 3');
  });

  it('starts at startSlideId when provided', () => {
    mount({ startSlideId: 's2' });
    expect(screen.getByTestId('presentation-counter').textContent).toContain('2 / 3');
  });

  it('ArrowRight advances to the next slide', () => {
    mount();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('presentation-counter').textContent).toContain('2 / 3');
  });

  it('ArrowLeft returns to the previous slide', () => {
    mount({ startSlideId: 's2' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('presentation-counter').textContent).toContain('1 / 3');
  });

  it('Escape closes via onClose', () => {
    let closed = false;
    mount({
      onClose: () => {
        closed = true;
      },
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(true);
  });

  it('Space advances', () => {
    mount();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByTestId('presentation-counter').textContent).toContain('2 / 3');
  });

  it('next beyond last clamps', () => {
    mount({ startSlideId: 's3' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('presentation-counter').textContent).toContain('3 / 3');
  });

  it('previous before first clamps', () => {
    mount();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('presentation-counter').textContent).toContain('1 / 3');
  });

  it('renders speaker notes, falls back when empty', () => {
    mount();
    expect(screen.getByTestId('presentation-notes').textContent).toContain('First slide notes');
    fireEvent.keyDown(window, { key: 'ArrowRight' }); // slide without notes
    expect(screen.getByTestId('presentation-notes').textContent).toContain(
      'No speaker notes for this slide.',
    );
  });

  it('S key toggles notes visibility', () => {
    mount();
    expect(screen.queryByTestId('presentation-notes')).toBeTruthy();
    fireEvent.keyDown(window, { key: 's' });
    expect(screen.queryByTestId('presentation-notes')).toBeNull();
    fireEvent.keyDown(window, { key: 's' });
    expect(screen.queryByTestId('presentation-notes')).toBeTruthy();
  });

  it('keyboard nav is suppressed when an input is focused', () => {
    mount();
    // Manually build an input focused target and dispatch.
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    // No slide change.
    expect(screen.getByTestId('presentation-counter').textContent).toContain('1 / 3');
    document.body.removeChild(input);
  });

  it('Exit button closes via onClose', () => {
    let closed = false;
    mount({
      onClose: () => {
        closed = true;
      },
    });
    fireEvent.click(screen.getByTestId('presentation-exit'));
    expect(closed).toBe(true);
  });
});
