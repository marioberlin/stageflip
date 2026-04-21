// packages/fonts/src/use-font-load.ts
// Editor / preview hook: block the canvas render on font readiness. Returns
// a status object consumers can gate their tree on so no frame draws with
// fallback glyphs. The CDP export path (Phase 4, T-084a) handles its own
// pre-embedding via `@fontsource` base64 and verifies with
// `document.fonts.check`; this hook is the live-preview half.

import { type RefObject, useEffect, useRef, useState } from 'react';

import type { FontRequirement } from '@stageflip/runtimes-contract';

import { formatFontShorthand } from './aggregate.js';

export type FontLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface FontLoadResult {
  status: FontLoadStatus;
  error: Error | null;
  /** Requirements whose `document.fonts.check` returned true at last evaluation. */
  loaded: readonly FontRequirement[];
}

export interface UseFontLoadOptions {
  /** Override `document.fonts` — for tests + alternative global contexts. */
  fontFaceSet?: FontFaceSet;
  /** Ignore partial availability and wait for all fonts; default true. */
  strict?: boolean;
}

const INITIAL_RESULT: FontLoadResult = {
  status: 'idle',
  error: null,
  loaded: [],
};

function getFontFaceSet(override: FontFaceSet | undefined): FontFaceSet | null {
  if (override !== undefined) return override;
  if (typeof document !== 'undefined' && 'fonts' in document) {
    return (document as Document & { fonts: FontFaceSet }).fonts;
  }
  return null;
}

/**
 * Block a React tree on font readiness. Returns a status object:
 *
 * - `idle` — no requirements supplied or no document.fonts available.
 * - `loading` — load in flight.
 * - `ready` — every requirement is resident (verified via
 *   `document.fonts.check`).
 * - `error` — at least one `.load()` rejected.
 *
 * Consumers typically render a blank / skeleton frame while `status !== 'ready'`
 * and swap to the real composition once ready.
 */
export function useFontLoad(
  requirements: readonly FontRequirement[],
  options: UseFontLoadOptions = {},
): FontLoadResult {
  const [result, setResult] = useState<FontLoadResult>(INITIAL_RESULT);
  const aliveRef = useRef(true) as RefObject<boolean>;

  // Destructure options to primitive dependencies AND structurally key the
  // requirements array — callers routinely pass `useFontLoad([{family:...}])`
  // inline, which produces a fresh array identity every render. Without this
  // the effect would refire on every state update and spin forever.
  const fontFaceSet = options.fontFaceSet;
  const strict = options.strict ?? true;
  const requirementsKey = JSON.stringify(requirements);

  // biome-ignore lint/correctness/useExhaustiveDependencies: aliveRef is a stable ref; empty deps is intentional
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: requirementsKey is the structural dep for the requirements array; aliveRef is a stable ref
  useEffect(() => {
    if (requirements.length === 0) {
      setResult({ status: 'ready', error: null, loaded: [] });
      return;
    }
    const set = getFontFaceSet(fontFaceSet);
    if (set === null) {
      // No font-face API available (SSR, non-browser runtime). Report idle
      // and let the caller render text with the system fallback.
      setResult({ status: 'idle', error: null, loaded: [] });
      return;
    }

    setResult({ status: 'loading', error: null, loaded: [] });

    const shorthand = requirements.map((r) => formatFontShorthand(r));

    Promise.all(
      shorthand.map(async (s) => {
        if (set.check(s)) return;
        await set.load(s);
      }),
    )
      .then(() => {
        if (!aliveRef.current) return;
        const loaded = requirements.filter((_, i) => set.check(shorthand[i] as string));
        if (strict && loaded.length !== requirements.length) {
          setResult({
            status: 'error',
            error: new Error(
              `useFontLoad: ${requirements.length - loaded.length} / ${requirements.length} font requirements failed to load`,
            ),
            loaded,
          });
          return;
        }
        setResult({ status: 'ready', error: null, loaded });
      })
      .catch((err: unknown) => {
        if (!aliveRef.current) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setResult({ status: 'error', error: e, loaded: [] });
      });
  }, [requirementsKey, fontFaceSet, strict]);

  return result;
}
