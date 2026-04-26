// apps/stageflip-slide/src/components/dialogs/loss-flag-reporter/loss-flag-reporter.test.tsx

import {
  EditorShell,
  activeSlideIdAtom,
  importLossFlagsAtom,
  selectedElementIdsAtom,
  t,
  useEditorShellAtomValue,
  useEditorShellSetAtom,
} from '@stageflip/editor-shell';
import type { LossFlag } from '@stageflip/loss-flags';
import type { Document } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LossFlagReporter } from './loss-flag-reporter';

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

function makeDoc(slideIds: readonly string[]): Document {
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
      slides: slideIds.map((id) => ({
        id,
        elements: [
          {
            id: `${id}-el-1`,
            transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1 },
            visible: true,
            locked: false,
            animations: [],
            type: 'text' as const,
            text: 't',
            align: 'left' as const,
          },
        ],
      })),
    },
  };
}

function Seed({ flags }: { flags: readonly LossFlag[] }): null {
  const set = useEditorShellSetAtom(importLossFlagsAtom);
  useEffect(() => {
    set(flags);
  }, [set, flags]);
  return null;
}

interface MountOptions {
  flags: readonly LossFlag[];
  document?: Document | null;
  onClose?: () => void;
}

function mount({ flags, document = null, onClose }: MountOptions) {
  return render(
    <EditorShell initialDocument={document}>
      <Seed flags={flags} />
      <LossFlagReporter open={true} onClose={onClose ?? (() => undefined)} />
    </EditorShell>,
  );
}

describe('<LossFlagReporter />', () => {
  it('shows the empty-state copy when there are no visible flags (AC #12)', () => {
    mount({ flags: [] });
    expect(screen.getByTestId('loss-flag-reporter-empty').textContent).toBe(
      t('lossFlags.modal.empty'),
    );
  });

  it('renders one row per visible flag (AC #13)', () => {
    mount({
      flags: [
        makeFlag({ id: 'a', code: 'LF-A' }),
        makeFlag({ id: 'b', code: 'LF-B' }),
        makeFlag({ id: 'c', code: 'LF-C' }),
      ],
    });
    expect(screen.getAllByTestId('loss-flag-row').length).toBe(3);
  });

  it('groups rows under severity headers (error → warn → info) (AC #14)', () => {
    mount({
      flags: [
        makeFlag({ id: 'i1', severity: 'info', code: 'LF-I' }),
        makeFlag({ id: 'w1', severity: 'warn', code: 'LF-W' }),
        makeFlag({ id: 'e1', severity: 'error', code: 'LF-E' }),
      ],
    });
    const headers = screen.getAllByTestId(/loss-flag-reporter-group-/);
    // Order matters — error first, info last.
    expect(headers.map((h) => h.getAttribute('data-severity'))).toEqual(['error', 'warn', 'info']);
  });

  it('per-row dismiss removes the row from the modal (AC #15)', () => {
    mount({
      flags: [makeFlag({ id: 'a', code: 'LF-A' }), makeFlag({ id: 'b', code: 'LF-B' })],
    });
    expect(screen.getAllByTestId('loss-flag-row').length).toBe(2);
    const [firstDismiss] = screen.getAllByTestId('loss-flag-row-dismiss');
    if (!firstDismiss) throw new Error('expected dismiss button');
    fireEvent.click(firstDismiss);
    expect(screen.getAllByTestId('loss-flag-row').length).toBe(1);
  });

  it('"Dismiss all" empties the visible list (AC #16)', () => {
    mount({
      flags: [makeFlag({ id: 'a' }), makeFlag({ id: 'b' }), makeFlag({ id: 'c' })],
    });
    fireEvent.click(screen.getByTestId('loss-flag-reporter-dismiss-all'));
    expect(screen.getByTestId('loss-flag-reporter-empty')).toBeTruthy();
  });

  it('the modal title comes from the i18n catalog (AC #20)', () => {
    mount({ flags: [] });
    const modal = screen.getByTestId('modal-loss-flag-reporter');
    expect(modal.getAttribute('aria-label')).toBe(t('lossFlags.modal.title'));
  });

  it('clicking a row location sets activeSlideId + selectedElementIds and closes (AC #17)', () => {
    const doc = makeDoc(['s1']);
    const onClose = vi.fn();
    function Spy(): null {
      const slide = useEditorShellAtomValue(activeSlideIdAtom);
      const sel = useEditorShellAtomValue(selectedElementIdsAtom);
      const w = window as unknown as Record<string, unknown>;
      w.__lastActiveSlide = slide;
      w.__lastSelectedIds = [...sel];
      return null;
    }
    render(
      <EditorShell initialDocument={doc}>
        <Spy />
        <Seed
          flags={[
            makeFlag({
              id: 'a',
              location: { slideId: 's1', elementId: 's1-el-1' },
            }),
          ]}
        />
        <LossFlagReporter open={true} onClose={onClose} />
      </EditorShell>,
    );
    fireEvent.click(screen.getByTestId('loss-flag-row-locate'));
    const w = window as unknown as Record<string, unknown>;
    expect(w.__lastActiveSlide).toBe('s1');
    expect(w.__lastSelectedIds).toEqual(['s1-el-1']);
    expect(onClose).toHaveBeenCalled();
  });

  it("aria-disables the locate button when slideId doesn't match the document (AC #18)", () => {
    mount({
      flags: [makeFlag({ id: 'a', location: { slideId: 'missing-slide' } })],
      document: makeDoc(['s1']),
    });
    const locate = screen.getByTestId('loss-flag-row-locate');
    expect(locate.getAttribute('aria-disabled')).toBe('true');
  });

  it('Escape closes the modal (AC #19)', () => {
    const onClose = vi.fn();
    mount({ flags: [], onClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
