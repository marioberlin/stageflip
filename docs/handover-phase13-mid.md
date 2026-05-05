---
title: Phase 13 mid — handover
id: docs/handover-phase13-mid
owner: orchestrator
last_updated: 2026-05-05
supersedes: docs/handover-phase12-complete.md
---

# Handover — Phase 13 mid (2026-05-05)

If you are the next agent: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md` §"Phase 13 — Premium Motion Library & Frontier Runtime".

**Phase 13 is mid-flight, NOT complete.** This session shipped **52 PRs** advancing two clusters from 0/6 to 6/6 each (Clusters E + F batch-eligible) and adding 6 new bridge clip primitives. `main` at `c7df9fc`. Working tree clean (`project_init/` untracked, intentional pre-existing scaffolding NOT to be swept into commits).

**Next work**: Phase 13 still has ~80 tasks across 6 unfinished clusters + Track A finale + GA closeout. Recommended dispatch order documented in §6.

**Mandatory first action**: read this handover top-to-bottom. Then run `pnpm typecheck && pnpm lint && pnpm test && pnpm check-skill-drift` to verify the green-on-main claim independently. After that, pick from §6 dispatch options.

---

## 1. Where we are

### Phase history

- Phases 0–12: ratified.
- **Phase 13 (Premium Motion Library & Frontier Runtime)**: mid-flight. Phase α primitives (T-301 → T-313) all done before this session. Track C γ-live primitives (T-383 → T-396) all done before this session. This session shipped Clusters E + F end-to-end + the L primitives that opened them.

### What this session shipped (52 PRs, chronological)

**Track C completion + first preset infra (PRs #297–#305, 9 PRs):**

| PR | Task | Notes |
|---|---|---|
| #297 | T-406 chart family | unified `chart` clipKind dispatching to 7 renderers (bar/line/area/pie/donut/scatter/combo) |
| #298 | T-359 spec | first Cluster E preset (`f1-sector-purple-green`) |
| #299 | T-359 (markdown only) | promoted stub → substantive; parity carved out (no infra yet) |
| #300 | T-359a spec | parity multi-variant + `bindProductionRenderer` hook |
| #301 | T-359a impl | multi-variant manifests; preset-id resolver hook precedent |
| #302 | T-359b spec | run prod parity on T-359 |
| #303 | T-359c spec | tsx ↔ gsap ESM/CJS interop fix |
| #304 | T-359c impl | runtimes-gsap re-export shim |
| #305 | T-359b retry | T-359 first signed parity fixture in repo |

**Cluster E presets (PRs #306–#319, 14 PRs):**

T-358 / T-356 / T-357 each escalated at impl gate (no fitting primitive); each produced a small `Ta` carve-out. T-360 used the presetId-override mechanism introduced by T-359a. T-355 (final + L) closed the cluster.

| PR | Task | Notes |
|---|---|---|
| #306 | T-358 spec | cricket-ball-by-ball-dots (scoreBug) |
| #307 | T-358a spec | outcome-row primitive |
| #308 | T-358a impl | `outcome-row` clip (1..12 chips) |
| #309 | T-358 retry | second signed preset |
| #310 | T-360 spec | big-number-stat-impact (bigNumber count-up) |
| #311 | T-360 impl | third signed; **introduced (clipKind, presetId) → binding** resolver evolution |
| #312 | T-356 spec | bloomberg-ticker (newsTicker LiveDataClip) |
| #313 | T-356a spec | news-ticker-bar primitive |
| #314 | T-356a impl | `news-ticker-bar` clip (1..24 chips, doubled-row marquee scroll) |
| #315 | T-356 retry | fourth signed |
| #316 | T-357 spec | olympic-medal-tracker (standings LiveDataClip) |
| #317 | T-357a spec | standings-table primitive |
| #318 | T-357a impl | `standings-table` clip (1..16 rows × 2..8 cols) |
| #319 | T-357 retry | fifth signed |

**T-316 CaptionClip primitive + first Cluster F preset (PRs #320–#323, 4 PRs):**

| PR | Task | Notes |
|---|---|---|
| #320 | T-316 spec | CaptionClip primitive (6 style bundles) |
| #321 | T-316 impl | `caption` clip (614 LOC; over 600-LOC soft cap, accepted) |
| #322 | T-362 spec | hormozi-montserrat-black (first Cluster F caption) |
| #323 | T-362 impl | sixth signed (first Cluster F) |

**Cluster F presets (PRs #324–#333, 10 PRs):**

T-365 escalated post-impl due to a primitive routing bug (T-316a `resolveColor` only applied `muteOpacity` when `emphasis: 'mute'` was tagged); T-316a fix unblocked.

| PR | Task | Notes |
|---|---|---|
| #324 | T-363 spec | mrbeast-komika-axis (caption) |
| #325 | T-363 impl | seventh signed; second Cluster F |
| #326 | T-364 spec | tiktok-rounded-box (caption + pill backdrop) |
| #327 | T-364 impl | eighth signed; first to validate `backdrop: 'pill'` rendering |
| #328 | T-365 spec | ali-abdaal-opacity-karaoke |
| #329 | T-316a spec | fix `resolveColor` to honor `muteOpacity` for non-tagged words |
| #330 | T-316a impl | 1-line fix + 3 regression tests |
| #331 | T-365 retry | ninth signed; opacity-emphasis register |
| #332 | T-366 spec | netflix-invisible (strict accessibility, muteOpacity 0) |
| #333 | T-366 impl | tenth signed |

**Final Cluster E preset + closes E (PRs #334–#337, 4 PRs):**

| PR | Task | Notes |
|---|---|---|
| #334 | T-355 spec | magic-wall-drilldown (fullScreen LiveDataClip) |
| #335 | T-355a spec | magic-wall-panel primitive |
| #336 | T-355a impl | `magic-wall-panel` clip (1..56 region tiles) |
| #337 | T-355 retry | eleventh signed; **CLOSES CLUSTER E** to 6/6 |

**T-322 LyricsClip + final Cluster F preset + closes F (PRs #338–#343, 6 PRs):**

T-367 escalated post-impl due to four LyricsClip rendering bugs; T-322a 4-bug fix unblocked.

| PR | Task | Notes |
|---|---|---|
| #338 | T-322 spec | LyricsClip primitive (line-level music-synced + per-line karaoke wipe) |
| #339 | T-322 impl | `lyrics` clip (489 LOC; 3 style bundles) |
| #340 | T-367 spec | karaoke-progressive-wipe |
| #341 | T-322a spec | 4-bug fix (wipe width, line overflow, line 3 missing, glow visibility) |
| #342 | T-322a impl | all 4 bugs fixed surgically; 5 regression tests |
| #343 | T-367 retry | twelfth signed; **CLOSES CLUSTER F** to 6/6 |

### Cluster status snapshot

| Cluster | Domain | Total | Signed | Eligible? |
|---|---|---|---|---|
| A | broadcast / lower-thirds | 9 | 0 | no |
| B | sports | 9 | 0 | no |
| C | weather | 4 | 0 | no |
| D | title sequences | 6 | 0 | no |
| **E** | **data** | **6** | **6** | **✅ ELIGIBLE** |
| **F** | **captions** | **6** | **6** | **✅ ELIGIBLE** |
| G | CTA / social | 5 | 0 | no |
| H | AR overlays | 5 | 0 | no |
| Total | — | 50 | 12 | 2 of 8 |

### Bridge clip count: 49

T-131 reference-clip ports (32) + T-183/T-202 profile-tier clips (10) + this-session additions (7):

| Added in session | Source | Use cases |
|---|---|---|
| `chart` (unified family) | T-406 | Cluster E LiveData chart panels + ChartElement consumers |
| `outcome-row` | T-358a | Cluster E + B (cricket dots / tennis tiebreak / F1 sector history / soccer last-N-shots) |
| `news-ticker-bar` | T-356a | Cluster E + B (Bloomberg ticker / ESPN bottomline / financial dashboards) |
| `standings-table` | T-357a | Cluster E + B (Olympic medals / NBA / NCAA / golf leaderboards / election results) |
| `caption` | T-316 | Cluster F (6 styles: hormozi/mrbeast/tiktok/ali-abdaal/netflix/karaoke-wipe) |
| `magic-wall-panel` | T-355a | Cluster A/B/C/E (election-night / weather radar / sports brackets / scientific heatmaps) |
| `lyrics` | T-322 | Cluster F karaoke + future music-video presets |

---

## 2. Architectural patterns established this session

### Pattern A — Carve-out → retry chain

**When primitives are missing**: a preset's first Implementer pass escalates per spec. The Orchestrator then carves out a small `Ta` primitive task. After `Ta` lands, the original task retries unchanged.

Examples this session:
- T-358 → T-358a (outcome-row) → T-358 retry
- T-356 → T-356a (news-ticker-bar) → T-356 retry
- T-357 → T-357a (standings-table) → T-357 retry
- T-355 → T-355a (magic-wall-panel) → T-355 retry

### Pattern B — Primitive bug → fix → preset retry

**When primitives have rendering bugs**: surfaced by a preset's parity render. Spec a tiny fix (`Ta` or `Xa`) → ship the fix → retry the preset.

Examples:
- T-365 escalated → T-316a (`resolveColor` muteOpacity routing fix) → T-365 retry
- T-367 escalated → T-322a (4 LyricsClip rendering fixes) → T-367 retry

### Pattern C — clipKind-default vs presetId-override resolver

T-359a's `bindProductionRenderer` exposes a `ClipKindResolver` keyed by `(clipKind, presetId?)`. Convention:

- **First preset for a clipKind** uses **clipKind-default** (`DEFAULT_CLIP_KIND_RESOLVER` switch arm). Established by T-362 hormozi for `caption`, T-355 magic-wall for `fullScreen`, T-367 karaoke for `lyrics`.
- **Subsequent presets** sharing a clipKind use **`PRESET_ID_BINDINGS`** override map. T-360 introduced this when T-359 had already taken `bigNumber → animated-value`. Reused by T-363/T-364/T-365/T-366 for the cluster F caption family.

Resolver entry budget: ~25 LOC for `buildProps` (snapshot constants don't count).

### Pattern D — In-PR sign-off (post-T-359b)

T-359b was the bootstrap (carved out as a separate operational task). T-358 onward signs parity in the same PR as the markdown promotion. Workflow:

1. Promote `status: stub → substantive`
2. Add resolver entry
3. Run `pnpm tsx scripts/generate-preset-parity-fixture-prod.ts --preset=<id> --frame=<n> --mark-signed`
4. Visually inspect golden
5. Hand-pin `thresholds.json` to 42/0.98 (recurring quirk — see §4)
6. Confirm `signOff.parityFixture: signed:<UTC date>`
7. Run gates + commit specific paths

### Pattern E — `pnpm --filter ... build` after primitive merges

`@stageflip/cdp-host-bundle` consumes `dist/` of `@stageflip/runtimes-frame-runtime-bridge` and `@stageflip/skills-sync`. After a new primitive merges, retry tasks **must rebuild both** before running the prod-bound generator, or the new clipKind won't be visible to the parity flow.

```bash
pnpm --filter @stageflip/runtimes-frame-runtime-bridge build
pnpm --filter @stageflip/cdp-host-bundle build
```

This bit T-365, T-366, T-355, T-367 — flagged in spec Implementer's notes.

---

## 3. Documented primitive-side follow-ups (non-blocking)

Five small follow-ups surfaced this session. None block forward progress; each can be tackled when convenient.

| ID | Issue | Origin | Severity |
|---|---|---|---|
| F-1 | CaptionClip `background` prop ignored when `backdrop: 'none'`. Container is transparent → host canvas bleed. | T-362 | low (Cluster F caption presets all expect overlay-on-video; canvas bleed is documented quirk) |
| F-2 | Host bundle doesn't preload Google Fonts' OFL Montserrat / Inter / Bebas Neue / Anton TTF. Falls back to system stack. | T-362 / T-365 / T-367 | low (visual fidelity acceptable; broadcast-exact fonts are BYO operator concern) |
| F-3 | `magic-wall-panel` uses placeholder rectangular tiles. Real US state SVG paths require asset pipeline + projection. | T-355a | medium (election-style magic-wall is visually obvious as placeholder; future task with `us-atlas` or similar) |
| F-4 | `parity-fixtures/<…>/thresholds.json` written with `35/0.95` defaults; every preset hand-pins to `42/0.98` afterwards. | T-358-T-367 (recurring) | medium (preset-driven-thresholds infra task — author specs/CLI flag for per-preset config; saves the manual hand-pin step) |
| F-5 | `KNOWN_KINDS` allowlist in `packages/testing/src/fixture-manifest.test.ts` is one-off-per-preset. T-355's fullScreen kind hits 9-10 stubs; future first-preset-for-clipKind tasks must touch this. | T-358a + T-355 | low (mechanical; document in workflow doc) |

---

## 4. Open quirks worth knowing

- **`project_init/`** is untracked (pre-existing scaffolding). NEVER `git add -A`. All commits in this session used specific paths per `MEMORY.md` `feedback_git_add_specific_paths.md`.
- **`docs/compass.md`** does NOT exist on disk. `check-preset-integrity.ts`'s invariant 7 (compass-anchor verification) is globally SKIPped because the file is missing. Pre-existing, project-wide. Frontmatter `source:` fields reference the missing file but the gate degrades gracefully. Resolution would either rename an existing doc or fix `COMPASS_PATH_DEFAULT` in the script — out of scope for any preset task.
- **Type-design batch sign-off** for Clusters A/B/D/F/G is owned by **T-382** (separate task). All Cluster F presets signed in this session carry `signOff.typeDesign: pending-cluster-batch` — that's the expected state.
- **`signOff.typeDesign: na`** for Cluster E presets — Cluster E is NOT in `TYPE_DESIGN_REQUIRED_CLUSTERS` per `check-preset-integrity.ts`.
- **CI auto-merge flow**: PRs in this session were squash-merged via `gh pr merge --squash --delete-branch --auto`. CI runs typecheck/lint/test/gates + e2e/parity/render-e2e/changeset-present. Merge fires when checks complete or eligibility allows.

---

## 5. Skills + plan changes this session

- `skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md` — clip catalog grew from 42 → 49 entries (7 added).
- `skills/stageflip/runtimes/chart/SKILL.md` — promoted from placeholder to substantive (T-406).
- `packages/skills-sync/src/live-runtime-manifest.ts` — clip list grew 42 → 49.
- `packages/cdp-host-bundle/src/runtimes.test.ts` — clip count test 42 → 49 + expectedKinds list mirrors.
- `scripts/check-preset-integrity.ts` — `VALID_CLIP_KINDS` already had `caption`, `lyrics` slots before T-316/T-322 (verified during impl).
- All cluster E (`skills/stageflip/presets/data/*.md`) and cluster F (`skills/stageflip/presets/captions/*.md`) preset stubs promoted to `status: substantive`.
- `docs/ops/parity-fixture-signoff.md` updated with Cluster F sign-off entries.
- `docs/tasks/T-355.md` through `T-367.md` + `Ta` variants — 25 new spec docs.

`pnpm check-skill-drift`: PASS as of `c7df9fc`.

---

## 6. Recommended next dispatch (priority-ordered)

### Highest leverage

1. **T-321 `TitleSequenceClip` (L primitive)** — opens all 6 Cluster D presets (T-348–T-353). Same shape as T-316/T-322. After T-321, Cluster D is the next batch-eligible target.
2. **First Cluster A preset** (e.g., **T-323 `cnn-classic`**, M, lowerThird) — opens Cluster A (9 presets). May need a `lower-third` primitive carve-out or may bind to existing `lower-third` clip directly.
3. **First Cluster B preset** — exercises the just-shipped `news-ticker-bar` and/or `outcome-row` and/or `standings-table` on a sports preset. **T-339a `espn-bottomline-flipper`** (M, newsTicker) maps directly onto `news-ticker-bar`.

### Operational

4. **T-380 batch sign-off — Cluster E** (L) — operationally close Cluster E into the cluster-merge ledger. Requires user/product-owner sign-off per ADR-004 §D5.
5. **T-381 batch sign-off — Cluster F** (L) — same shape as T-380 for Cluster F.
6. **T-361 Cluster E skill + composer tools** (M) — ships `compose_live_data` / `compose_market_ticker` / `compose_election_board` / `compose_big_number` / `compose_stat_callout`. Now valuable since all 6 Cluster E presets exist.
7. **T-368 Cluster F skill + composer tools** (M) — ships `compose_creator_caption` / etc. Same shape as T-361.

### Infra / tech-debt cleanup

8. **F-4 preset-driven-thresholds infra task** (S) — saves the manual `thresholds.json` hand-pin step on every preset. Was flagged across 12 presets this session.
9. **F-3 real US-state geometry for magic-wall-panel** (M) — needs `us-atlas` or similar asset pipeline.
10. **F-1 CaptionClip background-prop fix** (S) — small primitive fix; documented as quirk now.

### Larger structural

11. **Track A finale** (T-397–T-405): `renderer-cdp` interactive hosting + on-device display player + 3-stage security review. 9 tasks, the heaviest unfinished block. Likely the long pole on Phase 13 GA.
12. **GA closeout** (T-407–T-414): semantic tools, export matrix, CI parity, GA checklist, docs, ratification. 8 tasks.

### Recommendation for fresh agent

Start with **T-321 TitleSequenceClip**. It mirrors T-316/T-322 shape, the workflow is rock-solid (52 PRs of practice), and unlocks 6 cluster D presets. Aim to close 1-2 more clusters before pivoting to operational batch sign-off (T-380/T-381) or Track A.

---

## 7. Workflow / agent-spawning conventions

This session ran fully on auto-mode. Conventions established:

- **Every task gets a spec PR first**, drafted by an Orchestrator agent. Spec PRs are `docs(task): T-XXX spec — …` titles, single-file commits to `docs/tasks/T-XXX.md`, auto-merged into `main`.
- **After spec merges**, a fresh `task/T-XXX-<slug>` branch is created from `main` and a separate Implementer agent ships the impl PR.
- **After impl merges**, the spec considers the next dispatch step.
- **Reviewer agents** were spawned proactively for the largest PRs (T-406, T-359, T-359a) but skipped for many M-sized preset retries — auto-merge with green CI substituted. If you re-introduce mandatory Reviewer passes, expect ~2× cycle time but cleaner ratification trail.
- **Subagent prompts are self-contained** — they include the full spec direction summary, required reading list, workflow, gate matrix, escalation triggers. Pattern is now well-tested.

Branch hygiene reminders embedded in every prompt:
- `git add <specific paths>` — NEVER `-A` or `.` (`project_init/` will be swept in)
- `pnpm exec biome format --write` before committing
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` footer

---

## 8. Verification checklist for next agent

Run these before dispatching any P13 task:

```bash
git checkout main && git pull --ff-only

# Confirm clean tree (project_init/ untracked is expected)
git status

# Confirm gates green
pnpm typecheck
pnpm lint
pnpm test
pnpm check-licenses
pnpm check-remotion-imports
pnpm check-determinism
pnpm check-skill-drift
pnpm gen:tool-skills:check

# Confirm cluster eligibility claims
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=data       # → ELIGIBLE
pnpm tsx scripts/check-cluster-eligibility.ts --cluster=captions   # → ELIGIBLE

# Confirm clip count
grep -c "kind:" packages/skills-sync/src/live-runtime-manifest.ts  # frame-runtime row should list 49 clips
```

Expected `main` HEAD: **`c7df9fc`** (or descendant if `changeset-release` automation has fired).

---

## 9. Pointers for unfamiliar surfaces

- **CLAUDE.md** — hard rules (§3 determinism, §4 workflow, §10 where things go, §11 Implementer's checklist).
- **`docs/implementation-plan.md` §"Phase 13"** — task list lines 567–800 + dependency gates lines 795–814.
- **`docs/adr/ADR-003.md`** — Interactive Runtime Tier (LiveDataClip + WebEmbedClip + AiChatClip + AiGenerativeClip + VoiceClip).
- **`docs/adr/ADR-004.md`** — Preset System (frontmatter shape, sign-off ladder, type-design batch process).
- **`docs/adr/ADR-005.md`** — Frontier Clip Catalogue.
- **`docs/ops/parity-fixture-signoff.md`** — operational workflow for the prod-bound parity generator. **Follow as a customer**.
- **`packages/parity-cli/src/generate-fixture.ts`** — clipKind resolver. Pattern map of all session bindings.
- **`packages/runtimes/frame-runtime-bridge/src/clips/{outcome-row,news-ticker-bar,standings-table,magic-wall-panel,caption,lyrics}.tsx`** — primitives shipped this session.
- **`MEMORY.md`** — `feedback_git_add_specific_paths.md`, `feedback_format_before_commit.md`, etc. Read before any commit.

---

## 10. PR cycle times observed

For calibration:
- **Spec PR**: ~3-8 minutes (Orchestrator agent draft + commit + push + open + auto-merge).
- **Implementer PR (clean)**: ~10-30 minutes for M; ~30-60 minutes for L.
- **Carve-out → retry chain**: ~3 PR cycles back-to-back, ~45-90 minutes total.
- **Reviewer pass (when run)**: adds ~5-15 minutes.

Auto-merge fires within seconds of CI green. GitHub 504s observed once during the session (T-365 retry merge); resolved by retry after 20s.

---

**Phase 13 is alive and shipping. 12 of 50 cluster presets done. 7 new bridge primitives. 2 clusters closed. Carry on.**
