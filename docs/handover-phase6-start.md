# Handover — Phase 6 start (2026-04-22)

Supersedes `docs/handover-phase5-complete.md` as the live starter doc.
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` for Phase 6 detail.

Current commit on `main`: `e16c8e7` (Merge PR #33: T-120 — SlideMotion
editor audit). Working tree clean after merge. Every gate green.

---

## 1. Where we are

- **Phase 0 (Bootstrap)** — implementation complete.
- **Phase 1 (Schema + RIR + Determinism)** — ✅ **Ratified 2026-04-20**.
- **Phase 2 (Frame Runtime)** — implementation complete.
- **Phase 3 (Runtime Contract + Concrete Runtimes)** — ✅ **Ratified 2026-04-21**.
- **Phase 4 (Vendored CDP Engine + Export Dispatcher)** — ✅ **Ratified 2026-04-21**.
- **Phase 5 (Parity Harness + Pre-Render Linter)** — ✅ **Ratified 2026-04-22**.
- **Phase 6 (Slide Migration)** — **IN PROGRESS**. T-120 (editor audit)
  merged; T-119 tooling family fully landed. T-121 (greenfield
  `packages/editor-shell`) is the next critical-path item.

### Phase 6 state at handover

| Task | Title | Status |
|---|---|---|
| T-119 | CI render-e2e job | ✅ merged (`409e23e`) |
| T-119b | `stageflip-parity prime` subcommand | ✅ merged (`8fc13ae`) |
| T-119c | CI goldens-priming step + operator workflow docs | ✅ merged (`3cddb08`) |
| T-119d | `manifestToDocument` converter | ✅ merged (`b5b7f9e`) |
| T-119e | Fix cdp-host-bundle real-Chrome boot | ✅ merged (`107cae1`) |
| T-119f | `stageflip-parity prime --parity` flag | ✅ merged (`72657d5`) |
| T-120 | SlideMotion editor audit | ✅ merged (`e16c8e7`) |
| T-121 | Greenfield `packages/editor-shell` | **NEXT** (L-size) |
| T-122..T-129 | Walking skeleton + 7 component ports | pending |
| T-130..T-136 | Importer, clips, atoms, undo, branding, docs, E2E | pending |
| T-137 / T-138 | Visual diff viewer / auto-fix passes (carried from Phase 5) | pending |

Phase 6's goal: *apps/stageflip-slide achieves parity with the current
SlideMotion editor; existing SlideMotion documents migrate via
`@stageflip/import-slidemotion-legacy`.*

### T-119 family context (why it expanded)

Two Phase 5 ratification follow-ups (§6.1 goldens priming + §6.2 CI
Chrome/ffmpeg infra from `handover-phase5-complete.md`) were scoped
into a single T-119 row during v1.5 → v1.6. Mid-implementation, the
scope expanded cleanly following the established Phase-5-style split
pattern:

- v1.6: T-119 / T-119b / T-119c
- v1.7: T-119b narrowed + T-119d added after mid-task discovery that
  no `FixtureManifest → RIRDocument` converter existed
- Inline: T-119e surfaced during T-119b smoke (bundle-boot regression
  in real Chrome); T-119f extended T-119b with the `--parity` flag
  once T-119d landed the converter

Result: 6 PRs spanning M/M/S/M/patch/M, each standalone-value. No
escalation needed. **Handover-phase5 §6.1 + §6.2 are both fully
resolved** at this point.

---

## 2. Test + dependency surface

### Per-package test counts on `main` (end of this session)

| Package | Cases | Change vs Phase 5 |
|---|---|---|
| `@stageflip/schema` | 92 | unchanged |
| `@stageflip/rir` | 36 | unchanged |
| `@stageflip/storage` | 23 | unchanged |
| `@stageflip/frame-runtime` | 328 | unchanged |
| `@stageflip/determinism` | 14 | unchanged |
| `@stageflip/skills-core` | 14 | unchanged |
| `@stageflip/testing` | 39 | **+13 (T-119d manifestToDocument)** |
| `@stageflip/runtimes-contract` | 14 | unchanged |
| `@stageflip/runtimes-frame-runtime-bridge` | 14 | unchanged |
| `@stageflip/runtimes-css` | 13 | unchanged |
| `@stageflip/runtimes-gsap` | 12 | unchanged |
| `@stageflip/runtimes-lottie` | 13 | unchanged |
| `@stageflip/runtimes-shader` | 22 | unchanged |
| `@stageflip/runtimes-three` | 15 | unchanged |
| `@stageflip/fonts` | 23 | unchanged |
| `@stageflip/renderer-cdp` | 242 | unchanged |
| `@stageflip/parity` | 40 | unchanged |
| `@stageflip/cdp-host-bundle` | 28 | unchanged |
| `@stageflip/parity-cli` | **58** | **+30 (T-119b + T-119f)** |
| `@stageflip/validation` | 42 | unchanged |
| `@stageflip/skills-sync` | 8 | unchanged |
| **Total** | **1088** | **+41 vs Phase 5 complete** |

### Dependencies

No new external deps added this session. `check-licenses` remains at
**482 deps**. Workspace-dep additions:

- `@stageflip/parity-cli` now depends on `@stageflip/renderer-cdp`,
  `@stageflip/cdp-host-bundle`, `@stageflip/rir` (added during T-119b)
- `@stageflip/testing` now depends on `@stageflip/rir` (added during
  T-119d for the RIRDocument type)

### CI gate surface (11 gates, all green)

Phase 5 gates unchanged. One new job this session:

```
render-e2e (reference-render against real Chrome + ffmpeg)  — T-119
  - Path-filtered via dorny/paths-filter@v3 (rendering scope)
  - Installs ffmpeg via apt; uses pre-installed Chrome
  - Runs reference-render.e2e (3 fixtures, ~2m on green)
  - Forces captureMode=screenshot via STAGEFLIP_E2E_CAPTURE_MODE
    (Linux + auto BeginFrame hangs on CI)
  - Uploads 3 MP4s as render-e2e-mp4s artifact
  - Primes reference-set goldens (9 PNGs — T-119c)
  - Primes parity-fixture goldens (21 PNGs — T-119f)
```

Full list (from repo root):

```
pnpm typecheck | lint | test | build
pnpm check-licenses              — 482 deps
pnpm check-remotion-imports      — 294 source files at handover
pnpm check-skill-drift
pnpm skills-sync:check
pnpm check-determinism           — 21 source files
pnpm size-limit                  — frame-runtime 19.52 kB, bundle 323 kB / 500 kB
pnpm parity --fixtures-dir packages/testing/fixtures
pnpm parity:prime --reference-fixtures --out <dir>
pnpm parity:prime --parity packages/testing/fixtures --out <dir>
```

### Changesets recorded in this session

All minor/patch bumps on packages still `private: true`, recorded for
audit trail:

- `renderer-cdp-t119.md` (STAGEFLIP_E2E_ARTIFACT_DIR env hook)
- `parity-cli-t119b.md` (prime subcommand)
- `testing-t119d.md` (manifestToDocument)
- `cdp-host-bundle-t119e.md` (process.env.NODE_ENV substitution)
- `parity-cli-t119f.md` (prime --parity flag)

---

## 3. Architectural decisions (this session)

Layered on top of Phase 5 handover §3.

### 3.1 Goldens priming staging directory vs `goldens.dir`

`stageflip-parity prime` writes PNGs to a staging `--out <dir>`, NOT
directly into each fixture's `goldens.dir`. Operators inspect, then
copy to the canonical location as a separate PR. This separation is
intentional: automating the full "render → commit goldens" loop bypasses
the human visual inspection that makes goldens trustworthy. The CI
artifact flow encodes the same principle — download, look, commit.

### 3.2 `captureMode=screenshot` on CI is deliberate, not a bug

On Linux with `captureMode: 'auto'`, Chrome launches with
`--enable-begin-frame-control`. If the BeginFrame probe then falls
through to screenshot mode, Chrome is left in a compositor-waiting
state that `page.screenshot()` never satisfies — tests 2+ hang.

Forcing `screenshot` sidesteps the launch args AND the probe. Same
code path macOS/Windows take by default. Documented in the CI workflow
+ comments on `STAGEFLIP_E2E_CAPTURE_MODE`. The underlying Linux-auto
bug is a real but separate concern — out of T-119's scope and not
currently tracked as a task.

### 3.3 `manifestToDocument` is hand-assembled, not compiled

T-119d ships a manual converter (`FixtureManifest → RIRDocument`) rather
than running the real schema → compiler → RIR pipeline. Parity fixtures
carry only the fields a scoring-time renderer needs (composition + clip
window + runtime/kind/props); a full compile pass is overkill. The
converter is Zod-validated via `rirDocumentSchema.parse()` so shape
drift surfaces loudly at conversion time.

Byte-identical output on repeat calls: `meta.digest = manifest.name` by
design, no timestamps, no random IDs.

### 3.4 Node-side runtime registration in the primer

`createPuppeteerPrimer()` now calls `registerAllLiveRuntimes()` on the
Node side before first mount. Without it, `LiveTierAdapter.mount`'s
internal `dispatchClips(document)` rejects every parity-fixture clip
as `unknown-kind` because the Node-side `@stageflip/runtimes-contract`
registry is empty. The browser-side registration (via the bundle IIFE)
doesn't help dispatch, which runs in Node.

Re-register throws on duplicate id; the primer swallows that specific
error (for repeat primer creations in tests) but re-throws anything
else.

### 3.5 `process.env.NODE_ENV` substitution for Vite IIFE library builds

T-119e fixed a 3-line omission in `packages/cdp-host-bundle/vite.config.ts`:
library-mode Vite does NOT auto-substitute `process.env.NODE_ENV` like
app-mode does. Without the explicit `define: { 'process.env.NODE_ENV':
JSON.stringify('production') }`, React + react-dom's dev/prod checks
emitted raw references that threw at browser IIFE boot.

Verified only when the bundle was loaded in real Chrome (happy-dom
polyfills `process`; `canvasPlaceholderHostHtml` doesn't exercise the
bundle). **Rule to internalize: Vite library mode needs explicit `define`
for any `process.env.*` reference the bundle inherits from deps.**

### 3.6 Ad-hoc debug harness is a legitimate tool

T-119e root cause found in ~10 minutes via a 50-line `/tmp/t119e-debug.mjs`
that launched puppeteer-core directly, loaded the bundle host HTML,
and dumped `page.on('console' / 'pageerror')` events. The real-Chrome
debugging was flagged as blocker in T-119b's PR description and resolved
in the follow-up T-119e PR rather than scope-creeping into T-119b.

When a bug reproduces only in real Chrome and lives across
package boundaries, spinning up a minimal debug script outside the
test harness is cheaper than adding debug affordances to the harness.
Delete the script after.

### 3.7 Plan splits continue to be the right call

v1.4 → v1.5 → v1.6 → v1.7 in one session. Each split reacted to
mid-implementation discovery; none required formal `docs/escalation-*.md`.
The pattern (*"L-sized task reveals three independently-reviewable
concerns → split into M-sized rows with suffix IDs"*) from Phase 5's
T-100 family carried through: T-119 alone would have been 6+ PRs of
unreviewable scope. The split surfaces real risks earlier (see T-119b
→ T-119e sequence).

### 3.8 Parallel debugging + implementation pays

T-119c and T-119b shipped without T-119e's fix — T-119c's CI step used
`continue-on-error: true` as an honest scope signal while T-119e
investigated root cause separately. Once T-119e merged, a single
follow-up commit in T-119c-extension firmed up the guard. Avoids
blocking tooling progress on debugging unknowns.

---

## 4. Conventions reinforced this session

- **CI watcher-in-background pattern**: `gh pr checks <N> --watch --fail-fast`
  via `run_in_background: true` gives completion notifications instead
  of polling. Use `until gh pr checks <N> | grep -qE "pending|queued|..."; do sleep 2; done`
  to wait for registration first — avoids the race where `--watch` runs
  before the new push's checks have been created.
- **Reviewer subagent after mid-size PRs**: T-119 got a
  `feature-dev:code-reviewer` pass that caught the hardcoded
  `PUPPETEER_EXECUTABLE_PATH` brittleness. Don't skip reviewer pass
  because "it's mine" — different agent instances catch different
  things. Self-review isn't blocked by `gh pr review` (it blocks
  `--request-changes` on own PRs, not comments), so post findings as
  PR comments.
- **Dry-run `continue-on-error` scope signals**: When a step needs a
  cross-package fix that isn't in the current task's scope, ship it
  behind `continue-on-error: true` with an explanatory comment + a
  follow-up task ID. The CI artifact conditional upload pattern
  (`if: steps.<id>.outcome == 'success'`) keeps the PR green while
  the fix lands separately.
- **Docs-only PRs go fast**: T-120 + the plan bumps (v1.5, v1.6, v1.7)
  each settled in <5 minutes of CI. Don't wait on them in the critical
  path; merge and continue.
- **Handover after large sessions**: This file exists because the session
  shipped 12 merged PRs spanning 3 plan versions + an entire task family
  + a Phase 6 opener. Documenting where to resume is cheaper than
  reconstructing next session.

---

## 5. Phase 6 readiness — what the next agent needs

### 5.1 The editor audit (T-120 output) is the starting read

`docs/migration/editor-audit.md` inventories the reference SlideMotion
editor. 52 components, 11 Jotai atoms, 43 keyboard shortcuts, 11
routes. Every subsequent Phase 6 port task reads it. The audit's
"Decision points before T-121" section flags:

1. **Shortcut registry** — must port verbatim before any component uses
   `useRegisterShortcuts()`. 43 shortcuts depend on it.
2. **T-132 (atoms port) overlaps with T-121** — decide whether T-121
   ships stub atoms or T-132 lands alongside. Treat as a planning-time
   decision during T-121 kickoff.
3. **Context providers** (DocumentContext, AuthContext) — thin adapters
   over atoms + Firebase. Port as part of T-121.
4. **`html2canvas` on whitelist?** — check before T-121. If not,
   replace or decide.
5. **3 legacy `addEventListener` sites** — migrate to registry during
   T-121 or first touch during component ports.
6. **Remotion imports in `SingleSlidePreview` + `PlayerPreview`** —
   banned per CLAUDE.md §3. Reimplement via `@stageflip/frame-runtime`
   + runtimes-contract during T-123 / T-129. No copy-port.

### 5.2 T-121 scope (plan v1.7)

> Build greenfield `packages/editor-shell` — canvas, properties panel,
> filmstrip, timeline, command palette, AI copilot sidebar, shortcut
> registry — written against new RIR + frame-runtime + storage
> contract. Zero dependency on current SlideMotion code. **[L]**

Genuinely multi-hour. Consider at kickoff: does the L-size mask three
independently-reviewable concerns (shell scaffolding, shortcut registry,
storage-contract integration) that would benefit from a split into
M-sized suffixed rows (T-121 / T-121b / T-121c)? Phase 5 pattern
strongly argues yes — every time we've declined to pre-split an L, it
split during implementation anyway.

### 5.3 Phase 6 critical path

```
T-120 ✅ → T-121 → T-122 → T-123..T-129 → T-130 → T-131 → T-132..T-136
                                                                ↓
                                        (can interleave T-137 + T-138)
```

- T-123..T-129 can parallelize (each component-port task is
  independent once T-121 + T-122 land).
- T-132 atoms overlap with T-121 scaffolding — pin the split early.

---

## 6. Flagged risks + follow-ups (by urgency)

### Active — may need attention at the next relevant task

1. **Linux+auto BeginFrame hang** (new this session). Forcing
   `captureMode=screenshot` on CI sidesteps it, but the underlying
   bug — Chrome launched with `--enable-begin-frame-control` + falling
   back to screenshot = compositor-waiting state page.screenshot()
   never satisfies — is real. Surfaces if someone tries BeginFrame
   capture on CI. No task owns this today.

2. **`html2canvas` whitelist check** (from T-120 audit). Blocker if
   unverified before T-121.

3. **3 legacy `addEventListener` sites** (from T-120 audit). Migrate
   during T-121 or first touch.

4. **Remotion replacement in 2 components** (from T-120 audit).
   Reimplement, don't copy.

5. **Golden PNGs still uncommitted** (from Phase 5). The CI pipeline
   now produces them on every rendering-adjacent PR as artifacts;
   operators need to download, inspect, commit once. No plan row
   owns this today — natural fit for a one-off priming PR.

6. **T-132 / T-121 overlap** (from T-120 audit). Scope decision at
   T-121 kickoff.

### Carried from Phase 5 — still open

7. **No CI infra for Chrome + ffmpeg** — ✅ **RESOLVED** by T-119.
   (Kept for audit.)

8. **Goldens not primed** — ✅ **RESOLVED by T-119b/c/d/e/f** — CI now
   produces both `parity-goldens-reference-<sha>` + `parity-goldens-
   fixtures-<sha>` artifacts. Commit-to-repo is the next human step.

9. **Dev harness has no Phase 3/4/5 demos** (Phase 4 §6.4).

10. **Video codec thresholds `(TBD)` in parity-testing/SKILL.md**
    (Phase 5 §6.4).

11. **60fps scrub exit criterion** unmeasured (Phase 2).

12. **`readFrameContextValue` identity function** still public API
    (Phase 2).

13. **GSAP publish-gate legal review** — blocks `private: false` on
    `@stageflip/runtimes-gsap` AND `@stageflip/cdp-host-bundle` at
    Phase 10.

14. **T-137 / T-138** — visual diff viewer + auto-fix passes, carried
    from Phase 5 (T-105 / T-106).

15. **CDP font pre-embedding** (Phase 4 §6.9).

16. **Chromium `--font-render-hinting=none`** (Phase 4 §6.10).

17. **Per-package size-limit budgets** beyond frame-runtime +
    cdp-host-bundle.

18. **Firebase storage backend** (Phase 1).

19. **Concrete bake runtime** (Phase 12).

20. **`stageflip doctor` CLI subcommand**.

21. **Puppeteer-screenshot rasterization for unsupported embeds**
    (Phase 4 §6.16).

22. **Auto-gen `skills/stageflip/reference/cli/SKILL.md`** (Phase 5
    §6).

### Low-urgency cleanups

- Auto-generated schema skill "object object object…" artifact
  (Phase 1 §6.10).
- Turbo remote cache not enabled.
- `back-in` / `back-out` easings overshoot.

---

## 7. How to resume

### 7.1 Starter prompt for the next session

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase6-start.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` for Phase 6 detail, and
> `docs/migration/editor-audit.md` for the T-120 inventory that
> feeds T-121+. Confirm your understanding of the current state
> and the next task.

Expected confirmation shape: *"On `main` at `<hash>`. Phases 1+3+4+5
ratified; Phases 0+2 implementation complete. Phase 6 in progress:
T-119 family + T-120 merged; T-121 (greenfield editor-shell, L) is
next. Ready."*

### 7.2 If your first move is T-121

1. Read `docs/migration/editor-audit.md` in full.
2. Decide early: split T-121 into T-121 / T-121b / T-121c pre-emptively,
   or accept the L. Phase 5 precedent says split.
3. Decide the T-121 ↔ T-132 (atoms) overlap. Possible answers:
   - T-121 ships stub atoms; T-132 later replaces with real impls
   - T-132 lands alongside T-121 as its real store layer
   - T-121b specifically for the atoms port
4. Before writing code, do the `html2canvas` whitelist check.
5. Branch: `task/T-121-<slug>` (or split naming as above).

### 7.3 Pattern reminders from this session

- **Open a CI watcher with `gh pr checks <N> --watch --fail-fast` in
  `run_in_background: true`** immediately after every push to a PR.
  Notifications fire automatically. Use the `until ... do sleep 2; done`
  preamble to avoid the race where `--watch` beats check registration.
- **Self-review via `feature-dev:code-reviewer`** subagent after each
  non-trivial PR. Paste findings as comments (`--request-changes` is
  blocked on own PRs).
- **Plan-bump PRs go first** when scope changes. Keeps task PRs clean.
- **L-size is a smell** in the plan; pre-splitting is usually right.

---

## 8. File map — this session's additions

```
.github/workflows/ci.yml                      [MOD — T-119/c/e/f]
  +render-e2e job (install ffmpeg, run reference-render.e2e,
   upload MP4 artifacts)
  +3 goldens-priming steps (dry-run audit, reference-set real
   render, parity-fixture real render) + 2 artifact uploads

packages/renderer-cdp/src/reference-render.ts        [MOD — T-119]
  +captureMode: CaptureMode option threaded through to both the
   browser factory and the session

packages/renderer-cdp/src/reference-render.e2e.test.ts  [MOD — T-119]
  +STAGEFLIP_E2E_ARTIFACT_DIR env-var hook (keeps MP4s on disk)
  +STAGEFLIP_E2E_CAPTURE_MODE env-var hook (forces screenshot)
  +per-test timeout raised 60s → 120s for cold-Chrome on CI

packages/parity-cli/                          [MOD — T-119b, T-119f]
  src/prime.ts                                 [NEW T-119b]
  src/prime.test.ts                            [NEW T-119b, 9 cases]
  src/prime-cli.ts                             [NEW T-119b; rev T-119f]
                                               (--parity flag + resolver
                                               refactor: resolve(opts))
  src/prime-cli.test.ts                        [NEW T-119b, 17→20 cases]
  src/puppeteer-primer.ts                      [NEW T-119b; rev T-119f]
                                               (parity-fixture resolver
                                               + registerAllLiveRuntimes)
  src/cli.ts                                   [MOD T-119b]
                                               (prime subcommand dispatch)
  src/index.ts                                 [MOD T-119b/f]
  bin/parity.js                                [MOD T-119b/f]
  package.json                                 [MOD]
                                               +@stageflip/renderer-cdp,
                                               cdp-host-bundle, rir deps

packages/testing/                             [MOD — T-119d]
  src/manifest-to-document.ts                  [NEW, 131 lines]
  src/manifest-to-document.test.ts             [NEW, 13 cases]
  src/index.ts                                 [MOD: +export]
  package.json                                 [MOD: +@stageflip/rir dep]

packages/cdp-host-bundle/vite.config.ts       [MOD — T-119e]
  +define: { 'process.env.NODE_ENV': JSON.stringify('production') }

package.json                                  [MOD — T-119b]
  +parity:prime script

docs/
  migration/editor-audit.md                    [NEW T-120, 286 lines]
  implementation-plan.md                       [MOD v1.4 → v1.5 → v1.6 → v1.7]
  handover-phase5-complete.md                  [MOD — fixup from reviewer
                                               feedback at session start;
                                               Phase 5 ratification stamp]
  handover-phase6-start.md                     [NEW — this file]

skills/stageflip/workflows/parity-testing/SKILL.md  [MOD — T-119c/e/f]
  +Priming in CI section
  +Operator workflow for committing goldens
  (initial T-119c version had "known limitation" language; T-119e
   dropped it; T-119f extended to cover parity-fixture set)

.changeset/
  renderer-cdp-t119.md                         [NEW]
  parity-cli-t119b.md                          [NEW]
  testing-t119d.md                             [NEW]
  cdp-host-bundle-t119e.md                     [NEW]
  parity-cli-t119f.md                          [NEW]
```

---

## 9. Statistics — end of session

- **12 merged PRs** this session (#24–#33, excluding #26 meta-gap
  filled by main branch): handover fixup + ratification, v1.5 plan,
  v1.6 plan, T-119, v1.7 plan, T-119b, T-119d, T-119c, T-119e,
  T-119f, T-120.
- **1088 test cases** across **21 test-active packages** (+41 vs
  Phase 5 complete).
- **482 external deps** license-audited (unchanged).
- **294 source files** scanned for Remotion imports at handover
  (+8 vs Phase 5 complete; new source files from T-119 family).
- **21 source files** scanned for determinism (unchanged; new
  T-119 family packages intentionally outside the globs).
- **11 CI gates** green at handover (10 from Phase 5 + `render-e2e`
  job).
- **5 changesets** recorded this session.
- **4 plan versions** published this session (v1.4 → v1.7).
- **~30 golden PNGs** produced per rendering-adjacent CI run (9
  reference + 21 parity), uploaded as 2 artifacts per PR.
- **0 escalations** raised this session.

---

*End of handover. Next agent: go to §7.1 for the starter prompt.
Phase 6 continues at T-121 (greenfield editor-shell).*
