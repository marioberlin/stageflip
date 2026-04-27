---
title: Phase 11 late (session 2) — handover
id: docs/handover-phase11-late-2
owner: orchestrator
last_updated: 2026-04-26
supersedes: docs/handover-phase11-late.md
---

# Handover — Phase 11 late, session 2 (2026-04-26)

If you are the next agent: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md`. Phase 11 is **late-stage**: every remaining task has a merged spec; closeout is purely Implementer dispatches. **One Implementer is in flight at session end** (T-247, see §8); after it lands, the remaining queue is 4 Implementers + 1 docs-only sweep, all parallel-safe.

`main` at `28c8d35`. **19 PRs landed this session** (#196 → #218 across foundational schema, Google Slides triad, references/ tier convention, theme/sweep specs, Hyperframes import — plus 2 hotfixes #210 + #217). Working tree clean on main.

---

## 1. Where we are

### Phase history

- Phases 0–10: ratified.
- **Phase 11 (Importers)** — late-stage; closeout reachable in ~5-6 more dispatches.

### Session 2 tally — what landed (chronological)

This session shipped 19 PRs across the foundational + Google-Slides + theme-learning + Hyperframes sub-phases. Summary:

#### Sub-phase A — Foundational schema + PPTX completion

| PR | Title | Notes |
|---|---|---|
| #196 | [T-251] schema deck-level layouts + masters + inheritsFrom | Foundational schema lift; `applyInheritance` helper in `@stageflip/schema`; RIR pass; `materializedDocumentAtom` in editor-shell; pre-flight audits confirmed for `GroupElement` + `TableElement` |
| #197 | source-grounded providers proposal | ADR-006/007 extension (NotebookLM-class research providers); proposal doc only, not yet absorbed |
| #201 | [T-243b] @stageflip/import-pptx — PPTX video extraction | `<p:videoFile>` parsing + `resolveAssets` video branch; 6 new MIME types; AC #4 external-URL handling pinned |
| #202 | [T-243c] @stageflip/import-pptx — `<p:embeddedFont>` parsing + resolveAssets font walk | Bonus fix in `transforms/accumulate.ts` for `assetsResolved` + `embeddedFonts` pass-through |

#### Sub-phase B — Google Slides triad + ancillaries

| PR | Title | Notes |
|---|---|---|
| #200 | [T-244 spec] @stageflip/import-google-slides | Foundational Google Slides import spec; 44 ACs across 9 layers; cleanup PR addressed Reviewer's `composeAffines` cross-package extraction objection + `getThumbnail` URL correction |
| #208 | [T-244] @stageflip/import-google-slides — OAuth + Slides API v1 + native grouping + render-PNG pixel matching | Hand-rolled API client (no `googleapis` dep, ~3MB savings). 0 → 74 tests; bundle 18.1 KB gz vs 60 KB budget. CI hit a lint regression (#205-introduced); fixed by hotfix #210 |
| #210 | hotfix(export-pptx): biome formatter regression from #205 | Single-line `meta:{...}` triggered Biome's CI rejection that local check passed. Memory updated (`feedback_biome_format_before_commit.md`) |
| #203 | [T-253-base + rider specs] @stageflip/export-pptx | Discovered T-253 plan-row's faulty premise (riding on a non-existent foundation). Split into base (M, foundation) + rider (S, write-back) |
| #204 | [T-245 spec] @stageflip/rasterize | New shared package decision (vs. burying in import-google-slides). Pure-TS via `pngjs` (already in workspace). 29 ACs |
| #205 | [T-253-base] @stageflip/export-pptx — foundational PPTX writer | 0 → 40 tests; deterministic-bytes contract via `fflate level: 6 + uniform mtime`; 6 LF-PPTX-EXPORT-* codes (later 7th added in cleanup); image-background-fallback gap surfaced as a Reviewer-flagged hotfix |
| #206 | [T-247 spec] @stageflip/import-hyperframes-html | Bidirectional importer/exporter spec for Hyperframes HTML ↔ Document (video mode). 36 ACs. Reviewer-corrected for `transformSchema` shape (no `anchor`/`scale` fields) and source convention (`'hyperframes-html'` long form) |
| #207 | [T-246 spec] @stageflip/import-google-slides AI-QC convergence | Single-pass per-residual Gemini call. Reviewer flagged contract gap with T-244 (`pageImageCropPx` is bbox-only); T-246 spec amended to require T-244 to attach `tree.pageImagesPng` |
| #209 | [T-252 spec] @stageflip/export-google-slides render-diff convergence loop | Closing piece of Google Slides triad. 3 tier modes (fully-editable / hybrid / pixel-perfect-visual). 8 LF-GSLIDES-EXPORT-* codes |
| #211 | [T-244-cv-worker spec] services/cv-worker — Python CV sidecar | Infra-only (no TS code). FastAPI + PaddleOCR + OpenCV (+ optional SAM 2). Cloud Run deployment script per T-231 pattern |
| #212 | [T-245] @stageflip/rasterize — slide rasterization primitive | 0 → 52 tests; 97.81% coverage; 1.45 KB gz. Spec-vs-API deviation: `pngjs.constants.PNG_ALL_FILTERS` doesn't exist in pngjs 7.0.0; used `-1` sentinel (byte-identical) |

#### Sub-phase C — Convention work + theme-learning + workflow-skills sweep

| PR | Title | Notes |
|---|---|---|
| #213 | docs(skills): introduce references/ tier convention + 2 seed docs (huashu-inspired) | Codifies the convention for shipping a sibling `references/` tier next to a SKILL.md. Two seed docs: `pptx-constraints.md` (Q&A) + `render-pitfalls.md` (failure modes). Inspired by huashu-design's `references/` tier (~7K lines / 20 docs) |
| #217 | hotfix(skills): references-tier SKILL.md frontmatter | The references-tier convention SKILL.md initially used `name:`+`description:` frontmatter (huashu-style); StageFlip validator expects canonical `title/id/tier/...` shape. CI on #213 was green due to env divergence; hotfix repaired the regression |
| #214 | [T-249 spec] @stageflip/design-system — 8-step theme learning pipeline | Plan-row was terse ("8-step theme learning pipeline"); spec defines the 8 steps concretely + flags 4 architectural assumptions Reviewer ratified. 33 ACs. L-sized |
| #215 | [T-250 spec] workflow-skills sweep — import / export / concepts updates | Docs-only sweep across 7 workflow + concept skill files. 18 ACs. M-sized. Reviewer-confirmed sequencing: dispatch ONLY after T-247 + T-253-rider merge |
| #216 | [T-253-rider] @stageflip/export-pptx — placeholder-inheritance write-back | 43 → 68 tests in export-pptx; 125 → 133 in schema (`compareToPlaceholder` helper added). 3 new LF-PPTX-EXPORT-* codes. Round-trip `placeholder-inheritance-deck.json` fixture |
| #218 | [T-247] @stageflip/import-hyperframes-html — bidirectional HTML ↔ canonical (video mode) | 0 → 94 tests; 92-94% coverage on entry files; 5.71 KB gz vs 30 KB budget. All 6 round-trip fixtures pass. Bidirectional in one PR. 6 new `LF-HYPERFRAMES-HTML-*` codes. Hand-rolled inline-style parser; parse5 + no other deps. Spec corrections from PR #206 cleanup landed cleanly (no `transform.anchor`/`scale`; `'hyperframes-html'` source long form) |

### Workspace test counts (post all merges including T-247)

| Package | Before session | After session | Δ |
|---|---|---|---|
| `@stageflip/schema` | 125 | 133 | +8 (compareToPlaceholder) |
| `@stageflip/import-pptx` | 138 | 192 | +54 (T-243b/c) |
| `@stageflip/export-pptx` | 0 (stub) | 68 | +68 (T-253-base + rider) |
| `@stageflip/import-google-slides` | 0 (stub) | 74 | +74 (T-244) |
| `@stageflip/rasterize` | 0 (new pkg) | 52 | +52 (T-245) |
| `@stageflip/import-hyperframes-html` | 0 (stub) | 94 | +94 (T-247) |

Total new tests: **+350**. No regressions on any pre-existing package.

---

## 2. Phase 11 ledger — what's done, what remains

### Done implementations (16 tasks)

T-240, T-241a, T-242, T-242c, T-242d, T-243a, T-243-storage-adapter, T-243b, T-243c, T-247-loss-flags, T-248, T-251, T-253-base, **T-244**, **T-245**, **T-253-rider**, **T-247**.

### Implementations pending (5)

| Task | Size | Spec | Notes |
|---|---|---|---|
| T-246 | L | `docs/tasks/T-246.md` | AI-QC convergence loop (Gemini multimodal); requires T-244 amendment to attach `tree.pageImagesPng` per spec line 36 |
| T-252 | L | `docs/tasks/T-252.md` | export-google-slides render-diff convergence loop; 3 tier modes |
| T-249 | L | `docs/tasks/T-249.md` | design-system 8-step theme learning |
| T-250 | M | `docs/tasks/T-250.md` | workflow-skills sweep (docs-only); T-247 + T-253-rider merged so Reviewer's sequencing condition is met — can dispatch anytime |
| T-244-cv-worker | S | `docs/tasks/T-244-cv-worker.md` | Python CV sidecar (infra-only); could be deferred to ops backlog if production CV path isn't critical |

### Phase 11 closeout reachability

4 dispatches if T-244-cv-worker is deferred (3 if T-250 is rolled into a closeout PR). Estimated ~3 hours of focused work. Per `feedback_phase_closeout_timing.md`, the P11 closeout handover lands at **Phase 12 start**, not at the last P11 PR.

---

## 3. Architectural decisions ratified this session

### `references/` tier convention (PR #213)

A sibling `references/` directory next to a SKILL.md ships when the surface complexity warrants. Templates: constraints / pitfalls / patterns / case-study. Discoverability requires the parent SKILL.md to link the tier. **First seeds**: `reference/export-pptx/references/pptx-constraints.md` + `reference/renderer-cdp/references/render-pitfalls.md`.

When to add: SKILL.md approaching 500 lines + 30%+ concrete details; Implementers consistently hit issues the skill doesn't enumerate; same edge case in multiple Reviewer rounds; constraints catalogue >10 entries.

### Hand-rolled Google API clients (T-244 precedent → T-252 + T-249 + T-244-cv-worker)

T-244 implementer chose to hand-roll the strict subset of `presentations.get` and `presentations.pages.getThumbnail` response types in `packages/import-google-slides/src/api/types.ts` rather than depending on `googleapis` (~3 MB transitive surface). Pattern is now ratified — T-252 spec, T-249 spec, T-244-cv-worker spec all follow it. **Future Google API consumers should hand-roll unless the surface area is large.**

### `compareToPlaceholder` schema helper (T-253-rider)

Sibling export to `applyInheritance` in `@stageflip/schema/src/inheritance.ts`. Returns `{suppressKeys, mismatch}`. Used by T-253-rider's writer for override-suppression on slide elements that match their placeholder. Whole-or-nothing on `transform`; never suppresses `animations: []` (Zod default). **Future template-aware consumers reuse this helper.**

### 4 architectural assumptions ratified for T-249

Per PR #214 Reviewer: SOUND on all 4.
1. **8-step decomposition** for generic applicability.
2. **In-place mutation** of input Document (vs. sidecar) — `colorValueSchema` accepts both literals and `theme:foo.bar` refs in the same field.
3. **Google Fonts only** as font source (T-249-fonts-extended for vendor-private).
4. **k-means in Lab color space** with `kMeansSeed` for determinism.

---

## 4. Memory updates this session

The auto-memory system (`/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/`) gained two new entries:

### `feedback_biome_format_before_commit.md`

CI biome can surface formatting issues that local `pnpm lint` (which runs `biome check`) didn't catch — specifically multi-line wrapping triggered past line-length thresholds. Always run `biome format --write src/` on touched files before committing. Symptom: PR #205's `meta: {single-line, blocks}` passed local but failed CI; downstream PRs (#208) Turbo-invalidated the cache and surfaced the regression.

**Why it matters for next agent**: when an Implementer reports "all gates green" but their PR's CI fails on lint, the cause is often this. Run `biome format --write` per touched file; don't trust `pnpm lint` passing locally as evidence CI will pass.

### `feedback_subagent_shared_worktree.md` (updated)

Added: "Merging an unrelated PR while an Implementer runs is NOT safe." It feels safe (the merge happens remotely) but `gh pr merge ... && git checkout main && git pull --ff-only` does a HEAD switch on the shared tree mid-Implementer-work. Recovery: `git checkout <implementer-branch>` to restore HEAD; the modifications follow.

**Why it matters for next agent**: this session, I caused this foot-gun once when merging the T-245 spec PR while the T-253-base Implementer was running. Recovery worked but the Implementer's uncommitted work briefly appeared on `main`. **Rule**: even for "just syncing main" after merging an unrelated PR, defer until the Implementer reports back, OR do the merge from a separate worktree.

---

## 5. References/ tier seeds — for future expansion

Per PR #213's adoption status section, future skills earn a `references/` tier when complexity warrants:

- `skills/stageflip/workflows/import-pptx/references/` — gotchas observed across T-243a/b/c (multiple Reviewer rounds on rel resolution, content-type inference, walker dispatch order)
- `skills/stageflip/workflows/import-google-slides/references/` — T-244 fixture patterns + CV provider stub conventions
- `skills/stageflip/concepts/loss-flags/references/` — code emission patterns
- `skills/stageflip/reference/renderer-cdp/SKILL.md` — currently no parent SKILL.md (only the references/ subtree); would close the "references precede SKILL.md" gap noted in the convention doc

Add incrementally per the convention's "earn its place" rule.

---

## 6. How to pick up — explicit next-action prompts

### Step 1: Verify session-end state

```bash
git checkout main && git pull --ff-only
git log --oneline -3
# Should show: latest commits include T-247 merge (if landed) or its branch HEAD on origin
gh pr list --state open
# Should show: 0 open PRs (or just T-247 if still in flight at handover write time)
pnpm typecheck && pnpm lint && pnpm test
# Should be green on all packages
```

### Step 2: Check T-247 outcome (was running at session end)

```bash
gh pr view 218
# (PR number may differ; the T-247 Implementer was dispatched at agent id a010ea48418e703c4)
```

If the T-247 PR is open and CI green, the next session merges it via `gh pr merge --squash --delete-branch`, then proceeds to Step 3. If it's failed CI, investigate (likely lint or test count regression — see §4 memory updates for the failure-mode pattern).

### Step 3: Dispatch the remaining Implementers in priority order

#### Step 3a: T-246 Implementer (L; AI-QC convergence)

Background dispatch, foreground+no-worktree-isolation per session convention. Use this prompt verbatim (substitute the actual main commit SHA at dispatch time):

> **Agent type**: `general-purpose`
> **Description**: T-246 Implementer (AI-QC convergence loop)
> **run_in_background**: `true`
> **Prompt** (briefing — substitute the actual main commit SHA at dispatch time):
>
> You are the Implementer for **T-246** — converting `@stageflip/import-google-slides`'s residual handling into a Gemini-multimodal post-walk pass. Repo: `/Users/mario/projects/stageflip`. Main is at `<SHA>`.
>
> **Critical first git operation**: `git checkout main && git checkout -b task/T-246-ai-qc-convergence-loop`. Do NOT start with `git checkout -b` alone.
>
> **Critical contract gap to address in commit 1**: T-246 spec line 36 documents that T-244's emission does NOT include `tree.pageImagesPng` (the page PNG bytes Gemini needs for cropping). The T-246 Implementer's first commit must amend T-244's emission in `packages/import-google-slides/src/parseGoogleSlides.ts` to attach `tree.pageImagesPng: Record<slideId, {bytes, width, height}>`. Confirmed during T-244 Reviewer round (PR #208) — the Implementer left `pendingResolution` with bbox-only metadata; T-246 needs the bytes.
>
> Read in order:
> 1. `CLAUDE.md` (project rules)
> 2. `docs/tasks/T-246.md` — your spec (37 ACs across multimodal extension / public surface / per-element prompt / response validation / writeback / cost cap / loss flags / ordering+determinism / back-compat / coverage)
> 3. `docs/tasks/T-244.md` — sibling importer; verify `PendingMatchResolution` shape T-246 consumes
> 4. **`skills/stageflip/reference/export-pptx/references/pptx-constraints.md`** — references/ tier convention example; consider whether T-246 should ship a `references/` tier
> 5. `packages/llm-abstraction/src/types.ts` (extends `LLMContentBlock` with `image` variant) + `errors.ts` (extends `LLMErrorKind` with `'unsupported'`)
> 6. `packages/llm-abstraction/src/providers/{google,anthropic,openai}.ts` (Google gains image-block translation; Anthropic + OpenAI throw)
>
> **Critical correctness pins**:
> - `tree.pageImagesPng` attachment in `parseGoogleSlides.ts` (commit 1 — see above).
> - Multimodal extension to `@stageflip/llm-abstraction`: `LLMContentBlock` adds `{type: 'image'; mediaType; data}`; `LLMErrorKind` adds `'unsupported'`. Bundled in this PR per spec §1.
> - Single-pass per residual (NOT iterative) per spec §6.
> - `acceptThreshold: 0.85` default (higher than T-244's 0.78).
> - `maxCallsPerDeck: 100` cost cap.
> - Element-replacement (not in-place mutation) for `ShapeElement → TextElement` per spec AC #17.
> - 1 new loss flag: `LF-GSLIDES-AI-QC-CAP-HIT` (warn / other; deck-level).
>
> Run all gates before opening the PR. Open with title `[T-246] @stageflip/import-google-slides — AI-QC convergence loop (Gemini multimodal)`.
>
> Report back with: PR URL, gate counts, AC pins for the contract amendment + multimodal extension + writeback semantics + cost cap, deviations, sizing reality check.

#### Step 3b: T-249 Implementer (L; design-system theme learning)

Same pattern. Use this prompt (substitute main SHA):

> **Agent type**: `general-purpose`
> **Description**: T-249 Implementer (8-step theme learning pipeline)
> **run_in_background**: `true`
> **Prompt**:
>
> You are the Implementer for **T-249** — converting `@stageflip/design-system` from stub to 8-step theme learning pipeline. Repo: `/Users/mario/projects/stageflip`. Main is at `<SHA>`.
>
> **Critical first git operation**: `git checkout main && git checkout -b task/T-249-design-system-theme-learning`.
>
> Read in order:
> 1. `CLAUDE.md`
> 2. `docs/tasks/T-249.md` — your spec (33 ACs across 8 pipeline stages / mutation strategy / loss flags / determinism / coverage)
> 3. `packages/schema/src/{theme,document,primitives}.ts`
> 4. `skills/stageflip/concepts/references-tier/SKILL.md`
>
> **Architectural assumptions** (Reviewer-ratified SOUND): 8-step decomposition; in-place mutation; Google Fonts only; k-means in Lab space.
>
> **Critical correctness pins**:
> - **MUTATES `opts.doc`** — JSDoc must surface this; callers `structuredClone` to preserve original.
> - `StepDiagnostic` is a discriminated union (one variant per step) — pinned in spec §1 cleanup commit.
> - `componentDefinitionSchema.body` narrows from `z.unknown()` to `{slots, layout}` — patch changeset on schema.
> - Hand-rolled Google Fonts client (no `googleapis` dep) per T-244 precedent.
> - `kMeansSeed: 42` default; deterministic output.
> - 3 new loss flags: `LF-DESIGN-SYSTEM-FONT-FETCH-FAILED` / `-AMBIGUOUS-CLUSTER` / `-COMPONENT-MERGE-FAILED`.
>
> Two changesets: `.changeset/design-system-t249.md` (minor), `.changeset/schema-t249.md` (patch additive).
>
> Open with title `[T-249] @stageflip/design-system — 8-step theme learning pipeline`. Report back with PR URL, gate counts, fixture results.

#### Step 3c: T-252 Implementer (L; export-google-slides)

Same pattern. Use this prompt:

> **Agent type**: `general-purpose`
> **Description**: T-252 Implementer (export-google-slides render-diff convergence)
> **run_in_background**: `true`
> **Prompt**:
>
> You are the Implementer for **T-252** — closing piece of the Google Slides triad. Repo: `/Users/mario/projects/stageflip`. Main is at `<SHA>`.
>
> **Critical first git operation**: `git checkout main && git checkout -b task/T-252-export-google-slides`.
>
> Read in order:
> 1. `CLAUDE.md`
> 2. `docs/tasks/T-252.md` — your spec (31 ACs across public surface / tier modes / plan emission preference order / convergence loop / image-fallback / loss flags / round-trip / coverage)
> 3. `docs/tasks/T-244.md` (sibling importer; reuse `GoogleAuthProvider` interface)
> 4. `docs/tasks/T-245.md` (`rasterizeFromThumbnail` consumer)
> 5. `packages/import-google-slides/src/api/client.ts` (extend with mutation calls per T-244 hand-rolled precedent)
>
> **Critical correctness pins**:
> - 3 tier modes: `fully-editable` (no convergence) / `hybrid` (default; selective fallback) / `pixel-perfect-visual` (everything rasterized).
> - Plan emission preference order: (a) `UpdateShapePropertiesRequest` against `inheritsFrom`-bound shape > (b) `DuplicateObjectRequest` similar object > (c) `CreateShapeRequest` from scratch.
> - Convergence loop: max 3 iterations; tolerances per spec §3 (text bbox ±2/±3 px; image-shape ±1 px; perceptual diff < 2%).
> - Image-fallback via T-245's `rasterizeFromThumbnail` + Drive upload + `CreateImageRequest` + `DeleteObjectRequest` (with cascading-delete safety per spec §7 for groups).
> - 8 new `LF-GSLIDES-EXPORT-*` codes.
> - Hand-rolled API client (no `googleapis` dep).
> - Round-trip via T-244's `parseGoogleSlides` (stub CV provider in tests).
>
> Open with title `[T-252] @stageflip/export-google-slides — render-diff convergence loop`. Report back.

#### Step 3d: T-244-cv-worker (S; Python sidecar — infra only, can defer)

Per the spec, this is infrastructure-only — no TypeScript. Implementer authors a FastAPI service in `services/cv-worker/` + Cloud Run deploy script. **Can be deferred** to ops backlog if Phase 11 closeout is the priority — T-244 already ships and works with the stub provider; the production HTTP path needs the sidecar but the importer functions without it for testing.

#### Step 3e: T-250 (M; docs-only sweep — last)

**Per Reviewer note**: dispatch ONLY after T-247 + T-253-rider merge (both done at session end). T-250 is content-only, mostly low-stakes. Spec can be dispatched whenever the closeout is being assembled.

> **Agent type**: `general-purpose`
> **Description**: T-250 Implementer (workflow-skills sweep)
> **run_in_background**: `true`
> **Prompt**:
>
> You are the Implementer for **T-250** — docs-only sweep across `skills/stageflip/workflows/` and `skills/stageflip/concepts/{loss-flags,schema}/SKILL.md`. Repo: `/Users/mario/projects/stageflip`. Main is at `<SHA>`.
>
> **Critical first git operation**: `git checkout main && git checkout -b task/T-250-workflow-skills-sweep`.
>
> Read `docs/tasks/T-250.md` — 18 ACs. **No package source touched.** Primary CI signal: `pnpm check-skill-drift`.
>
> Open with title `[T-250] workflow-skills sweep — import / export / concepts updates`. Report back.

### Step 4: Phase 11 closeout

Once T-247, T-246, T-249, T-252, T-250 (T-244-cv-worker optional) all merge:

1. Verify all `pnpm` gates green on `main`.
2. Author `docs/handover-phase11-complete.md` per the §"Phase 9 closeout — include difficulty assessment" memory pattern (`/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/project_handover_phase9_closeout.md`).
3. Per `feedback_phase_closeout_timing.md`, the closeout handover + ratification land at **Phase 12 start**, not at the last P11 PR.
4. Phase 12 (Collab + Hardening + Blender) becomes the active phase.

---

## 7. Risk assessment

### High-risk items

- **T-246's contract amendment** (Step 3a): the T-246 Implementer must amend T-244's emission to attach `tree.pageImagesPng` — a small but cross-cutting change. If they skip it, the writer can't crop and Gemini gets bbox-only metadata. Spec line 36 documents this; Implementer should read.
- **T-249's `componentDefinitionSchema.body` narrowing**: changes the schema's existing `z.unknown()` to a typed shape. Additive (existing empty `components: {}` still parses), but a Reviewer should sanity-check on real fixtures.
- **T-252's hand-rolled API client** carries the most surface (mutation calls): `batchUpdate`, `presentations.create`, Drive upload. Test depth matters here.

### Medium-risk items

- **T-247's class-style resolution OOS** is a conservative call; if real-world Hyperframes decks rely heavily on CSS classes (some samples in `reference/hyperframes/` do), the loss-flag emission rate could be high enough to make the importer feel broken. T-247-css follow-on rider would address.
- **T-250's sequencing**: Reviewer-confirmed must wait for T-247 + T-253-rider (both done at session end); other prereqs (T-249/T-252/T-246) can settle in parallel via spec-stub markers.

### Low-risk items

- **T-244-cv-worker** is infra; deferring doesn't block any Implementer.
- The `references/` tier convention is established; future Implementers can adopt without further ratification.

---

## 8. Sub-agent in flight at session end

**None.** T-247 Implementer landed PR #218 + merged before this handover doc was written. No sub-agents running at handover commit.

---

## 9. Memory pointers

- [Phase closeout timing](/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/feedback_phase_closeout_timing.md)
- [Phase 9 closeout difficulty assessment pattern](/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/project_handover_phase9_closeout.md)
- [Subagent worktree blocks Bash](/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/feedback_subagent_worktree_bash.md)
- [Subagent shared worktree (updated)](/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/feedback_subagent_shared_worktree.md) — includes new "merge-an-unrelated-PR-while-Implementer-runs is NOT safe" rule
- [Run biome format before commit](/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/feedback_biome_format_before_commit.md) — new this session

---

## 10. Closing notes

This session shipped **19 PRs** across 4 sub-phases (foundational + Google Slides + references/ tier convention + theme/sweep + Hyperframes import). Phase 11 went from "in flight, several gaps" to "closeout reachable in 4 dispatches, all specced." The biggest unlocks were T-244 (Google Slides import — 74 tests), T-245 (rasterize primitive — 52 tests), T-253-base + rider (export-pptx — 68 tests), T-247 (Hyperframes HTML — 94 tests), and T-251's schema lift (foundational for T-244 + T-253-rider).

Three structural improvements landed:
- The `references/` tier convention (PR #213) — patterned on huashu-design's references/ directory.
- The `compareToPlaceholder` schema helper (T-253-rider) — sibling export to T-251's `applyInheritance`.
- Hand-rolled Google API client precedent (T-244 → T-252 spec → T-249 spec → T-244-cv-worker spec).

Next session should be the Phase 11 closeout drive. Estimated ~3 hours of focused work to land 4 more Implementer dispatches (T-246, T-249, T-252, T-250 — T-244-cv-worker optionally deferred to ops backlog). The closeout handover + ratification land at Phase 12 start per existing memory (`feedback_phase_closeout_timing.md`).
