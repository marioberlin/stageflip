// packages/editor-shell/src/persistence/use-autosave-document.test.tsx
// Covers: debounce window, null skip, enabled=false skip, custom
// serializer. Uses fake timers + @testing-library/react act() to
// flush both the state update and the scheduled setTimeout.

import { act, cleanup, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentProvider, useDocument } from '../context/document-context';
import { makeSlideDoc } from '../test-fixtures/document-fixture';
import { loadDocumentSerialized } from './document-storage';
import { useAutosaveDocument } from './use-autosave-document';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({
  delayMs,
  onReady,
  serialize,
  enabled,
}: {
  delayMs?: number;
  onReady?: (api: ReturnType<typeof useDocument>) => void;
  serialize?: (doc: ReturnType<typeof useDocument>['document'] & {}) => string;
  enabled?: boolean;
}): React.ReactElement {
  const options: Parameters<typeof useAutosaveDocument>[0] = {};
  if (delayMs !== undefined) options.delayMs = delayMs;
  if (serialize !== undefined) options.serialize = serialize;
  if (enabled !== undefined) options.enabled = enabled;
  useAutosaveDocument(options);
  const api = useDocument();
  onReady?.(api);
  return <></>;
}

function countDocWrites(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter(
    ([k]) => typeof k === 'string' && k.startsWith('stageflip:editor:doc:'),
  ).length;
}

describe('useAutosaveDocument', () => {
  it('saves the document after the debounce window elapses', () => {
    const doc = makeSlideDoc({ slideCount: 2 });
    render(
      <DocumentProvider initialDocument={doc}>
        <Harness delayMs={100} />
      </DocumentProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(loadDocumentSerialized(doc.meta.id)).toBe(JSON.stringify(doc));
  });

  it('does not save before the debounce window elapses', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(
      <DocumentProvider initialDocument={doc}>
        <Harness delayMs={200} />
      </DocumentProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(countDocWrites(setItem)).toBe(0);
  });

  it('a fresh setDocument inside the debounce window extends the window', () => {
    let api!: ReturnType<typeof useDocument>;
    const first = makeSlideDoc({ slideCount: 1 });
    render(
      <DocumentProvider initialDocument={first}>
        <Harness
          delayMs={100}
          onReady={(a) => {
            api = a;
          }}
        />
      </DocumentProvider>,
    );
    // Start window, let 80ms pass (pre-threshold), replace the doc.
    act(() => {
      vi.advanceTimersByTime(80);
    });
    const replacement = makeSlideDoc({ slideCount: 9 });
    act(() => {
      api.setDocument(replacement);
    });
    // Jump another 80ms — total 160ms since first mount, but only 80ms
    // since the replacement. Debounce window is 100ms, so still pre-save.
    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(loadDocumentSerialized(first.meta.id)).toBeNull();
    // Now finish the window.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(loadDocumentSerialized(replacement.meta.id)).toBe(JSON.stringify(replacement));
  });

  it('skips when the document is null', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(
      <DocumentProvider initialDocument={null}>
        <Harness delayMs={50} />
      </DocumentProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(countDocWrites(setItem)).toBe(0);
  });

  it('skips entirely when `enabled` is false', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(
      <DocumentProvider initialDocument={doc}>
        <Harness delayMs={50} enabled={false} />
      </DocumentProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(countDocWrites(setItem)).toBe(0);
  });

  it('tolerates an unstable `serialize` reference without re-running the effect every render', () => {
    // Regression guard: before the ref fix, including `serialize` in the
    // effect deps would cause every render to cancel + reschedule the
    // debounce timer. This test renders with an inline arrow (brand-new
    // identity every render), then triggers extra renders via a state
    // bump, then confirms the initial save fires exactly once on the
    // first schedule — ignoring the churn.
    const doc = makeSlideDoc({ slideCount: 1 });
    function Bump({ tick }: { tick: number }): null {
      useAutosaveDocument({
        delayMs: 100,
        // Unstable identity on every render.
        serialize: (d) => `serialized-${tick}-${JSON.stringify(d)}`,
      });
      return null;
    }
    const { rerender } = render(
      <DocumentProvider initialDocument={doc}>
        <Bump tick={0} />
      </DocumentProvider>,
    );
    // Three extra renders in the first 90ms; each supplies a new
    // `serialize` identity. A naive impl re-schedules on each; the ref
    // impl ignores identity.
    act(() => {
      vi.advanceTimersByTime(30);
    });
    rerender(
      <DocumentProvider initialDocument={doc}>
        <Bump tick={1} />
      </DocumentProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(30);
    });
    rerender(
      <DocumentProvider initialDocument={doc}>
        <Bump tick={2} />
      </DocumentProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(30);
    });
    rerender(
      <DocumentProvider initialDocument={doc}>
        <Bump tick={3} />
      </DocumentProvider>,
    );
    // Elapsed 90ms since mount. The initial timer is ~10ms away.
    act(() => {
      vi.advanceTimersByTime(20);
    });
    // With the ref impl, the initial save has fired with the LATEST
    // serialize identity seen (tick=3). With the old deps-based impl,
    // the timer would have been reset three times; no save yet.
    const stored = loadDocumentSerialized(doc.meta.id);
    expect(stored).toBe(`serialized-3-${JSON.stringify(doc)}`);
  });

  it('uses a custom serializer when provided', () => {
    const doc = makeSlideDoc({ slideCount: 1 });
    const serialize = vi.fn().mockReturnValue('custom-payload');
    render(
      <DocumentProvider initialDocument={doc}>
        <Harness delayMs={50} serialize={serialize} />
      </DocumentProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(serialize).toHaveBeenCalledTimes(1);
    expect(loadDocumentSerialized(doc.meta.id)).toBe('custom-payload');
  });
});
