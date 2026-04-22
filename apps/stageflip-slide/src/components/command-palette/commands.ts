// apps/stageflip-slide/src/components/command-palette/commands.ts
// Declarative command registry consumed by <CommandPalette> (T-127).

import type { Document, Slide, SlideContent } from '@stageflip/schema';

/**
 * A single palette entry. Kept as plain data so Phase 7 can merge
 * engine/agent-sourced tool definitions into the same list without
 * reshaping the UI. The audit (§1) plans the palette to eventually
 * dispatch through the tool router — today's `run` closures work
 * locally against `useDocument`.
 */
export interface PaletteCommand {
  id: string;
  label: string;
  category: 'slide' | 'selection' | 'edit' | 'view' | 'help';
  /** Optional keyboard-shortcut label for display. The registry doesn't
   * bind the keys — that stays with the shortcut registry (T-121a). */
  shortcut?: string;
  /** Return `false` / `undefined` if the command cannot fire (e.g.
   * trying to delete a non-existent slide). A truthy result is taken
   * as success. */
  run: (ctx: PaletteContext) => boolean | undefined;
}

/**
 * Context object passed to every command. Exposes only the pieces a
 * command needs to mutate state or read the current document; hides
 * the broader `useDocument()` surface.
 */
export interface PaletteContext {
  document: Document | null;
  activeSlideId: string;
  setActiveSlide: (id: string) => void;
  setDocument: (doc: Document) => void;
  updateDocument: (updater: (doc: Document) => Document) => void;
  clearSelection: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const UUID_PREFIX = 'slide-';

function makeSlideId(): string {
  const anyGlobal = globalThis as { crypto?: { randomUUID?: () => string } };
  const uuid = anyGlobal.crypto?.randomUUID?.();
  if (uuid) return `${UUID_PREFIX}${uuid.replace(/-/g, '').slice(0, 12)}`;
  return `${UUID_PREFIX}${Math.random().toString(36).slice(2, 12)}`;
}

function ensureSlideDoc(doc: Document | null): { doc: Document; content: SlideContent } | null {
  if (!doc || doc.content.mode !== 'slide') return null;
  return { doc, content: doc.content };
}

/**
 * Default palette entries. Pure data — swappable by tests and by
 * Phase 7 tool integration.
 */
export function defaultCommands(): PaletteCommand[] {
  return [
    {
      id: 'slide.new',
      label: 'New slide',
      category: 'slide',
      shortcut: 'Mod+M',
      run: (ctx) => {
        const state = ensureSlideDoc(ctx.document);
        if (!state) return false;
        const id = makeSlideId();
        ctx.updateDocument((prev) => {
          if (prev.content.mode !== 'slide') return prev;
          return {
            ...prev,
            content: {
              ...prev.content,
              slides: [...prev.content.slides, { id, elements: [] }],
            },
          };
        });
        ctx.setActiveSlide(id);
        return true;
      },
    },
    {
      id: 'slide.duplicate',
      label: 'Duplicate slide',
      category: 'slide',
      shortcut: 'Mod+Shift+D',
      run: (ctx) => {
        const state = ensureSlideDoc(ctx.document);
        if (!state) return false;
        const source = state.content.slides.find((s) => s.id === ctx.activeSlideId);
        if (!source) return false;
        const newId = makeSlideId();
        ctx.updateDocument((prev) => {
          if (prev.content.mode !== 'slide') return prev;
          const srcIndex = prev.content.slides.findIndex((s) => s.id === ctx.activeSlideId);
          if (srcIndex < 0) return prev;
          const clone: Slide = {
            ...prev.content.slides[srcIndex],
            id: newId,
          } as Slide;
          const slides = [...prev.content.slides];
          slides.splice(srcIndex + 1, 0, clone);
          return { ...prev, content: { ...prev.content, slides } };
        });
        ctx.setActiveSlide(newId);
        return true;
      },
    },
    {
      id: 'slide.delete',
      label: 'Delete active slide',
      category: 'slide',
      run: (ctx) => {
        const state = ensureSlideDoc(ctx.document);
        if (!state) return false;
        const srcIndex = state.content.slides.findIndex((s) => s.id === ctx.activeSlideId);
        if (srcIndex < 0) return false;
        if (state.content.slides.length <= 1) return false; // never orphan
        const nextActive =
          state.content.slides[srcIndex + 1]?.id ?? state.content.slides[srcIndex - 1]?.id ?? '';
        ctx.updateDocument((prev) => {
          if (prev.content.mode !== 'slide') return prev;
          const slides = prev.content.slides.filter((s) => s.id !== ctx.activeSlideId);
          return { ...prev, content: { ...prev.content, slides } };
        });
        ctx.setActiveSlide(nextActive);
        return true;
      },
    },
    {
      id: 'selection.clear',
      label: 'Clear selection',
      category: 'selection',
      shortcut: 'Escape',
      run: (ctx) => {
        ctx.clearSelection();
        return true;
      },
    },
    {
      id: 'help.palette',
      label: 'Show command palette',
      category: 'help',
      shortcut: 'Mod+K',
      run: () => true,
    },
  ];
}

/**
 * Case-insensitive substring filter across `label`, `category`, and
 * `shortcut`. Returns the commands in the original order — no
 * scoring — because the registry is small today and ranking would be
 * premature.
 */
export function filterCommands(
  commands: ReadonlyArray<PaletteCommand>,
  query: string,
): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...commands];
  return commands.filter((c) => {
    const haystack = `${c.label} ${c.category} ${c.shortcut ?? ''}`.toLowerCase();
    return haystack.includes(q);
  });
}
