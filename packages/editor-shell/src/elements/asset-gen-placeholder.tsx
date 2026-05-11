// packages/editor-shell/src/elements/asset-gen-placeholder.tsx
// T-438 — visual placeholder for in-flight asset-generation elements.
//
// Async asset generation (T-423 `generate_asset` tool with
// `optimistic: true`) emits a MediaElement carrying
// `provenance.kind: 'asset-gen-pending'` BEFORE the adapter resolves.
// This component renders that pending state as a greyed-out box with a
// spinner + adapter modality + provider name + countdown derived from
// `provenance.estimatedCompletionAt`. When the adapter resolves, a
// follow-up swap patch (owned by the `placeholderResolver` seam +
// downstream T-442 transport) replaces the placeholder element with
// the terminal-state MediaElement and this component renders nothing
// (returns null) for that element.
//
// Zero visual polish — the rendering is functional (greyed-out box +
// spinner + label). Host apps supply CSS for chrome. The component
// owns only the structural markup + the countdown computation.

'use client';

import type { Element as DocElement, MediaProvenance } from '@stageflip/schema';
import { useAtomValue } from 'jotai';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { documentAtom } from '../atoms/document';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A pending asset-generation entry exposed by `useAssetGenPlaceholders`.
 * The shape is intentionally narrow — consumers wanting the full element
 * can re-key via `elementByIdAtom(entry.elementId)`.
 */
export interface AssetGenPlaceholderEntry {
  readonly slideId: string;
  readonly elementId: string;
  readonly elementType: 'audio' | 'image' | 'video';
  readonly placeholderId: string;
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly estimatedCompletionAt: string | undefined;
}

export interface AssetGenPlaceholderProps {
  /** The element to inspect; only renders when `provenance.kind` is pending. */
  readonly element: Pick<DocElement, 'type'> & {
    readonly provenance?: MediaProvenance;
  };
  /** Optional CSS class on the outer wrapper. */
  readonly className?: string;
  /** Optional inline style merged onto the wrapper. */
  readonly style?: CSSProperties;
  /**
   * Override the clock used for the countdown. Defaults to `Date.now()`.
   * Tests inject a deterministic clock.
   */
  readonly nowMs?: () => number;
  /** Custom child to override the default spinner glyph. */
  readonly children?: ReactNode;
}

/* -------------------------------------------------------------------------- */
/* <AssetGenPlaceholder>                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Renders the in-flight placeholder visual for an element whose
 * `provenance.kind === 'asset-gen-pending'`. Returns `null` when the
 * provenance slot is absent or the discriminator is a terminal variant
 * (the resolved element renders through its normal renderer path).
 */
export function AssetGenPlaceholder(props: AssetGenPlaceholderProps): ReactNode {
  const { element, className, style, nowMs, children } = props;
  const provenance = element.provenance;
  if (!provenance || provenance.kind !== 'asset-gen-pending') {
    return null;
  }

  const wrapperStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    border: '1px dashed rgba(128, 128, 128, 0.5)',
    borderRadius: 4,
    color: 'rgba(80, 80, 80, 0.9)',
    fontSize: 12,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    gap: 6,
    padding: 8,
    ...style,
  };

  const providerLabel = provenance.provider ?? 'asset generation';
  const elementTypeLabel = element.type;

  return (
    <div
      className={className}
      style={wrapperStyle}
      data-testid="asset-gen-placeholder"
      data-placeholder-id={provenance.placeholderId}
      data-element-type={elementTypeLabel}
    >
      {children ?? (
        <span
          aria-label="Loading"
          role="status"
          data-testid="asset-gen-placeholder-spinner"
          style={{
            width: 18,
            height: 18,
            border: '2px solid rgba(128, 128, 128, 0.4)',
            borderTopColor: 'rgba(80, 80, 80, 0.9)',
            borderRadius: '50%',
            // Spinner motion is CSS-only; the editor host owns the keyframes.
            animation: 'asset-gen-placeholder-spin 1s linear infinite',
          }}
        />
      )}
      <span data-testid="asset-gen-placeholder-label">
        Generating {elementTypeLabel} with {providerLabel}
      </span>
      <Countdown
        estimatedCompletionAt={provenance.estimatedCompletionAt}
        nowMs={nowMs ?? defaultNowMs}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* <Countdown>                                                                 */
/* -------------------------------------------------------------------------- */

interface CountdownProps {
  readonly estimatedCompletionAt: string | undefined;
  readonly nowMs: () => number;
}

function Countdown({ estimatedCompletionAt, nowMs }: CountdownProps): ReactNode {
  // Hooks must run unconditionally — feature-detect inside.
  const targetMs = estimatedCompletionAt ? Date.parse(estimatedCompletionAt) : Number.NaN;
  const [now, setNow] = useState(() => nowMs());

  useEffect(() => {
    if (!Number.isFinite(targetMs)) return;
    const handle = setInterval(() => setNow(nowMs()), 1_000);
    return () => clearInterval(handle);
  }, [targetMs, nowMs]);

  if (!Number.isFinite(targetMs)) {
    return (
      <span data-testid="asset-gen-placeholder-countdown" data-state="indefinite">
        working...
      </span>
    );
  }

  const remainingMs = Math.max(0, targetMs - now);
  const remainingSeconds = Math.ceil(remainingMs / 1_000);
  const state = remainingMs > 0 ? 'pending' : 'overdue';
  return (
    <span data-testid="asset-gen-placeholder-countdown" data-state={state}>
      {state === 'overdue' ? 'finishing up...' : `ready in ~${remainingSeconds}s`}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* useAssetGenPlaceholders — document-wide enumeration                         */
/* -------------------------------------------------------------------------- */

/**
 * Returns every element in the current `documentAtom` whose
 * `provenance.kind === 'asset-gen-pending'`, in document order
 * (slide-index, then element-index). Returns an empty array when no
 * elements are pending (or the document is null / non-slide-mode).
 *
 * Consumers: editor copilot sidebar (count badge), per-modality
 * progress indicators, layout assists that want to defer interactions
 * with pending elements.
 */
export function useAssetGenPlaceholders(): readonly AssetGenPlaceholderEntry[] {
  const doc = useAtomValue(documentAtom);
  if (!doc || doc.content.mode !== 'slide') return EMPTY_ENTRIES;
  const out: AssetGenPlaceholderEntry[] = [];
  for (const slide of doc.content.slides) {
    for (const el of slide.elements) {
      if (el.type !== 'audio' && el.type !== 'image' && el.type !== 'video') continue;
      const provenance = el.provenance;
      if (!provenance || provenance.kind !== 'asset-gen-pending') continue;
      out.push({
        slideId: slide.id,
        elementId: el.id,
        elementType: el.type,
        placeholderId: provenance.placeholderId ?? '',
        provider: provenance.provider,
        model: provenance.model,
        estimatedCompletionAt: provenance.estimatedCompletionAt,
      });
    }
  }
  return out;
}

const EMPTY_ENTRIES: readonly AssetGenPlaceholderEntry[] = [];

function defaultNowMs(): number {
  return Date.now();
}
