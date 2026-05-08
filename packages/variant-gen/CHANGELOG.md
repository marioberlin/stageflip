# @stageflip/variant-gen

## 0.1.0

### Minor Changes

- 38e4017: T-386: variant-generation primitive — message × locale matrix over RIR.

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

### Patch Changes

- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/schema@0.1.0
