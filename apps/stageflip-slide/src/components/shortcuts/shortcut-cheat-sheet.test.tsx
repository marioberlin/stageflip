// apps/stageflip-slide/src/components/shortcuts/shortcut-cheat-sheet.test.tsx

import {
  type Shortcut,
  ShortcutRegistryProvider,
  useRegisterShortcuts,
} from '@stageflip/editor-shell';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useMemo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShortcutCheatSheet } from './shortcut-cheat-sheet';

afterEach(() => cleanup());

function SeedShortcuts({ list }: { list: Shortcut[] }): null {
  const memo = useMemo(() => list, [list]);
  useRegisterShortcuts(memo);
  return null;
}

function noop(): undefined {
  return undefined;
}

function makeShortcuts(): Shortcut[] {
  return [
    {
      id: 's.undo',
      combo: 'Mod+Z',
      description: 'Undo',
      category: 'essential',
      handler: noop,
    },
    {
      id: 's.redo',
      combo: 'Mod+Shift+Z',
      description: 'Redo',
      category: 'essential',
      handler: noop,
    },
    {
      id: 's.new-slide',
      combo: 'Mod+N',
      description: 'New slide',
      category: 'slide',
      handler: noop,
    },
    {
      id: 's.delete',
      combo: 'Delete',
      description: 'Delete element',
      category: 'object',
      handler: noop,
    },
  ];
}

function renderSheet(open: boolean, onClose = vi.fn()): ReactElement {
  return (
    <ShortcutRegistryProvider>
      <SeedShortcuts list={makeShortcuts()} />
      <ShortcutCheatSheet open={open} onClose={onClose} />
    </ShortcutRegistryProvider>
  );
}

describe('<ShortcutCheatSheet>', () => {
  it('renders nothing when closed', () => {
    render(renderSheet(false));
    expect(screen.queryByTestId('shortcut-cheat-sheet')).toBeNull();
  });

  it('lists every registered shortcut with its description + combo when open', () => {
    render(renderSheet(true));
    expect(screen.getByTestId('shortcut-cheat-sheet')).toBeTruthy();
    expect(screen.getByTestId('shortcut-row-s.undo')).toBeTruthy();
    expect(screen.getByTestId('shortcut-row-s.undo').textContent).toContain('Undo');
    expect(screen.getByTestId('shortcut-row-s.redo').textContent).toContain('Redo');
    expect(screen.getByTestId('shortcut-row-s.new-slide').textContent).toContain('New slide');
  });

  it('groups shortcuts by category with a heading per group', () => {
    render(renderSheet(true));
    expect(screen.getByTestId('shortcut-group-essential')).toBeTruthy();
    expect(screen.getByTestId('shortcut-group-slide')).toBeTruthy();
    expect(screen.getByTestId('shortcut-group-object')).toBeTruthy();
  });

  it('filters rows by description substring (case-insensitive)', () => {
    render(renderSheet(true));
    const search = screen.getByTestId('shortcut-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'redo' } });
    expect(screen.queryByTestId('shortcut-row-s.redo')).toBeTruthy();
    expect(screen.queryByTestId('shortcut-row-s.undo')).toBeNull();
    expect(screen.queryByTestId('shortcut-row-s.new-slide')).toBeNull();
  });

  it('filters by combo string too', () => {
    render(renderSheet(true));
    const search = screen.getByTestId('shortcut-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'delete' } });
    expect(screen.queryByTestId('shortcut-row-s.delete')).toBeTruthy();
    expect(screen.queryByTestId('shortcut-row-s.undo')).toBeNull();
  });

  it('shows the empty-state when the search matches nothing', () => {
    render(renderSheet(true));
    const search = screen.getByTestId('shortcut-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'zzz-no-match' } });
    expect(screen.getByTestId('shortcut-empty')).toBeTruthy();
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    render(renderSheet(true, onClose));
    fireEvent.keyDown(screen.getByTestId('shortcut-cheat-sheet'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the dismiss button calls onClose', () => {
    const onClose = vi.fn();
    render(renderSheet(true, onClose));
    fireEvent.click(screen.getByTestId('shortcut-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
