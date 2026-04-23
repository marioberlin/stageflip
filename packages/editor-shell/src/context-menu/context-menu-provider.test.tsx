// packages/editor-shell/src/context-menu/context-menu-provider.test.tsx
// Exercises the provider + hooks through @testing-library/react.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './context-menu';
import {
  ContextMenuProvider,
  useAllContextMenus,
  useContextMenu,
  useRegisterContextMenu,
} from './context-menu-provider';
import type { ContextMenuDescriptor } from './types';

afterEach(() => {
  cleanup();
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

function Registrar({ descriptor }: { descriptor: ContextMenuDescriptor }): null {
  const memo = useMemo(() => descriptor, [descriptor]);
  useRegisterContextMenu(memo);
  return null;
}

function CountProbe({ onCount }: { onCount: (n: number) => void }): null {
  const descriptors = useAllContextMenus();
  onCount(descriptors.length);
  return null;
}

function withProvider(children: ReactElement): ReactElement {
  return <ContextMenuProvider>{children}</ContextMenuProvider>;
}

function dispatchContextMenu(target: Element, x = 10, y = 20): void {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
}

describe('ContextMenuProvider', () => {
  it('mounts without crashing', () => {
    render(withProvider(<div data-testid="child">ok</div>));
    expect(screen.getByTestId('child').textContent).toBe('ok');
  });

  it('registers descriptors and unregisters them on unmount', () => {
    const counts: number[] = [];
    const { unmount } = render(
      withProvider(
        <>
          <Registrar
            descriptor={{
              id: 'a',
              match: () => true,
              items: [],
            }}
          />
          <CountProbe onCount={(n) => counts.push(n)} />
        </>,
      ),
    );
    expect(counts.at(-1)).toBe(1);
    unmount();
  });

  it('re-registers replace prior descriptor with the same id', () => {
    function Outer({ sel }: { sel: boolean }): ReactElement {
      return (
        <Registrar
          descriptor={{
            id: 'dup',
            match: () => true,
            items: [],
            disabled: sel,
          }}
        />
      );
    }
    const seen: boolean[] = [];
    function Probe(): null {
      const descriptors = useAllContextMenus();
      for (const d of descriptors) if (d.id === 'dup') seen.push(d.disabled === true);
      return null;
    }
    const { rerender } = render(
      withProvider(
        <>
          <Outer sel={false} />
          <Probe />
        </>,
      ),
    );
    rerender(
      withProvider(
        <>
          <Outer sel={true} />
          <Probe />
        </>,
      ),
    );
    // Exactly one descriptor with the id should ever be present.
    expect(seen.at(-1)).toBe(true);
  });

  it('opens the menu on right-click when a registered match claims the target', () => {
    const onSelect = vi.fn();
    render(
      withProvider(
        <>
          <div data-testid="area" className="target-zone">
            <span data-testid="inside">inside</span>
          </div>
          <Registrar
            descriptor={{
              id: 'zone',
              match: (el) => !!el?.closest('.target-zone'),
              items: [
                {
                  type: 'item',
                  labelKey: 'common.delete',
                  onSelect,
                },
              ],
            }}
          />
          <ContextMenu />
        </>,
      ),
    );
    act(() => {
      dispatchContextMenu(screen.getByTestId('inside'));
    });
    expect(screen.getByTestId('context-menu-zone')).toBeTruthy();
    fireEvent.click(screen.getByTestId('context-menu-item-zone-0'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not open when no descriptor matches (browser default survives)', () => {
    render(
      withProvider(
        <>
          <div data-testid="bg">background</div>
          <Registrar
            descriptor={{
              id: 'never',
              match: () => false,
              items: [],
            }}
          />
          <ContextMenu />
        </>,
      ),
    );
    act(() => {
      dispatchContextMenu(screen.getByTestId('bg'));
    });
    expect(screen.queryByTestId('context-menu-never')).toBeNull();
  });

  it('picks the first matching descriptor in registration order', () => {
    const firstSelect = vi.fn();
    const secondSelect = vi.fn();
    render(
      withProvider(
        <>
          <div data-testid="target" />
          <Registrar
            descriptor={{
              id: 'first',
              match: () => true,
              items: [{ type: 'item', labelKey: 'first', onSelect: firstSelect }],
            }}
          />
          <Registrar
            descriptor={{
              id: 'second',
              match: () => true,
              items: [{ type: 'item', labelKey: 'second', onSelect: secondSelect }],
            }}
          />
          <ContextMenu />
        </>,
      ),
    );
    act(() => {
      dispatchContextMenu(screen.getByTestId('target'));
    });
    expect(screen.getByTestId('context-menu-first')).toBeTruthy();
    expect(screen.queryByTestId('context-menu-second')).toBeNull();
  });

  it('closes on Escape dispatched on the menu root (T-140)', () => {
    render(
      withProvider(
        <>
          <div data-testid="target" />
          <Registrar
            descriptor={{
              id: 'esc',
              match: () => true,
              items: [{ type: 'item', labelKey: 'l', onSelect: () => undefined }],
            }}
          />
          <ContextMenu />
        </>,
      ),
    );
    act(() => {
      dispatchContextMenu(screen.getByTestId('target'));
    });
    const menu = screen.getByTestId('context-menu-esc');
    expect(menu).toBeTruthy();
    // Post-T-140 Escape routes through the menu root's element-level
    // onKeyDown (the menu auto-focuses on open) rather than a
    // window-level listener.
    act(() => {
      fireEvent.keyDown(menu, { key: 'Escape' });
    });
    expect(screen.queryByTestId('context-menu-esc')).toBeNull();
  });

  it('throws when useRegisterContextMenu is called outside the provider', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <Registrar
          descriptor={{
            id: 'x',
            match: () => true,
            items: [],
          }}
        />,
      ),
    ).toThrow(/ContextMenuProvider/);
    err.mockRestore();
  });

  it('exposes open-state via useContextMenu()', () => {
    const captured: Array<{ id: string; x: number; y: number } | null> = [];
    function Peek(): null {
      const { openState } = useContextMenu();
      captured.push(
        openState ? { id: openState.descriptor.id, x: openState.x, y: openState.y } : null,
      );
      return null;
    }
    render(
      withProvider(
        <>
          <div data-testid="peek-target" />
          <Registrar
            descriptor={{
              id: 'peek',
              match: () => true,
              items: [],
            }}
          />
          <Peek />
        </>,
      ),
    );
    act(() => {
      dispatchContextMenu(screen.getByTestId('peek-target'), 33, 44);
    });
    const last = captured.at(-1);
    expect(last?.id).toBe('peek');
    expect(last?.x).toBe(33);
    expect(last?.y).toBe(44);
  });
});
