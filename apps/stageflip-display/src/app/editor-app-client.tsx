// apps/stageflip-display/src/app/editor-app-client.tsx
// Walking-skeleton entrypoint for StageFlip.Display. Mounts
// <EditorShell> with a seeded display document (3 IAB canonical
// sizes; 150 KB budget; 15s duration) and renders the multi-size
// banner grid + a budget header. Component-level styling lives
// inline for now; deeper chrome (timeline, properties panel) lands
// in follow-up PRs.

'use client';

import {
  type BannerSize,
  BannerSizeGrid,
  type BannerSizePlacement,
  EditorShell,
  useDocument,
} from '@stageflip/editor-shell';
import { DISPLAY_CANONICAL_SIZES, DISPLAY_FILE_SIZE_BUDGETS_KB } from '@stageflip/profiles-display';
import type { Document } from '@stageflip/schema';
import type { ReactElement } from 'react';

// Seeded document — a 15s display composition with the three canonical
// IAB sizes from T-200's DISPLAY_CANONICAL_SIZES and the IAB 150 KB
// baseline budget. Exercises every surface the editor-shell renders.
const INITIAL_DOCUMENT = {
  meta: {
    id: 'walking-skeleton-display',
    version: 0,
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
    title: 'Walking skeleton — StageFlip.Display',
    locale: 'en',
    schemaVersion: 1,
  },
  theme: { tokens: {} },
  variables: {},
  components: {},
  content: {
    mode: 'display',
    sizes: DISPLAY_CANONICAL_SIZES.map((s) => ({
      id: `${s.width}x${s.height}`,
      width: s.width,
      height: s.height,
      name: s.name,
    })),
    durationMs: 15_000,
    budget: {
      totalZipKb: DISPLAY_FILE_SIZE_BUDGETS_KB.iabInitialLoadKb,
      externalFontsAllowed: false,
      externalFontsKbCap: 0,
      assetsInlined: true,
    },
    elements: [],
  },
} as unknown as Document;

/**
 * Adapt a schema-level `BannerSize` (where `name` is `string | undefined`
 * per `exactOptionalPropertyTypes`) to the editor-shell `BannerSize` the
 * grid expects (`name` omitted rather than `undefined`).
 */
function toGridSize(size: {
  id: string;
  width: number;
  height: number;
  name?: string | undefined;
}): BannerSize {
  return size.name !== undefined
    ? { id: size.id, width: size.width, height: size.height, name: size.name }
    : { id: size.id, width: size.width, height: size.height };
}

function BannerCellPlaceholder({ placement }: { placement: BannerSizePlacement }): ReactElement {
  const { size, scale } = placement;
  return (
    <div
      data-testid={`app-display-cell-${size.id}`}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: 'var(--sf-banner-chrome)',
        border: '1px solid rgba(90, 248, 251, 0.18)',
        borderRadius: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--sf-muted)',
        }}
      >
        {size.name ?? size.id}
      </span>
      <span
        style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 12,
          color: 'var(--sf-fg)',
          letterSpacing: '-0.02em',
        }}
      >
        {size.width}×{size.height}
      </span>
      <span style={{ fontSize: 10, color: 'var(--sf-muted)' }}>
        scale {(scale * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function ShellBody(): ReactElement {
  const { document } = useDocument();
  if (document === null) {
    return (
      <main data-testid="app-display-root" style={{ padding: 24, color: 'var(--sf-muted)' }}>
        Loading…
      </main>
    );
  }
  const content = document.content;
  const isDisplay = content.mode === 'display';
  return (
    <main
      data-testid="app-display-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        padding: 24,
        gap: 16,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          {document.meta.title ?? 'StageFlip.Display'}
        </h1>
        <span
          data-testid="app-display-mode-badge"
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: 'var(--sf-surface)',
            color: 'var(--sf-accent)',
            fontSize: 12,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          mode: {content.mode}
        </span>
      </header>
      {isDisplay ? (
        <>
          <section
            data-testid="app-display-budget"
            style={{ fontSize: 14, color: 'var(--sf-muted)' }}
          >
            {content.sizes.length} size{content.sizes.length === 1 ? '' : 's'} ·{' '}
            {(content.durationMs / 1000).toFixed(1)}s · budget{' '}
            <span data-testid="app-display-budget-cap">{content.budget.totalZipKb} KB</span> ·
            assets {content.budget.assetsInlined ? 'inlined' : 'external'}
          </section>
          <section
            data-testid="app-display-grid-wrap"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              overflow: 'auto',
              padding: '8px 0',
            }}
          >
            <BannerSizeGrid
              sizes={content.sizes.map(toGridSize)}
              container={{ width: 1200, height: 640 }}
              renderPreview={(placement) => <BannerCellPlaceholder placement={placement} />}
            />
          </section>
        </>
      ) : (
        <div data-testid="app-display-unhydrated" style={{ color: 'var(--sf-muted)' }}>
          Document is not in display mode.
        </div>
      )}
    </main>
  );
}

export function EditorAppClient(): ReactElement {
  return (
    <EditorShell initialDocument={INITIAL_DOCUMENT}>
      <ShellBody />
    </EditorShell>
  );
}
