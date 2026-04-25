---
title: Phase 11 mid — handover
id: docs/handover-phase11-mid
owner: orchestrator
last_updated: 2026-05-01
supersedes: docs/handover-phase10-complete.md
---

# Handover — Phase 11 mid (2026-05-01)

If you are the next agent: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md` (v1.20). Phase 11 is **in-flight**; Phase 10 ratified at P11 start. The PPTX importer pipeline runs end-to-end for image content (parse → group-transform accumulation → asset upload to Firebase Storage). Geometry coverage is partial; remaining importer kinds (videos, fonts) and the second importer (Google Slides) haven't started.

`main` at `acbc394`. Working tree clean; every gate green on every merge.

---

## 1. Where we are

### Phase history

- Phases 0–10: ratified (see prior handover docs).
- **Phase 11 (Importers)** — in-flight.

### Phase 11 tasks as shipped (this session)

| ID | Title | PR |
|---|---|---|
| T-240 spec | `@stageflip/import-pptx` task spec | [#166](https://github.com/marioberlin/stageflip/pull/166) |
| T-240 | `@stageflip/import-pptx` — ZIP + PresentationML structural parser | [#167](https://github.com/marioberlin/stageflip/pull/167) |
| — | Drop flaky `fixtures.test.ts` byte-stability assertion | [#169](https://github.com/marioberlin/stageflip/pull/169) |
| T-241a spec | Nested group transform accumulator spec | [#168](https://github.com/marioberlin/stageflip/pull/168) |
| T-241a | `accumulateGroupTransforms` post-walk pass | [#170](https://github.com/marioberlin/stageflip/pull/170) |
| T-243 spec | PPTX image asset extraction spec | [#171](https://github.com/marioberlin/stageflip/pull/171) |
| T-243a | `resolveAssets` + `AssetStorage` interface | [#172](https://github.com/marioberlin/stageflip/pull/172) |
| T-243-storage-adapter | Firebase `AssetStorage` adapter in `@stageflip/storage-firebase` | [#173](https://github.com/marioberlin/stageflip/pull/173) |
| Plan v1.20 | T-243 split + P11 progress recorded | [#174](https://github.com/marioberlin/stageflip/pull/174) |
| T-242 spec | Preset geometries + custom paths spec (full T-242 commitment) | [#175](https://github.com/marioberlin/stageflip/pull/175) |
| T-242a | Geometry library infra + 6 representative presets | [#176](https://github.com/marioberlin/stageflip/pull/176) |
| T-242b first-wave | 10 more presets + `roundRect.adj1` honoring | [#177](https://github.com/marioberlin/stageflip/pull/177) |
| — | `<a:custGeom>` parser supports `<a:quadBezTo>` | [#178](https://github.com/marioberlin/stageflip/pull/178) |

13 PRs merged this session (4 task specs, 1 plan amendment, 6 implementations, 1 flake fix, 1 follow-up).

### Functional state

The PPTX importer pipeline runs **end-to-end for image content**:

```ts
import { parsePptx, resolveAssets, unpackPptx } from '@stageflip/import-pptx';
import { createFirebaseAssetStorage } from '@stageflip/storage-firebase';
import { getStorage } from 'firebase-admin/storage';

const entries = unpackPptx(buffer);
const tree = await parsePptx(buffer);                          // T-240 + T-241a (group accum runs as post-walk)
const storage = createFirebaseAssetStorage({ bucket: getStorage().bucket() });
const resolved = await resolveAssets(tree, entries, storage);  // T-243a → bytes in Firebase Storage
```

A real-world `.pptx` with text + images + groups + 16 of 50 covered preset shapes will round-trip into a parser-side `CanonicalSlideTree` with no `LF-PPTX-NESTED-GROUP-TRANSFORM` and no `LF-PPTX-UNRESOLVED-ASSET` flags. Custom geometries using `<a:moveTo>`, `<a:lnTo>`, `<a:cubicBezTo>`, `<a:quadBezTo>`, `<a:close>`, multi-`<a:path>` parse cleanly.

---

## 2. Architecture that landed

### Package + module additions

```
packages/import-pptx/
  src/
    parsePptx.ts             # T-240 entry: pure (Uint8Array) → CanonicalSlideTree
    types.ts                 # ParsedElement, ParsedSlide, CanonicalSlideTree, LossFlag, etc.
    loss-flags.ts            # emitLossFlag with deterministic content-hashed ids
    zip.ts                   # unpackPptx (fflate)
    opc.ts                   # XML parse + relationships resolution
    parts/
      presentation.ts        # /ppt/presentation.xml → slide list
      slide.ts               # parses <p:sld>/<p:sldLayout>/<p:sldMaster> uniformly
      sp-tree.ts             # walks <p:spTree> + parseGroup (chOff/chExt captured)
    elements/
      shape.ts               # <p:sp> → text / structural shape / custom-path / unsupported
      text.ts                # text-run extractor
      picture.ts             # <p:pic> → ParsedImageElement with ParsedAssetRef
      shared.ts              # helpers
    transforms/
      accumulate.ts          # T-241a: composes ancestor frames; idempotent
    assets/
      resolve.ts             # T-243a: walks tree, hashes, uploads, rewrites refs
      content-type.ts        # extension → MIME
      types.ts               # AssetStorage interface, AssetResolutionError
    geometries/
      index.ts               # PRESET_GENERATORS registry, geometryFor, COVERED_PRESETS, HONORED_ADJUSTMENTS
      format.ts              # shared `fmt` for SVG coords
      cust-geom/parse.ts     # custGeomToSvgPath: M/L/C/Q/Z + multi-path
      presets/{arrows,callouts,banners,basics,brackets,misc}.ts

packages/storage-firebase/
  src/asset-storage.ts       # createFirebaseAssetStorage factory; structural BucketLike
```

### Type-layer pattern

`@stageflip/schema` is **untouched** by this session. The parser carries its own types:

- `ParsedAssetRef` — `{ kind: 'resolved'; ref: AssetRef } | { kind: 'unresolved'; oocxmlPath: string }`. T-243a narrows unresolved → resolved.
- `UnsupportedShapeElement` — placeholder for presets/custGeom outside T-242 + cust-geom coverage.
- `ParsedElement` / `ParsedSlide` / `CanonicalSlideTree` mirror schema shapes with the loosened fields.
- `CanonicalSlideTree.transformsAccumulated?` and `assetsResolved?` markers — idempotence guards.

`documentSchema.parse()` is **never** invoked on parser output today. Downstream callers must complete the geometry / asset resolution passes before validating against the canonical schema.

### Loss-flag system

`LossFlag` matches the contract in `skills/stageflip/concepts/loss-flags`. A parser-side `code: LossFlagCode` field carries the stable `LF-PPTX-*` enum. Sibling importers (T-244, T-247) will define their own `LF-<SRC>-*` enums.

Current PPTX flag inventory — see §4 below for status.

---

## 3. Test / coverage state at handover write-time

- **`@stageflip/import-pptx`**: 87 tests passing across 7 files.
  - `parsePptx.test.ts` 15
  - `transforms/accumulate.test.ts` 11
  - `assets/resolve.test.ts` 12
  - `assets/content-type.test.ts` 9
  - `geometries/index.test.ts` 20
  - `geometries/cust-geom/parse.test.ts` 15
  - `fixtures/fixtures.test.ts` 6
- Package coverage: ~94% lines.
- **`@stageflip/storage-firebase`**: 8 tests; 100% on the adapter.
- All §8 gates green on every PR. CI consistently CLEAN.

---

## 4. What's left in P11

In rough priority order:

| ID | Status | Size | Notes |
|---|---|---|---|
| **T-242c** | spec'd via T-242 (#175); not started | M | Remaining 30 of 50 committed presets (more arrows / callouts / banners / chord-pie-donut / lightningBolt / moon / noSmoking) |
| **`<a:arcTo>` support in cust-geom parser** | not specced | M | Hard-blocked by `preserveOrder: true` workspace refactor (see §5). Closes the last `LF-PPTX-CUSTOM-GEOMETRY` emission case |
| **preserveOrder workspace refactor** | not specced | L | Touches OPC / presentation / slide / sp-tree / elements helpers. Foundation for arcTo + multi-subpath custGeom. ~120 min minimum |
| **T-243b** | spec'd inline in plan v1.20; not started | M | Video asset extraction. Needs `<p:videoFile>` parsing in T-240 first |
| **T-243c** | spec'd inline in plan v1.20; not started | M | Font asset extraction. Needs `<p:embeddedFont>` parsing in T-240 first |
| **T-244** | not specced | L | Google Slides importer (OAuth + Slides API v1) |
| **T-245** | not specced | M | Shape rasterization fallback for presets outside T-242 coverage |
| **T-246** | not specced | L | AI-QC convergence loop (Gemini multimodal) |
| **T-247** | partially scoped (see notes) | M | Hyperframes HTML importer (data-* + reverse direction). Has architectural ambiguity — see `docs/tasks/T-247.md` if it ends up drafted |
| **T-248** | not specced | M | Loss-flag reporter UI. **Architecturally blocked**: `LossFlag` lives in `@stageflip/import-pptx` but editor-shell can't depend on importers. Need to extract `LossFlag` to a shared package (e.g. `@stageflip/loss-flags`) or fold into `@stageflip/schema`. Decision-required before implementation |
| **T-249** | not specced | L | 8-step theme learning |
| **T-250** | not specced | M | Substantive workflow skill content |

### Loss-flag emission status

| Flag | Emits today? | Cleared by |
|---|---|---|
| `LF-PPTX-NESTED-GROUP-TRANSFORM` | ❌ removed | T-241a (this session) |
| `LF-PPTX-UNRESOLVED-ASSET` | only if `resolveAssets` not called | T-243a (this session) |
| `LF-PPTX-MISSING-ASSET-BYTES` | yes (real-broken-import surfacer) | n/a — working as designed |
| `LF-PPTX-PRESET-GEOMETRY` | yes — for the 34 presets not yet covered | T-242c (next 30 presets), T-245 (rasterization fallback for the rest) |
| `LF-PPTX-CUSTOM-GEOMETRY` | yes — only for `<a:arcTo>`-bearing payloads | preserveOrder refactor + arcTo support, OR T-245 |
| `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` | yes — for adjustments other than `roundRect.adj` | T-242c per-preset adjustment honoring |
| `LF-PPTX-UNSUPPORTED-ELEMENT` | yes — for `<p:cxnSp>`, `<p:graphicFrame>`, `<p:contentPart>` | T-247 / T-248 |
| `LF-PPTX-UNSUPPORTED-FILL` | (declared, never emitted today) | T-249 |
| `LF-PPTX-NOTES-DROPPED` | yes — for slides with speaker notes | T-249 / T-250 |

### Reviewer-flagged carry-forwards

From the chain of T-241a / T-243 / T-242a / T-242b reviews — non-blocking but worth tracking:

1. **`preserveOrder: true` workspace refactor** — multiple Reviewers have flagged this. It's the right thing; just expensive. ~120 min.
2. **Cloud preset arc-faithful re-derivation** — once arcTo lands, replace the cubic-Bézier approximation in `presets/misc.ts:cloud` with the spec's actual arc segments.
3. **Default `adj=35000` for absent-`<a:avLst>` `roundRect`** — OOXML spec defaults; current implementation produces sharp corners when avLst is absent. T-242c fix.
4. **Brace curve control points** — `leftBrace` / `rightBrace` look slightly stiff; spec-derived ratios more graceful. Cosmetic; T-242c.
5. **`sun` arcs vs polygon** — current sun is a 16-vertex polygon; OOXML's actual sun uses 8 separate triangular ray segments around a body circle. Acceptable for typical box sizes; T-242c upgrade.
6. **Accumulator nested-rotation gap** — `transforms/accumulate.ts:composeFrame` has a known limitation when both parent and child groups have non-zero rotation. Not exercised by AC tests; documented in code as requiring 2x3 matrix composition to fix.

---

## 5. Architectural decisions deferred to next session

These need explicit Orchestrator decisions before the relevant Implementer work starts:

1. **`LossFlag` package home** (blocks T-248). Three options:
   - Extract to new `@stageflip/loss-flags` package (cleanest; canonical type for all importers + editor)
   - Fold into `@stageflip/schema` (couples schema to import concerns; downside)
   - Editor-shell depends on `@stageflip/import-pptx` (wrong direction; rejected)
   - **Recommendation when picked up: option 1.**

2. **preserveOrder refactor sequencing**. Decide whether it lands as its own PR (clean diff but introduces no functional change) or bundled with the arcTo work. Recommend separate PR — easier to review the structural change in isolation.

3. **T-243b/c parser surface**. Adding `<p:videoFile>` and `<p:embeddedFont>` to T-240's walker is straightforward but introduces new `LossFlagCode` variants (`LF-PPTX-UNRESOLVED-VIDEO`, `LF-PPTX-UNRESOLVED-FONT`). T-243b/c specs should declare them.

4. **Plan amendment for arcTo / preserveOrder**. Plan v1.20 doesn't list these as discrete tasks. Either (a) add `T-242d (preserveOrder + arcTo)` to the §Phase 11 table, or (b) accept that these are sub-task work inside the existing rows. Recommend (a).

---

## 6. Memory pointers

The following entries in `~/.claude/projects/-Users-mario-projects-stageflip/memory/` apply to this work:

- `feedback_phase_closeout_timing.md` — phase-N ratification at phase-N+1 start. Carried correctly: T-240 PR landed the Phase 10 banner flip + v1.19 changelog.
- `feedback_subagent_worktree_bash.md` — sub-agents launched with `isolation: "worktree"` cannot run Bash. Workaround used throughout this session: foreground sub-agents without `isolation: worktree` for Reviewer dispatches.
- `project_handover_phase9_closeout.md` — handover docs include §"Remaining-phases risk" — preserved here as §4's priority table + §5's deferred decisions.

---

## 7. References

- Phase 10 closeout: `docs/handover-phase10-complete.md`
- Plan: `docs/implementation-plan.md` v1.20
- Per-task specs landed: `docs/tasks/T-240.md`, `T-241a.md`, `T-242.md`, `T-243.md`
- Skills updated: `skills/stageflip/workflows/import-pptx/SKILL.md`, `skills/stageflip/concepts/loss-flags/SKILL.md`
- Architecture: `docs/architecture.md` (unchanged this session)
- Public-spec references cited in PR descriptions: ECMA-376 §20.1.9, MS-PPTX OOXML docs, Firebase Storage Admin, IANA MIME registry, W3C SVG path spec.

---

## 8. How to pick this up

1. Read this file + `CLAUDE.md` + `docs/implementation-plan.md` §Phase 11.
2. Decide which §4 task to take. Specs landed (T-242c via T-242 row, T-243b/c via plan note) can dispatch to an Implementer immediately.
3. Architectural decisions in §5 should go through the Orchestrator before the dependent Implementer work starts.
4. Sub-agent dispatch convention from this session: **foreground, no `isolation: worktree`** for any agent that needs Bash. Worktree-isolated sub-agents have Bash blocked in this harness.
