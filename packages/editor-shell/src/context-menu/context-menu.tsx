// packages/editor-shell/src/context-menu/context-menu.tsx
// Renders the currently-open context menu at the cursor.

/**
 * A single `<ContextMenu />` mounts once (typically inside the EditorShell
 * composition) and renders the open menu. Closed state renders nothing.
 *
 * Keyboard model:
 *   - ArrowDown / ArrowUp cycle the focus across items (skipping
 *     separators + disabled rows).
 *   - Enter activates the focused item.
 *   - ArrowRight opens a focused submenu; ArrowLeft closes the active
 *     submenu (or the menu itself if at the top level).
 *   - Escape closes the menu (also wired by the provider's global
 *     Escape handler).
 *
 * Submenu model: hover or Enter on a submenu item opens it at the
 * adjacent edge. Only one submenu chain is open at a time.
 *
 * Positioning: the menu is absolutely positioned at `openState.{x,y}`,
 * then clamped to the viewport via `clampToViewport` in a
 * `useLayoutEffect` — a second-paint nudge that flips the origin when
 * the menu would overflow the right or bottom edge (native-menu
 * convention). The clamp is a no-op when the cursor sits far from the
 * viewport edges (T-139b).
 */

'use client';

import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/catalog';
import { formatCombo } from '../shortcuts/match-key-combo';
import { useContextMenu } from './context-menu-provider';
import type { ContextMenuItem, ContextMenuItemSpec, ContextMenuSubmenu } from './types';

/** Padding kept between the menu edge and the viewport edge when clamping. */
const VIEWPORT_CLAMP_MARGIN = 4;

/**
 * Clamp a proposed `{x, y}` origin so the rendered menu stays fully on
 * screen. When the menu would overflow the right or bottom edge, flip
 * the origin so the menu opens up-left of the cursor (native-menu
 * convention). Zero-sized `width`/`height` fall through — the caller
 * renders off-screen on the first paint and the layout-effect re-clamp
 * corrects on the second. (T-139b addition — extends T-139a's naive
 * positioner with a `getBoundingClientRect`-based nudge.)
 */
export function clampToViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  let clampedX = x;
  let clampedY = y;
  if (width > 0 && x + width + VIEWPORT_CLAMP_MARGIN > viewportWidth) {
    clampedX = Math.max(VIEWPORT_CLAMP_MARGIN, viewportWidth - width - VIEWPORT_CLAMP_MARGIN);
  }
  if (height > 0 && y + height + VIEWPORT_CLAMP_MARGIN > viewportHeight) {
    clampedY = Math.max(VIEWPORT_CLAMP_MARGIN, viewportHeight - height - VIEWPORT_CLAMP_MARGIN);
  }
  return { x: clampedX, y: clampedY };
}

export function ContextMenu(): ReactElement | null {
  const { openState, close } = useContextMenu();
  if (!openState) return null;
  return (
    <Menu
      items={openState.descriptor.items}
      x={openState.x}
      y={openState.y}
      onClose={close}
      testIdSuffix={openState.descriptor.id}
    />
  );
}

interface MenuProps {
  items: ReadonlyArray<ContextMenuItemSpec>;
  x: number;
  y: number;
  onClose: () => void;
  /** Suffix appended to data-testid on the outer container. */
  testIdSuffix: string;
  /** Nested submenus mount as siblings of the trigger row. */
  submenu?: boolean;
}

function Menu({ items, x, y, onClose, testIdSuffix, submenu = false }: MenuProps): ReactElement {
  const activatable = useMemo(() => {
    const indices: number[] = [];
    items.forEach((item, i) => {
      if (item.type === 'separator') return;
      if ((item.type === 'item' || item.type === 'submenu') && item.disabled) return;
      indices.push(i);
    });
    return indices;
  }, [items]);

  const [focusedIndex, setFocusedIndex] = useState<number>(activatable[0] ?? -1);
  const [openSubIndex, setOpenSubIndex] = useState<number | null>(null);
  const [clampedOrigin, setClampedOrigin] = useState<{ x: number; y: number }>({ x, y });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Focus the container so keydown routes through it. happy-dom supports
    // this; real browsers honor it via the `tabIndex={-1}` on the div.
    containerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    // Measure post-layout + clamp to the viewport so a near-edge cursor
    // doesn't produce a half-off-screen menu. Runs every time the
    // requested origin changes; typical case is once per open.
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : rect.right;
    const vh = typeof window !== 'undefined' ? window.innerHeight : rect.bottom;
    const next = clampToViewport(x, y, rect.width, rect.height, vw, vh);
    if (next.x !== clampedOrigin.x || next.y !== clampedOrigin.y) {
      setClampedOrigin(next);
    }
  }, [x, y, clampedOrigin.x, clampedOrigin.y]);

  useEffect(() => {
    // If items change and the focused index no longer resolves to an
    // activatable row, snap focus to the first one. Keeps keyboard nav
    // valid across item-list replacements.
    if (!activatable.includes(focusedIndex)) {
      setFocusedIndex(activatable[0] ?? -1);
    }
  }, [activatable, focusedIndex]);

  const handleKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const idx = activatable.indexOf(focusedIndex);
      const next = activatable[(idx + 1) % activatable.length];
      setFocusedIndex(next ?? focusedIndex);
      setOpenSubIndex(null);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const idx = activatable.indexOf(focusedIndex);
      const nextIdx = idx <= 0 ? activatable.length - 1 : idx - 1;
      const next = activatable[nextIdx];
      setFocusedIndex(next ?? focusedIndex);
      setOpenSubIndex(null);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = items[focusedIndex];
      if (!item) return;
      if (item.type === 'item') {
        item.onSelect();
        onClose();
      } else if (item.type === 'submenu') {
        setOpenSubIndex(focusedIndex);
      }
      return;
    }
    if (event.key === 'ArrowRight') {
      const item = items[focusedIndex];
      if (item?.type === 'submenu') {
        event.preventDefault();
        setOpenSubIndex(focusedIndex);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      if (submenu) {
        event.preventDefault();
        onClose();
      }
      return;
    }
  };

  const style: CSSProperties = {
    position: 'fixed',
    top: clampedOrigin.y,
    left: clampedOrigin.x,
    minWidth: 200,
    padding: '6px 0',
    background: 'rgba(21, 28, 35, 0.92)',
    backdropFilter: 'blur(24px)',
    borderRadius: 8,
    boxShadow: '0 8px 48px rgba(0, 114, 229, 0.12)',
    color: '#ebf1fa',
    fontSize: 13,
    zIndex: 1000,
    outline: 'none',
  };

  return (
    <div
      ref={containerRef}
      data-stageflip-context-menu="true"
      data-testid={`context-menu-${testIdSuffix}`}
      role="menu"
      tabIndex={-1}
      onKeyDown={handleKey}
      style={style}
    >
      {items.map((item, i) => (
        <ItemRow
          key={itemKey(item, i)}
          item={item}
          index={i}
          focused={focusedIndex === i}
          openSub={openSubIndex === i}
          onFocus={() => setFocusedIndex(i)}
          onOpenSub={() => setOpenSubIndex(i)}
          onCloseSub={() => setOpenSubIndex(null)}
          onClose={onClose}
          testIdSuffix={testIdSuffix}
        />
      ))}
    </div>
  );
}

interface ItemRowProps {
  item: ContextMenuItemSpec;
  index: number;
  focused: boolean;
  openSub: boolean;
  onFocus: () => void;
  onOpenSub: () => void;
  onCloseSub: () => void;
  onClose: () => void;
  testIdSuffix: string;
}

function ItemRow({
  item,
  index,
  focused,
  openSub,
  onFocus,
  onOpenSub,
  onCloseSub,
  onClose,
  testIdSuffix,
}: ItemRowProps): ReactElement {
  if (item.type === 'separator') {
    return (
      <div
        data-testid={`context-menu-separator-${testIdSuffix}-${index}`}
        aria-hidden="true"
        style={separatorStyle}
      />
    );
  }
  if (item.type === 'submenu') {
    return (
      <SubmenuRow
        item={item}
        index={index}
        focused={focused}
        openSub={openSub}
        onFocus={onFocus}
        onOpenSub={onOpenSub}
        onCloseSub={onCloseSub}
        onClose={onClose}
        testIdSuffix={testIdSuffix}
      />
    );
  }
  return (
    <ActivatableRow
      item={item}
      index={index}
      focused={focused}
      onFocus={onFocus}
      onClose={onClose}
      testIdSuffix={testIdSuffix}
    />
  );
}

function ActivatableRow({
  item,
  index,
  focused,
  onFocus,
  onClose,
  testIdSuffix,
}: {
  item: ContextMenuItem;
  index: number;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
  testIdSuffix: string;
}): ReactElement {
  const disabled = item.disabled === true;
  const handleClick = (): void => {
    if (disabled) return;
    item.onSelect();
    onClose();
  };
  return (
    <div
      data-testid={`context-menu-item-${testIdSuffix}-${index}`}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled}
      data-focused={focused}
      data-destructive={item.destructive === true}
      onMouseEnter={onFocus}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      style={itemStyle(focused, disabled, item.destructive === true)}
    >
      <span style={labelStyle}>{t(item.labelKey)}</span>
      {item.keybind ? <span style={keybindStyle}>{formatCombo(item.keybind)}</span> : null}
    </div>
  );
}

function SubmenuRow({
  item,
  index,
  focused,
  openSub,
  onFocus,
  onOpenSub,
  onCloseSub,
  onClose,
  testIdSuffix,
}: {
  item: ContextMenuSubmenu;
  index: number;
  focused: boolean;
  openSub: boolean;
  onFocus: () => void;
  onOpenSub: () => void;
  onCloseSub: () => void;
  onClose: () => void;
  testIdSuffix: string;
}): ReactElement {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const disabled = item.disabled === true;
  const rect = rowRef.current?.getBoundingClientRect();
  const subX = rect ? rect.right : 0;
  const subY = rect ? rect.top : 0;
  return (
    <div
      ref={rowRef}
      data-testid={`context-menu-submenu-${testIdSuffix}-${index}`}
      role="menuitem"
      tabIndex={-1}
      aria-haspopup="menu"
      aria-expanded={openSub}
      aria-disabled={disabled}
      data-focused={focused}
      onMouseEnter={() => {
        onFocus();
        if (!disabled) onOpenSub();
      }}
      onMouseLeave={onCloseSub}
      style={itemStyle(focused || openSub, disabled, false)}
    >
      <span style={labelStyle}>{t(item.labelKey)}</span>
      <span style={keybindStyle}>▸</span>
      {openSub && !disabled ? (
        <Menu
          items={item.items}
          x={subX}
          y={subY}
          onClose={onClose}
          testIdSuffix={`${testIdSuffix}-sub-${index}`}
          submenu
        />
      ) : null}
    </div>
  );
}

/**
 * Compose a stable React key for an item. Separators and items may share a
 * labelKey so the index is folded in as a tiebreaker — but unlike a bare
 * `key={i}`, this value includes the item's own shape, so a reorder
 * actually re-keys instead of silently swapping state.
 */
function itemKey(item: ContextMenuItemSpec, index: number): string {
  if (item.type === 'separator') return `sep-${index}`;
  return `${item.type}-${item.labelKey}-${index}`;
}

function itemStyle(focused: boolean, disabled: boolean, destructive: boolean): CSSProperties {
  const color = disabled ? '#5a6068' : destructive ? '#ff8a8a' : '#ebf1fa';
  const background = focused
    ? destructive
      ? 'rgba(255, 138, 138, 0.15)'
      : 'rgba(90, 248, 251, 0.12)'
    : 'transparent';
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color,
    background,
    position: 'relative',
    userSelect: 'none',
  };
}

const labelStyle: CSSProperties = {
  flex: 1,
  whiteSpace: 'nowrap',
};

const keybindStyle: CSSProperties = {
  marginLeft: 'auto',
  fontSize: 11,
  color: '#a5acb4',
  fontFamily: 'monospace',
};

const separatorStyle: CSSProperties = {
  margin: '4px 8px',
  height: 1,
  background: 'rgba(165, 172, 180, 0.15)',
};
