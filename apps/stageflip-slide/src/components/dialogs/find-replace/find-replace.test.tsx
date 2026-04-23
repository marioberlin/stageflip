// apps/stageflip-slide/src/components/dialogs/find-replace/find-replace.test.tsx
// UI tests for the <FindReplace> dialog (T-139c).

import { EditorShell, useDocument } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FindReplace } from './find-replace';

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
        {
          id: 's1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
              visible: true,
              locked: false,
              animations: [],
              text: 'foo bar foo',
              align: 'left',
            },
          ],
        },
        {
          id: 's2',
          elements: [
            {
              id: 'e2',
              type: 'text',
              transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
              visible: true,
              locked: false,
              animations: [],
              text: 'foo again',
              align: 'left',
            },
          ],
        },
      ],
    },
  };
}

function Harness({
  showReplace = true,
  onClose,
}: {
  showReplace?: boolean;
  onClose?: () => void;
}): ReactElement {
  const [open, setOpen] = useState(true);
  const handleClose = (): void => {
    setOpen(false);
    onClose?.();
  };
  return (
    <EditorShell initialDocument={makeDoc()}>
      <FindReplace open={open} onClose={handleClose} showReplace={showReplace} />
    </EditorShell>
  );
}

function DocProbe({ onDoc }: { onDoc: (doc: Document | null) => void }): null {
  const { document } = useDocument();
  onDoc(document);
  return null;
}

describe('<FindReplace />', () => {
  it('renders nothing when closed', () => {
    render(
      <EditorShell initialDocument={makeDoc()}>
        <FindReplace open={false} onClose={() => undefined} showReplace={false} />
      </EditorShell>,
    );
    expect(screen.queryByTestId('find-replace')).toBeNull();
  });

  it('renders when open and aria-label reflects replace mode', () => {
    render(<Harness showReplace />);
    const dialog = screen.getByTestId('find-replace');
    expect(dialog.getAttribute('aria-label')).toBe('Find and replace');
  });

  it('shows the counter for matches', () => {
    render(<Harness />);
    const input = screen.getByTestId('find-replace-query') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'foo' } });
    const counter = screen.getByTestId('find-replace-counter');
    expect(counter.textContent).toContain('1');
    expect(counter.textContent).toContain('of');
    expect(counter.textContent).toContain('3');
  });

  it('shows "No matches" when query has no results', () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId('find-replace-query'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('find-replace-counter').textContent).toBe('No matches');
  });

  it('navigates matches via next button', () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId('find-replace-query'), { target: { value: 'foo' } });
    fireEvent.click(screen.getByTestId('find-replace-next'));
    expect(screen.getByTestId('find-replace-counter').textContent).toContain('2');
    fireEvent.click(screen.getByTestId('find-replace-next'));
    expect(screen.getByTestId('find-replace-counter').textContent).toContain('3');
    fireEvent.click(screen.getByTestId('find-replace-next'));
    expect(screen.getByTestId('find-replace-counter').textContent).toContain('1');
  });

  it('navigates matches via previous button (wraps)', () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId('find-replace-query'), { target: { value: 'foo' } });
    fireEvent.click(screen.getByTestId('find-replace-previous'));
    expect(screen.getByTestId('find-replace-counter').textContent).toContain('3');
  });

  it('performs replace-all via replaceAll mutation', () => {
    let doc: Document | null = null;
    render(
      <EditorShell initialDocument={makeDoc()}>
        <DocProbe
          onDoc={(d) => {
            doc = d;
          }}
        />
        <FindReplace open onClose={() => undefined} showReplace />
      </EditorShell>,
    );
    fireEvent.change(screen.getByTestId('find-replace-query'), { target: { value: 'foo' } });
    fireEvent.change(screen.getByTestId('find-replace-replace-with'), {
      target: { value: 'baz' },
    });
    act(() => {
      fireEvent.click(screen.getByTestId('find-replace-replace-all'));
    });
    if (!doc || doc.content.mode !== 'slide') throw new Error();
    const texts = doc.content.slides.flatMap((s) =>
      s.elements.filter((e) => e.type === 'text').map((e) => (e as { text: string }).text),
    );
    expect(texts).toEqual(['baz bar baz', 'baz again']);
  });

  it('shows "Invalid regex" when regex mode + bad pattern', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('find-replace-regex'));
    fireEvent.change(screen.getByTestId('find-replace-query'), {
      target: { value: '[unterminated' },
    });
    expect(screen.getByTestId('find-replace-counter').textContent).toBe('Invalid regex');
  });

  it('Esc in the find input closes the dialog', () => {
    let closed = false;
    render(
      <Harness
        onClose={() => {
          closed = true;
        }}
      />,
    );
    const input = screen.getByTestId('find-replace-query') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(closed).toBe(true);
  });

  it('disables replace buttons when there are no matches', () => {
    render(<Harness />);
    const replaceBtn = screen.getByTestId('find-replace-replace') as HTMLButtonElement;
    expect(replaceBtn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('find-replace-query'), { target: { value: 'foo' } });
    expect(replaceBtn.disabled).toBe(false);
  });

  it('hides replace controls in find-only mode', () => {
    render(<Harness showReplace={false} />);
    expect(screen.queryByTestId('find-replace-replace-with')).toBeNull();
    expect(screen.queryByTestId('find-replace-replace-all')).toBeNull();
  });
});
