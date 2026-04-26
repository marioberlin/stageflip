# `@stageflip/export-pptx` constraints (T-253-base)

Searchable Q&A: when authoring an exporter feature or reviewing a T-253-rider PR, look up "Can I X?" before doing it. Inspired by huashu's `editable-pptx.md` 4-hard-rules pattern; adapted to StageFlip's actual T-253-base implementation.

## Quick lookup

| Question | Answer | Source |
|---|---|---|
| Can I emit `<a:custGeom>` for custom shapes? | **No (degraded)** | falls back to `<a:prstGeom prst="rect"/>` + `LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED` |
| Can I emit `<p:videoFile>` for VideoElement? | **No** | skipped + `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` |
| Can I emit `<a:tbl>` for TableElement? | **No** (T-253-base) | skipped + `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT`; future T-253-tables-rider |
| Can I emit `<p:sldLayout>` / `<p:sldMaster>` parts? | **No** (T-253-base) | T-253-rider activates this path |
| Can I write `inheritsFrom` references? | **No** (T-253-base) | dropped; T-253-rider activates |
| Can I emit `<a:blipFill>` for image-fill slide backgrounds? | **No (degraded)** | placeholder solid white + `LF-PPTX-EXPORT-IMAGE-BACKGROUND-FALLBACK` |
| Can I write animations (`<p:timing>`, `<p:cTn>`)? | **No** | dropped + `LF-PPTX-EXPORT-ANIMATIONS-DROPPED` per affected slide |
| Can I write speaker notes (`notesSlide` part)? | **No** | dropped + `LF-PPTX-EXPORT-NOTES-DROPPED` per affected slide |
| Can I write a real `theme1.xml` from `Document.theme`? | **No** | hard-coded Office 2007 default + `LF-PPTX-EXPORT-THEME-FLATTENED` once per export |
| Can I emit non-deterministic ZIP output? | **No** | byte-identity contract per AC #2/#3; `fflate` pinned at `level: 6` + uniform `mtime` |
| Can I call `Date.now()` / `Math.random()` in the writer source? | **No** | source-level grep test (AC #28) blocks |
| Can I add a new dep? | **Only if** on the whitelist (`pnpm check-licenses`) | `fflate` and `pngjs` are already there |
| Can I emit `<Default>` content-types per image extension? | **Yes** | content-types consolidates into `<Default>` per extension (OOXML §10.1.2.3) |
| Can I emit `<Override>` for content-types? | **Yes**, for parts with non-default content type (e.g., `ppt/presentation.xml`) | per `parts/content-types.ts` |
| Can I omit `[Content_Types].xml`? | **No** | OPC requires it; without it Office refuses to open |
| Can I omit `_rels/.rels`? | **No** | root rels point at `ppt/presentation.xml`; omitting breaks Office |
| Can I omit `theme1.xml`? | **No** (per Office) | a presentation without a theme part loads but with downgraded fidelity |

## Detailed entries

### Q: Can I emit `<a:custGeom>` for `ShapeElement` with `shape: 'custom-path'`?

**A**: No. The base writer falls back to a bounding `<a:prstGeom prst="rect"/>` + emits `LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED`.

**Why**: `<a:custGeom>` writeback requires the inverse of T-242d's `<a:custGeom>` parser (`packages/import-pptx/src/geometries/cust-geom/parse.ts`); not yet shipped on the writer side. Spec §"Out of scope" defers this to a future task.

**Workaround**: For the user, the shape becomes a rect with the original bbox preserved. For the agent, no workaround — emit as-is and let the loss flag surface.

**Verified**: [packages/export-pptx/src/elements/shape.ts](../../../../../packages/export-pptx/src/elements/shape.ts) — falls back to `prstGeom prst="rect"` for non-preset shapes.

---

### Q: Can I emit `<a:blipFill>` for a slide background with `kind: 'asset'`?

**A**: No (degraded). The base writer emits a placeholder solid-white `<p:bg>` + `LF-PPTX-EXPORT-IMAGE-BACKGROUND-FALLBACK` (severity `warn`, category `media`).

**Why**: Real `<a:blipFill>` writeback would require allocating a slide-rel + uploading the background image bytes through `AssetReader.get`. Discovered as a Reviewer-flagged gap on T-253-base PR #205; addressed via the breadcrumb flag rather than the full implementation, deferred to a follow-on rider.

**Workaround**: None at the writer; the importer parser drops slide backgrounds anyway, so the round-trip predicate accepts this. A future T-253-bg-rider could add the real blipFill path.

**Verified**: [packages/export-pptx/src/parts/slide.ts:205-218](../../../../../packages/export-pptx/src/parts/slide.ts) — `renderBackground` returns the placeholder XML; the loss-flag emission lives at the call site.

---

### Q: Can I rely on the writer being deterministic across two calls?

**A**: Yes — but only if you pass `opts.modifiedAt` (or omit it; a frozen epoch is the default fallback).

**Why**: The writer's two non-determinism sources are ZIP timestamps and `fflate` compression options. Both are pinned. AC #2 + #3 enforce the contract via a test that calls `exportPptx` twice with the same input and asserts `Buffer.from(b1).equals(Buffer.from(b2))`.

**Pin**: [packages/export-pptx/src/exportPptx.test.ts](../../../../../packages/export-pptx/src/exportPptx.test.ts) — searches "byte-determinism" / "AC #2" / "AC #3."

---

### Q: Can the writer be a non-pure function (e.g., access env vars, current time)?

**A**: No. Source-level grep test (AC #28) blocks `Date.now`, `Date()`, `new Date()` (without arg), `Math.random`, `performance.now`, `setTimeout`, `setInterval` in `packages/export-pptx/src/**` (excluding `*.test.ts`).

**Why**: The package isn't in CLAUDE.md §3's determinism-restricted scope, but byte-output identity depends on writer purity. The grep test is the package-local enforcement.

**Pin**: [packages/export-pptx/src/exportPptx.test.ts](../../../../../packages/export-pptx/src/exportPptx.test.ts) — the source-grep test. Pattern reused by `@stageflip/rasterize` (T-245 AC #19) and other Phase 11 packages.

---

### Q: Can I extend the element dispatcher to support a new element type?

**A**: Yes, in a new commit, but **the round-trip suite must extend in lock-step**. T-253-base's `roundtrip.test.ts` is the contract: any new element type that round-trips must have a fixture in `packages/export-pptx/src/fixtures/` exercising it.

**Why**: Adding an element type without a fixture means future regressions to that element are silent. The suite is the authoritative gate.

**Pattern**: each new element type gets:
1. A new emitter in `packages/export-pptx/src/elements/<type>.ts`
2. The dispatcher (likely `parts/slide.ts:renderElement` or similar) gains a new branch
3. A new fixture in `packages/export-pptx/src/fixtures/`
4. A round-trip test that loads the fixture and asserts structural equality

**Verified**: [packages/export-pptx/src/roundtrip.test.ts](../../../../../packages/export-pptx/src/roundtrip.test.ts).

---

### Q: Can I bake the current Slides API client subset's response shape directly into types?

**A**: Yes. T-244 implementation already chose this (see PR #208 deviation #1): hand-rolled the strict subset of `presentations.get` and `presentations.pages.getThumbnail` response shapes in `packages/import-google-slides/src/api/types.ts` rather than depending on `googleapis` (~3 MB transitive surface). T-252 spec follows the same precedent. This pattern is now established for any Google API consumer.

**Why**: The `googleapis` client is dynamic-typed at runtime and pulls a large dep tree. For exporters/importers consuming a stable, narrow subset of the API, hand-rolled types are cleaner.

**Verified**: [packages/import-google-slides/src/api/types.ts](../../../../../packages/import-google-slides/src/api/types.ts).

---

### Q: Should I add a new `LF-PPTX-EXPORT-*` loss flag for a new degraded path?

**A**: Yes, when the path is a named, recurring fidelity loss the consumer needs to surface. Add to:
1. `ExportPptxLossFlagCode` union ([packages/export-pptx/src/types.ts](../../../../../packages/export-pptx/src/types.ts))
2. `CODE_DEFAULTS` table ([packages/export-pptx/src/loss-flags.ts](../../../../../packages/export-pptx/src/loss-flags.ts))
3. The `loss-flags.test.ts` iterator that covers every union variant
4. The skill at `skills/stageflip/concepts/loss-flags/SKILL.md`

**No**, when the degraded path is a one-off / temporary internal state. Use a `console.warn` (in scripts only — not in package source per CLAUDE.md §3) or an inline TODO with a linked task ID.

**Pattern reference**: `LF-PPTX-EXPORT-IMAGE-BACKGROUND-FALLBACK` was added in T-253-base PR #205's Reviewer cleanup as the canonical example of "name the recurring degradation, don't silently drop fidelity."

---

### Q: Can the writer call `assets.get` lazily / in parallel?

**A**: Yes — the asset collector is async per-id. The writer collects every distinct `AssetRef` first (one walk), deduplicates, then issues `assets.get` calls (no required ordering). The current implementation is sequential; a future optimization could parallelize via `Promise.all`. Not blocking.

**Verified**: [packages/export-pptx/src/assets/collect.ts](../../../../../packages/export-pptx/src/assets/collect.ts).

---

## Future entries (placeholder)

When new constraints are discovered (typically during Reviewer rounds on T-253-rider or future riders), add Q&A entries here. Format: lead with the question, answer in bold, then Why / Workaround / Verified. Keep each entry under ~30 lines.
