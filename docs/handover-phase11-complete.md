---
title: Phase 11 complete — handover
id: docs/handover-phase11-complete
owner: orchestrator
last_updated: 2026-04-27
supersedes: docs/handover-phase11-late-2.md
---

# Handover — Phase 11 complete (2026-04-27)

If you are the next agent: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md` §Phase 12.

**Phase 11 is closed.** All 21 implementation tasks shipped. `main` at `4455556`. Working tree clean. All gates green per-PR and cumulatively. Three Google Slides import/export tasks (T-244, T-246, T-252), one Python CV sidecar (T-244-cv-worker), one bidirectional Hyperframes importer (T-247), one design-system theme-learning pipeline (T-249), one foundational schema lift (T-251), one PPTX writer + placeholder-inheritance rider (T-253-base + T-253-rider), and one workflow-skills sweep (T-250) all landed.

**Next work**: Phase 12 — Collab + Hardening + Blender (T-260 → T-273, 14 tasks). Per-task ratification still applies; no new ADRs gate P12 entry. T-260 (ChangeSets + Yjs CRDT) is the recommended first dispatch — it finally exercises the storage delta methods T-025 introduced 18 months ago.

**Mandatory first action**: spin up the **ratification agent** before dispatching any P12 task. The agent verifies the P11 closeout claim independently against `main`, the implementation plan, and the gate suite. Prompt is in §8.

---

## 1. Where we are

### Phase history

- Phases 0–10: ratified.
- **Phase 11 (Importers)**: complete. 21 implementations + 4 spec sweeps + 2 hotfixes + 2 handover docs across 39 PRs from #187 → #224.

### Cumulative Phase 11 ledger — what shipped

The full P11 sequence (across mid + late + late-2 + complete sessions) covered:

| Layer | Tasks | Status |
|---|---|---|
| Foundational schema | T-251 (deck-level layouts + masters + inheritsFrom) | ✅ #196 |
| Loss-flag extraction | T-247-loss-flags | ✅ #188 |
| Loss-flag reporter UI | T-248 | ✅ #192 |
| PPTX import bring-up | T-240, T-241a, T-242, T-242d, T-243a, T-243b, T-243c, T-243-storage-adapter | ✅ all merged earlier in P11 |
| Google Slides triad | **T-244** (importer), **T-246** (AI-QC convergence), **T-252** (exporter) | ✅ #208, #220, #222 |
| Python CV sidecar | **T-244-cv-worker** (FastAPI + PaddleOCR + OpenCV) | ✅ #224 |
| Slide rasterization primitive | T-245 (`@stageflip/rasterize`) | ✅ #212 |
| Hyperframes HTML importer | T-247 (bidirectional, video mode) | ✅ #218 |
| PPTX export | T-253-base + T-253-rider (placeholder-inheritance write-back) | ✅ #205, #216 |
| Design-system theme learning | **T-249** (8-step pipeline) | ✅ #221 |
| Workflow-skills sweep | **T-250** (docs across 7 skill files) | ✅ #223 |

### Session 3 (closing session) — what landed (chronological)

This session shipped 5 PRs (#220 → #224) closing every remaining P11 implementation:

| PR | Task | Notes |
|---|---|---|
| #220 | T-246 | AI-QC convergence loop (Gemini multimodal). Single-pass per-residual call; bounds Gemini cost. Per-element confidence on every imported deck. Inverted from spec's earlier framing — classical CV first, Gemini second. |
| #221 | T-249 | `@stageflip/design-system` — 8-step theme learning pipeline. k-means in Lab color space with `kMeansSeed` for determinism. In-place mutation of input Document; `colorValueSchema` accepts both literals and `theme:foo.bar` refs. Google Fonts only (T-249-fonts-extended deferred). 33 ACs. |
| #222 | T-252 | `@stageflip/export-google-slides` — render-diff convergence loop. Three tier modes (fully-editable / hybrid / pixel-perfect-visual). Required Reviewer round-trip: first pass shipped a structurally inert loop (no `src/diff/` module); fix commit added connected-components diff + dimension plumbing + 5-fixture round-trip + `presentations.get` wiring + 4 minor fixes. 98 tests. |
| #223 | T-250 | Workflow-skills sweep (docs-only across 7 skill files). 18 ACs. 46 loss-flag codes enumerated by source in `concepts/loss-flags`. AC #10 vacuously holds (no workflow has a sibling `references/` dir yet). `check-skill-drift` PASS. |
| #224 | T-244-cv-worker | Python FastAPI service in `services/cv-worker/`. PaddleOCR + OpenCV core; SAM 2 opt-in via `ENABLE_SAM2=1`. Cloud Run deploy script per T-231 pattern. Docker image < 4 GB; pytest + shellcheck + docker-build CI jobs. No TS-side changes — wire format conforms to existing `HttpCvProvider`. |

**Session 3 PR count: 5. Cumulative P11 PR count: 39 (across all P11 sessions).**

### Workspace test counts (cumulative P11)

| Package | At P10 close | At P11 close | Δ |
|---|---|---|---|
| `@stageflip/schema` | 117 | 133 | +16 (compareToPlaceholder + inheritance helpers) |
| `@stageflip/rir` | (existing) | (existing + inheritance pass) | +small |
| `@stageflip/loss-flags` | 0 (new pkg) | (extracted) | new |
| `@stageflip/import-pptx` | 84 | 192 | +108 (T-240/241a/242/242c/242d/243a/243b/243c) |
| `@stageflip/import-google-slides` | 0 (stub) | 74 | +74 (T-244) |
| `@stageflip/import-hyperframes-html` | 0 (stub) | 94 | +94 (T-247) |
| `@stageflip/export-pptx` | 0 (stub) | 68 | +68 (T-253-base + rider) |
| `@stageflip/export-google-slides` | 0 (stub) | 98 | +98 (T-252) |
| `@stageflip/rasterize` | 0 (new pkg) | 52 | +52 (T-245) |
| `@stageflip/design-system` | 0 (new pkg) | (T-249 suite) | new |
| `services/cv-worker` (Python) | 0 (new svc) | (pytest suite, ~30+ assertions) | new |

**No regressions on any pre-existing package.** All workspace gates remain green at HEAD.

### Phase 11 exit-criteria check

Plan quote (paraphrased from §Phase 11): *"Importers operational for PPTX, Google Slides, and Hyperframes HTML; canonical schema supports placeholder inheritance + native grouping + tables; loss flags surfaced to editor UI; CV pipeline stood up for Slides import."*

- ✅ **PPTX importer operational** — T-240/241a/242/242c/242d/243a/243b/243c shipped; 192 tests; assets (image, video, font) extracted; nested groups + custom geometry supported.
- ✅ **Google Slides importer operational** — T-244 ships hand-rolled OAuth + Slides API v1 + render-PNG pixel matching; 74 tests. Convergence loop (T-246) bounds Gemini cost; CV sidecar (T-244-cv-worker) ready for production deployment.
- ✅ **Google Slides exporter operational** — T-252 ships render-diff convergence loop + 3 tier modes + image-fallback. 98 tests. Round-trips all 5 fixtures via `batchUpdates[]` replay.
- ✅ **Hyperframes HTML importer operational** — T-247 ships bidirectional importer + exporter (video mode). 94 tests. 6 round-trip fixtures pass.
- ✅ **PPTX exporter operational** — T-253-base + T-253-rider; 68 tests. Placeholder-inheritance write-back with override-suppression.
- ✅ **Schema supports placeholder inheritance + grouping + tables** — T-251 lifted layouts/masters/inheritsFrom; `applyInheritance` + `compareToPlaceholder` helpers; RIR pass; `materializedDocumentAtom` in editor.
- ✅ **Loss flags surfaced** — T-247-loss-flags extracted the type to `@stageflip/loss-flags`; T-248 wired the editor reporter UI; 46 codes catalogued in `concepts/loss-flags` skill.
- ✅ **Design-system theme learning** — T-249 ships 8-step pipeline; deterministic k-means; Google Fonts source.

---

## 2. Architecture that landed (Phase 11 additions)

### Package + service graph

```
packages/
  schema                       — +layouts, +masters, +inheritsFrom, +compareToPlaceholder
  rir                          — +inheritance pass
  loss-flags                   — extracted from import-pptx (T-247-loss-flags)
  import-pptx                  — full bring-up (text/image/shape/group/video/font assets)
  import-google-slides         — hand-rolled API client + CV pipeline (HttpCvProvider, stub)
  import-hyperframes-html      — bidirectional, video mode
  export-pptx                  — foundational writer + placeholder write-back
  export-google-slides         — render-diff convergence loop (3 tiers)
  rasterize                    — slide PNG-crop primitive (shared by import + export)
  design-system                — 8-step theme learning pipeline

services/
  cv-worker (Python)           — FastAPI + PaddleOCR + OpenCV; SAM 2 opt-in. Cloud Run.

apps/
  editor-shell                 — +loss-flag reporter UI (T-248); +materializedDocumentAtom

skills/stageflip/
  concepts/loss-flags          — 46-code taxonomy table (T-250)
  concepts/schema              — §"Native grouping" (T-250)
  concepts/references-tier     — convention doc + 2 seed references (PR #213)
  workflows/import-*/SKILL.md  — emu_to_px math, CvCandidateProvider, T-244/T-246 cites
  workflows/export-*/SKILL.md  — placeholder-inheritance write-back, render-diff loop
  reference/cv-worker/SKILL.md — TS-side validator as source of truth
```

### Hand-rolled Google API clients (ratified pattern)

T-244 implementer chose to hand-roll the strict subset of `presentations.get` and `presentations.pages.getThumbnail` response types in `packages/import-google-slides/src/api/types.ts` rather than depending on `googleapis` (~3 MB transitive surface). Pattern is now ratified across **T-244, T-246, T-249, T-252, T-244-cv-worker**. Future Google API consumers should hand-roll unless the surface area is large.

### `references/` tier convention (PR #213)

A sibling `references/` directory next to a SKILL.md ships when surface complexity warrants. Templates: constraints / pitfalls / patterns / case-study. **First seeds**: `reference/export-pptx/references/pptx-constraints.md`, `reference/renderer-cdp/references/render-pitfalls.md`. Discoverability requires the parent SKILL.md to link the tier (`## References` section). When to add: SKILL.md approaching 500 lines + 30%+ concrete details; Implementers consistently hit issues the skill doesn't enumerate; same edge case in multiple Reviewer rounds; constraints catalogue >10 entries.

### `compareToPlaceholder` schema helper (T-253-rider)

Sibling export to `applyInheritance` in `@stageflip/schema/src/inheritance.ts`. Returns `{suppressKeys, mismatch}`. Used by T-253-rider's writer for override-suppression on slide elements that match their placeholder. Whole-or-nothing on `transform`; never suppresses `animations: []` (Zod default). Future template-aware consumers reuse this helper.

### Connected-components diff (T-252 fix-pass)

`packages/export-google-slides/src/diff/{pixel-diff,connected-components,observe}.ts`. Per-pixel RGBA-channel-delta + 4-connectivity flood-fill labeling; integer threshold (`DEFAULT_PIXEL_DELTA = 8`) avoids floating-point non-determinism. Region-to-element observation matching via expanded-bbox center containment with 32-px capture radius. Wired into `runConvergenceLoop` so production observations come from real pixel pipeline (not the `__convergenceObservations` test seam). **Pattern available for future render-diff consumers.**

---

## 3. Architectural decisions ratified this phase (recap from earlier sessions, plus this session)

### From earlier sessions (already in late-2 handover; restated for completeness)

1. **Hand-rolled Google API clients** (T-244 precedent → applied across P11).
2. **`compareToPlaceholder` schema helper** (T-253-rider).
3. **`references/` tier convention** (PR #213, hotfix #217 for frontmatter).
4. **4 architectural assumptions ratified for T-249**: 8-step decomposition; in-place mutation; Google Fonts only; k-means in Lab with `kMeansSeed`.
5. **Inverted T-246 framing**: classical CV first, Gemini second (~90% deterministic resolution).

### Newly ratified this session

6. **Connected-components diff as a shared primitive** (T-252 fix-pass). Currently lives in `packages/export-google-slides/src/diff/`; if a second consumer emerges (e.g., import-side render verification, video-mode parity check), promote to `@stageflip/render-diff` package. Until then, keep in-place per ADR principle "extract on second use."

7. **Three-agent workflow proven for fix-pass loops**: T-252 went through Implementer → Reviewer → Implementer (fix) → fresh Reviewer → APPROVE → merge in a single session. Memory entry `feedback_phase_closeout_timing.md` adjacent: when the first Implementer pass ships a structurally inert deliverable that passes CI by canned-test injection, the **Reviewer must verify the production code path independently of CI green**. CI green ≠ correct.

---

## 4. Memory updates this session

The auto-memory system gained no new entries this session — the existing five (`feedback_phase_closeout_timing`, `project_handover_phase9_closeout`, `feedback_subagent_worktree_bash`, `feedback_subagent_shared_worktree`, `feedback_biome_format_before_commit`) all held; T-244-cv-worker re-validated `feedback_subagent_shared_worktree` (background subagent reported PR open with stale CI rollup; main thread re-checked underlying API and confirmed green).

**Lesson worth capturing for future sessions** (not yet committed to memory; defer to next agent's discretion): when `gh pr checks <pr>` reports `pending` jobs whose `started_at` > expected runtime, query the underlying job-step API (`gh api repos/<owner>/<repo>/actions/jobs/<id>`) before assuming the job is stuck. The CLI rollup can lag the actual job state by minutes.

---

## 5. Remaining-phases risk (post-P11)

Per `project_handover_phase9_closeout.md`, every closeout handover must include this section. With P11 closed:

**Risk order (highest first): P13 > P14 > P15 > P12.**

### P13 — Premium Motion Library & Frontier Runtime (highest risk)

- **115 tasks across three parallel tracks** (A: frontier runtime, B: preset library, C: supporting plumbing). The largest phase by task count and by absolute scope.
- ADRs ratified 2026-04-25 (ADR-003/004/005) — gate is open. But the **type-design consultant** agent (`skills/stageflip/agents/type-design-consultant/SKILL.md`) batch-reviews Clusters A/B/D/F/G fallback fonts; preset PRs in those clusters link to the batch. **Coordination overhead is non-trivial.**
- **Parity fixtures ship per cluster batch with product-owner sign-off** (not Reviewer-only). New approval surface; first cluster will reveal the bottleneck.
- Frontier runtime (Track A) sits adjacent to runtime-contract package; it cannot land before P12 hardens auth/tenancy + observability or premium-tier rate-limiting becomes blocked.
- **Recommended mitigation**: do not start P13 until P12's T-262 (auth + org tenancy) + T-263 (rate limiting) + T-264 (observability) ship. P13's 115-task scope amplifies any cross-cutting issues.

### P14 — Asset Generation (Adapter-Pattern Foundation + Per-Modality Build-out)

- Adapter-pattern foundation (`@stageflip/asset-gen`) followed by per-modality build-outs (image, video, audio, font, 3D). Each modality is its own provider integration (OpenAI, Gemini, ElevenLabs, Suno, Sora, etc.).
- **Provider non-determinism** is the central risk. The asset cache must be content-addressed and the provider-call layer must be replayable; otherwise determinism CI breaks across the workspace.
- Adapter pattern is well-trodden internally (storage, runtimes); P14's risk is provider-side rate limits and cost spikes mid-development.

### P15 — Live Audience (Native Primitives + Vendor Bridges via Adapter Pattern)

- Real-time low-latency rendering + vendor bridges (OBS, Vimeo, vMix, Restream). Lower task count than P13/P14 but hard real-time constraints.
- **Risk concentrated in the WebRTC + WebSocket plumbing** and per-vendor SDK quirks. Less bounded than P12.

### P12 — Collab + Hardening + Blender (lowest risk)

- 14 tasks across collab (Yjs, presence, auth, tenancy), hardening (rate limiting, OTel/Sentry, security review, pentest, load testing, backup, telemetry export), and a separate Blender bake-tier runtime.
- Each task is well-scoped and uses established patterns: Yjs is the de-facto CRDT choice; Sentry + OTel are standard; Stripe billing is straightforward; pentest is a vendor engagement.
- **Risk is execution drift (14 medium tasks ≠ low cumulative effort)**, not technical novelty. P12 is the right phase to dispatch in parallel with P13/P14 once auth + observability ship.

### Concrete sequencing recommendation

1. **Now**: Ratify P11 closeout (§8 prompt below).
2. **Next**: Dispatch T-260 (Yjs + ChangeSets) — the biggest piece of P12 and the prerequisite for presence (T-261), rate limiting (T-263), and per-org auth (T-262).
3. **After T-260**: Parallel-dispatch T-261, T-262, T-263, T-264. They share no critical-path dependencies.
4. **Hold P13**: do not unblock until T-262 + T-263 + T-264 are merged. Type-design batch coordination requires stable auth + telemetry.

---

## 6. Memory health check (per `consolidate-memory` skill)

Current memory entries — all checked against current state:

- **`feedback_phase_closeout_timing.md`** — still load-bearing. Reapplied this session: P11 closeout handover written **at this point** (P12 start), not at the last P11 PR.
- **`project_handover_phase9_closeout.md`** — still load-bearing. Reapplied: §"Remaining-phases risk" (§5 above) is in the canonical position.
- **`feedback_subagent_worktree_bash.md`** — still load-bearing. Reapplied: T-244-cv-worker Implementer used non-worktree subagent (Bash available).
- **`feedback_subagent_shared_worktree.md`** — still load-bearing. Reapplied: avoided concurrent git ops while non-worktree subagents were in flight.
- **`feedback_biome_format_before_commit.md`** — still load-bearing. Reapplied (implicitly): no biome-format CI regressions this session; pattern from #210 hasn't repeated.

No stale entries. No obvious duplicates. `MEMORY.md` index under 200 lines.

---

## 7. References/ tier seeds — for future expansion (carried forward from late-2)

Per PR #213's adoption status section, future skills earn a `references/` tier when complexity warrants:

- `skills/stageflip/workflows/import-pptx/references/` — gotchas observed across T-243a/b/c.
- `skills/stageflip/workflows/import-google-slides/references/` — T-244 fixture patterns + CV provider stub conventions; T-246 Gemini-residual handling patterns.
- `skills/stageflip/workflows/export-google-slides/references/` — render-diff loop pitfalls (B1: structurally inert loop without real-pixel pipeline; B2: dimension hard-coding); image-fallback emission rules.
- `skills/stageflip/concepts/loss-flags/references/` — code emission patterns.
- `skills/stageflip/reference/renderer-cdp/SKILL.md` — currently no parent SKILL.md (only the references/ subtree); would close the "references precede SKILL.md" gap noted in the convention doc.
- `skills/stageflip/reference/cv-worker/references/` — Python service operational gotchas (cold-start, Cloud Run scaling, PaddleOCR memory pinning).

Add incrementally per the convention's "earn its place" rule.

---

## 8. How to pick up — explicit next-action prompts

### Step 1: Verify session-end state

```
git log --oneline main -5
# Expected:
#   4455556 [T-244-cv-worker] services/cv-worker — Python CV sidecar (FastAPI + PaddleOCR + OpenCV) (#224)
#   28901ef [T-250] workflow-skills sweep — import / export / concepts updates (#223)
#   5ba9be7 [T-252] @stageflip/export-google-slides — render-diff convergence loop (#222)
#   a4bb803 [T-249] @stageflip/design-system — 8-step theme learning pipeline (#221)
#   58d78e7 [T-246] @stageflip/import-google-slides — AI-QC convergence loop (Gemini multimodal) (#220)

git status
# Expected: clean tree on main (or on docs/handover-phase11-complete if this handover hasn't been merged yet).

pnpm typecheck && pnpm lint && pnpm test
# Expected: all green at HEAD.
```

### Step 2: Spin up the **ratification agent** (mandatory before any P12 dispatch)

Use the `Agent` tool with `subagent_type: pr-review-toolkit:code-reviewer` (treat the closeout itself as a review surface). Prompt:

```
You are the **Phase 11 closeout ratification agent** for StageFlip. Your job: independently verify the P11 closeout claim made in `docs/handover-phase11-complete.md` against the actual state of `main`. You are NOT reviewing a single PR — you are auditing a phase boundary.

## Required reading (in this order)

1. `/Users/mario/projects/stageflip/CLAUDE.md` — hard rules and the three-agent workflow.
2. `/Users/mario/projects/stageflip/docs/handover-phase11-complete.md` — the closeout claim. Specifically §1 (cumulative ledger), §2 (architecture), §3 (decisions ratified), §5 (remaining-phases risk).
3. `/Users/mario/projects/stageflip/docs/implementation-plan.md` §Phase 11 — the original task list. Cross-check that every task ID in P11 is either marked merged in the handover or explicitly deferred with rationale.
4. `git log --oneline main` since `docs/handover-phase11-late-2` (commit bcee432). Cross-check every claimed PR (#220, #221, #222, #223, #224) actually merged.

## What to verify

- **Task completeness**: every P11 task ID in `docs/implementation-plan.md` § Phase 11 is accounted for (merged, explicitly out-of-scope, or deferred with documented rationale).
- **Architecture claims**: §2 of the handover claims specific files / patterns landed (e.g., `packages/export-google-slides/src/diff/`, `services/cv-worker/`, `compareToPlaceholder`, `references/` tier seeds). Verify each by `ls`/grep on `main`.
- **Test counts**: §1's workspace test-count delta table. Spot-check 2–3 packages by running `pnpm --filter <pkg> test` and comparing.
- **All gates green at HEAD**: `pnpm typecheck && pnpm lint && pnpm test && pnpm check-licenses && pnpm check-remotion-imports && pnpm check-determinism && pnpm check-skill-drift`.
- **No regressions on pre-P11 packages**: pick 2–3 packages that existed before P11 (e.g., `@stageflip/frame-runtime`, `@stageflip/renderer-core`, `@stageflip/engine`); their test counts should not have decreased.
- **Memory health**: §6's claims about each memory entry remaining load-bearing. Spot-check by reading the actual files at `/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/`.
- **Risk ordering**: §5's claim that P13 > P14 > P15 > P12 in risk. Sanity-check against the implementation plan; flag any obvious mis-ordering.

## Reporting

Return a focused ratification using severity bands (blocker / major / minor). End with one of:

- **RATIFY** — closeout claim holds; P12 dispatch unblocked.
- **HOLD** — list specific gaps the Orchestrator must address before P12 dispatch.

Be terse. State facts. Cite file:line / commit / PR# for every finding. If you RATIFY, briefly state which checks you spot-verified.

Working directory: `/Users/mario/projects/stageflip`.
```

### Step 3: After ratification — merge this handover doc

Once the ratification agent returns RATIFY, this handover doc itself needs to be on `main`. Open a PR:

```bash
git checkout docs/handover-phase11-complete  # branch the handover lives on
gh pr create --title "docs(handover): Phase 11 complete — supersedes phase11-late-2" \
  --body "$(cat <<'EOF'
## Summary
- Closes Phase 11. All 21 implementation tasks shipped across 39 PRs (#187 → #224).
- Supersedes \`docs/handover-phase11-late-2.md\`.
- Includes §"Remaining-phases risk" per memory \`project_handover_phase9_closeout.md\`.

## Test plan
- [x] Ratification agent returned RATIFY against \`main\`.
- [x] Skill drift gate green.
- [x] No source code changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

CI should be near-trivial (docs-only, no changeset). Merge once green.

### Step 4: Dispatch P12 first task — T-260 (ChangeSets + Yjs CRDT sync layer)

T-260 is the load-bearing P12 entry. It exercises the storage delta methods T-025 introduced 18 months ago (which have lain dormant) and unblocks T-261 (presence) + T-262 (auth + tenancy) + T-263 (rate limiting). Spec is in `docs/implementation-plan.md` §Phase 12; if a `docs/tasks/T-260.md` standalone spec doesn't exist yet, the Implementer's first action is to **escalate** for one — do not implement against the one-line plan row.

Use `Agent` with `subagent_type: general-purpose`. Prompt:

```
You are the **Implementer** agent for StageFlip task **T-260** — `ChangeSets + CRDT (Yjs) sync layer`. Phase 12, first dispatch. Your job: read the spec, implement, open PR, drive CI green.

## Required reading (in this order)

1. `/Users/mario/projects/stageflip/CLAUDE.md` — hard rules and the three-agent workflow.
2. `/Users/mario/projects/stageflip/docs/implementation-plan.md` §Phase 12, T-260 row — `ChangeSets + CRDT (Yjs) sync layer. Storage delta methods (T-025) finally exercised in prod`.
3. **CHECK**: `/Users/mario/projects/stageflip/docs/tasks/T-260.md` — if missing, STOP and escalate to Orchestrator. Do NOT implement against the one-line plan row alone — Phase 12 task specs follow the same convention as P11 (one MD per L-sized task).
4. The T-025 storage abstraction (`packages/storage/` or wherever it lives) — read its delta-method surface so the Yjs layer wires through correctly.
5. ADRs touching collab — search `docs/decisions/` for `ADR-collab` or `Yjs`.

## Branch + workflow

- Working directory: `/Users/mario/projects/stageflip`
- Branch: `task/T-260-yjs-changesets-sync`
- Non-worktree subagent — share working tree with main thread. Sequential commits.

## Work to do

- Implement Yjs CRDT layer + ChangeSet model per spec.
- Wire storage delta methods (T-025).
- Per spec ACs.

## Hard rules (CLAUDE.md §3)

- TS strict, no `any`, file headers on new files, no commented-out code, no `console.log`.
- Tests-first: failing tests before implementation.
- Determinism rules in clip/runtime code (Yjs layer is in collab/sync, NOT clip code; rules don't apply there directly — but verify with the spec).
- Conventional Commits: `feat(collab): T-260 — Yjs ChangeSet sync layer`.

## Quality gates (must pass before pushing)

```
pnpm typecheck
pnpm lint
pnpm test
pnpm check-licenses        # Yjs is MIT — verify it's on whitelist
pnpm check-remotion-imports
pnpm check-determinism
pnpm check-skill-drift     # if a SKILL.md is part of the task
pnpm size-limit            # if a publishable package is touched
```

Coverage on changed files ≥85%.

## PR

- Title: `[T-260] @stageflip/<pkg> — Yjs ChangeSet sync layer`
- Changeset if a publishable package is touched.
- PR body: list each AC and where it's satisfied.

## Reporting

When done, push branch, confirm CI green via `gh pr checks <pr>`, return terse summary listing each AC + the file:section satisfying it. Note any deviations from spec.

If T-260.md spec doesn't exist OR an AC conflicts with an invariant, STOP and escalate per CLAUDE.md §6. Do not silently descope.

Be terse. State facts, cite skills, ship code.
```

### Step 5: Continue P12 dispatch loop

After T-260 merges (Implementer → Reviewer → APPROVE → merge), dispatch T-261, T-262, T-263, T-264 **in parallel** (single Agent call with multiple Task tool uses). They share no critical-path dependencies.

T-265 (Blender bake-tier ClipRuntime) and T-266 (render farm deploy) can dispatch in parallel after auth + observability land.

T-267 (Stripe billing) waits for T-262 (org tenancy) — billing requires org_id.

T-268 (security review + pentest) is a vendor engagement; schedule it after T-263 + T-264 (rate limiting + observability) so the pentester has telemetry to inspect.

T-269 (load testing) and T-270 (`@stageflip/storage-postgres`) are independent.

T-271 (EU Firestore region) + T-272 (backup/PITR) + T-273 (BigQuery telemetry export) are infra-only, can dispatch in parallel.

### Step 6: Phase 12 closeout

When all 14 P12 tasks are merged: **do not write the closeout handover yet** (per `feedback_phase_closeout_timing.md`). Write `docs/handover-phase12-complete.md` at **Phase 13 start**, mirroring the structure of this doc.

---

## 9. Pointers for the next agent

- **Working tree**: `/Users/mario/projects/stageflip`. Currently on branch `docs/handover-phase11-complete` with this file as the only addition. Push → PR → merge after ratification.
- **`main` HEAD**: `4455556`. All gates green per most-recent CI runs.
- **Memory location**: `/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/`. Index in `MEMORY.md`.
- **Open PRs**: none from this session. All 5 P11-closing PRs merged.
- **Open work**: none. Working tree clean on main.
- **Previously open Reviewer comments**: none unresolved.
- **No escalations in flight.**

End of handover.
