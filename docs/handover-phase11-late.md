---
title: Phase 11 late — handover
id: docs/handover-phase11-late
owner: orchestrator
last_updated: 2026-04-26
supersedes: docs/handover-phase11-mid.md
---

# Handover — Phase 11 late (2026-04-26)

If you are the next agent: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md` (now at v1.24). Phase 11 is **late-stage in-flight** — every spec for the foreground importer + reporter + foundational schema work is now drafted or merged; remaining work is mostly Implementer dispatches against ratified specs. **Two PRs are in flight at session end** (#196 T-251 impl, #197 source-grounded proposal); both should land cleanly with the actions in §8 below.

`main` at `2f200ae` (after PR #198 plan v1.24 merge). 17 PRs landed this session (#181 through #198 minus the two in-flight). Working tree clean on main.

---

## 1. Where we are

### Phase history

- Phases 0–10: ratified.
- **Phase 11 (Importers)** — late-stage in-flight.

### Phase 11 progression — what's now landed (full session tally)

This session shipped 17 PRs across 4 sub-phases of P11 work. Full chronology in §C.10 changelog (`docs/implementation-plan.md`); summary:

#### Sub-phase A — finishing T-242 (geometry coverage)

| PR | Title | Commit |
|---|---|---|
| [#181](https://github.com/marioberlin/stageflip/pull/181) | Plan v1.21 — T-242d + T-247-loss-flags rows added | `5f7a566` |
| [#183](https://github.com/marioberlin/stageflip/pull/183) | T-242c spec | `f669bf1` |
| [#184](https://github.com/marioberlin/stageflip/pull/184) | T-242c batch 1 — 9 presets (arrows + callouts) | `5a02994` |
| [#186](https://github.com/marioberlin/stageflip/pull/186) | T-242c batch 2 — 8 presets (banners + misc) | `ca51076` |
| [#187](https://github.com/marioberlin/stageflip/pull/187) | T-242d spec | `f47fd56` |
| [#190](https://github.com/marioberlin/stageflip/pull/190) | T-242d Sub-PR 1 — preserveOrder XML refactor | `29701d5` |
| [#191](https://github.com/marioberlin/stageflip/pull/191) | T-242d Sub-PR 2 — arcTo + chord/pie/donut | `226d85b` |

**Outcome**: 50/50 preset coverage; `LF-PPTX-CUSTOM-GEOMETRY` retired; cust-geom parser handles full M/L/C/Q/Z/arcTo command set.

#### Sub-phase B — loss-flag system extraction + reporter UI

| PR | Title | Commit |
|---|---|---|
| [#185](https://github.com/marioberlin/stageflip/pull/185) | T-247-loss-flags spec | `b5edce0` |
| [#188](https://github.com/marioberlin/stageflip/pull/188) | T-247-loss-flags impl — extract `LossFlag` to new `@stageflip/loss-flags` package | `3280984` |
| [#189](https://github.com/marioberlin/stageflip/pull/189) | T-248 spec — loss-flag reporter UI | `372e2a9` |
| [#192](https://github.com/marioberlin/stageflip/pull/192) | T-248 impl — `materializedDocumentAtom` + status-bar badge + modal | `1c9dea3` |

**Outcome**: `@stageflip/loss-flags` is the canonical home for `LossFlag` / `LossFlagCode` / `emitLossFlag`. Reporter UI is in `apps/stageflip-slide` + `@stageflip/editor-shell`. **Reporter ships INERT** — no in-app code path populates `importLossFlagsAtom` until the import-pipeline wiring follow-up lands. The atom is publicly exported.

#### Sub-phase C — importer extension specs (PPTX video + fonts)

| PR | Title | Commit |
|---|---|---|
| [#193](https://github.com/marioberlin/stageflip/pull/193) | T-243b spec — PPTX video extraction | `616b721` |
| [#195](https://github.com/marioberlin/stageflip/pull/195) | T-243c spec — PPTX embedded font extraction | `677bfe4` |

**Outcome**: both specs ratified, **awaiting Implementer dispatch**. Both follow the T-243a image-extraction precedent + use `@stageflip/loss-flags` for the new flag codes.

#### Sub-phase D — foundational schema lift + plan/proposal infrastructure

| PR | Title | Commit |
|---|---|---|
| [#194](https://github.com/marioberlin/stageflip/pull/194) | T-251 spec — deck-level layouts + masters + inheritsFrom | `9f40e6f` |
| [#196](https://github.com/marioberlin/stageflip/pull/196) | T-251 impl — schema + RIR pass + editor-shell + canvas migration | **IN FLIGHT** (Reviewer APPROVE; CI flake on goldens-priming step) |
| [#197](https://github.com/marioberlin/stageflip/pull/197) | Source-grounded providers proposal — extension to ADR-006 + ADR-007 | **IN FLIGHT** (Reviewer 2nd-pass APPROVE; ready to merge) |
| [#198](https://github.com/marioberlin/stageflip/pull/198) | Plan v1.24 — references proposal from T-415 / T-416 row text | `2f200ae` |

**Outcome (when #196 lands)**: `Document.layouts` + `Document.masters` + per-element `inheritsFrom` schema-typed; `applyInheritance(doc): Document` schema helper as single source of truth; RIR `applyInheritance` pass at front of pass list; `materializedDocumentAtom` derived atom; canvas migrated. **T-244, T-252, T-253 are no longer schema-blocked.**

**Outcome (when #197 lands)**: `docs/proposals/source-grounded-providers.md` codifies the architectural extensions ADR-006/007 must absorb when T-415/T-416 dispatch (Phase 14 α). 9 design decisions ratified up-front (D1-D9). Plan v1.24 row text on T-415/T-416 explicitly says "Required reading; fold into ADR-006/007 directly — NOT as a separate ADR-008."

### Functional state at handover write-time

When the two in-flight PRs land (likely just a re-run away on #196):

```ts
// PPTX import end-to-end (image content; video/font specs ready, impl pending):
import { parsePptx, resolveAssets, unpackPptx } from '@stageflip/import-pptx';
import { createFirebaseAssetStorage } from '@stageflip/storage-firebase';
import type { LossFlag } from '@stageflip/loss-flags';   // canonical home

const entries = unpackPptx(buffer);
const tree = await parsePptx(buffer);                    // 138+ tests passing
const storage = createFirebaseAssetStorage({ bucket });
const resolved = await resolveAssets(tree, entries, storage);

// Schema with deck-level layouts/masters:
import { documentSchema, applyInheritance } from '@stageflip/schema';
const materializedDoc = applyInheritance(parsedDoc);     // pure helper

// Editor canvas reads materialized variant:
import { materializedDocumentAtom } from '@stageflip/editor-shell';
```

The PPTX importer covers: text + images (50/50 presets + cust-geom incl. arcTo + group-transform accumulator + asset upload through Firebase). Geometry coverage commitment closed at 50.

---

## 2. Architecture that landed this session

### New packages

```
packages/loss-flags/                    # NEW (T-247-loss-flags, #188)
  src/types.ts                          # LossFlag, LossFlagSeverity, LossFlagCategory, LossFlagSource
  src/emit.ts                           # emitLossFlag — generic; same id-hash as the prior PPTX impl
  src/index.ts                          # public barrel
  Coverage: 100% on emit.ts + index.ts (types.ts is type-only).
```

### Schema additions (T-251, awaiting #196 merge)

```
packages/schema/
  src/templates.ts                      # NEW — SlideMaster + SlideLayout
  src/inheritance.ts                    # NEW — applyInheritance(doc): Document — pure, fast-path identity
  src/document.ts                       # +masters: SlideMaster[]; +layouts: SlideLayout[]
  src/content/slide.ts                  # +layoutId?: idSchema
  src/elements/base.ts                  # +inheritsFrom?: { templateId, placeholderIdx }
```

Cascade: 17 test files + 1 production file (`packages/import-slidemotion-legacy/src/index.ts`) gained mechanical `masters: []` / `layouts: []` lines because the inferred output type with `.default([])` is required.

### RIR pass (T-251, awaiting #196 merge)

```
packages/rir/src/compile/
  passes.ts                             # +applyInheritancePass — thin wrapper around schema helper +
                                        #  walks slides for LF-RIR-LAYOUT-NOT-FOUND / LF-RIR-PLACEHOLDER-NOT-FOUND
  index.ts                              # +pass at front of list (before theme-resolve / lower-tree / etc.)
packages/rir/src/types.ts:360-369       # +'apply-inheritance' to compilerDiagnosticSchema.pass enum
```

### Editor-shell + canvas (T-248 + T-251, awaiting #196 merge)

```
packages/editor-shell/src/atoms/
  import-loss-flags.ts                  # T-248 — importLossFlagsAtom + dismissedLossFlagIdsAtom +
                                        #         visibleLossFlagsAtom (sorted severity → category → source → code)
  document.ts                           # T-251 — +materializedDocumentAtom +materializedSlideByIdAtom

apps/stageflip-slide/src/components/
  status-bar/
    loss-flag-badge.tsx                 # T-248 — null when empty; severity-colored count when populated
    status-bar.tsx                      # T-248 — renders <LossFlagBadge /> slot
  dialogs/loss-flag-reporter/
    loss-flag-reporter.tsx              # T-248 — modal; sorted by severity → category → source → code
    loss-flag-row.tsx                   # T-248 — per-flag row + navigate-to-location + dismiss
  canvas/
    slide-canvas.tsx                    # T-251 — reads materializedDocumentAtom (was documentAtom)
```

### Cust-geom parser (T-242d, merged)

```
packages/import-pptx/src/
  opc.ts                                # +preserveOrder: true config; +firstChild/children/allChildren/
                                        #  tagOf/attrs/attr helpers
  parts/{presentation,slide,sp-tree}.ts # adopted helpers; no callsite indexes raw :@ / @_
  elements/{shape,text,picture}.ts      # adopted helpers (Implementer found these had direct indexing
                                        #  despite the spec assuming they went through shared.ts)
  geometries/cust-geom/parse.ts         # +arcTo handling (ECMA-376 §20.1.9.3); +pen-position state
  geometries/presets/basics.ts          # +chord/pie/donut with real arcs (not Bézier)
```

138 tests in `@stageflip/import-pptx`; 50/50 preset coverage.

### Plan / proposal docs

```
docs/proposals/source-grounded-providers.md   # NEW (#197) — 9 ratified decisions D1-D9
docs/handover-phase11-late.md                  # this file
docs/tasks/T-242c.md, T-242d.md, T-243b.md,    # NEW — per-task specs
  T-243c.md, T-247-loss-flags.md, T-248.md,
  T-251.md
```

---

## 3. Test / coverage state at handover write-time

Latest measured (pending #196 merge for T-251 deltas):

| Package | Tests | Coverage notes |
|---|---|---|
| `@stageflip/import-pptx` | 138 | 50/50 preset coverage; cust-geom M/L/C/Q/Z/arcTo |
| `@stageflip/loss-flags` | 33 | 100% on emit.ts + index.ts |
| `@stageflip/editor-shell` | 386 (+3 from T-248, +3 from T-251 atoms) | atoms/import-loss-flags + atoms/document |
| `@stageflip/app-slide` | 341 (+1 from T-251 canvas, +16 from T-248 reporter) | canvas + reporter + status-bar |
| `@stageflip/schema` | 125 (+33 from T-251 templates + inheritance + roundtrip) | 100% statements on templates + inheritance |
| `@stageflip/rir` | 44 (+8 from T-251 apply-inheritance pass) | new pass coverage ≥90% |
| `@stageflip/storage-firebase` | 8 | unchanged this session |

All §8 gates green per-PR. Two CI surfaces had issues this session:
- **skills-sync drift** on PR #196 — fixed by running `pnpm skills-sync` (chore commit `b0069c5`).
- **`@stageflip/app-docs#build` sharp resolution failure** on PR #196's render-e2e workspace-build step — fixed by configuring Astro's no-op image service (`6128d5b`). **Pre-existing CI bug, not a T-251 regression.** See §6 for diagnostic.

---

## 4. What's left in P11

### Specs READY for Implementer dispatch (no further spec work needed)

| Task | Spec PR | Cost | Notes |
|---|---|---|---|
| **T-243b** — PPTX video extraction | #193 (merged) | M | Mechanical; mirrors T-243a image precedent |
| **T-243c** — PPTX embedded font extraction | #195 (merged) | M | Mechanical; deck-level vs per-element |
| **T-251 impl** | #196 (in-flight) | L | If #196 merges first session, drop from this list |

### Specs needing AUTHORING

| Task | Cost (spec) | Cost (impl) | Notes |
|---|---|---|---|
| **T-244** — Google Slides import (pixel-perfect) | M | L | **Highest leverage now** — T-251 unblocks it. PR #180 already revised the row text with full PaddleOCR + OpenCV + SAM 2 + Gemini fallback architecture. |
| **T-253** — export-pptx placeholder-inheritance rider | S | M | Small follow-on to T-251; updates `@stageflip/export-pptx` to write `<p:sldLayout>` / `<p:sldMaster>` parts |
| **T-245** — slide rasterization primitive | S | M | Promoted in v1.23 from "crop unsupported shapes" to shared primitive |
| **T-246** — AI-QC inverted convergence loop | M | L | Classical CV first, Gemini per-element fallback; depends on T-244 |
| **T-252** — export-google-slides | M | L | Render-diff convergence loop; depends on T-244 + T-245 + T-251 |
| **T-247** — Hyperframes HTML importer | S | M | Lower priority |
| **T-249** — design-system / 8-step theme learning | M | L | Could bleed into P12 |
| **T-250 [rev]** — workflow + export skill content | — | M | Skill content authoring |

### Orphan follow-ups (small; can land any time)

- **T-248 wiring** — `parsePptx → setImportLossFlagsAtom`. Reporter ships INERT until this lands. ~30 minutes of work.
- **ModalShell focus-trap** — deferred from T-248 AC #19; touches every modal in the app.
- **i18n typed-catalog migration** — escalated by T-248 Implementer; `t(key: string)` accepts any string today; should be `keyof typeof CATALOG`. 21 `lossFlags.*` keys would catch typos at typecheck.
- **LossFlag.id TSDoc fix** — chipped earlier in session; pre-existing inaccuracy in TSDoc claims hash material is `source + category + location + originalSnippet` but actual is different.
- **cloud + cloudCallout arc-faithful re-derivation** — deferred from T-242d; Bézier → real arcs now possible with arcTo support.

---

## 5. Architectural decisions made / pending this session

### Ratified this session (in spec PR bodies + plan v1.24 + proposal D-numbers)

| ID | Where | Decision |
|---|---|---|
| LossFlag package home | T-247-loss-flags spec (#185) | New `@stageflip/loss-flags` package; not folded into schema. |
| preserveOrder refactor sequencing | T-242d spec (#187) | Standalone PR before arcTo (Sub-PR 1 → Sub-PR 2). |
| Reporter scope: ships INERT in v1 | T-248 spec (#189) | Wiring is a follow-up; atom is publicly exported. |
| `.default([])` cascade for new schema fields | T-251 impl (#196) | Cleaner runtime semantics over per-consumer undefined-checks; 17-file mechanical cascade is acceptable one-time cost. |
| `materializedDocumentAtom` separation | T-251 impl (#196) | Render surfaces use materialized; mutation surfaces (selection, undo, edit) keep raw `documentAtom` to avoid persisting inherited fields. |

### Ratified for FUTURE Phase 14 α work (in proposal #197 + plan v1.24)

| ID | Decision |
|---|---|
| **D1** | Source refresh: replace in place with content-hash provenance (option a) |
| **D2** | Session lifetime = project lifetime (set-once-at-creation UX is the unlock) |
| **D3** | Optional grounding falls through to creative providers when `Document.research` empty |
| **D4** | One research provider per project for v1 |
| **D5** | Per-modality adapter declares `requiresResearchProvider` (manifest-time linkage) |
| **D6** | Capability descriptor uses boolean `sourceGrounded` flag (not discriminated union); future per-call-grounded providers added via `groundingMode?: 'session' \| 'per-call'` additively |
| **D7** | Per-call grounding override: `groundingOverride: 'auto' \| 'force-grounded' \| 'force-creative'` parameter on every generation tool |
| **D8** | `replaceSource` in-flight semantics: post-replace bytes (no snapshot); provenance records actual bytes consumed |
| **D9** | `LF-RESEARCH-SESSION-RECONNECTED` demoted from loss flag to UI toast notification (successful reconnect is a notice, not a loss) |

### NOT yet ratified (open architecture questions for next session)

- None blocking the next dispatch. T-244 spec authoring will surface T-244-specific decisions (e.g., where the PaddleOCR / OpenCV / SAM 2 binaries live — workspace dep vs. plugin vs. server-side).

---

## 6. Workflow conventions established / refined this session

These supersede or extend the conventions in `docs/handover-phase11-mid.md` §6:

1. **Single foreground Implementer at a time in the shared worktree.** Two concurrent Implementers in the same checkout do not work — saved as `feedback_subagent_shared_worktree.md` after observing severe collision pain. Per-PR sequence: Implementer dispatches, completes, returns; only then does the next Implementer dispatch.
2. **Reviewers ARE safe to run in parallel** — they're read-only. Dispatch multiple Reviewers concurrently in background; they don't collide with each other or with one running Implementer.
3. **Worktree pattern for parallel main-thread docs work** while a sub-agent runs. `git worktree add /Users/mario/projects/stageflip-<name> <branch>` creates an isolated checkout. `git -C /path/to/worktree …` for git ops avoids `cd` side effects on main thread's CWD. Clean up with `git worktree remove`.
4. **Always include explicit "checkout main first" guard** in Implementer dispatch prompts — even when a single Implementer runs, the worktree's HEAD position at dispatch time may be unexpected.
5. **Per-task spec lives at `docs/tasks/T-XXX.md`**. Established last session, applied universally this session.
6. **Two-commit convention** (test scaffolding → implementation) holds for most Implementers; concurrency churn forced 3-4 commit splits in two cases (T-242d Sub-PR 2, T-248). Acceptable when documented; bisectability mildly degraded.
7. **Reviewer-driven cleanup commits** land on the same Implementer branch, **NOT** as separate PRs.
8. **Plan amendments** (v1.21 → v1.22 → v1.23 → v1.24) land as standalone "[plan] vX.Y — …" PRs whenever the plan needs updating.
9. **Proposals** (vs. ADRs) live in `docs/proposals/`. Use this when the architectural extension needs to land BEFORE the foundational ADR is written. Pattern proven this session with `source-grounded-providers.md` informing future ADR-006/007.
10. **CI's render-e2e path filter** (`packages/schema/**` + `packages/rir/**` + `packages/runtimes/**` + others) triggers a full `pnpm build` of the workspace. Any PR touching these surfaces will surface app-docs build issues — **app-docs's Astro now uses the no-op image service** to avoid sharp resolution (per T-251 impl fixup `6128d5b`).

---

## 7. CI / environment notes

- **Sharp / Astro fix landed**: PR #196's commit `6128d5b` configures `apps/docs/astro.config.mjs` with `image: { service: { entrypoint: 'astro/assets/services/noop' } }`. This avoids the rollup-resolve-import failure when the workspace's `pnpm-lock.yaml` `ignoredOptionalDependencies` excludes sharp (which it does, by design). **No future PR should hit the sharp resolution issue.**
- **Goldens-priming Puppeteer flake**: PR #196's render-e2e step "Prime parity-fixture goldens (real render)" hit `Page.captureScreenshot timed out` after the sharp fix landed. This is **unrelated to the schema changes** — `e2e (Playwright smoke)` and `parity (fixture scoring)` both pass; only the optional goldens-priming step times out. **Re-run will likely clear it.** See §8 step 1.
- All other gates green per-PR (typecheck, lint, test, check-licenses, check-remotion-imports, check-determinism, check-skill-drift, size-limit, changeset).

---

## 8. **How to pick this up — explicit next-action prompts**

### Step 1: Land the two in-flight PRs (do this FIRST)

```
1. Re-run PR #196's render-e2e:
     gh run rerun <latest-run-id-on-#196> --failed

   The Puppeteer screenshot-timeout flake usually clears on retry.

2. When PR #196's CI is green, merge:
     gh pr merge 196 --squash --delete-branch

3. Sync main:
     git checkout main && git pull --ff-only

4. Merge PR #197 (source-grounded providers proposal):
     gh pr merge 197 --squash --delete-branch
     git pull --ff-only
```

### Step 2: Dispatch T-243b Implementer (mechanical, fast win)

Background Agent dispatch. Use this prompt verbatim (extends the proven T-243a/T-242c pattern):

> **Agent type**: `general-purpose`
> **Description**: T-243b Implementer (PPTX video extraction)
> **run_in_background**: `true`
> **Prompt** (briefing — substitute the actual main commit SHA at dispatch time):
>
> You are the Implementer for **T-243b** — adding `<p:videoFile>` parsing + `resolveAssets` video branch to `@stageflip/import-pptx`. Repo: `/Users/mario/projects/stageflip`. Main is at commit `<SHA>`.
>
> **Critical first git operation**: `git checkout main && git checkout -b task/T-243b-pptx-video-extraction`. Do NOT start with `git checkout -b` alone.
>
> Read in order:
> 1. `CLAUDE.md` (project rules)
> 2. `docs/tasks/T-243b.md` — your spec (17 ACs across parser layer / asset-resolution / end-to-end / coverage+gates)
> 3. `docs/tasks/T-243.md` (image precedent) for architectural framing
> 4. `packages/import-pptx/src/elements/picture.ts` (the parser to mirror)
> 5. `packages/import-pptx/src/assets/resolve.ts` (the resolution flow you extend)
>
> Two-commit pattern: tests-first scaffolding, then implementation. 3 changesets only on `@stageflip/import-pptx` (`minor` bump).
>
> **Critical correctness pins**:
> - AC #4 (External `r:link` case): emits `LF-PPTX-UNSUPPORTED-ELEMENT` with `originalSnippet: 'external video URL'`, NOT a `ParsedVideoElement`.
> - AC #3 (Walker dispatch positive case): shape with body + `<p:videoFile>` emits exactly **one** `ParsedVideoElement` and **zero** `ParsedShapeElement`; shape body dropped + one `LF-PPTX-UNSUPPORTED-ELEMENT` flag.
> - AC #13: pin all 6 added MIME entries (`.mp4` / `.m4v` / `.mov` / `.webm` / `.avi` / `.wmv`).
>
> Report back with: PR URL, gate counts (especially `pnpm --filter @stageflip/import-pptx test` count vs the pre-T-243b count of 138), AC #4 + AC #3 test pins, deviations from spec, branch-collision observations.

After this Implementer returns: dispatch a Reviewer (also background, foreground+no-worktree-isolation per session convention), apply any cleanup, merge.

### Step 3: Author T-244 spec in worktree (in PARALLEL with step 2 — different surfaces)

While the T-243b Implementer runs in background, author the T-244 spec on a sibling worktree. T-244 is the foundational Google Slides import — biggest unlock now that T-251 has merged.

```
git worktree add /Users/mario/projects/stageflip-T-244-spec main -b task/T-244-spec
```

Author `docs/tasks/T-244.md` in the worktree. The plan row at `docs/implementation-plan.md:532` (after PR #180's revision) already contains the substantive content:

- Pixel-perfect import via `presentations.get` + per-slide rendered PNG at fixed render resolution
- Pixel-candidate pass: PaddleOCR (text-line/word polygons + OCR text) + OpenCV (`findContours` + `connectedComponentsWithStats`) + optional SAM 2 (logos / icons / illustrations)
- Match candidates to `objectId`s via text-content equality + center-inside containment + z-order plausibility
- Native grouping: emit `GroupElement` for `elementGroup`, `TableElement` for tables, `inheritsFrom` for placeholders (now possible thanks to T-251)
- New loss flags: `LF-GSLIDES-PADDING-INFERRED`, `LF-GSLIDES-FONT-SUBSTITUTED`, `LF-GSLIDES-IMAGE-FALLBACK`, `LF-GSLIDES-LOW-MATCH-CONFIDENCE`, `LF-GSLIDES-PLACEHOLDER-INLINED`, `LF-GSLIDES-TABLE-MERGE-LOST`
- Gemini multimodal fallback (T-246) resolves only deterministic-match failures
- License-vet PaddleOCR / OpenCV / SAM 2 (all Apache-2.0) via `pnpm check-licenses`

Spec scope to lock in:
- Where do PaddleOCR / OpenCV / SAM 2 binaries live? Workspace dep vs. plugin vs. server-side service?
- Image-fallback rasterization is T-245 territory — T-244 declares dependency without re-specifying
- Pixel-candidate pipeline is the heart of the spec — needs concrete fixtures + AC pins
- The two pre-flight audits T-251 confirmed (`GroupElement` preservation, `TableElement` merged-cell support) carry forward

Style baseline: `docs/tasks/T-251.md` (the most recent L-sized multi-package spec).

After authoring: commit + push from worktree, open PR, dispatch Reviewer, apply cleanup, merge.

### Step 4 (after both T-243b lands AND T-244 spec merges): Continue the cascade

In rough priority order:

1. **T-243c Implementer** (after T-243b lands; specs are nearly identical — same Implementer can pick up the pattern fast)
2. **T-244 Implementer** (after T-244 spec merges; L-sized, biggest single dispatch)
3. **T-253 spec + impl** (small follow-on to T-251 — add `<p:sldLayout>` / `<p:sldMaster>` writers to `@stageflip/export-pptx`)
4. **T-245 spec + impl** (slide rasterization primitive)
5. **T-248 wiring follow-up** (parsePptx → atom — small, makes reporter actually work end-to-end)
6. **T-246 spec + impl** (AI-QC convergence loop; depends on T-244)
7. **T-252 spec + impl** (export-google-slides; depends on T-244 + T-245 + T-251)
8. **T-247 spec + impl** (Hyperframes HTML)
9. **T-249, T-250** (lower priority)

After ~3 more major dispatches (T-244 + T-253 + T-247 or similar), Phase 11 will be approaching closeout territory. Per `feedback_phase_closeout_timing.md`, the P11 closeout handover lands at **Phase 12 start**, not at the last P11 PR.

---

## 9. Memory pointers

The following entries in `~/.claude/projects/-Users-mario-projects-stageflip/memory/` apply:

- `feedback_phase_closeout_timing.md` — phase-N closeout at phase-N+1 start. Carry-forward.
- `feedback_subagent_worktree_bash.md` — `isolation: worktree` agents can't run Bash. Affects Implementer dispatch (must be foreground).
- `feedback_subagent_shared_worktree.md` — UPDATED THIS SESSION. Two failure modes documented: Mode 1 (main thread vs. one Implementer — recoverable) and Mode 2 (two concurrent Implementers — severely painful). Recommends single-Implementer-at-a-time + worktree pattern for parallel docs work.
- `project_handover_phase9_closeout.md` — handover docs include §"Remaining-phases risk" — preserved here as §4's task list + §5's decision log + §8's next-action prompts.

---

## 10. References

- Plan: `docs/implementation-plan.md` (now v1.24)
- Per-task specs landed this session: `docs/tasks/T-242c.md`, `T-242d.md`, `T-243b.md`, `T-243c.md`, `T-247-loss-flags.md`, `T-248.md`, `T-251.md`
- Proposals: `docs/proposals/source-grounded-providers.md` (in flight, #197)
- Skills updated: `skills/stageflip/workflows/import-pptx/SKILL.md`, `skills/stageflip/concepts/loss-flags/SKILL.md`, `skills/stageflip/concepts/rir/SKILL.md`, `skills/stageflip/concepts/schema/SKILL.md`
- ADRs: ADR-001 through ADR-005 ratified; ADR-006 (T-415) + ADR-007 (T-416) unbuilt; T-415/T-416 row text (post-v1.24) cites the source-grounded proposal as required reading
- Architecture: `docs/architecture.md` (unchanged this session)
- Public-spec references cited in PR descriptions: ECMA-376 §19.5.41 / §19.2.1.5 / §20.1.9.3, W3C SVG 2 §9.3.8, IANA media-types, Google Slides API REST v1, Astro image-service docs

---

## 11. Risks / known unknowns

1. **Sharp / Astro fix is landed but untested at scale**. The `image: { service: { entrypoint: 'astro/assets/services/noop' } }` config means app-docs cannot process images — if any future docs page adds an `<Image>` component, that page won't render. v1 docs don't use images; flag for review when adding doc images.
2. **Render-e2e Puppeteer screenshot-timeout flake** observed at session end. Probably transient. If it recurs: investigate `protocolTimeout` in puppeteer launch options at `packages/parity-cli/src/...` (not investigated this session).
3. **Reporter UI ships INERT** until T-248 wiring follow-up lands. Don't let that drift across Phase 12 boundary.
4. **17-file `masters: []` / `layouts: []` cascade** in T-251 — future schema additions following the same `.default([])` pattern will recreate the cost. Consider a Document-literal helper in `packages/editor-shell/src/test-fixtures/` if it becomes recurring pain (Reviewer's non-blocking observation #3 on T-251).
5. **`expandComponents` pass-order vs. `applyInheritance`** — today's `expandComponents` is a stub so order doesn't matter. T-249 (theme learning) may add component bodies that themselves use `inheritsFrom`, which would require flipping the order. Documented in `passes.ts` + T-251 Notes #6.
6. **Source-grounded proposal absorption** — PR #197 lands as a proposal in `docs/proposals/`. When T-415/T-416 dispatch (Phase 14 α — likely months from now), the Implementer reads the v1.24 plan row text + the proposal and folds the concepts into ADR-006/007 directly. The proposal then moves to `docs/proposals/archive/`. **Risk**: if T-415/T-416 dispatch much later, the proposal may be slightly stale by then; Implementer should validate D6-D9 still hold.

---

**Start at §8 ("How to pick this up — explicit next-action prompts"). Good luck.**
