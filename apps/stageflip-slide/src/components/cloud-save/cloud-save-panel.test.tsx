// apps/stageflip-slide/src/components/cloud-save/cloud-save-panel.test.tsx
// Tests for the cloud-save panel UI (T-139c).

import { EditorShell, createStubCloudSaveAdapter } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { CloudSavePanel } from './cloud-save-panel';

afterEach(() => cleanup());

function makeDoc(): Document {
  return {
    meta: {
      id: 'doc-1',
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
  };
}

function mount(
  adapter = createStubCloudSaveAdapter({ now: () => new Date('2026-04-22T00:00:00Z') }),
): {
  view: ReactElement;
  adapter: ReturnType<typeof createStubCloudSaveAdapter>;
} {
  return {
    adapter,
    view: (
      <EditorShell initialDocument={makeDoc()}>
        <CloudSavePanel adapter={adapter} />
      </EditorShell>
    ),
  };
}

describe('<CloudSavePanel />', () => {
  it('renders idle status on mount', () => {
    const { view } = mount();
    render(view);
    expect(screen.getByTestId('cloud-save-status').getAttribute('data-status')).toBe('idle');
    expect(screen.getByTestId('cloud-save-save').textContent).toBe('Save to cloud');
  });

  it('flips through saving → saved on a successful save', async () => {
    const { view } = mount();
    render(view);
    act(() => {
      fireEvent.click(screen.getByTestId('cloud-save-save'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('cloud-save-status').getAttribute('data-status')).toBe('saved');
    });
    expect(screen.getByTestId('cloud-save-last-result').textContent).toContain('Rev 1');
    expect(screen.getByTestId('cloud-save-save').textContent).toBe('Save again');
  });

  it('surfaces the conflict UI when adapter reports a conflict', async () => {
    const { view, adapter } = mount();
    render(view);
    // First save succeeds.
    act(() => {
      fireEvent.click(screen.getByTestId('cloud-save-save'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('cloud-save-status').getAttribute('data-status')).toBe('saved'),
    );
    // Next save hits a simulated conflict.
    const remote = makeDoc();
    adapter.__simulateConflict('doc-1', remote);
    act(() => {
      fireEvent.click(screen.getByTestId('cloud-save-save'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('cloud-save-status').getAttribute('data-status')).toBe('conflict'),
    );
    expect(screen.getByTestId('cloud-save-conflict')).toBeTruthy();
    expect(screen.getByTestId('cloud-save-conflict-keep-local')).toBeTruthy();
    expect(screen.getByTestId('cloud-save-conflict-keep-remote')).toBeTruthy();
  });

  it('surfaces generic errors via the error banner', async () => {
    const { view, adapter } = mount();
    adapter.__simulateError(new Error('network down'));
    render(view);
    act(() => {
      fireEvent.click(screen.getByTestId('cloud-save-save'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('cloud-save-status').getAttribute('data-status')).toBe('error'),
    );
    expect(screen.getByTestId('cloud-save-error').textContent).toContain('network down');
  });

  it('disables the save button while saving', async () => {
    let resolve: (() => void) | null = null;
    const slowAdapter = {
      displayName: 'slow',
      async save(doc: Document) {
        await new Promise<void>((r) => {
          resolve = r;
        });
        return { id: doc.meta.id, revision: 1, savedAtIso: '2026-04-22T00:00:00Z' };
      },
      async load() {
        throw new Error('no');
      },
    };
    render(
      <EditorShell initialDocument={makeDoc()}>
        <CloudSavePanel adapter={slowAdapter} />
      </EditorShell>,
    );
    act(() => {
      fireEvent.click(screen.getByTestId('cloud-save-save'));
    });
    await waitFor(() =>
      expect((screen.getByTestId('cloud-save-save') as HTMLButtonElement).disabled).toBe(true),
    );
    act(() => {
      resolve?.();
    });
    await waitFor(() =>
      expect((screen.getByTestId('cloud-save-save') as HTMLButtonElement).disabled).toBe(false),
    );
  });
});
