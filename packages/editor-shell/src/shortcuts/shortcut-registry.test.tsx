// packages/editor-shell/src/shortcuts/shortcut-registry.test.tsx
// Exercises the provider, useRegisterShortcuts, and useAllShortcuts via
// @testing-library/react. Dispatches real KeyboardEvents on window to
// verify matching, input-target suppression, decline chaining, and
// unregistration lifecycle.

import { act, cleanup, render } from '@testing-library/react';
import type React from 'react';
import { useMemo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ShortcutRegistryProvider,
  useAllShortcuts,
  useRegisterShortcuts,
} from './shortcut-registry';
import type { Shortcut } from './types';

type KeyInit = {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  target?: HTMLElement;
};

function dispatchKey(init: KeyInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: init.key,
    metaKey: init.meta ?? false,
    ctrlKey: init.ctrl ?? false,
    shiftKey: init.shift ?? false,
    altKey: init.alt ?? false,
    bubbles: true,
    cancelable: true,
  });
  const target = init.target ?? document.body;
  target.dispatchEvent(event);
  return event;
}

function Registrar({ shortcuts }: { shortcuts: Shortcut[] }): null {
  const memo = useMemo(() => shortcuts, [shortcuts]);
  useRegisterShortcuts(memo);
  return null;
}

function withProvider(children: React.ReactNode): React.ReactElement {
  return <ShortcutRegistryProvider>{children}</ShortcutRegistryProvider>;
}

afterEach(() => {
  cleanup();
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});

describe('ShortcutRegistryProvider', () => {
  it('invokes a registered handler on matching keydown', () => {
    const handler = vi.fn();
    render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'edit.undo',
              combo: 'Mod+Z',
              description: 'Undo',
              category: 'essential',
              handler,
            },
          ]}
        />,
      ),
    );
    act(() => {
      dispatchKey({ key: 'z', ctrl: true });
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls preventDefault when a handler claims the event', () => {
    render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'edit.undo',
              combo: 'Mod+Z',
              description: 'Undo',
              category: 'essential',
              handler: () => {},
            },
          ]}
        />,
      ),
    );
    let claimed: KeyboardEvent | undefined;
    act(() => {
      claimed = dispatchKey({ key: 'z', ctrl: true });
    });
    expect(claimed?.defaultPrevented).toBe(true);
  });

  it('does not claim the event when no shortcut matches', () => {
    render(withProvider(<Registrar shortcuts={[]} />));
    let event: KeyboardEvent | undefined;
    act(() => {
      event = dispatchKey({ key: 'z', ctrl: true });
    });
    expect(event?.defaultPrevented).toBe(false);
  });

  it('suppresses bare-key shortcuts when focus is inside an input', () => {
    const handler = vi.fn();
    render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'selection.deselect',
              combo: 'Escape',
              description: 'Deselect',
              category: 'selection',
              handler,
            },
          ]}
        />,
      ),
    );
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => {
      dispatchKey({ key: 'Escape', target: input });
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('fires Mod-combo shortcuts even when focus is inside an input', () => {
    const handler = vi.fn();
    render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'edit.undo',
              combo: 'Mod+Z',
              description: 'Undo',
              category: 'essential',
              handler,
            },
          ]}
        />,
      ),
    );
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => {
      dispatchKey({ key: 'z', ctrl: true, target: input });
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('suppresses bare-key shortcuts when focus is inside a <select>', () => {
    const handler = vi.fn();
    render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'nudge.down',
              combo: 'ArrowDown',
              description: 'Nudge down',
              category: 'object',
              handler,
            },
          ]}
        />,
      ),
    );
    const select = document.createElement('select');
    document.body.appendChild(select);
    select.focus();
    act(() => {
      dispatchKey({ key: 'ArrowDown', target: select });
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('fires when the `when` predicate returns true', () => {
    const handler = vi.fn();
    render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'always',
              combo: 'Mod+K',
              description: 'Always',
              category: 'essential',
              when: () => true,
              handler,
            },
          ]}
        />,
      ),
    );
    act(() => {
      dispatchKey({ key: 'k', ctrl: true });
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('respects the `when` predicate and tries the next shortcut when it fails', () => {
    const gated = vi.fn();
    const fallback = vi.fn();
    render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'gated',
              combo: 'Mod+K',
              description: 'Gated',
              category: 'essential',
              when: () => false,
              handler: gated,
            },
            {
              id: 'fallback',
              combo: 'Mod+K',
              description: 'Fallback',
              category: 'essential',
              handler: fallback,
            },
          ]}
        />,
      ),
    );
    act(() => {
      dispatchKey({ key: 'k', ctrl: true });
    });
    expect(gated).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('treats a sync handler returning false as a decline and tries the next', () => {
    const declining = vi.fn().mockReturnValue(false);
    const fallback = vi.fn();
    render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'declining',
              combo: 'Mod+K',
              description: 'Declining',
              category: 'essential',
              handler: declining,
            },
            {
              id: 'fallback',
              combo: 'Mod+K',
              description: 'Fallback',
              category: 'essential',
              handler: fallback,
            },
          ]}
        />,
      ),
    );
    act(() => {
      dispatchKey({ key: 'k', ctrl: true });
    });
    expect(declining).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('preventDefaults eagerly when an async handler matches (cannot await decline)', () => {
    const async = vi.fn(async () => false);
    render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'async',
              combo: 'Mod+K',
              description: 'Async',
              category: 'essential',
              handler: async,
            },
          ]}
        />,
      ),
    );
    let event: KeyboardEvent | undefined;
    act(() => {
      event = dispatchKey({ key: 'k', ctrl: true });
    });
    expect(event?.defaultPrevented).toBe(true);
    expect(async).toHaveBeenCalledTimes(1);
  });

  it('removes a shortcut when its component unmounts', () => {
    const handler = vi.fn();
    const { unmount } = render(
      withProvider(
        <Registrar
          shortcuts={[
            {
              id: 'edit.undo',
              combo: 'Mod+Z',
              description: 'Undo',
              category: 'essential',
              handler,
            },
          ]}
        />,
      ),
    );
    unmount();
    act(() => {
      dispatchKey({ key: 'z', ctrl: true });
    });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useAllShortcuts', () => {
  it('returns an empty list initially', () => {
    let snapshot: ReadonlyArray<Shortcut> = [];
    function Peek(): null {
      snapshot = useAllShortcuts();
      return null;
    }
    render(withProvider(<Peek />));
    expect(snapshot.length).toBe(0);
  });

  it('re-renders consumers when shortcuts register or unregister', () => {
    let latest: ReadonlyArray<Shortcut> = [];
    function Peek(): null {
      latest = useAllShortcuts();
      return null;
    }
    const shortcuts: Shortcut[] = [
      {
        id: 'edit.undo',
        combo: 'Mod+Z',
        description: 'Undo',
        category: 'essential',
        handler: () => {},
      },
    ];
    const { rerender, unmount } = render(
      withProvider(
        <>
          <Registrar shortcuts={shortcuts} />
          <Peek />
        </>,
      ),
    );
    expect(latest.map((s) => s.id)).toEqual(['edit.undo']);

    rerender(withProvider(<Peek />));
    expect(latest.length).toBe(0);

    unmount();
  });
});

describe('useRegisterShortcuts outside provider', () => {
  it('throws a descriptive error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <Registrar
          shortcuts={[
            {
              id: 'x',
              combo: 'Mod+X',
              description: 'x',
              category: 'essential',
              handler: () => {},
            },
          ]}
        />,
      ),
    ).toThrow(/ShortcutRegistryProvider/);
    spy.mockRestore();
  });
});
