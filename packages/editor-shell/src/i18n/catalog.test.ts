// packages/editor-shell/src/i18n/catalog.test.ts
// Catalog resolver, locale switching, pseudo mode, and seed integrity.

import { afterEach, describe, expect, it } from 'vitest';
import { __enCatalogEntriesForTest, getLocale, setLocale, t } from './catalog';

afterEach(() => {
  setLocale('en');
});

describe('t() in en locale', () => {
  it('resolves a known key to its translated string', () => {
    expect(t('nav.undo')).toBe('Undo');
    expect(t('common.cancel')).toBe('Cancel');
    expect(t('shortcut.cheatSheet.title')).toBe('Keyboard Shortcuts');
  });

  it('falls back to the explicit fallback for an unknown key', () => {
    expect(t('does.not.exist', 'Fallback')).toBe('Fallback');
  });

  it('falls back to the key itself when no fallback is supplied', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});

describe('t() in pseudo locale', () => {
  it('renders every key as ⟦key⟧ regardless of catalog membership', () => {
    setLocale('pseudo');
    expect(t('nav.undo')).toBe('⟦nav.undo⟧');
    expect(t('missing.key')).toBe('⟦missing.key⟧');
  });

  it('pseudo mode ignores the fallback (it is a QA-visibility mode)', () => {
    setLocale('pseudo');
    expect(t('missing.key', 'ignored')).toBe('⟦missing.key⟧');
  });
});

describe('setLocale / getLocale', () => {
  it('round-trips the active locale', () => {
    setLocale('pseudo');
    expect(getLocale()).toBe('pseudo');
    setLocale('en');
    expect(getLocale()).toBe('en');
  });
});

describe('seed integrity', () => {
  it('exposes at least 80 entries seeded from the SlideMotion editor audit', () => {
    expect(__enCatalogEntriesForTest().length).toBeGreaterThanOrEqual(80);
  });

  it('every seeded value is a non-empty string', () => {
    for (const [, value] of __enCatalogEntriesForTest()) {
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('does not carry any SlideMotion-branded strings (T-134 branding pass target)', () => {
    for (const [, value] of __enCatalogEntriesForTest()) {
      expect(value).not.toMatch(/slidemotion/i);
      expect(value).not.toMatch(/remotion/i);
    }
  });
});
