# Handover — Phase 6 mid-6 (2026-04-23, very late session)

Supersedes `docs/handover-phase6-mid-5.md` as the live starter doc.
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` (Phase 6 detail), then the task-specific
files named in §5.

Current commit on `main`: **`7e977a2`** (T-131f.3). The mid-5 handover
is on branch `docs/handover-phase6-mid-5` (unmerged — history only).

---

## 1. Session PRs (all 4 merged)

Continuation of the phase-6 mid-5 push. Same reviewer-subagent
discipline — every PR got a pre-merge review pass; BLOCKING + SHOULD
findings were addressed in-PR before merge.

| PR | Task | Squash SHA | Title |
|---|---|---|---|
| [#76](https://github.com/marioberlin/stageflip/pull/76) | T-131f.2a | 012cd98 | frame-runtime-bridge: hr-dashboard + marketing-dashboard |
| [#77](https://github.com/marioberlin/stageflip/pull/77) | T-131f.2b | 5989a43 | frame-runtime-bridge: product-dashboard + okr-dashboard |
| [#78](https://github.com/marioberlin/stageflip/pull/78) | T-131f.2c | b8bd157 | frame-runtime-bridge: sales-dashboard (closes T-131f.2) |
| [#79](https://github.com/marioberlin/stageflip/pull/79) | T-131f.3 | 7e977a2 | frame-runtime-bridge: financial-statement composite |

PR #76 was also captured in the mid-5 handover. #77/#78/#79 are the
delta after mid-5.

---

## 2. State summary

### Clip ports

- `ALL_BRIDGE_CLIPS`: **30 clips** (was 26 at end of mid-5).
- Reference clip coverage: **31 of 32 ported** (was 27 at end of
  mid-5). Only `animated-map` remains — blocked.

### Test counts

| Package | Current | Delta since mid-5 |
|---|---|---|
| `@stageflip/runtimes-frame-runtime-bridge` | 372 | +89 (4 dashboards + financial-statement) |
| `@stageflip/cdp-host-bundle` | 29 | — (assertion counts bumped 26 → 30) |

### New shared module

- `packages/runtimes/frame-runtime-bridge/src/clips/_dashboard-utils.ts`
  — private helpers module. Holds `dashboardTrendSchema`,
  `formatDashboardValue`, `dashboardTrendColor`, and the 5 semantic
  colour constants (`DASHBOARD_GOOD_COLOR` / `WARN` / `BAD` / `MUTED`
  / `SUBDUED`). All five T-131f.2 dashboards + T-131f.3 import from
  here. **Convention**: underscore-prefix = private-to-clips-directory;
  NOT re-exported from the package barrel.

### CI gates

All 5 gates green on every merged PR this continuation. No infra
flakes this tranche (in contrast to the Puppeteer `captureScreenshot`
flake that hit PR #73 during mid-5).

### Changesets

4 changesets recorded. All `minor` bumps on
`@stageflip/runtimes-frame-runtime-bridge`.

---

## 3. Architectural decisions (this continuation)

### 3.1 Option B — flat-prop schemas throughout T-131f.2 + T-131f.3

Every dashboard clip declares its own Zod `propsSchema` over just the
fields it renders. No `@slidemotion/schema` domain types
(`HrContent`, `SalesPipelineContent`, `StatementTableContent`, etc.)
reimplemented in `@stageflip/schema`. The Phase 7 agent layer can map
its domain shapes onto these flat props later — decoupling keeps the
bridge runtime stable.

### 3.2 Inlined private sub-components pattern

Composite clips (sales-dashboard, financial-statement) have 3+
sub-components in the reference. This continuation inlined them as
module-private helpers inside the main clip file rather than exposing
separate files:

- **sales-dashboard**: `PipelineFunnel`, `ForecastChart`, `DealCard`,
  `KpiCard`, `KpiRow` all inlined.
- **financial-statement**: `KpiStrip`, `StatementTable`,
  `CommentsRail`, `KpiCard` all inlined.

Precedent: `ObjectiveCard` in okr-dashboard was initially exported,
reviewer flagged premature API surface → reverted to private.
Pattern: **export only when a concrete second consumer exists**.

### 3.3 `toLocaleString('en-US', opts)` is safe; bare `toLocaleString()` is not

The financial-statement port uses `toLocaleString('en-US', {
minimumFractionDigits, maximumFractionDigits })` for thousands-
separator formatting. This is deterministic across CI runners because
Node ships ICU data and the locale argument is pinned. The **drift
hazard** is the zero-arg form, which reads the runtime locale. Pattern
documented in the `financial-statement.tsx` file header.

### 3.4 Determinism gotchas caught by the reviewer subagent

Real bugs caught + fixed in-PR during this continuation:

- **sales-dashboard `localeCompare`** on ISO dates — locale-drift
  hazard. Replaced with ordinal `<` / `>` comparison (PR #78).
- **sales-dashboard non-compliant sort comparator** for `sortBy =
  'status'` — returned `1` for every non-`at_risk` pair regardless of
  `b`. Replaced with a spec-compliant key-difference comparator
  (`at_risk` → 0, everything else → 1) (PR #78).
- **win_loss count drift**: the "Won (N)" / "Lost (N)" header counted
  from the full `deals[]` array but the grid sliced to 6. Fixed to
  count from the sliced array so the header agrees with the rendered
  cards (PR #78).
- **product-dashboard `Math.max(...channels.map(...))` inside a
  `map()` callback** — O(n²) in the render hot path. Hoisted (PR
  #77).
- **marketing-dashboard funnel `?? 1` vs `|| 1`** — `??` only fires
  on undefined/null, so a zero-valued first stage still divided by
  zero. Fixed to fall through on 0 (from mid-5 PR #76, retained here
  for ledger continuity).

### 3.5 SKILL.md tranche ledger

Added a "Tranche ledger" section to
`skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md` in PR #79
covering all nine tranches (light / medium / heavy / d / f.1 / e.1
/ e.2 / f.2a-c / f.3). Replaces the stale "Twenty reference-clip
ports" wording; clip count corrected 20 → 30.

---

## 4. Phase 6 state at this handover

| Task | Title | Status |
|---|---|---|
| T-119..T-130, T-133..T-136, T-131a..T-131e | (per mid-5 + prior handovers) | ✅ merged |
| T-131f.1 | Bridge standalones (code-block, image-gallery, timeline-milestones, audio-visualizer) | ✅ merged |
| **T-131f.2** | **5 dashboard composites** | ✅ **merged** (this continuation) |
| T-131f.2a | hr-dashboard + marketing-dashboard | ✅ merged (#76) |
| T-131f.2b | product-dashboard + okr-dashboard | ✅ merged (#77) |
| T-131f.2c | sales-dashboard | ✅ merged (#78) |
| **T-131f.3** | **financial-statement composite** | ✅ **merged** (#79) |
| T-131f.4 | audio-visualizer real-audio | ✅ folded into T-131e.2 (see mid-5 §3.2) |
| **T-131d.4** | **`animated-map`** | 🔴 **blocked** — needs `mapbox-gl` license review + tile-API strategy before any agent can pick it up |
| T-137 | Visual diff viewer | 🟡 pending (M, parallel-eligible) |
| T-138 | Auto-fix passes (10) | 🟡 pending (L, parallel-eligible) |

**Reference clip coverage**: 32 total in `reference/.../clips/registry.ts`.
- ✅ 30 bridge + 2 shader + 2 lottie + 1 three + 2 css + no-op (hr/marketing/product/okr/sales/financial deduplicated to 6 composites in the bridge) = **31 ported**
- 🔴 1 blocked (animated-map)

---

## 5. How to resume

### 5.1 Starter prompt

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase6-mid-6.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` for Phase 6 detail. Confirm
> current state and the next task.

Expected confirmation: Phase 6 **critical path is done**. 31 of 32
reference clips ported. Only `animated-map` (license-blocked) plus
T-137 / T-138 remain in scope. Phase 6 ratification is overdue.

### 5.2 Recommended next moves

1. **Phase 6 ratification** — convene with the orchestrator /
   human reviewer. Every critical-path item is merged; T-131d.4 is a
   named blocker that doesn't gate ratification, and T-137/T-138 are
   parallel-eligible.

2. **T-137 Visual diff viewer** — Build a viewer that renders
   side-by-side golden vs current frames with PSNR/SSIM heatmaps. M.
   Parallel-eligible. Probably lives in `packages/parity-cli` or a
   new `apps/parity-viewer` (check plan). Agent-shippable in one PR.

3. **T-138 Auto-fix passes** — 10 passes that auto-repair
   round-tripped slide content (colour contrast, over-run timing,
   orphan elements, etc.). L. Agent-shippable but probably 2-3 sub-
   PRs to keep each ≤ 2k LOC.

4. **T-131d.4 animated-map** — **do not start without orchestrator
   sign-off**. Needs THIRD_PARTY.md review for `mapbox-gl` (license
   + tile-API commercial-use restriction), an account-token
   strategy, and a deterministic rendering plan (canvas-driven
   mapbox isn't frame-exact without seeded styles + disabled
   interactions). A lesser "static-geometry coverage map" without
   real Mapbox is possible but departs from the reference's intent.

5. **Bake-tier dispatcher wiring** — T-131e.0/.1/.2 shipped the
   clips bridge-style for preview. Deterministic export still needs
   a concrete `BakeRuntime` impl in `@stageflip/runtimes-blender`
   plus app-slide dispatcher. Not consumer-blocking until someone
   tries to export a deck with a `video-background` / `gif-player`
   / `audio-visualizer-reactive` clip.

### 5.3 Patterns that worked this continuation

- **One PR per sub-tranche.** Each of f.2a/b/c/f.3 was a focused
  review surface. Reviewer catches stayed actionable.
- **Private `_dashboard-utils.ts` for cross-clip shared helpers.**
  Underscore prefix = package-private; not exported from the barrel.
  Extracted after the second dashboard (f.2a), reused by f.2b/c/f.3.
- **Inline sub-components in composite clips.** PipelineFunnel /
  ForecastChart / DealCard (sales) and KpiStrip / StatementTable /
  CommentsRail (financial) are all private module-level helpers —
  single consumer, no cross-clip reuse, no API surface to maintain.
- **Reviewer subagent's "reference-parity" catches.** The reviewer
  flagged several intentional-looking divergences from reference
  that were actually correct (e.g., `trendGlyphColor` using SUBDUED
  per reference vs the shared helper's MUTED). Documenting the
  divergence in a JSDoc comment was the right response, not
  reverting.
- **Plan-row `[shipped]` promotion in the same PR.** Every PR that
  closed a sub-task promoted the plan row. Kept the audit trail
  accurate without needing a separate housekeeping PR.

### 5.4 Open follow-ups worth listing

Carried from mid-5 §5.4:

- Golden PNGs committed to repo (operator-handled).
- Bake-runtime dispatcher wiring (see §5.2 item 5).
- `useWindowedAudioData` analogue (only needed if the bake path
  needs pre-decoded window samples; not consumer-blocking).
- Shader compile failure silent-fallback — still has no dev-mode
  `console.warn`. Worth revisiting if authors start hitting it.
- Fixture `goldens` are placeholder on all new clips — priming
  operator renders real goldens against real assets at parity-
  scoring time.

**New items from this continuation**:

- **T-131f.3 `commentaryMode: 'inline'` vs `'rail'`** — schema
  advertises both, but both render the side rail today. Pinned by
  a test that documents the current equivalence. If a future deck
  needs a true inline-within-row commentary layout, it's a separate
  follow-up.
- **Currency prefix only handles USD + EUR** — everything else
  silently renders without a symbol. Reference has the same
  limitation. Narrow the schema to an enum or add explicit mapping
  when a deck needs GBP / JPY / etc.
- **ObjectiveCard / DealCard / StatementTable** — all inlined as
  module-private. If Phase 7 agent tooling ever needs to render
  these in isolation (e.g., a preview of a single dashboard card),
  they'll need to be promoted to public exports at that time.

---

## 6. Session stats (mid-5 end → now)

- **4 PRs opened + merged** (#76 folded in from mid-5, #77/#78/#79
  this continuation).
- **~89 new tests** on the bridge runtime.
- **+4 reference clip ports** (hr / marketing / product / okr /
  sales / financial-statement = 6 new clips across 4 PRs, noting
  marketing-dashboard was already part of #76).
- **5 new dashboard clip kinds** on `frame-runtime-bridge`.
- **1 new private helper module** (`_dashboard-utils.ts`).
- **490 external deps** (unchanged).
- **~10 reviewer-pass findings caught in-PR**. None shipped to
  main. Notable: the `localeCompare` + non-compliant comparator in
  sales-dashboard, the O(n²) `Math.max` in marketing-dashboard, the
  `trendGlyphColor` vs shared-helper nuance in okr-dashboard.
- **0 infra flakes** this continuation.
- **0 escalations to orchestrator**. T-131d.4 remains escalation-
  ready; intentionally not attempted in this session.

---

*End of handover. Next agent: start at §5.1. Phase 6's critical path
is fully merged — 31 of 32 reference clips ported, only the
license-blocked `animated-map` and the two parallel-eligible T-137 /
T-138 tasks remain. Convene Phase 6 ratification first; then pick up
T-137 + T-138 in parallel while the orchestrator decides on
`mapbox-gl`.*
