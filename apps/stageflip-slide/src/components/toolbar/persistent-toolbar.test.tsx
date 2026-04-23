// apps/stageflip-slide/src/components/toolbar/persistent-toolbar.test.tsx

import { EditorShell } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersistentToolbar } from './persistent-toolbar';

afterEach(() => cleanup());

const DOC: Document = {
  meta: {
    id: 'test-doc',
    version: 0,
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    title: 'Test',
    locale: 'en',
    schemaVersion: 1,
  },
  theme: { tokens: {} },
  variables: {},
  components: {},
  content: {
    mode: 'slide',
    slides: [
      { id: 's1', elements: [] },
      { id: 's2', elements: [] },
      { id: 's3', elements: [] },
    ],
  },
};

function mount(
  overrides: Partial<React.ComponentProps<typeof PersistentToolbar>> = {},
): ReactElement {
  return (
    <EditorShell initialDocument={DOC}>
      <PersistentToolbar
        zoom={overrides.zoom ?? 1}
        onZoomIn={overrides.onZoomIn ?? (() => undefined)}
        onZoomOut={overrides.onZoomOut ?? (() => undefined)}
        onPresent={overrides.onPresent ?? (() => undefined)}
        onNewSlide={overrides.onNewSlide ?? (() => undefined)}
      />
    </EditorShell>
  );
}

describe('<PersistentToolbar />', () => {
  it('renders every control', () => {
    render(mount());
    expect(screen.getByTestId('persistent-toolbar')).toBeTruthy();
    expect(screen.getByTestId('persistent-toolbar-new-slide')).toBeTruthy();
    expect(screen.getByTestId('persistent-toolbar-undo')).toBeTruthy();
    expect(screen.getByTestId('persistent-toolbar-redo')).toBeTruthy();
    expect(screen.getByTestId('persistent-toolbar-zoom-in')).toBeTruthy();
    expect(screen.getByTestId('persistent-toolbar-zoom-out')).toBeTruthy();
    expect(screen.getByTestId('persistent-toolbar-zoom-readout')).toBeTruthy();
    expect(screen.getByTestId('persistent-toolbar-present')).toBeTruthy();
    expect(screen.getByTestId('persistent-toolbar-slide-counter')).toBeTruthy();
  });

  it('renders undo as disabled when the history is empty', () => {
    render(mount());
    const undoBtn = screen.getByTestId('persistent-toolbar-undo') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
  });

  it('renders redo as disabled when the redo stack is empty', () => {
    render(mount());
    const redoBtn = screen.getByTestId('persistent-toolbar-redo') as HTMLButtonElement;
    expect(redoBtn.disabled).toBe(true);
  });

  it('dispatches onNewSlide click', () => {
    const onNewSlide = vi.fn();
    render(mount({ onNewSlide }));
    fireEvent.click(screen.getByTestId('persistent-toolbar-new-slide'));
    expect(onNewSlide).toHaveBeenCalledTimes(1);
  });

  it('dispatches onPresent click', () => {
    const onPresent = vi.fn();
    render(mount({ onPresent }));
    fireEvent.click(screen.getByTestId('persistent-toolbar-present'));
    expect(onPresent).toHaveBeenCalledTimes(1);
  });

  it('dispatches zoom stepper clicks', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    render(mount({ onZoomIn, onZoomOut }));
    fireEvent.click(screen.getByTestId('persistent-toolbar-zoom-in'));
    fireEvent.click(screen.getByTestId('persistent-toolbar-zoom-out'));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('rounds the zoom readout to a percentage', () => {
    render(mount({ zoom: 0.756 }));
    expect(screen.getByTestId('persistent-toolbar-zoom-readout').textContent).toBe('76%');
  });

  it('renders "— / N" slide counter when no active slide is set', () => {
    render(mount());
    expect(screen.getByTestId('persistent-toolbar-slide-counter').textContent).toBe('— / 3');
  });
});
