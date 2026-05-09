---
title: Phase 13 — Cluster C in flight (6 preset PRs queued; merge sequencing + final closeout)
id: docs/handover-phase13-cluster-c-in-flight
phase: 13
size: M
owner_role: orchestrator
status: open
last_updated: 2026-05-08
supersedes: docs/handover-phase13-cluster-g-eligible.md
related:
  - docs/handover-cluster-d-regression.md
  - docs/tasks/T-347a.md
  - docs/tasks/T-347b.md
  - docs/tasks/T-347c.md
  - docs/tasks/T-347d.md
  - docs/tasks/T-347e.md
  - docs/tasks/T-347f.md
  - docs/tasks/T-347g.md
  - docs/tasks/T-347h.md
---

# Handover — Phase 13 Cluster C in flight (2026-05-08)

If you are the next agent picking this up: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md` §"Phase 13".

**Current state**: Phase 13 is mid-flight. Cluster C is the single in-flight cluster. **6 preset PRs (#451-#456) are queued; both primitive PRs (#449/#450) merged; Cluster D + the rest of the closed clusters are landed.**

**Mandatory first action**: read this handover top-to-bottom. Then run gates against `main` to verify green:

```bash
git checkout main && git pull --ff-only
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm check-skill-drift
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=news       # → ELIGIBLE (8/8)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=sports     # → ELIGIBLE (9/9)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=titles     # → ELIGIBLE (6/6) (post-Cluster-D regression remediation)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=data       # → ELIGIBLE (6/6)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=captions   # → ELIGIBLE (6/6)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=ctas       # → ELIGIBLE (5/5)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=weather    # → 0/6 NOT ELIGIBLE (until #451-#456 merge)
```

Then check open PRs:

```bash
gh pr list --state open --json number,title,statusCheckRollup,mergeable
```

---

## 1. Cluster status snapshot (post-Cluster-D-regression-closeout)

| Cluster | Domain | Total | Signed | Eligible? | Ratified? |
|---|---|---|---|---|---|
| **A** | broadcast / news | **8** | **8** | ✅ ELIGIBLE | ✅ RATIFIED |
| **B** | sports | **9** | **9** | ✅ ELIGIBLE | ✅ RATIFIED |
| **C** | **weather** | **6** | **0 (until #451-#456 merge)** | **⏳ in flight** | — |
| **D** | titles | **6** | **6** | ✅ ELIGIBLE | ✅ RE-RATIFIED post-regression |
| **E** | data | **6** | **6** | ✅ ELIGIBLE | ✅ RATIFIED |
| **F** | captions | **6** | **6** | ✅ ELIGIBLE | ✅ RATIFIED |
| **G** | CTA / social | **5** | **5** | ✅ ELIGIBLE | ✅ RATIFIED |
| H | AR overlays | 5 | 0 | no | — |
| **TOTAL** | — | **51** | **40 → 46 once Cluster C merges** | **6 of 8 → 7 of 8** | **6 of 8 → 7 of 8** |

(Total bumped from 50 → 51 because Cluster C currently has **6** presets, not the 4 that the original Phase 13 plan inventoried. Two of those 6 are TWC presets that were originally inventoried as out-of-scope; they shipped via dedicated primitives this session. See §3.3.)

---

## 2. Cluster D regression — fully closed

A multi-PR remediation arc landed:

| Phase | PR | Outcome |
|---|---|---|
| 1 — revert frontmatter | #444 | 5 affected presets reverted to `pending-user-review` |
| 2 — first-attempt fix (incorrect; superseded) | #445 | `mix-blend-mode: multiply` inline on photographic-overlay SVG; passed unit tests + CI but didn't actually composite at the renderer level (each `RIRElement` wrapper has its own stacking context, isolating inline mix-blend-mode from siblings) |
| 2.5 — corrected fix | #448 | Hoisted `mixBlendMode` to `ClipDefinition` field; host renderer (`composition.tsx` ElementNode) reads it and applies on the OUTER wrapper (Composition root's stacking context, not isolated) |
| 3 — re-generate + re-sign 5 goldens | #448 (combined w/ Phase 2.5) | 5 affected goldens regenerated; PO ratified each |
| 4 — non-blank CI gate | #446 | `parityFixture-non-blank` invariant in `scripts/check-preset-integrity.ts`; two-stage detection (significant-bucket count + dominance threshold) |
| 5 — F-30 process lesson | #447 | `CLAUDE.md` §13 + §11 checklist item: structural-extension specs require end-to-end render verification |

**Cluster D back to 6/6 ELIGIBLE+RATIFIED.** Process backstops in place: §13 (prevention) + non-blank gate (recovery).

The Phase 2-vs-2.5 split is itself a textbook F-30 illustration: Phase 2's unit tests passed but the wiring didn't actually compose at the renderer level; Phase 3's pixel-level verification caught it. **Future structural-extension PRs MUST follow §13 verification posture.**

---

## 3. Cluster C in flight — full ledger

### 3.1 Primitives shipped (merged to `main`)

| PR | Task | Primitive | clipKind | Merged |
|---|---|---|---|---|
| #449 | T-347a | `weatherMap` | `weatherMap` | ✅ 2026-05-08 |
| #450 | T-347b | `stormTracker` | `stormTracker` | ✅ 2026-05-08 |

Two new primitives added to `ALL_BRIDGE_CLIPS` (58 → 60). Each ships with sealed canonical palettes (NOT theme-able per cluster SKILL "Color palettes are standard, not brand"), helper exports for parity-cli resolver shims, and v1 carve-outs for live data / animation.

### 3.2 Preset PRs in flight (open, not yet merged)

| PR | Task | Preset | clipKind | Binding pattern | §13 branch |
|---|---|---|---|---|---|
| #451 | T-347c | `bbc-mark-allen-clouds` | `weatherMap` | `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C clipKind-default — first weatherMap consumer) | `'mark-allen-clouds'` style branch |
| #452 | T-347d | `doppler-dbz-standard` | `weatherMap` | `PRESET_ID_BINDINGS` override | `'doppler-radar'` style branch |
| #453 | T-347e | `heat-map-cool-to-warm` | `weatherMap` | `PRESET_ID_BINDINGS` override | `'heat-map'` style branch |
| #454 | T-347f | `nhc-cone-of-uncertainty` | `stormTracker` | `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C clipKind-default — only stormTracker consumer) | `stormTracker` (single style) |
| #455 | T-347g | `twc-retrocast-8bit` | `fullScreen` | `PRESET_ID_BINDINGS` (preset clipKind STAYS `fullScreen`; binding overrides clipName to NEW `weatherStar4000Panel` primitive per T-328 / T-339 precedent) | new `weatherStar4000Panel` primitive |
| #456 | T-347h | `twc-immersive-mixed-reality` | `fullScreen` | `PRESET_ID_BINDINGS` (binding overrides clipName to NEW `imrStaticFallback` primitive — same precedent) | new `imrStaticFallback` primitive |

**All 6 PRs branch off `origin/main` independently — they share the same files (`packages/parity-cli/src/generate-fixture.ts`, `packages/runtimes/frame-runtime-bridge/src/clips/index.ts`, sibling test files). Whichever lands second / third / etc. needs rebase + length-bump fixups.**

### 3.3 New primitives shipped via T-347g + T-347h

The original Phase 13 plan inventoried Cluster C as 4 presets (3 weatherMap + 1 stormTracker). The 2 TWC presets (`twc-retrocast-8bit` + `twc-immersive-mixed-reality`) were originally `clipKind: fullScreen` — they would have bound to the existing `magic-wall-panel` primitive. But neither register fits magic-wall-panel:

- **TWC RetroCast (T-347g)**: pixel-perfect 8-bit register with L-bar sidebar, 8-px-step font sizing, Press Start 2P pixel font, period-authentic palette. Required dedicated primitive `weatherStar4000Panel`.
- **TWC IMR (T-347h)**: Track A frontier feature (live `ThreeSceneClip` 3D rendering via Unreal Engine + Zero Density Reality Engine + Mo-Sys StarTracker). Stub-canon-explicit static-fallback allowance authorizes a v1 static-only register; required dedicated primitive `imrStaticFallback`.

Both bound via `PRESET_ID_BINDINGS` with `clipName` override to the new primitives — preset's `clipKind: fullScreen` stays unchanged (T-328 msnbc-big-board / T-339 uefa-starball-refraction precedent).

`ALL_BRIDGE_CLIPS` length impact: 58 → 60 (primitives merged) → 62 (after T-347g + T-347h impl PRs land their new primitives).

---

## 4. **Highest priority next dispatch — merge the 6 in-flight PRs**

The CI-passing tipping point: each PR is independently green at branch HEAD. Merging requires sequential rebase + length-bump fixups.

### 4.1 Merge order recommendation

Order by §13 verification value first (each merge unlocks `pnpm check-cluster-eligibility.ts --cluster=weather` to count one more):

1. **#451 T-347c bbc-mark-allen-clouds** — first weatherMap consumer; adds the resolver `'weatherMap'` arm to `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C). Smallest blast radius.
2. **#454 T-347f nhc-cone-of-uncertainty** — only stormTracker consumer; adds the resolver `'stormTracker'` arm. Independent of the weatherMap arm.
3. **#452 T-347d doppler-dbz-standard** — second weatherMap consumer; adds `PRESET_ID_BINDINGS['doppler-dbz-standard']`.
4. **#453 T-347e heat-map-cool-to-warm** — third + final weatherMap consumer; adds `PRESET_ID_BINDINGS['heat-map-cool-to-warm']`.
5. **#455 T-347g twc-retrocast-8bit** — bumps `ALL_BRIDGE_CLIPS` 60 → 61 (new primitive `weatherStar4000Panel`).
6. **#456 T-347h twc-immersive-mixed-reality** — bumps `ALL_BRIDGE_CLIPS` 60 → 61 / 61 → 62 (new primitive `imrStaticFallback`).

### 4.2 Rebase fixups for second-and-onwards merges

**For #452 / #453 / #454 (preset-only PRs)**:

Conflict surface = `PRESET_ID_BINDINGS` map literal end + `generate-fixture.test.ts` length assertions.

```bash
# After first PR merges:
git fetch origin main && git rebase origin/main
# Resolve PRESET_ID_BINDINGS conflict by KEEPING BOTH new entries (each PR
# adds a unique key)
# Bump generate-fixture.test.ts assertions: previous N → N+1 (sibling
# already added 1; this PR adds another)
sed -i '' 's/toHaveLength(31)/toHaveLength(32)/g' packages/parity-cli/src/generate-fixture.test.ts
# (or 32→33 / 33→34 / etc. depending on how many siblings already merged)
```

**For #455 / #456 (primitive + preset PRs)**:

Additional conflict surface = `ALL_BRIDGE_CLIPS` array end (each PR adds one new clip), `cdp-host-bundle/src/runtimes.test.ts` (clip count + kind list), `skills-sync/src/live-runtime-manifest.ts`, `frame-runtime-bridge/SKILL.md`, 12 sibling clip test files (`ALL_BRIDGE_CLIPS.length`).

```bash
git fetch origin main && git rebase origin/main
# Resolve ALL_BRIDGE_CLIPS array conflict: KEEP BOTH new entries
# Resolve runtimes.test.ts: bump `expect(bridge?.clips.size).toBe(N)` and
# the it() title; APPEND BOTH new clip kinds to expectedKinds[]
# Resolve manifest.ts: APPEND BOTH new clip-kind strings + comment blocks
# Resolve SKILL.md: KEEP BOTH primitive rows
# Bump 12 sibling clip tests:
for f in packages/runtimes/frame-runtime-bridge/src/clips/{breaking-banner,follow-prompt,grain,link-sticker,lyrics,photographic-overlay,qr-code-bounce,score-bug,storm-tracker,subscribe-button,title-sequence,weather-map}.test.tsx; do
  sed -i '' -e 's/toHaveLength(N)/toHaveLength(N+1)/g' "$f"
done
# (where N is the current main HEAD's ALL_BRIDGE_CLIPS length)
# Bump the new-primitive's own test (e.g. weather-star-panel.test.tsx
# or imr-static-fallback.test.tsx) — the bumped length there represents
# the value AFTER the second PR's primitive lands too.
# Re-run skills-sync regen:
pnpm --filter @stageflip/runtimes-frame-runtime-bridge build
pnpm --filter @stageflip/skills-sync build
pnpm skills-sync
git add -u && git rebase --continue && git push --force-with-lease
```

**After each merge**: wait for CI green, then merge via `gh pr merge <num> --squash --delete-branch`. Auto-merge is disabled per repo policy. **Note**: the `gh pr merge` may print a `git: 'main' is already used by worktree` error — this is local-git noise; the merge happens on GitHub's side regardless. Verify with `gh pr view <num> --json state,mergedAt`.

### 4.3 After all 6 PRs merge

Cluster C: 6/6 ELIGIBLE. Total: 46/51 signed (90%). Still need:

- **T-347 cluster compose-tools handler bundle** (4 tools: `compose_weather_alert` / `compose_forecast_map` / `compose_storm_track` / `compose_temperature_map`). Mirrors prior cluster compose-tools PRs (T-340 cluster-b-compose / T-368 cluster-f-compose / T-331 cluster-a-compose / T-361 cluster-e-compose).
- **Cluster C PO ratification** + handover-doc closeout (replaces this doc with `docs/handover-phase13-cluster-c-eligible-and-ratified.md`).

---

## 5. Established workflow conventions (locked-in patterns)

### 5.1 Spec-first, then impl

Every preset/primitive task gets a spec doc in `docs/tasks/T-XXX.md` BEFORE impl. In recent practice (this session) we shipped spec + impl in the SAME PR (two commits), which works fine when the work is happening in one continuous session. The spec commit is the first commit on the branch; impl commits follow on top.

### 5.2 Pattern C resolver dispatch (`DEFAULT_CLIP_KIND_RESOLVER` vs `PRESET_ID_BINDINGS`)

**First preset for a new clipKind** → wired via `DEFAULT_CLIP_KIND_RESOLVER` (the clipKind-default arm). Adds an `if (clipKind === 'X') return XBinding;` line to the resolver.

**Subsequent presets for the same clipKind** → wired via `PRESET_ID_BINDINGS['<preset-id>'] = XBinding`. NO change to `DEFAULT_CLIP_KIND_RESOLVER`.

**Presets that override to a different primitive** (e.g. T-328 msnbc-big-board, T-339 uefa-starball, T-347g twc-retrocast-8bit, T-347h twc-immersive-mixed-reality) → keep preset's `clipKind` unchanged in frontmatter; the binding's `clipName` field overrides which primitive renders. Wired via `PRESET_ID_BINDINGS`.

### 5.3 Pattern D in-PR sign-off

Preset impl PRs include EVERYTHING in one PR (manually squash-merged):
- Preset markdown promotion (`status: stub` → `substantive`)
- Resolver entry (binding constant + `DEFAULT_CLIP_KIND_RESOLVER` arm OR `PRESET_ID_BINDINGS` entry)
- Generated parity golden (`parity-fixtures/<cluster>/<preset-id>/golden-frame-N.png`)
- `thresholds.json`
- Frontmatter `signOff.parityFixture: signed:YYYY-MM-DD` after PO visual ratification

### 5.4 Pattern E build chain

Before any `scripts/generate-preset-parity-fixture-prod.ts` invocation:

```bash
pnpm --filter @stageflip/runtimes-frame-runtime-bridge build && \
  pnpm --filter @stageflip/cdp-host-bundle build
```

If new primitive code is in the picture, also build `@stageflip/runtimes-contract` and `@stageflip/frame-runtime`.

### 5.5 F-4 generator flags

`scripts/generate-preset-parity-fixture-prod.ts` accepts `--psnr=N --ssim=N --mark-signed` to set thresholds + auto-promote `signOff.parityFixture` to `signed:YYYY-MM-DD`. Add `--force` to overwrite an already-signed entry.

`--fps` flag is NOT supported. Only `--frame=N` (default fps applies — typically 30 fps for the 1280×720 default canvas).

### 5.6 §13 verification posture (F-30; CLAUDE.md §13)

Any **structural extension** (new field on `ClipKindBinding` / `RIRElement` / `RIRDocument`, new element type, new compositing mode, new top-level prop materially changing render, new runtime kind plumbed through `findClip(kind)`) requires end-to-end render verification per CLAUDE.md §13. Three acceptable evidence forms:

1. Real-render integration test asserting on observable output (decoded PNG pixel buckets via T-348b non-blank gate are a lower-bound acceptable assertion).
2. Reference preset signed off via the parity-fixture flow + PO visual inspection (this is what every Cluster C preset PR is doing).
3. Explicit deferral note naming a downstream consumer task whose first-render is the verification step.

The Phase 2-vs-2.5 split in the Cluster D remediation is the worked example of why this rule exists — Phase 2 unit tests passed but the wiring didn't compose at the renderer level.

### 5.7 Multi-clip composition

`ClipKindBinding.overlays?: ReadonlyArray<{ runtimeId, clipName, buildProps }>` extends single-clip bindings to N+1 elements with strictly-increasing zIndex. Used by Cluster D presets (T-348 stranger-things-benguiat etc). 

Per Phase 2.5 fix: primitives that need to composite with content below in the z-stack declare `mixBlendMode?: string` on their `ClipDefinition`. The host renderer (`composition.tsx` ElementNode) reads it and applies on the OUTER per-element wrapper. Inline `mix-blend-mode` inside the primitive's React subtree DOES NOT WORK — each per-element wrapper has its own `position: absolute` + `z-index` and creates a stacking context, isolating an inline blend.

### 5.8 Sealed canonical palettes

Cluster C primitives all bake their canonical palettes as static module-level constants exported from the primitive file. `Object.freeze(...)` for runtime-immutability. Caller-supplied palette overrides REJECTED (these are public-interest standards / first-class brand canon per cluster SKILL "Color palettes are standard, not brand"). Theme-slot fallback ONLY for `background` + `foreground`; palettes themselves NOT theme-bound.

### 5.9 Lowercase changeset filenames

`.changeset/t-XXX-...md` (lowercase). CI regex rejects uppercase per memory file `feedback_changeset_lowercase` (or whatever the rule is in the changeset config — verified by Cluster G PR series).

### 5.10 Auto-merge disabled

Use `gh pr merge <pr-number> --squash --delete-branch` (no `--auto`). Be aware: when running from a worktree, `gh pr merge` may print a local-git error (`fatal: 'main' is already used by worktree`) — this is harmless; the merge happens on GitHub's side regardless.

### 5.11 NEVER `git add -A` / `.`

Use specific paths only. `project_init/` is untracked scaffolding; it must NOT be swept into commits. Per memory file `feedback_git_add_specific_paths.md`.

### 5.12 Biome format every touched file before commit

`pnpm exec biome format --write <files>` (and sometimes `pnpm exec biome check --write <files>` to auto-fix import-order errors). CI runs strict biome checks; local lint can pass loosely on code that CI rejects (per memory `feedback_biome_format_before_commit.md`).

### 5.13 Subagent dispatch posture

- Spawn `general-purpose` subagent for spec PRs (S-sized).
- Spawn `general-purpose` subagent for impl PRs (M-sized work; L-sized may timeout — split into spec+impl two-PR pairs if the impl is >800 LOC).
- Inline-write specs in main thread when context window allows (faster than re-dispatching).
- Background subagents share the working tree per memory `feedback_subagent_shared_worktree.md` — avoid concurrent git checkout/commit/push from multiple subagents.

### 5.14 F-18 / CI flake recovery

600s `protocolTimeout` reduces render-e2e flakes but doesn't eliminate them. If a render-e2e failure is the only failure and the log shows `Page.captureScreenshot timed out`, run `gh run rerun <run-id> --failed` (succeeds eventually as a different runner picks up). If ffmpeg install hangs >5 min, `gh run cancel <run-id>` then `gh run rerun <run-id> --failed`.

### 5.15 Skills-sync auto-gen freshness

Adding a new bridge clip to `ALL_BRIDGE_CLIPS` requires:
1. Update `packages/skills-sync/src/live-runtime-manifest.ts` (the static manifest)
2. Run `pnpm --filter @stageflip/skills-sync build && pnpm skills-sync` to regenerate `skills/stageflip/clips/catalog/SKILL.md` + `skills/stageflip/runtimes/SKILL.md` + `skills/stageflip/reference/cli/SKILL.md`
3. Commit the regenerated SKILL.md files alongside the primitive code

CI gate `pnpm skills-sync:check` will fail if any auto-gen file drifts.

### 5.16 DO NOT touch `docs/ops/parity-fixture-signoff.md`

That doc is procedural-only; sign-off lives in preset frontmatter only (`signOff.parityFixture: signed:YYYY-MM-DD`). Per memory `feedback_parity_signoff_doc_is_procedural.md`.

---

## 6. Memory files to read before any commit

In `~/.claude/projects/-Users-mario-projects-stageflip/memory/`:

- `feedback_git_add_specific_paths.md` — never `git add -A` / `.`
- `feedback_biome_format_before_commit.md` — biome format every touched file
- `feedback_parity_signoff_doc_is_procedural.md` — don't touch sign-off doc
- `feedback_subagent_shared_worktree.md` — concurrent subagent caveats
- `feedback_subagent_worktree_bash.md` — `isolation: worktree` agents can't run Bash
- `feedback_phase_closeout_timing.md` — phase-N closeout lands at phase-N+1 start
- `feedback_t304_lessons.md` — spec-vs-stub mismatches; browser-bundle hazards
- `feedback_phase9_closeout_difficulty_assessment.md` — closeout includes remaining-phases risk

---

## 7. Architecture — key files + entry points

- **CLAUDE.md** — project rulebook (§3 hard rules; §11 implementer's checklist; §13 structural-extension verification)
- **docs/architecture.md** — overall architecture
- **docs/implementation-plan.md** — Phase 13 task list
- **docs/decisions/** — ADRs (ADR-004 preset system; ADR-005 frontier runtime)
- **docs/handover-cluster-d-regression.md** — Cluster D regression remediation (CLOSED)
- **packages/runtimes/contract/src/index.ts** — `ClipDefinition` interface (notes new optional `mixBlendMode?: string` field per T-348a.1)
- **packages/runtimes/frame-runtime-bridge/src/clips/index.ts** — `ALL_BRIDGE_CLIPS` array (length 60 on `main`; 61/62 after T-347g/h merge)
- **packages/runtimes/frame-runtime-bridge/src/clips/weather-map.tsx** — T-347a sealed three-style primitive
- **packages/runtimes/frame-runtime-bridge/src/clips/storm-tracker.tsx** — T-347b mandatory-disclaimer primitive
- **packages/runtimes/frame-runtime-bridge/src/clips/weather-star-panel.tsx** — T-347g WeatherStar 4000 register (in flight via #455)
- **packages/runtimes/frame-runtime-bridge/src/clips/imr-static-fallback.tsx** — T-347h IMR static fallback (in flight via #456)
- **packages/parity-cli/src/generate-fixture.ts** — `DEFAULT_CLIP_KIND_RESOLVER` + `PRESET_ID_BINDINGS` (line 3389ish for the map)
- **packages/cdp-host-bundle/src/composition.tsx** — `ElementNode` (T-348a.1: reads `mixBlendMode` from clip definition + applies on outer wrapper)
- **packages/skills-sync/src/live-runtime-manifest.ts** — static manifest matched by `cdp-host-bundle/runtimes.test.ts` cross-check
- **scripts/check-preset-integrity.ts** — 15 invariants incl. T-348b parityFixture-non-blank
- **scripts/generate-preset-parity-fixture-prod.ts** — parity-golden generator
- **scripts/check-cluster-eligibility.ts** — per-cluster status

---

## 8. Where things go (CLAUDE.md §10 reminder)

| Adding... | Goes in |
|---|---|
| New agent tool | Handler in `packages/engine/src/handlers/<category>/` + registry update + `skills/stageflip/tools/<category>/SKILL.md` |
| New clip | `packages/runtimes/<runtime-kind>/src/clips/<clip-name>/` + registry + parity fixture + skill update |
| New primitive (Cluster C-style) | `packages/runtimes/frame-runtime-bridge/src/clips/<name>.tsx` + tests + barrel export + `ALL_BRIDGE_CLIPS` entry + skills-sync manifest entry + `cdp-host-bundle/runtimes.test.ts` count + kind list bump + 12 sibling clip tests' length-assertion bump + SKILL.md row |
| New element type | `packages/schema/src/elements/<name>.ts` + Zod schema + RIR compiler update + renderer-core dispatcher + skill |
| New cluster C-style preset (consumer of existing primitive) | Binding constant in `parity-cli/src/generate-fixture.ts` + `DEFAULT_CLIP_KIND_RESOLVER` arm OR `PRESET_ID_BINDINGS` entry + frontmatter `status: substantive` + parity golden + thresholds + sign-off + changeset |

---

## 9. Cluster H — outstanding (next dispatch after Cluster C closes)

Per Phase 13 plan: 5 AR-overlay presets:

- `sky-sports-ar-formations` (T-375)
- `hawkeye-var-3d-skeletal` (T-376)
- `olympic-swim-lane-track` (T-377)
- `nba-ar-replay` (T-378)
- (one more — check stub directory)

Cluster H is the **frontier track** per ADR-005 — depends on `T-384 ThreeSceneClip` (which has shipped per the Track C γ-live primitives — see prior handover §1 phase-history list). Likely needs new `arOverlay` primitive + per-preset bindings, mirroring Cluster C dispatch shape.

Other Phase 13 closeout work:

- **T-407 — `arrange_reveal` semantic tool** (staggered headline → body → media) — M
- **T-408 — Export matrix routing** (MP4 / PPTX → static; HTML / display-interactive → live) — M
- **T-409 — CI: preset × export parity job** (cross-product matrix) — M
- **T-410 — GA readiness checklist pass** — M
- **T-411 — Enterprise admin flows** (tenant-level frontier enablement) — M
- **T-412 — Documentation pass** (user-manual + skill index) — M
- **T-413 — Phase 13 closeout handover** at `docs/handover-phase13-complete.md` (per memory: write at P14 start) — S
- **T-414 — Phase 13 ratification checkpoint** — S

Track A finale (T-397-T-405) — renderer-cdp interactive hosting + on-device player + 3-stage security review — also outstanding; gated on a 3-stage security review and not solo-dispatchable.

---

## 10. Quick command reference

```bash
# Verify all gates green on main
pnpm typecheck && pnpm lint && pnpm test
pnpm check-licenses && pnpm check-remotion-imports && pnpm check-determinism
pnpm check-skill-drift && pnpm gen:tool-skills:check
pnpm tsx scripts/check-preset-integrity.ts

# Build chain (Pattern E) before parity-fixture generation
pnpm --filter @stageflip/runtimes-contract build
pnpm --filter @stageflip/frame-runtime build
pnpm --filter @stageflip/runtimes-frame-runtime-bridge build
pnpm --filter @stageflip/cdp-host-bundle build

# Generate a parity golden for a preset
pnpm tsx scripts/generate-preset-parity-fixture-prod.ts \
  --preset=<preset-id> \
  --frame=<N> \
  --psnr=<N> \
  --ssim=<N> \
  --mark-signed [--force]

# Check cluster eligibility
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=<cluster-name>

# Skills-sync regen after adding a primitive
pnpm --filter @stageflip/skills-sync build && pnpm skills-sync

# Open / merge PR (auto-merge disabled; manual squash)
gh pr create --title "[T-XXX] ..." --body "$(cat <<'EOF'
...
EOF
)"
gh pr merge <num> --squash --delete-branch

# Wait until a PR's CI completes (background pattern)
until [[ -z "$(gh pr view <num> --json statusCheckRollup -q '[.statusCheckRollup[] | select(.status == "IN_PROGRESS" or .status == "PENDING" or .status == "QUEUED")] | length' | grep -v '^0$')" ]]; do sleep 30; done
```

---

## 11. Recommended next-session opening move

1. Read this handover top-to-bottom.
2. Check open PR status:
   ```bash
   for n in 451 452 453 454 455 456; do
     gh pr view $n --json number,title,state,mergeable,statusCheckRollup -q '"#" + (.number|tostring) + " [" + .state + "] mergeable=" + .mergeable + " " + .title' ;
   done
   ```
3. If any of the 6 PRs has CI failures, investigate and fix.
4. If all are green, start merging in the order recommended in §4.1: #451 → #454 → #452 → #453 → #455 → #456. After each merge, verify the next PR's CI is still green (it'll re-run on the new main HEAD); if rebase conflicts, follow the §4.2 fixup procedure.
5. After all 6 merge: re-run `pnpm tsx scripts/check-cluster-eligibility.ts --cluster=weather` to confirm 6/6 ELIGIBLE.
6. Dispatch the **T-347 cluster compose-tools handler bundle** — 4 tools per cluster SKILL `compose_*` list. Mirrors prior cluster compose-tools precedents (see §4.3).
7. Schedule Cluster C PO ratification + handover-doc closeout.
