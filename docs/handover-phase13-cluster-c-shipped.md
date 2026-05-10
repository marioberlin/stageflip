---
title: Phase 13 — Cluster C shipped (6/6 ELIGIBLE + compose-tools landed; awaiting PO ratification + Cluster H dispatch)
id: docs/handover-phase13-cluster-c-shipped
phase: 13
size: M
owner_role: orchestrator
status: open
last_updated: 2026-05-10
supersedes: docs/handover-phase13-cluster-c-in-flight.md
related:
  - docs/handover-cluster-d-regression.md
  - docs/tasks/T-347.md
  - docs/tasks/T-347a.md
  - docs/tasks/T-347b.md
  - docs/tasks/T-347c.md
  - docs/tasks/T-347d.md
  - docs/tasks/T-347e.md
  - docs/tasks/T-347f.md
  - docs/tasks/T-347g.md
  - docs/tasks/T-347h.md
---

# Handover — Phase 13 Cluster C shipped (2026-05-10)

If you are the next agent picking this up: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md` §"Phase 13".

**Current state**: Phase 13 is mid-flight. Cluster C is **6/6 ELIGIBLE** with the compose-tools handler bundle landed. **Cluster C PO ratification is the only outstanding piece for Cluster C.** Cluster H is the next dispatchable cluster.

**Mandatory first action**: read this handover top-to-bottom. Then run gates against `main` to verify green:

```bash
git checkout main && git pull --ff-only
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm check-skill-drift && pnpm gen:tool-skills:check
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=news       # → ELIGIBLE (8/8)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=sports     # → ELIGIBLE (9/9)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=titles     # → ELIGIBLE (6/6)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=data       # → ELIGIBLE (6/6)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=captions   # → ELIGIBLE (6/6)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=ctas       # → ELIGIBLE (5/5)
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=weather    # → ELIGIBLE (6/6) ← SHIPPED THIS SESSION
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=ar         # → 0/4 NOT ELIGIBLE (Cluster H — not yet dispatched)
```

---

## 1. Cluster status snapshot

| Cluster | Domain | Total | Signed | Eligible? | Compose tools? | Ratified? |
|---|---|---|---|---|---|---|
| **A** | broadcast / news | **8** | **8** | ✅ | ✅ T-331 | ✅ |
| **B** | sports | **9** | **9** | ✅ | ✅ T-340 | ✅ |
| **C** | **weather** | **6** | **6** | ✅ **(SHIPPED THIS SESSION)** | ✅ **T-347 (this session)** | ⏳ **awaiting PO** |
| **D** | titles | **6** | **6** | ✅ | (no compose; titles ship as-is per cluster pattern) | ✅ RE-RATIFIED post-regression |
| **E** | data | **6** | **6** | ✅ | ✅ T-361 | ✅ |
| **F** | captions | **6** | **6** | ✅ | ✅ T-368 | ✅ |
| **G** | CTA / social | **5** | **5** | ✅ | ✅ T-374 | ✅ |
| **H** | **AR overlays** | **4** | **0** | ❌ next dispatch | (T-379 plan) | — |
| **TOTAL** | — | **50** | **46** | **7 of 8** | **6 of 7 with composers** | **6 of 8** |

(Cluster H is **4 presets**, not 5 as previously stated in `docs/handover-phase13-cluster-c-in-flight.md` §9. The directory `skills/stageflip/presets/ar/` has 4 stubs only.)

---

## 2. What shipped this session

Eight PRs merged on top of the in-flight cluster-C handover (#457):

| PR | Task | Outcome |
|---|---|---|
| **#457** | (handover) | Phase 13 Cluster C in-flight handover landed for next-session reference |
| **#451** | T-347c | `bbc-mark-allen-clouds` preset (first weatherMap consumer; Pattern C clipKind-default arm) |
| **#454** | T-347f | `nhc-cone-of-uncertainty` preset (only stormTracker consumer; mandatory beyond-cone-impact disclaimer) |
| **#452** | T-347d | `doppler-dbz-standard` preset (second weatherMap consumer; first PRESET_ID_BINDINGS override; tests bumped 30→31) |
| **#453** | T-347e | `heat-map-cool-to-warm` preset (third + final weatherMap consumer; tests 31→32) |
| **#455** | T-347g | `weatherStar4000Panel` primitive + `twc-retrocast-8bit` preset (Cluster C 5/6; ALL_BRIDGE_CLIPS 60→61; +12 sibling test bumps) |
| **#456** | T-347h | `imrStaticFallback` primitive + `twc-immersive-mixed-reality` preset (Cluster C 6/6 — CLOSES ELIGIBLE; ALL_BRIDGE_CLIPS 61→62) |
| **#458** | T-347 | `cluster-c-compose` handler bundle (4 tools: `compose_weather_alert` / `compose_forecast_map` / `compose_storm_track` / `compose_temperature_map`) — agent-layer wrap |

**Cluster C 6/6 ELIGIBLE confirmed** via `pnpm tsx scripts/check-cluster-eligibility.ts --cluster=weather` post-#456.

**ALL_BRIDGE_CLIPS @ 62** on main (was 60 pre-session: #449 + #450 had already added weatherMap + stormTracker; #455 added weatherStar4000Panel; #456 added imrStaticFallback).

**PRESET_ID_BINDINGS @ 32** entries on main (added: doppler-dbz-standard, heat-map-cool-to-warm, twc-retrocast-8bit, twc-immersive-mixed-reality. NOT added: bbc-mark-allen-clouds + nhc-cone-of-uncertainty — those go through `DEFAULT_CLIP_KIND_RESOLVER` clipKind-default arm).

**Canonical bundle count @ 23** (was 22; added cluster-c-compose).

---

## 3. NEW lessons from this session — bake into next dispatch

The cluster-compose dispatch (T-347, PR #458) had **three follow-up fixes** post-PR-creation that the next compose dispatch can pre-empt:

### 3.1 LESSON: `createCanonicalRegistry` count assertion needs bumping

`packages/engine/src/bundles/registry.test.ts` line ~67 has `expect(r.size).toBe(N)`. Adding a new compose bundle bumps N+1.

```typescript
it('seeds the 23 canonical bundles', () => {  // ← bump count + name
  const r = createCanonicalRegistry();
  expect(r.size).toBe(23);                    // ← bump count
  ...
});
```

### 3.2 LESSON: Orchestrator wiring is a SECOND register site

The cluster-compose pattern requires THREE separate registration edits, not two:

1. **`scripts/gen-tool-skills.ts`** — for skill auto-generation (already documented in T-340 §D-T340-14)
2. **`packages/app-agent/src/orchestrator.ts`** — for runtime orchestrator (NOT in T-340 spec; **add to checklist**)
3. **`packages/engine/src/bundles/catalog.ts`** — for `CANONICAL_BUNDLES` array

Forgetting (2) causes a passing local-test surprise: `pnpm --filter @stageflip/engine test` is green, but `pnpm --filter @stageflip/app-agent test` fails with `expected N to be N-1` on the orchestrator-bundle-count assertion.

```typescript
// packages/app-agent/src/orchestrator.ts
import {
  ...
  registerClusterCComposeBundle,    // ← add import
  ...
} from '@stageflip/engine';

// inside createOrchestrator()
registerClusterCComposeBundle(registry, router);   // ← add call
```

And bump `packages/app-agent/src/orchestrator.test.ts`:
```typescript
it('registers all 23 handler bundles on the router', () => {  // ← bump count + name
  ...
  expect(summaries.length).toBe(23);                          // ← bump count
});
```
And the comment near line 5: `// verify only the wiring: registry is populated with all 23 bundles,` ← bump.

### 3.3 LESSON: `tools/SKILL.md` regen drifts after orchestrator wiring

Wiring a new bundle into `packages/app-agent/orchestrator.ts` shifts the bundle order in the auto-generated `skills/stageflip/tools/SKILL.md`. Run `pnpm skills-sync` after wiring; commit the regen separately.

### 3.4 Suggested edit to T-340 spec

Append a new section §D-T340-19 documenting the THREE-site registration (engine catalog + gen-tool-skills + app-agent orchestrator) and the THREE-site test bumps (engine registry.test + app-agent orchestrator.test + skills-sync regen). Reference this handover §3.

---

## 4. Established workflow conventions (locked-in patterns; carry forward)

All §5 conventions from `docs/handover-phase13-cluster-c-in-flight.md` still hold. Plus the 3 new lessons above. Skim `docs/handover-phase13-cluster-c-in-flight.md` (now on main via #457) for the full enumerated list. Highlights:

- **Pattern C resolver dispatch** (DEFAULT_CLIP_KIND_RESOLVER vs PRESET_ID_BINDINGS) — first preset for new clipKind via clipKind-default arm; subsequent via PRESET_ID_BINDINGS.
- **§4.2 rebase-fixup procedure** — when N PRs share `PRESET_ID_BINDINGS` map, second-and-onwards merges need conflict resolve (keep both entries) + test length-assertion bump (sed pattern in handover doc).
- **§13 verification posture** (CLAUDE.md §13 + this session's structural-extension PR for arOverlay will need this) — structural extensions require pixel-level evidence, not just unit tests.
- **Sealed canonical palettes** — Cluster C / Cluster D primitives bake palettes as static module-level constants (Cluster H AR overlays will likely follow the same pattern).
- **Lowercase changeset filenames** — CI regex rejects uppercase.
- **NEVER `git add -A` / `.`** — workspace generates untracked artifacts.
- **Biome format every touched file** before commit.
- **Auto-merge disabled** — manual `gh pr merge <num> --squash --delete-branch`.

---

## 5. Cluster H — next dispatch target

**Cluster H = 4 AR-overlay presets** (not 5 as previously stated). All are stubs awaiting implementation. T-384 ThreeSceneClip is **MERGED** (PR #272, commit `6cfbb4c4`). T-397–T-405 (Track A renderer-cdp finale) are **NOT merged** — Cluster H presets ship with `staticFallback` posters; live-mount is gated on Track A.

### 5.1 Cluster H ledger

| Preset | clipKind | Frontier-runtime intent | Status |
|---|---|---|---|
| `sky-sports-ar-formations` (T-375) | `arOverlay` (NEW kind) | ThreeSceneClip + camera-track | stub, pending-user-review |
| `hawkeye-var-3d-skeletal` (T-376) | `arOverlay` | ThreeSceneClip + Hawk-Eye limb tracking | stub |
| `olympic-swim-lane-track` (T-377) | `arOverlay` | ThreeSceneClip + LiveDataClip (Omega timing) — declares `permissions: ['network']` | stub |
| `nba-ar-replay` (T-378) | `arOverlay` | ThreeSceneClip + slow-mo + court-anchored parabolic arc | stub |

**No fifth preset.** The handover doc §9 was wrong.

### 5.2 Recommended dispatch sequence (~6 PRs, 1.5–2 wall-day cycle)

1. **PR1 — `arOverlay` bridge-clip primitive** (M) — wraps `ThreeSceneClip` from `@stageflip/runtimes-interactive`; props include `staticFallback` + `setupRef` + `permissions`. Adds `arOverlay` clipKind to `RIRElement` discriminator (schema PR companion or in same PR; verify via `packages/schema/src/elements/clip-binding.ts`). Adds to `ALL_BRIDGE_CLIPS` (62→63), updates manifest + 12 sibling tests + `cdp-host-bundle/runtimes.test.ts` + SKILL.md (per §4.2 bump pattern).
2. **PR2 — T-375 `sky-sports-ar-formations`** (L) — first `arOverlay` consumer; resolver-default arm; pre-baked static-fallback poster as parity golden; **§13 verifier for the new clipKind** (PO visual ratification = end-to-end render verification per CLAUDE.md §13).
3. **PR3 — T-376 `hawkeye-var-3d-skeletal`** (L) — second consumer via `PRESET_ID_BINDINGS`.
4. **PR4 — T-377 `olympic-swim-lane-track`** (L) — third consumer; declares network permission.
5. **PR5 — T-378 `nba-ar-replay`** (L) — fourth + final preset; closes Cluster H to 4/4 ELIGIBLE.
6. **PR6 — T-379 cluster-h-compose** (M) — 4 tools dispatching the 4 presets; mirrors T-347 pattern; **bake §3 lessons into the spec** (orchestrator wiring + canonical-bundle 23→24 + lowercase changeset).

### 5.3 Cluster H risks

- **Track A finale gates live-mount.** Cluster H presets are renderable as static fallbacks but cannot live-mount until renderer-cdp interactive hosting (T-397+) ships. Do NOT block Cluster H closure on Track A; ship presets with static-fallback posters as the §13 evidence; defer live-mount validation to a downstream Track A consumer task.
- **Trademark exposure** — Sky Sports / Hawk-Eye / Olympic / NBA visual canon. Verify each preset stub doesn't introduce IP risk in binding code (palette + symbol set, not logos).
- **§13 (F-30) — pixel verification on static-fallback** — the parity-golden non-blank gate from T-348b catches blank-poster regressions. Each H preset's static-fallback poster MUST pass `parityFixture-non-blank`.
- **`arOverlay` clipKind addition is structural extension** — needs §13 verification posture; PR2 (sky-sports-ar-formations) is the §13 verifier (deferred from PR1 per CLAUDE.md §13 acceptable-evidence option 3).
- **Cluster D regression backstop applies** — multi-clip composition with mixBlendMode lessons from T-348a.1 (PR #448) should propagate if AR overlays composite with sport-context backgrounds. Verify mix-blend-mode wrapper hoist if AR overlay is meant to composite over a video background.

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
- `feedback_changeset_lowercase` — CI rejects uppercase changeset filenames

---

## 7. Architecture — key files + entry points

- **CLAUDE.md** — project rulebook (§3 hard rules; §11 implementer's checklist; §13 structural-extension verification)
- **docs/architecture.md** — overall architecture
- **docs/implementation-plan.md** — Phase 13 task list
- **docs/decisions/ADR-004-preset-system.md** — preset system contract
- **docs/decisions/ADR-005-frontier-clip-catalogue.md** — frontier runtime + IMR static-fallback
- **docs/handover-phase13-cluster-c-in-flight.md** — superseded predecessor (still useful for the §5 conventions enumeration)
- **docs/handover-cluster-d-regression.md** — Cluster D regression remediation (CLOSED; reference for §13 origin)
- **docs/tasks/T-340.md** — canonical M-sized cluster-compose template (this session shipped T-347 as a follow-on)
- **docs/tasks/T-347.md** — Cluster C compose-tools spec (NEW this session)
- **packages/runtimes/contract/src/index.ts** — `ClipDefinition` interface (incl. `mixBlendMode?: string` per T-348a.1)
- **packages/runtimes/frame-runtime-bridge/src/clips/index.ts** — `ALL_BRIDGE_CLIPS` array (length **62** on `main`; will be 63 after Cluster H primitive PR)
- **packages/runtimes/interactive/src/clips/three-scene/** — T-384 ThreeSceneClip (MERGED; Cluster H primitive will wrap this)
- **packages/parity-cli/src/generate-fixture.ts** — `DEFAULT_CLIP_KIND_RESOLVER` + `PRESET_ID_BINDINGS` (line ~3870 for the resolver block; ~3930 for the resolver function)
- **packages/cdp-host-bundle/src/composition.tsx** — `ElementNode` (T-348a.1: reads `mixBlendMode` from clip definition)
- **packages/skills-sync/src/live-runtime-manifest.ts** — static manifest matched by `cdp-host-bundle/runtimes.test.ts`
- **packages/engine/src/handlers/cluster-c-compose/** — NEW this session; canonical pattern for Cluster H compose
- **packages/engine/src/bundles/catalog.ts** — `CANONICAL_BUNDLES` (length **23** on `main`)
- **packages/engine/src/bundles/registry.test.ts** — `createCanonicalRegistry` size assertion
- **packages/app-agent/src/orchestrator.ts** — runtime orchestrator (NEW lesson per §3.2 — must wire each new bundle here too)
- **packages/app-agent/src/orchestrator.test.ts** — bundle-count + tool-count assertion
- **scripts/gen-tool-skills.ts** — tool-skills generator (must add new bundle to imports + OWNER_TASK_MAP + populateRegistry)
- **scripts/check-preset-integrity.ts** — 15 invariants incl. T-348b parityFixture-non-blank
- **scripts/check-cluster-eligibility.ts** — per-cluster status

---

## 8. Where things go (CLAUDE.md §10 reminder + this-session augmentations)

| Adding... | Goes in |
|---|---|
| New agent tool | Handler in `packages/engine/src/handlers/<category>/` + registry update + `skills/stageflip/tools/<category>/SKILL.md` |
| New cluster-compose bundle | Handler dir per above + 3-site registration: `packages/engine/src/bundles/catalog.ts` + `scripts/gen-tool-skills.ts` + **`packages/app-agent/src/orchestrator.ts`** (THIS WAS THE NEW LESSON FROM #458) + bump count tests in `packages/engine/src/bundles/registry.test.ts` AND `packages/app-agent/src/orchestrator.test.ts` |
| New clip | `packages/runtimes/<runtime-kind>/src/clips/<clip-name>/` + registry + parity fixture + skill update |
| New primitive (Cluster C-style) | `packages/runtimes/frame-runtime-bridge/src/clips/<name>.tsx` + tests + barrel export + `ALL_BRIDGE_CLIPS` entry + skills-sync manifest entry + `cdp-host-bundle/runtimes.test.ts` count + kind list bump + 12 sibling clip tests' length-assertion bump + SKILL.md row |
| New element type | `packages/schema/src/elements/<name>.ts` + Zod schema + RIR compiler update + renderer-core dispatcher + skill |
| New cluster C-style preset (consumer of existing primitive) | Binding constant in `parity-cli/src/generate-fixture.ts` + `DEFAULT_CLIP_KIND_RESOLVER` arm OR `PRESET_ID_BINDINGS` entry + frontmatter `status: substantive` + parity golden + thresholds + sign-off + changeset |

---

## 9. Outstanding Phase 13 work

**Per implementation-plan §"Phase 13" + this session's verifications:**

- **Cluster C PO ratification** (this is the only outstanding piece for Cluster C closure). Per memory `feedback_phase_closeout_timing.md`, ratification typically lands at the next phase's start; orchestrator schedules.
- **Cluster H** (next dispatchable cluster — 4 AR-overlay presets per §5).
- **T-407 — `arrange_reveal` semantic tool** (staggered headline → body → media) — M
- **T-408 — Export matrix routing** (MP4 / PPTX → static; HTML / display-interactive → live) — M
- **T-409 — CI: preset × export parity job** (cross-product matrix) — M
- **T-410 — GA readiness checklist pass** — M
- **T-411 — Enterprise admin flows** (tenant-level frontier enablement) — M
- **T-412 — Documentation pass** (user-manual + skill index) — M
- **T-413 — Phase 13 closeout handover** at `docs/handover-phase13-complete.md` (per memory: write at P14 start) — S
- **T-414 — Phase 13 ratification checkpoint** — S

**Track A finale (T-397–T-405)** — renderer-cdp interactive hosting + on-device player + 3-stage security review — outstanding; not solo-dispatchable; gates Cluster H live-mount but NOT Cluster H static-fallback closure.

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
# Available clusters: news, sports, weather, titles, data, captions, ctas, ar

# Skills-sync regen after adding a primitive OR adding/wiring a compose bundle
pnpm --filter @stageflip/skills-sync build && pnpm skills-sync

# Open / merge PR (auto-merge disabled; manual squash)
gh pr create --title "[T-XXX] ..." --body "$(cat <<'EOF'
...
EOF
)"
gh pr merge <num> --squash --delete-branch

# Wait until a PR's CI completes (background pattern)
until [[ "$(gh pr view <num> --json statusCheckRollup -q '[.statusCheckRollup[] | select(.status == "IN_PROGRESS" or .status == "PENDING" or .status == "QUEUED")] | length')" == "0" ]]; do sleep 30; done
```

---

## 11. Recommended next-session opening move

1. Read this handover top-to-bottom.
2. Verify gates green on `main` per the §0 commands.
3. Confirm Cluster C PO ratification status. If still pending, escalate to orchestrator. (Per memory `feedback_phase_closeout_timing.md`, this is normal — ratification lands at the next phase's start, not at this phase's end.)
4. **Dispatch Cluster H PR1 — `arOverlay` bridge-clip primitive** per §5.2. Subagent posture: `general-purpose`, M-sized. Spec + impl in same PR (recent session pattern). Bake the §3 lessons into the spec (specifically: orchestrator wiring + canonical-bundle count bumps + lowercase changeset). Also bake the F-30 §13 deferral note: PR1 defers pixel verification to PR2 (sky-sports-ar-formations).
5. After PR1 lands: dispatch PR2 (sky-sports-ar-formations) as the §13 verifier.
6. Sequence PR3-5 serially with the §4.2 rebase-fixup playbook from `docs/handover-phase13-cluster-c-in-flight.md`.
7. PR6 (cluster-h-compose) last; **mirror T-347 spec but include the §3 lessons up-front** so the dispatch is one clean PR, not three follow-up fixes.

---

**End of handover.** Phase 13 cluster status: **7 of 8 closed** (Cluster H next). Phase 13 ratification status: **6 of 8 ratified** (Cluster C awaiting PO; Cluster H not yet eligible).
