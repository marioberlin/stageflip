// packages/variant-gen/src/locale-provider.ts
// Locale-provider seam (T-386 D-T386-3). Two implementations ship:
//   - InMemoryLocaleProvider (test-friendly; takes a pre-built catalogue)
//   - StaticBundleLocaleProvider (reads a serialised catalogue bundle)
// Network-fetching providers (Google Translate / DeepL) are deferred to
// T-415 (Phase 14 ADR-006 provider-seam pattern).

/**
 * Translation backend interface. `translate()` is synchronous because
 * `generateVariants` is synchronous + bounded; async network providers
 * (T-415) wrap async fetches in a sync interface via pre-warmed caches.
 */
export interface LocaleProvider {
  /** Translate a key+source-text into the requested tag. Returns the original on miss. */
  translate(args: { tag: string; key: string; source: string }): string;
}

/** Catalogue shape — `tag → { key → translation }`. */
export type LocaleBundle = Readonly<Record<string, Readonly<Record<string, string>>>>;

/**
 * In-memory provider for tests + small bundles. The `catalogue` is the
 * full lookup table; missing tags / keys fall through to source text.
 */
export class InMemoryLocaleProvider implements LocaleProvider {
  private readonly catalogue: LocaleBundle;

  constructor(args: { catalogue: LocaleBundle }) {
    this.catalogue = args.catalogue;
  }

  translate(args: { tag: string; key: string; source: string }): string {
    return this.catalogue[args.tag]?.[args.key] ?? args.source;
  }
}

/**
 * Static-bundle provider — reads the same `LocaleBundle` shape an app's
 * `i18n/catalog.ts` produces. Browser-safe: no I/O, no Node imports. The
 * caller passes the already-loaded JSON.
 */
export class StaticBundleLocaleProvider implements LocaleProvider {
  private readonly bundle: LocaleBundle;

  constructor(args: { bundle: LocaleBundle }) {
    this.bundle = args.bundle;
  }

  translate(args: { tag: string; key: string; source: string }): string {
    return this.bundle[args.tag]?.[args.key] ?? args.source;
  }
}
