// packages/editor-shell/src/shortcuts/types.typecheck.test.tsx
// Typecheck-only regression: `() => void` handlers must satisfy
// `ShortcutHandler` so that `useCallback(() => { ... }, [])` in consumer
// code can be assigned directly to `shortcut.handler`. If this file
// fails to typecheck, consumer ergonomics break even if the runtime
// tests still pass.

import { useCallback } from 'react';
import { describe, expectTypeOf, it } from 'vitest';
import type { Shortcut, ShortcutHandler } from './types';

describe('ShortcutHandler assignment surface', () => {
  it('accepts an inferred `() => void` no-return callback', () => {
    const handler: ShortcutHandler = () => {
      /* no-op */
    };
    expectTypeOf(handler).toBeFunction();
  });

  it('accepts a `useCallback` handler in a typed Shortcut literal', () => {
    function Component(): Shortcut {
      // Inferred as `() => void`.
      const handler = useCallback(() => {
        /* no-op */
      }, []);
      return {
        id: 'x',
        combo: 'Mod+X',
        description: '',
        category: 'essential',
        handler,
      };
    }
    expectTypeOf(Component).returns.toEqualTypeOf<Shortcut>();
  });

  it('accepts an explicit `false` decline', () => {
    const handler: ShortcutHandler = () => false;
    expectTypeOf(handler).toBeFunction();
  });

  it('accepts an async handler returning `false`', () => {
    const handler: ShortcutHandler = async () => false;
    expectTypeOf(handler).toBeFunction();
  });
});
