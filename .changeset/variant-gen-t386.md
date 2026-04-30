---
'@stageflip/variant-gen': minor
'@stageflip/schema': minor
'@stageflip/engine': minor
---

T-386: variant-generation primitive — message × locale matrix over RIR.

`@stageflip/variant-gen` (new package):

- `generateVariants(source, spec, options?) → Iterable<VariantOutput>` —
  synchronous, bounded, browser-safe. Two axes (messages + locales) ship in
  v1; size axis deferred to T-386a (TS `size?: never` placeholder + Zod
  `strict()` runtime reject).
- `VariantMatrixCapExceededError` — synchronous throw on cap-exceeded
  (default `maxVariants: 100`). No partial output.
- `LocaleProvider` interface + `InMemoryLocaleProvider` +
  `StaticBundleLocaleProvider`. Network-fetching providers deferred to
  T-415.
- `deriveCacheKey(sourceDocId, coordinate)` — content-addressed sha256 hex.
  Pure-JS sync FIPS 180-4 implementation, no Node-only imports.
- `replaceElementInDocument` / `setNestedProperty` — structural-sharing
  helpers; pinned by AC #21 ref-equality on a 100-element source.

`@stageflip/schema`:

- New `@stageflip/schema/variants` surface — `variantMatrixSpecSchema`,
  `messageVariantAxisEntrySchema`, `localeAxisEntrySchema`,
  `variantSlotDefSchema`, `variantSlotsSchema`. Re-exported from the schema
  barrel.
- `Document.variantSlots?: Record<string, VariantSlotDef>` — optional root
  field. Existing documents without the field round-trip unchanged.
- BCP-47 light regex on `locales[].tag`; `messages[].id` uniqueness
  enforced via superRefine.

`@stageflip/engine`:

- New 17th canonical bundle `arrange-variants` exposing one tool —
  `arrange_variants({ matrixSpec })`. Returns
  `{ ok: true, variants: [{ coordinate, documentId, cacheKey }] }`; full
  Document payloads are persisted via the
  `VariantPersistenceContext.persistVariant` seam and never inlined into
  the agent context.
- Cap-exceeded responses are typed
  `{ ok: false, reason: 'matrix_cap_exceeded' }` — synchronous, no patches
  emitted.
