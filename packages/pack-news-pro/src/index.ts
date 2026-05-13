// packages/pack-news-pro/src/index.ts
// T-506 — Public surface of `@stageflip/pack-news-pro`. Re-exports
// the manifest skeleton + the hash-substitution helper so the editor
// surface (and the build script) can consume a single typed source of
// truth for the pack metadata.
//
// Determinism perimeter: this package lives OUTSIDE per CLAUDE.md §3
// (content package + host-side tooling).

export { MANIFEST_SKELETON, PLACEHOLDER_INTEGRITY_HASH, withIntegrityHash } from './manifest.js';
