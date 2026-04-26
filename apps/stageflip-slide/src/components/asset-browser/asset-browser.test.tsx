// apps/stageflip-slide/src/components/asset-browser/asset-browser.test.tsx

import {
  type Asset,
  ContextMenu,
  ContextMenuProvider,
  EditorShell,
  addAssetAtom,
  assetsAtom,
  useEditorShellAtomValue,
  useEditorShellSetAtom,
} from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetBrowser } from './asset-browser';

afterEach(() => cleanup());

const DOC: Document = {
  meta: {
    id: 'doc',
    version: 0,
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    title: 'doc',
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

function Seed({ assets }: { assets: ReadonlyArray<Omit<Asset, 'ref'>> }): null {
  const add = useEditorShellSetAtom(addAssetAtom);
  useEffect(() => {
    for (const a of assets) add(a);
  }, [add, assets]);
  return null;
}

function mount(
  assets: ReadonlyArray<Omit<Asset, 'ref'>> = [],
  props: Partial<React.ComponentProps<typeof AssetBrowser>> = {},
): ReactElement {
  return (
    <EditorShell initialDocument={DOC}>
      <ContextMenuProvider>
        <Seed assets={assets} />
        <AssetBrowser onInsert={props.onInsert ?? (() => undefined)} />
        <ContextMenu />
      </ContextMenuProvider>
    </EditorShell>
  );
}

describe('<AssetBrowser />', () => {
  it('renders the empty state when the registry is empty', () => {
    render(mount());
    expect(screen.getByTestId('asset-browser')).toBeTruthy();
    expect(screen.getByTestId('asset-browser-empty')).toBeTruthy();
  });

  it('renders one grid cell per registered asset', () => {
    render(
      mount([
        { id: 'a', kind: 'image', name: 'one.png', url: 'https://x/one.png', addedAt: 0 },
        { id: 'b', kind: 'image', name: 'two.png', url: 'https://x/two.png', addedAt: 1 },
      ]),
    );
    expect(screen.getByTestId('asset-browser-cell-a')).toBeTruthy();
    expect(screen.getByTestId('asset-browser-cell-b')).toBeTruthy();
  });

  it('filters by kind when the filter pill is clicked', () => {
    render(
      mount([
        { id: 'img', kind: 'image', name: 'p.png', url: 'https://x/p.png', addedAt: 0 },
        { id: 'vid', kind: 'video', name: 'v.mp4', url: 'https://x/v.mp4', addedAt: 1 },
      ]),
    );
    fireEvent.click(screen.getByTestId('asset-browser-filter-video'));
    expect(screen.queryByTestId('asset-browser-cell-img')).toBeNull();
    expect(screen.getByTestId('asset-browser-cell-vid')).toBeTruthy();
  });

  it('clicking a cell focuses the asset (selection state)', () => {
    render(mount([{ id: 'a', kind: 'image', name: 'p.png', url: 'https://x/p.png', addedAt: 0 }]));
    const cell = screen.getByTestId('asset-browser-cell-a');
    fireEvent.click(cell);
    expect(cell.getAttribute('data-selected')).toBe('true');
  });

  it('drag-start populates dataTransfer with the asset ref', () => {
    render(mount([{ id: 'a', kind: 'image', name: 'p.png', url: 'https://x/p.png', addedAt: 0 }]));
    const cell = screen.getByTestId('asset-browser-cell-a');
    const setData = vi.fn();
    fireEvent.dragStart(cell, { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith('application/x-stageflip-asset-ref', 'asset:a');
  });

  it('right-click opens the context menu registered for the cell', () => {
    render(mount([{ id: 'a', kind: 'image', name: 'p.png', url: 'https://x/p.png', addedAt: 0 }]));
    const cell = screen.getByTestId('asset-browser-cell-a');
    act(() => {
      cell.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
        }),
      );
    });
    expect(screen.getByTestId('context-menu-asset-browser-cell')).toBeTruthy();
  });

  it('context-menu Insert action dispatches onInsert with the asset ref', () => {
    const onInsert = vi.fn();
    render(
      mount([{ id: 'a', kind: 'image', name: 'p.png', url: 'https://x/p.png', addedAt: 0 }], {
        onInsert,
      }),
    );
    const cell = screen.getByTestId('asset-browser-cell-a');
    // Select first so the context-menu "current" resolves.
    fireEvent.click(cell);
    act(() => {
      cell.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
        }),
      );
    });
    fireEvent.click(screen.getByTestId('context-menu-item-asset-browser-cell-0'));
    expect(onInsert).toHaveBeenCalledWith({
      ref: 'asset:a',
      kind: 'image',
      id: 'a',
    });
  });

  it('context-menu Remove action removes the asset from the registry', () => {
    function Observer(): ReactElement {
      const list = useEditorShellAtomValue(assetsAtom);
      return <span data-testid="count">{list.length}</span>;
    }
    render(
      <EditorShell initialDocument={DOC}>
        <ContextMenuProvider>
          <Seed
            assets={[{ id: 'a', kind: 'image', name: 'p.png', url: 'https://x/p.png', addedAt: 0 }]}
          />
          <AssetBrowser onInsert={() => undefined} />
          <ContextMenu />
          <Observer />
        </ContextMenuProvider>
      </EditorShell>,
    );
    expect(screen.getByTestId('count').textContent).toBe('1');
    const cell = screen.getByTestId('asset-browser-cell-a');
    fireEvent.click(cell);
    act(() => {
      cell.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 10,
          clientY: 10,
        }),
      );
    });
    // Index 3 = Remove (0 insert, 1 copy-ref, 2 separator, 3 remove).
    fireEvent.click(screen.getByTestId('context-menu-item-asset-browser-cell-3'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});
