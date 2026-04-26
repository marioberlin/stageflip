// apps/stageflip-slide/src/components/command-palette/commands.test.ts
// Command registry + filter behavior for <CommandPalette>.

import type { Document } from '@stageflip/schema';
import { describe, expect, it, vi } from 'vitest';
import { type PaletteContext, defaultCommands, filterCommands } from './commands';

function doc(slideIds: string[]): Document {
  return {
    meta: {
      id: 'd',
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: { mode: 'slide', slides: slideIds.map((id) => ({ id, elements: [] })) },
  } as Document;
}

function ctx(overrides: Partial<PaletteContext> = {}): PaletteContext {
  return {
    document: doc(['a']),
    activeSlideId: 'a',
    setActiveSlide: vi.fn(),
    setDocument: vi.fn(),
    updateDocument: vi.fn(),
    clearSelection: vi.fn(),
    canUndo: false,
    canRedo: false,
    ...overrides,
  };
}

describe('defaultCommands', () => {
  it('ships a stable set of ids in the expected categories', () => {
    const ids = defaultCommands().map((c) => c.id);
    expect(ids).toContain('slide.new');
    expect(ids).toContain('slide.duplicate');
    expect(ids).toContain('slide.delete');
    expect(ids).toContain('selection.clear');
    expect(ids).toContain('help.palette');
  });

  it('slide.new appends a slide and activates the new id', () => {
    const call = ctx();
    const cmd = defaultCommands().find((c) => c.id === 'slide.new');
    expect(cmd?.run(call)).toBe(true);
    expect(call.updateDocument).toHaveBeenCalledTimes(1);
    expect(call.setActiveSlide).toHaveBeenCalledTimes(1);
  });

  it('slide.duplicate requires a resolvable active slide', () => {
    const call = ctx({
      document: doc(['a']),
      activeSlideId: 'does-not-exist',
    });
    const cmd = defaultCommands().find((c) => c.id === 'slide.duplicate');
    expect(cmd?.run(call)).toBe(false);
    expect(call.updateDocument).not.toHaveBeenCalled();
  });

  it('slide.delete refuses to orphan the deck (only one slide)', () => {
    const call = ctx({ document: doc(['only']), activeSlideId: 'only' });
    const cmd = defaultCommands().find((c) => c.id === 'slide.delete');
    expect(cmd?.run(call)).toBe(false);
    expect(call.updateDocument).not.toHaveBeenCalled();
  });

  it('slide.delete fires updateDocument + picks an adjacent slide as new active', () => {
    const call = ctx({
      document: doc(['a', 'b', 'c']),
      activeSlideId: 'b',
    });
    const cmd = defaultCommands().find((c) => c.id === 'slide.delete');
    expect(cmd?.run(call)).toBe(true);
    expect(call.updateDocument).toHaveBeenCalledTimes(1);
    // Prefers the next slide; in our fixture the active becomes 'c'.
    expect(call.setActiveSlide).toHaveBeenLastCalledWith('c');
  });

  it('selection.clear calls clearSelection', () => {
    const call = ctx();
    const cmd = defaultCommands().find((c) => c.id === 'selection.clear');
    expect(cmd?.run(call)).toBe(true);
    expect(call.clearSelection).toHaveBeenCalledTimes(1);
  });
});

describe('filterCommands', () => {
  const all = defaultCommands();

  it('empty query returns the registry in original order', () => {
    expect(filterCommands(all, '')).toEqual(all);
  });

  it('whitespace-only query is treated as empty', () => {
    expect(filterCommands(all, '   ')).toEqual(all);
  });

  it('matches substrings in label, category, or shortcut', () => {
    const hits = filterCommands(all, 'slide');
    expect(hits.every((c) => c.category === 'slide' || /slide/i.test(c.label))).toBe(true);
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });

  it('case-insensitive', () => {
    expect(filterCommands(all, 'NEW')).toEqual(filterCommands(all, 'new'));
  });

  it('unknown query returns empty', () => {
    expect(filterCommands(all, 'xxxnonsensexxx')).toEqual([]);
  });
});
