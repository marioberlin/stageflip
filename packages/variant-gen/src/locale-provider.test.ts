// packages/variant-gen/src/locale-provider.test.ts
// Locale provider tests (T-386 AC #15-17).

import { describe, expect, it } from 'vitest';
import {
  InMemoryLocaleProvider,
  type LocaleBundle,
  StaticBundleLocaleProvider,
} from './locale-provider.js';

describe('InMemoryLocaleProvider', () => {
  it('returns the catalogue value when present', () => {
    const provider = new InMemoryLocaleProvider({
      catalogue: {
        'de-DE': { headline: 'Hallo' },
      },
    });
    expect(provider.translate({ tag: 'de-DE', key: 'headline', source: 'Hello' })).toBe('Hallo');
  });

  it('returns the source text when the key is missing (AC #16)', () => {
    const provider = new InMemoryLocaleProvider({
      catalogue: { 'de-DE': {} },
    });
    expect(provider.translate({ tag: 'de-DE', key: 'cta', source: 'Click me' })).toBe('Click me');
  });

  it('returns the source text when the locale is missing entirely', () => {
    const provider = new InMemoryLocaleProvider({ catalogue: {} });
    expect(provider.translate({ tag: 'fr-FR', key: 'k', source: 'fallback' })).toBe('fallback');
  });
});

describe('StaticBundleLocaleProvider', () => {
  it('reads a JSON bundle of the shape `{ tag: { key: translated } }` (AC #17)', () => {
    const bundle: LocaleBundle = {
      'de-DE': { headline: 'Hallo' },
      'fr-FR': { headline: 'Bonjour', cta: 'Cliquez' },
    };
    const provider = new StaticBundleLocaleProvider({ bundle });
    expect(provider.translate({ tag: 'de-DE', key: 'headline', source: 'Hello' })).toBe('Hallo');
    expect(provider.translate({ tag: 'fr-FR', key: 'cta', source: 'Click' })).toBe('Cliquez');
  });

  it('falls back to source on miss', () => {
    const provider = new StaticBundleLocaleProvider({ bundle: { 'de-DE': {} } });
    expect(provider.translate({ tag: 'de-DE', key: 'unknown', source: 'src' })).toBe('src');
  });
});
