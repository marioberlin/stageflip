// packages/editor-shell/src/context-menu/context-menu.test.tsx
// Keyboard navigation + submenu + i18n label tests for the renderer.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/catalog';
import { ContextMenu } from './context-menu';
import { ContextMenuProvider, useRegisterContextMenu } from './context-menu-provider';
import type { ContextMenuDescriptor } from './types';

afterEach(() => {
  cleanup();
  setLocale('en');
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

function Registrar({ descriptor }: { descriptor: ContextMenuDescriptor }): null {
  const memo = useMemo(() => descriptor, [descriptor]);
  useRegisterContextMenu(memo);
  return null;
}

function withProvider(children: ReactElement): ReactElement {
  return <ContextMenuProvider>{children}</ContextMenuProvider>;
}

function dispatchContextMenu(target: Element): void {
  target.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 1, clientY: 1 }),
  );
}

function openMenu(descriptor: ContextMenuDescriptor): void {
  render(
    withProvider(
      <>
        <div data-testid="anchor" />
        <Registrar descriptor={descriptor} />
        <ContextMenu />
      </>,
    ),
  );
  act(() => {
    dispatchContextMenu(screen.getByTestId('anchor'));
  });
}

describe('<ContextMenu />', () => {
  it('renders items and resolves i18n labels via t()', () => {
    openMenu({
      id: 'labels',
      match: () => true,
      items: [{ type: 'item', labelKey: 'common.delete', onSelect: () => undefined }],
    });
    const row = screen.getByTestId('context-menu-item-labels-0');
    expect(row.textContent).toContain('Delete');
  });

  it('renders pseudo-locale markers when setLocale("pseudo")', () => {
    setLocale('pseudo');
    openMenu({
      id: 'pseudo',
      match: () => true,
      items: [{ type: 'item', labelKey: 'common.delete', onSelect: () => undefined }],
    });
    expect(screen.getByTestId('context-menu-item-pseudo-0').textContent).toContain(
      '⟦common.delete⟧',
    );
  });

  it('renders a separator', () => {
    openMenu({
      id: 'sep',
      match: () => true,
      items: [
        { type: 'item', labelKey: 'common.delete', onSelect: () => undefined },
        { type: 'separator' },
        { type: 'item', labelKey: 'common.close', onSelect: () => undefined },
      ],
    });
    expect(screen.getByTestId('context-menu-separator-sep-1')).toBeTruthy();
  });

  it('invokes onSelect and closes on item click', () => {
    const onSelect = vi.fn();
    openMenu({
      id: 'click',
      match: () => true,
      items: [{ type: 'item', labelKey: 'common.delete', onSelect }],
    });
    fireEvent.click(screen.getByTestId('context-menu-item-click-0'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('context-menu-click')).toBeNull();
  });

  it('does not invoke onSelect when disabled', () => {
    const onSelect = vi.fn();
    openMenu({
      id: 'disabled',
      match: () => true,
      items: [{ type: 'item', labelKey: 'common.delete', onSelect, disabled: true }],
    });
    fireEvent.click(screen.getByTestId('context-menu-item-disabled-0'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('navigates with ArrowDown / ArrowUp / Enter', () => {
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    openMenu({
      id: 'nav',
      match: () => true,
      items: [
        { type: 'item', labelKey: 'common.delete', onSelect: onFirst },
        { type: 'item', labelKey: 'common.close', onSelect: onSecond },
      ],
    });
    const menu = screen.getByTestId('context-menu-nav');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onSecond).toHaveBeenCalledTimes(1);
    expect(onFirst).not.toHaveBeenCalled();
  });

  it('ArrowUp wraps from first to last', () => {
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    openMenu({
      id: 'wrap',
      match: () => true,
      items: [
        { type: 'item', labelKey: 'common.delete', onSelect: onFirst },
        { type: 'item', labelKey: 'common.close', onSelect: onSecond },
      ],
    });
    const menu = screen.getByTestId('context-menu-wrap');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onSecond).toHaveBeenCalledTimes(1);
  });

  it('opens a submenu on hover and invokes its item', () => {
    const nestedSelect = vi.fn();
    openMenu({
      id: 'sub',
      match: () => true,
      items: [
        {
          type: 'submenu',
          labelKey: 'common.delete',
          items: [{ type: 'item', labelKey: 'common.close', onSelect: nestedSelect }],
        },
      ],
    });
    const row = screen.getByTestId('context-menu-submenu-sub-0');
    fireEvent.mouseEnter(row);
    const nestedItem = screen.getByTestId('context-menu-item-sub-sub-0-0');
    fireEvent.click(nestedItem);
    expect(nestedSelect).toHaveBeenCalledTimes(1);
  });

  it('submenu keyboard: ArrowRight on focused submenu opens it', () => {
    const nestedSelect = vi.fn();
    openMenu({
      id: 'subkey',
      match: () => true,
      items: [
        {
          type: 'submenu',
          labelKey: 'common.delete',
          items: [{ type: 'item', labelKey: 'common.close', onSelect: nestedSelect }],
        },
      ],
    });
    const menu = screen.getByTestId('context-menu-subkey');
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    expect(screen.getByTestId('context-menu-item-subkey-sub-0-0')).toBeTruthy();
  });

  it('renders keybind hints via formatCombo', () => {
    openMenu({
      id: 'kb',
      match: () => true,
      items: [
        {
          type: 'item',
          labelKey: 'common.delete',
          onSelect: () => undefined,
          keybind: 'Mod+Backspace',
        },
      ],
    });
    const row = screen.getByTestId('context-menu-item-kb-0');
    // formatCombo renders Backspace as "⌫" and Mod as Ctrl/⌘ depending
    // on platform — the rendered hint should at minimum contain the
    // modifier affordance.
    expect(row.textContent).toMatch(/Ctrl|⌘/);
    expect(row.textContent).toMatch(/⌫/);
  });

  it('ArrowDown skips separators and disabled rows', () => {
    const onLast = vi.fn();
    openMenu({
      id: 'skip',
      match: () => true,
      items: [
        { type: 'item', labelKey: 'common.delete', onSelect: () => undefined },
        { type: 'separator' },
        { type: 'item', labelKey: 'common.close', onSelect: () => undefined, disabled: true },
        { type: 'item', labelKey: 'common.cancel', onSelect: onLast },
      ],
    });
    const menu = screen.getByTestId('context-menu-skip');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onLast).toHaveBeenCalledTimes(1);
  });
});
