---
title: T-253-rider — @stageflip/export-pptx — placeholder-inheritance write-back
id: docs/tasks/T-253-rider
phase: 11
size: S
owner_role: implementer
status: draft
last_updated: 2026-04-26
---

# T-253-rider — `@stageflip/export-pptx` — placeholder-inheritance write-back

**Branch**: `task/T-253-rider-placeholder-inheritance`

## Goal

Extend the `@stageflip/export-pptx` foundation that lands in T-253-base so the writer emits `<p:sldLayout>` / `<p:sldMaster>` parts mirroring `Document.layouts` / `Document.masters`, and per-element `inheritsFrom` becomes the `<p:nvSpPr><p:nvPr><p:ph type="..." idx="..."/></p:nvPr></p:nvSpPr>` reference. After this PR, an authored deck that uses placeholder inheritance round-trips through `parsePptx → exportPptx → parsePptx` with `Document.layouts` / `Document.masters` preserved and slides carrying `inheritsFrom` references rather than fully materialized geometry.

This is the original v1.24 plan-row scope at `docs/implementation-plan.md:542`. T-253-base unblocked it by shipping the foundation.

## Dependencies

- **T-253-base merged** (the foundational `@stageflip/export-pptx` writer). This task hard-depends on the base writer's element dispatcher, ZIP packer, and round-trip test infrastructure.
- T-251 merged (#196). Provides `Document.layouts` / `Document.masters` / `Slide.layoutId` / `ElementBase.inheritsFrom`.
- All other deps already on `main` per T-253-base's dep list.

**Does NOT depend on**: T-244, T-245, T-246, T-252.

**Blocks**: nothing structural. T-253-rider is a clean follow-on; future T-253-tables / T-253-videos / T-253-fonts riders are independent of this one.

## Out of scope

| Item | Why deferred |
|---|---|
| Theme write-back (`Document.theme` → real `theme1.xml`) | A future T-253-theme rider. T-253-rider continues to ship the hard-coded Office 2007 default theme from base. |
| `<a:tbl>` / `<p:videoFile>` / `<p:embeddedFontLst>` write-back | Independent riders. |
| Layout-side animation write-back | Same as base — animations are dropped with `LF-PPTX-EXPORT-ANIMATIONS-DROPPED`. |
| **Bidirectional placeholder discovery from importer-side `inheritsFrom`** | The base writer drops `inheritsFrom` (per T-253-base §4 element dispatch). T-253-rider activates the read path: when `inheritsFrom` is present and resolves to a parsed layout / master, the writer emits the `<p:ph>` reference; otherwise it falls back to base-style fully-materialized geometry. Round-trip safety ensures no regression. |

## Architectural decisions

### 1. Element dispatcher gains `inheritsFrom` awareness

In T-253-base, `packages/export-pptx/src/elements/text.ts` (and the other element emitters) ignore `ElementBase.inheritsFrom`. T-253-rider modifies the dispatcher contract:

```ts
// packages/export-pptx/src/elements/shared.ts (modified)
export interface EmitContext {
  /** Document-level layouts indexed by id, for inheritsFrom resolution. */
  layoutsById: Map<string, SlideLayout>;
  /** Document-level masters indexed by id. */
  mastersById: Map<string, SlideMaster>;
  /** Whether this slide's layout passed through to the writer (T-253-rider). */
  layoutEmitted: boolean;
  /** ... existing fields from base ... */
}
```

For each element with `inheritsFrom = { templateId, placeholderIdx }`:

1. Resolve `templateId` against `layoutsById` (or fall through to `mastersById`).
2. If unresolved → emit `LF-PPTX-EXPORT-LAYOUT-NOT-FOUND`, drop `inheritsFrom`, fall back to base behavior (materialized geometry).
3. If resolved but the matching `placeholderIdx` doesn't exist on the template → emit `LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND`, drop `inheritsFrom`, fall back.
4. If resolved cleanly → emit `<p:nvSpPr><p:nvPr><p:ph type="<placeholder.type>" idx="<placeholderIdx>"/></p:nvPr></p:nvSpPr>` plus the slide-side override fields. Suppress slide-side fields that are byte-equal to the placeholder default (so the slide truly inherits from the template at runtime). **Mismatch detection**: for any field whose slide-side value matches the placeholder default, omit it from the slide XML. Emit `LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH` only when the slide-side value cannot be represented as either "matches default" or "explicit override" (rare; usually means the value is structurally divergent from the placeholder type).

### 2. New writer parts: `slideLayouts/` + `slideMasters/`

Two new emit functions mirror `parts/slide.ts`:

```
packages/export-pptx/src/parts/
  slide-layout.ts                   # NEW — emits ppt/slideLayouts/slideLayoutN.xml + rels
  slide-layout.test.ts              # NEW
  slide-master.ts                   # NEW — emits ppt/slideMasters/slideMasterN.xml + rels
  slide-master.test.ts              # NEW
```

Each layout XML contains:

- `<p:sldLayout xmlns:p="..." xmlns:a="..." xmlns:r="..." type="<layoutType>">` — root.
- `<p:cSld>` with the layout's `placeholders: Element[]` emitted via the same element dispatcher (`<p:sp>` / `<p:pic>` / etc.) — placeholders are full-shape Elements per T-251 §"Schema additions".
- `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` — minimal color mapping; layouts inherit master's color map by default.

Each master XML contains:

- `<p:sldMaster xmlns:p="..." xmlns:a="..." xmlns:r="...">` — root.
- `<p:cSld>` with the master's `placeholders: Element[]`.
- `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` — standard PPTX color-map.
- `<p:sldLayoutIdLst>` listing every layout that points at this master via `masterId`.
- `<p:txStyles>` minimal stub — title / body / other style placeholders. Future rider can flesh this out.

The layout's `<p:sldLayoutIdLst>` membership and master's `<p:clrMap>` are required for Office to open the file; without them, the deck loads but with downgraded fidelity.

### 3. `presentation.xml.rels` updates

Base writer emits rels only to slides + theme. Rider extends to also emit rels to every layout + master.

The rels precedence chain that downstream consumers (Office, LibreOffice, Slides) walk:

```
presentation → master(s)
              → layout(s) [via master's <p:sldLayoutIdLst>]
              → slide(s) [via slide-rel pointing at layout]
```

T-253-rider emits the chain bottom-up: slides reference layouts via `<Relationship .../>` in `slide{N}.xml.rels`; layouts reference masters via `<Relationship .../>` in `slideLayout{N}.xml.rels`. The presentation.xml.rels lists every part as a top-level Relationship.

### 4. Slide-side rel update

Each slide whose `Slide.layoutId` resolves emits an additional rel:

```xml
<Relationship Id="rId<N>" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout<M>.xml"/>
```

Where `<M>` is the layout's index in `Document.layouts` (1-based). The slide XML itself doesn't reference layouts inline — Office discovers the chain via the rel.

### 5. New loss flags

Two new `ExportPptxLossFlagCode` variants on top of the six T-253-base codes:

| Code | Severity | Category | Emitted when |
|---|---|---|---|
| `LF-PPTX-EXPORT-LAYOUT-NOT-FOUND` | `warn` | `shape` | An element's `inheritsFrom.templateId` doesn't match any `Document.layouts[i].id` or `Document.masters[i].id`. The writer falls back to materialized geometry. |
| `LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND` | `warn` | `shape` | The `templateId` resolves but `placeholderIdx` doesn't match a placeholder on the resolved template (or transitively on its master). Same fallback. |
| `LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH` | `info` | `shape` | A slide-side field cannot be classified as "matches default" or "explicit override" cleanly (rare; structural divergence from placeholder type). The slide-side value wins. |

### 6. Round-trip suite extension

The base writer's `roundtrip.test.ts` is the contract. T-253-rider extends it with a new fixture: a 3-slide deck with one master + one layout + slides whose elements use `inheritsFrom`. Round-trip equality must hold AND the second-pass tree must show every applicable element carrying `inheritsFrom` (not flat geometry). Pin via fixture.

A second negative fixture: a deck with `Document.layouts === []` (T-253-base's common case) round-trips identically before and after rider — no `slideLayouts/` or `slideMasters/` ZIP entries appear. Pin.

### 7. CLAUDE.md §10 compliance

The "Where things go" table in CLAUDE.md §10 names the placeholder-inheritance pattern only for new element types (via `packages/schema/src/elements/<name>.ts`). T-253-rider doesn't add a new element type — it extends the writer's emit logic for an existing schema field. No table-row addition needed; the pattern is contained in the export-pptx package.

## Files to create / modify

```
packages/export-pptx/
  src/
    parts/
      slide-layout.ts                   # NEW — emits ppt/slideLayouts/slideLayoutN.xml + rels
      slide-layout.test.ts              # NEW
      slide-master.ts                   # NEW — emits ppt/slideMasters/slideMasterN.xml + rels
      slide-master.test.ts              # NEW
      presentation.ts                   # MODIFIED — emits <p:sldMasterIdLst> + extra rels
      presentation.test.ts              # MODIFIED — pin new emissions
      content-types.ts                  # MODIFIED — adds <Override> entries for new parts
      content-types.test.ts             # MODIFIED
      slide.ts                          # MODIFIED — emits slide-layout rel when Slide.layoutId resolves
      slide.test.ts                     # MODIFIED
    elements/
      shared.ts                         # MODIFIED — EmitContext gains layoutsById / mastersById; inheritsFrom resolver
      shared.test.ts                    # MODIFIED
      text.ts                           # MODIFIED — emits <p:nvSpPr><p:nvPr><p:ph .../></p:nvPr></p:nvSpPr> when inheritsFrom resolves
      text.test.ts                      # MODIFIED
      image.ts                          # MODIFIED — same
      image.test.ts                     # MODIFIED
      shape.ts                          # MODIFIED — same
      shape.test.ts                     # MODIFIED
      group.ts                          # MODIFIED — same (inheritsFrom can be set on groups)
      group.test.ts                     # MODIFIED
    types.ts                            # MODIFIED — adds 3 new ExportPptxLossFlagCode variants
    loss-flags.ts                       # MODIFIED — adds CODE_DEFAULTS entries
    loss-flags.test.ts                  # MODIFIED
    exportPptx.ts                       # MODIFIED — wires layouts / masters into the emit pass
    exportPptx.test.ts                  # MODIFIED — pin layouts-populated path
    roundtrip.test.ts                   # MODIFIED — extend fixture set with placeholder-inheritance deck
    fixtures/
      placeholder-inheritance-deck.json # NEW — Document with master + layout + slides using inheritsFrom

skills/stageflip/
  workflows/
    export-pptx/
      SKILL.md                          # MODIFIED — document layout/master emission + inheritsFrom dispatch
  reference/
    export-pptx/
      SKILL.md                          # MODIFIED — three new loss flags

.changeset/export-pptx-t253-rider.md    # NEW — minor on @stageflip/export-pptx (0.1.0 → 0.2.0)
```

No changes to:
- `@stageflip/schema` — T-251 already shipped the types.
- `@stageflip/import-pptx` — T-253-rider is write-only; the importer's read path through layouts/masters lands in a separate task (call it T-243d if/when authored).

## Acceptance criteria

Each gets a Vitest test, written first and failing.

### Layout / master emission

1. `Document.layouts: SlideLayout[]` of length N produces N `ppt/slideLayouts/slideLayoutK.xml` entries (1-based) with rels. Pin via ZIP entry list.
2. `Document.masters: SlideMaster[]` of length M produces M `ppt/slideMasters/slideMasterK.xml` entries with rels. Pin.
3. `Document.layouts === []` produces zero layout entries (no `slideLayouts/` directory). Pin.
4. `Document.masters === []` produces zero master entries. Pin.
5. The master XML's `<p:sldLayoutIdLst>` lists every layout whose `masterId` matches the master's id. Pin via fixture with 1 master + 2 layouts.
6. The master XML emits a default `<p:clrMap>` entry. Pin via snapshot.

### Per-element `inheritsFrom` emission

7. A `TextElement` with `inheritsFrom = { templateId: <layoutId>, placeholderIdx: 1 }` (where the layout has a matching placeholder) emits `<p:nvSpPr><p:nvPr><p:ph type="<placeholderType>" idx="1"/></p:nvPr></p:nvSpPr>`. Pin via fixture.
8. The same element with `inheritsFrom` to a non-existent `templateId` falls back to materialized geometry + emits `LF-PPTX-EXPORT-LAYOUT-NOT-FOUND`. Pin.
9. The same element with `inheritsFrom` to a valid templateId but a `placeholderIdx` that doesn't match emits `LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND` + falls back. Pin.
10. **Transitive resolution**: an element with `inheritsFrom.templateId = layoutId` whose layout doesn't have a matching `placeholderIdx` but whose master does walks the chain and emits the `<p:ph>` reference pointing at `layoutId` (NOT `masterId`); the runtime PPTX consumer walks the chain itself. Pin via fixture.

### Slide-side rel updates

11. A `Slide` with `layoutId` resolving to `Document.layouts[i]` emits a slide-rel pointing at `../slideLayouts/slideLayout<i+1>.xml` with `Type="...slideLayout"`. Pin.
12. A `Slide` with `layoutId === undefined` (or unresolvable) emits no slide-layout rel. Pin.

### Override suppression

13. A slide element whose every field is byte-equal to its placeholder's default emits **only** the `<p:nvSpPr>` block (no `<p:spPr>`, no `<p:txBody>`); the runtime fully inherits. Pin via fixture (a slide element identical to its placeholder).
14. A slide element whose `transform` matches but whose `text` differs emits the `<p:nvSpPr>` block plus a `<p:txBody>` carrying the override. The unchanged `transform` is omitted from the slide XML. Pin.

### Loss flags

15. The `ExportPptxLossFlagCode` union adds three variants and `CODE_DEFAULTS` covers each. Pin via test that iterates the union.
16. A normal export with valid inheritance chain emits **zero** new loss flags. Pin via fixture.

### Round-trip suite

17. The new `placeholder-inheritance-deck.json` fixture round-trips through `exportPptx → parsePptx` (with the importer's existing layouts/masters parser if present, else the importer drops layouts cleanly — see Notes for the Orchestrator §3) with `Document.layouts.length` and `Document.masters.length` preserved. Pin.
18. Slide elements in the round-trip output carry `inheritsFrom` (not flat geometry) for every element that started with `inheritsFrom`. Pin.
19. The base writer's existing `roundtrip.test.ts` fixtures all continue to pass — no regression on the layouts-empty path. Pin via re-running the suite.

### Coverage + gates

20. Coverage on the modified files is at or above the base-writer baseline (≥85%; ≥90% on `parts/slide-layout.ts` and `parts/slide-master.ts`).
21. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check-licenses`, `pnpm check-remotion-imports`, `pnpm check-determinism`, `pnpm check-skill-drift`, `pnpm size-limit` all green.

## Public-spec / library references

- **ECMA-376** PPTX schema, slideLayout / slideMaster:
  - §19.3.1.41 — `<p:sldLayout>`
  - §19.3.1.42 — `<p:sldMaster>`
  - §19.3.1.36 — `<p:ph>` (placeholder shape)
  - §19.3.1.50 — `<p:sldLayoutIdLst>` and `<p:sldLayoutId>`
- **In-repo precedents**:
  - `packages/import-pptx/src/parts/presentation.ts` — read-side parsing of `<p:sldMasterIdLst>` + layout-rels chain.
  - `packages/schema/src/templates.ts` (T-251) — `SlideLayout` + `SlideMaster` types.
  - `packages/schema/src/inheritance.ts` (T-251) — the `applyInheritance` walk; the writer's transitive resolution mirrors this logic.

## Skill updates (in same PR)

- `skills/stageflip/workflows/export-pptx/SKILL.md` (MODIFIED) — document layout/master emission + `inheritsFrom` dispatch + override-suppression rule + three new loss flags.
- `skills/stageflip/reference/export-pptx/SKILL.md` (MODIFIED) — list the three new `ExportPptxLossFlagCode` variants.

## Quality gates (block merge)

Standard CLAUDE.md §8 set, all green:

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (≥85% coverage; ≥90% on the two new `parts/` files per AC #20).
- `pnpm check-licenses` — no new deps.
- `pnpm check-remotion-imports` — n/a.
- `pnpm check-determinism` — n/a (package not in scope; source-grep test from T-253-base AC #28 still passes).
- `pnpm check-skill-drift`.
- `pnpm size-limit`.

## PR template + commit

- Title: `[T-253-rider] @stageflip/export-pptx — placeholder-inheritance write-back`
- Conventional commits:
  - Commit 1: `test(export-pptx): T-253-rider — failing tests + placeholder-inheritance fixture`
  - Commit 2: `feat(export-pptx): T-253-rider — slideLayout / slideMaster part emission`
  - Commit 3: `feat(export-pptx): T-253-rider — element dispatcher inheritsFrom resolution + override suppression + 3 loss flags`
  - Optional Commit 4 for non-blocking Reviewer feedback.
- Branch: `task/T-253-rider-placeholder-inheritance`
- Changesets: `.changeset/export-pptx-t253-rider.md` — `minor` on `@stageflip/export-pptx` (0.1.0 → 0.2.0).

## Escalation triggers (CLAUDE.md §6)

Stop and report instead of guessing if:

- An importer-side parsed fixture has `Document.layouts` populated but the layouts' `placeholders[]` contains element types T-253-base's writer doesn't support (e.g., `TableElement`). The placeholder still has to emit; the writer should fall back to a `<p:sp>` stub with `<p:nvSpPr>` only. Pin via fixture; if fallback isn't clean, escalate.
- A real `.pptx` from Office surfaces a layout with `<p:sldLayout type="custom">` (the OOXML enum has 27 values). T-253-rider should preserve `SlideLayout.type` if the schema models it; if the schema doesn't carry it, escalate before extending the schema in this PR.
- The override-suppression rule (AC #13–#14) produces a slide that Office opens but renders differently than the schema-level rendering (e.g., schema's resolved value disagrees with the placeholder's default). Investigate the schema-level `applyInheritance` resolver; do NOT silently widen the suppression rule.
- The transitive resolution (AC #10) requires the `<p:ph>` to point at the master (not the layout) to render correctly in Office. ECMA-376 says the layout's `placeholderIdx` should be authoritative; if it's not in practice, escalate before changing the emitted reference.

## Notes for the Orchestrator

1. **S-sized; expect three commits + cleanup.** The bulk is in the `parts/slide-layout.ts` + `parts/slide-master.ts` emitters (mechanical) and the dispatcher contract change (focused). Reviewer should focus on AC #10 (transitive resolution) and AC #13–#14 (override suppression).
2. **Hard dependency on T-253-base.** Do NOT dispatch the rider Implementer until base merges. The shared fixture infrastructure (`roundtrip.test.ts`) and dispatcher contract are load-bearing.
3. **Importer-side gap**: T-253-rider only writes layouts/masters/inheritsFrom. The importer (`@stageflip/import-pptx`) doesn't yet **read** layouts/masters from real `.pptx` files (it parses them as opaque slides). Round-trip equality (AC #17–#18) currently relies on the round-trip closing on a hand-authored `Document` (already in `Document.layouts`/`masters` form), not on a `.pptx → Document` import that recovers the templates from XML. A future T-243d would close the importer-side gap; until then, the rider's contribution is real but only realized for editor-authored decks. Note in PR body so future work surfaces this.
4. **Three loss flags, not five.** The plan-row mentions placeholder-inheritance write-back; T-253-rider keeps the loss-flag set tight: layout-not-found + placeholder-not-found + mismatch. Other failure modes fold into base writer flags.
5. **Dispatch convention** (this session): foreground Implementer, no `isolation: worktree`. Reviewer dispatch likewise foreground.
6. **Plan-row update lands in T-253-base's PR**, not in T-253-rider's. Once base lands, the plan rows already point at "T-253-base done; T-253-rider next" so no second plan-row edit needed.
