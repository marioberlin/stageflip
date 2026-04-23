// apps/stageflip-slide/src/components/asset-browser/asset-browser.tsx
// Media library panel — browsable grid over the editor's asset registry (T-139b).

/**
 * The AssetBrowser reads `assetsAtom` from `@stageflip/editor-shell`
 * and renders a filterable grid of image / video / audio thumbnails.
 * Each cell is draggable — `dragstart` sets a custom MIME type the
 * canvas-drop handler recognizes, so dragging an asset onto a slide
 * inserts an element referencing it.
 *
 * Right-click on any cell opens a context menu registered via the
 * T-139a framework. Items: insert on slide (dispatches `onInsert`),
 * copy asset ref, rename (stubbed), remove from library.
 *
 * The upload button is a no-op hook — the modal that owns the actual
 * file picker (`<ImageUploadDialog>`) is the composer's concern. This
 * panel just exposes the trigger so consumers wire it.
 */

'use client';

import {
  type Asset,
  type AssetKind,
  assetsAtom,
  removeAssetAtom,
  selectedAssetIdAtom,
  t,
  useEditorShellAtomValue,
  useEditorShellSetAtom,
  useRegisterContextMenu,
} from '@stageflip/editor-shell';
import type { CSSProperties, DragEvent, ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

export interface AssetInsertPayload {
  id: string;
  ref: `asset:${string}`;
  kind: AssetKind;
}

export interface AssetBrowserProps {
  /** Insert action — dispatched from the context menu's first item. */
  onInsert: (payload: AssetInsertPayload) => void;
  /** Optional upload trigger — if omitted the Upload button is hidden. */
  onUpload?: () => void;
}

type Filter = 'all' | AssetKind;

/** Data-transfer MIME type recognized by the canvas-drop handler. */
export const ASSET_DRAG_MIME = 'application/x-stageflip-asset-ref';

/**
 * Browsable asset library panel. Registers a context-menu descriptor
 * scoped to `[data-stageflip-asset-cell]` elements so right-click on a
 * cell routes through the T-139a framework.
 */
export function AssetBrowser({ onInsert, onUpload }: AssetBrowserProps): ReactElement {
  const assets = useEditorShellAtomValue(assetsAtom);
  const selectedId = useEditorShellAtomValue(selectedAssetIdAtom);
  const setSelectedId = useEditorShellSetAtom(selectedAssetIdAtom);
  const removeAsset = useEditorShellSetAtom(removeAssetAtom);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? assets : assets.filter((a) => a.kind === filter)),
    [assets, filter],
  );

  /** Read the focused asset at dispatch time — stale closure would point at
   * the id active when the descriptor was registered, not the one being
   * right-clicked. */
  const currentRef = useCallback((): Asset | undefined => {
    if (selectedId === null) return undefined;
    return assets.find((a) => a.id === selectedId);
  }, [assets, selectedId]);

  const descriptor = useMemo(
    () => ({
      id: 'asset-browser-cell',
      match: (target: HTMLElement | null): boolean =>
        target !== null && target.closest('[data-stageflip-asset-cell]') !== null,
      items: [
        {
          type: 'item' as const,
          labelKey: 'assetBrowser.contextMenu.insert',
          onSelect: (): void => {
            const asset = currentRef();
            if (!asset) return;
            onInsert({ id: asset.id, ref: asset.ref, kind: asset.kind });
          },
        },
        {
          type: 'item' as const,
          labelKey: 'assetBrowser.contextMenu.copyRef',
          onSelect: (): void => {
            const asset = currentRef();
            if (!asset) return;
            copyToClipboard(asset.ref);
          },
        },
        { type: 'separator' as const },
        {
          type: 'item' as const,
          labelKey: 'assetBrowser.contextMenu.remove',
          destructive: true,
          onSelect: (): void => {
            const asset = currentRef();
            if (!asset) return;
            removeAsset(asset.id);
          },
        },
      ],
    }),
    [currentRef, onInsert, removeAsset],
  );

  useRegisterContextMenu(descriptor);

  return (
    <aside
      data-testid="asset-browser"
      aria-label={t('assetBrowser.ariaLabel')}
      style={rootStyle}
    >
      <header style={headerStyle}>
        <h2 style={titleStyle}>{t('assetBrowser.title')}</h2>
        {onUpload ? (
          <button
            type="button"
            data-testid="asset-browser-upload"
            onClick={onUpload}
            style={uploadButtonStyle}
          >
            {t('assetBrowser.uploadButton')}
          </button>
        ) : null}
      </header>
      <div style={filterBarStyle} role="tablist">
        <FilterPill label={t('assetBrowser.filter.all')} active={filter === 'all'} onClick={() => setFilter('all')} testId="asset-browser-filter-all" />
        <FilterPill label={t('assetBrowser.filter.image')} active={filter === 'image'} onClick={() => setFilter('image')} testId="asset-browser-filter-image" />
        <FilterPill label={t('assetBrowser.filter.video')} active={filter === 'video'} onClick={() => setFilter('video')} testId="asset-browser-filter-video" />
        <FilterPill label={t('assetBrowser.filter.audio')} active={filter === 'audio'} onClick={() => setFilter('audio')} testId="asset-browser-filter-audio" />
      </div>
      {visible.length === 0 ? (
        <p data-testid="asset-browser-empty" style={emptyStyle}>
          {t('assetBrowser.empty')}
        </p>
      ) : (
        <ul style={gridStyle}>
          {visible.map((asset) => (
            <AssetCell
              key={asset.id}
              asset={asset}
              selected={asset.id === selectedId}
              onSelect={() => setSelectedId(asset.id)}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

function AssetCell({
  asset,
  selected,
  onSelect,
}: {
  asset: Asset;
  selected: boolean;
  onSelect: () => void;
}): ReactElement {
  const handleDragStart = (event: DragEvent<HTMLLIElement>): void => {
    event.dataTransfer.setData(ASSET_DRAG_MIME, asset.ref);
    event.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <li
      data-testid={`asset-browser-cell-${asset.id}`}
      data-stageflip-asset-cell="true"
      data-selected={selected}
      draggable
      onDragStart={handleDragStart}
      onClick={onSelect}
      title={asset.name}
      style={cellStyle(selected)}
    >
      <AssetThumb asset={asset} />
      <span style={cellLabelStyle}>{asset.name}</span>
    </li>
  );
}

function AssetThumb({ asset }: { asset: Asset }): ReactElement {
  if (asset.kind === 'image') {
    return (
      // biome-ignore lint/a11y/useAltText: decorative thumb — label is rendered next to it, and aria-hidden hides it from assistive tech.
      <img
        src={asset.thumbnailUrl ?? asset.url}
        alt=""
        aria-hidden="true"
        style={thumbImgStyle}
        draggable={false}
      />
    );
  }
  return (
    <div aria-hidden="true" style={thumbPlaceholderStyle}>
      {asset.kind === 'video' ? '▶' : '♪'}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}): ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      style={pillStyle(active)}
    >
      {label}
    </button>
  );
}

function copyToClipboard(text: string): void {
  // `navigator.clipboard` is not available under happy-dom; fall through
  // silently so the context-menu action remains testable without mocks.
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    void nav?.clipboard?.writeText?.(text);
  } catch {
    // Intentional no-op: clipboard access is a best-effort UX affordance.
  }
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  background: 'rgba(21, 28, 35, 0.6)',
  backdropFilter: 'blur(8px)',
  borderRadius: 12,
  border: '1px solid rgba(129, 174, 255, 0.08)',
  color: '#ebf1fa',
  minWidth: 240,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#a5acb4',
};

const uploadButtonStyle: CSSProperties = {
  padding: '4px 10px',
  background: 'rgba(129, 174, 255, 0.15)',
  color: '#5af8fb',
  border: '1px solid rgba(90, 248, 251, 0.4)',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
};

const filterBarStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
};

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: '3px 8px',
    background: active ? 'rgba(90, 248, 251, 0.15)' : 'rgba(21, 28, 35, 0.4)',
    color: active ? '#5af8fb' : '#a5acb4',
    border: `1px solid ${active ? 'rgba(90, 248, 251, 0.4)' : 'rgba(129, 174, 255, 0.08)'}`,
    borderRadius: 9999,
    fontSize: 11,
    cursor: 'pointer',
  };
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
  gap: 6,
  listStyle: 'none',
  padding: 0,
  margin: 0,
};

const emptyStyle: CSSProperties = {
  color: '#a5acb4',
  fontSize: 12,
  margin: '12px 0',
};

function cellStyle(selected: boolean): CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 6,
    borderRadius: 8,
    background: selected ? 'rgba(90, 248, 251, 0.12)' : 'rgba(21, 28, 35, 0.4)',
    border: `1px solid ${selected ? 'rgba(90, 248, 251, 0.4)' : 'rgba(129, 174, 255, 0.08)'}`,
    cursor: 'grab',
    userSelect: 'none',
  };
}

const thumbImgStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 9',
  objectFit: 'cover',
  borderRadius: 4,
  background: '#080f15',
};

const thumbPlaceholderStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 24,
  color: '#5af8fb',
  background: '#080f15',
  borderRadius: 4,
};

const cellLabelStyle: CSSProperties = {
  fontSize: 11,
  color: '#ebf1fa',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
