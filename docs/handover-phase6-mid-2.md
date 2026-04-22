# Handover — Phase 6 mid-2 (2026-04-22, second half of the day)

Supersedes `docs/handover-phase6-mid.md` as the live starter doc.
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` for Phase 6 detail (now at **v1.10**),
then `docs/migration/editor-audit.md` for the T-120 inventory.

Current commit on `main`: **`cd2fba6`** (Merge PR #54: T-133a — drag
coalescing). Working tree clean after this session's merges. Every
CI gate green on every merge.

---

## 1. Where we are

- Phase 0–5: implementation complete, Phases 1+3+4+5 ratified (unchanged
  from `handover-phase6-mid.md` §1).
- **Phase 6 (Slide Migration)** — **IN PROGRESS**. Undo/redo, AI copilot
  stub, legacy importer, PropertiesPanel router, and drag coalescing
  all merged this session. Phase 6 now pivots from **component ports**
  to **depth** (ZodForm introspection + domain editors) and
  **closeout** (E2E regression, branding, skill doc).

### Phase 6 state at this handover

| Task | Title | Status |
|---|---|---|
| T-119 through T-127, T-128, T-130, T-133 | (as per phase6-mid) | ✅ all merged |
| **T-125a** | PropertiesPanel router + Selected/Slide properties | ✅ merged this session |
| **T-133a** | Coalescing transaction API + selection-overlay drag coalescing | ✅ merged this session |
| **T-125b** | ZodForm auto-inspector + introspect module | **NEXT** (M) |
| **T-125c** | ChartEditor + TableEditor + AnimationPicker | pending (M) |
| T-129 | Remaining 32 components | pending (L) |
| T-131 | 33 clips ported to ClipRuntime | pending (L) |
| T-134 | Branding pass | pending (M) |
| T-135 | `skills/stageflip/modes/stageflip-slide/SKILL.md` final | pending (M) |
| T-136 | E2E Playwright regression (Phase 6 ratification gate) | pending (M) |
| T-137 | Visual diff viewer (carried from Phase 5) | pending (M) |
| T-138 | Auto-fix passes (carried from Phase 5) | pending (L) |

### Session merges (#49 → #54)

| PR | Task | Title |
|---|---|---|
| [#49](https://github.com/marioberlin/stageflip/pull/49) | T-133 | editor-shell: RFC-6902 undo/redo via fast-json-patch |
| [#50](https://github.com/marioberlin/stageflip/pull/50) | T-128 | app-slide: AI copilot sidebar stub |
| [#51](https://github.com/marioberlin/stageflip/pull/51) | T-130 | import-slidemotion-legacy: one-way legacy → canonical |
| [#52](https://github.com/marioberlin/stageflip/pull/52) | docs | plan v1.10 — pre-split T-125 into a/b/c |
| [#53](https://github.com/marioberlin/stageflip/pull/53) | T-125a | app-slide: PropertiesPanel router + Selected/Slide properties |
| [#54](https://github.com/marioberlin/stageflip/pull/54) | T-133a | editor-shell: coalescing transaction API + drag coalescing |

Six PRs. Each had a pre-merge reviewer-subagent pass; every BLOCKING +
SHOULD finding was addressed before merge.

---

## 2. Test + dependency surface

### Per-package test counts (end of session)

| Package | Cases | Δ vs phase6-mid |
|---|---|---|
| `@stageflip/editor-shell` | **157** | +29 (+128 → 157: 18 in T-133, 11 in T-133a, +20 in T-125a i18n keys don't add tests) |
| `@stageflip/app-slide` | **165** | +61 (+104 → 165: 23 in T-128, 36 in T-125a, 3 in T-133a; properties-tier additions) |
| `@stageflip/import-slidemotion-legacy` | **34** | +34 (new in T-130) |
| Other packages | unchanged | — |
| **Total** | **~1417** | **+95 vs phase6-mid** |

Plus Playwright walking-skeleton e2e: **11 passing** (was 9; T-125a
adds 1, T-128 adds 1).

### Dependencies

`pnpm check-licenses` at **490** deps (was 489; +1 `fast-json-patch@3.1.1`
MIT from T-133). No license whitelist changes.

### CI gates — all 11 green on every merge

Unchanged gate set. T-130's new package picked up gates via the
workspace loop without any `ci.yml` changes.

### Changesets recorded

Minor bumps on `private: true` packages:

- `editor-shell-t133.md` — undo/redo action surface
- `editor-shell-t128-i18n.md` — copilot.* keys
- `app-slide-t128.md` — AI copilot stub
- `import-slidemotion-legacy-t130.md` — legacy converter
- `app-slide-t125a.md` — PropertiesPanel router + stubs
- `editor-shell-t125a-i18n.md` — properties.* keys
- `editor-shell-t133a.md` — transaction API
- `app-slide-t133a.md` — selection-overlay drag coalescing

---

## 3. Architectural decisions (this session)

Layered on top of `handover-phase6-mid.md` §3.

### 3.1 T-133's undo interceptor + T-133a's coalescing transaction

`DocumentProvider.updateDocument` now owns the "what qualifies as a
history entry" policy. Two layers:

- **Auto-record layer (T-133).** Every `updateDocument` call diffs
  pre/post via `fast-json-patch.compare`, and if the forward patch is
  non-empty, pushes a `MicroUndo` onto `undoStackAtom`. Identity- and
  value-equal updaters skip. Stack capped at `MAX_MICRO_UNDO = 100`.
- **Coalescing layer (T-133a).** `beginTransaction(label?)` snapshots
  the doc and sets `transactionAtom`. While active, `updateDocument`
  applies to the atom but **skips the diff-and-push step**.
  `commitTransaction()` diffs snapshot vs. final and pushes one entry.
  `cancelTransaction()` restores the atom to the snapshot. Nested
  begins are ignored (outer snapshot wins); `undo()`/`redo()` are
  no-ops during a transaction; `setDocument` clears the transaction
  along with the stacks.

**Where to call it**: wrap any gesture that produces many sequential
`updateDocument` calls. Live examples: `<SelectionOverlay>` drag /
resize / rotate (T-133a). Future T-125c (ChartEditor drags, TableEditor
cell resize) and multi-element transforms should use the same primitive.
One-off commits (clicks, form submits) need no transaction.

### 3.2 T-125a PropertiesPanel router shape

Three render branches, driven by `selectedElementId` + active slide:

1. **Element selected** → `<SelectedElementProperties>` with position /
   size / rotation / opacity / visibility / lock / z-order / delete.
2. **No element selected, active slide** → `<SlideProperties>` with id
   / title / background / duration / element count read-outs + editable
   notes textarea.
3. **Unhydrated** → fallback message.

Multi-select (`selectedElementId` returns `null` because the atom
only resolves to single-select) falls through to branch 2; a
dedicated multi-select view is future-expand.

**`<PropField>`** is the shared number input. Commits only on blur
or Enter, reverts on Escape. Partially-typed values pass through
intermediate states without committing. Every commit funnels through
`updateDocument`, so T-133 auto-records history.

**Scope boundary**: T-125a ships no ZodForm, ChartEditor, TableEditor,
AnimationPicker, typography editor, or color picker. Those live in
T-125b (ZodForm + introspect) and T-125c (three domain editors).

### 3.3 Commit-on-release is now the pattern for range + textarea inputs

T-125a shipped the opacity slider + notes textarea with on-change
updates, which exploded the undo stack. Reviewer caught both before
merge; follow-up commit changed them to local-state + commit-on-release.
Pattern codified: any input that fires onChange on every character or
tick must buffer locally and commit on blur / pointerup / Enter,
not on every event.

T-133a's transaction API is the more general answer to the same
problem for pointer-driven gestures. Prefer transactions for gestures
(multi-frame, physical input); prefer commit-on-release for discrete
UI controls (sliders, textareas, keyboard-only fields).

### 3.4 T-128 AI copilot stub: fetch seam pattern

`executeAgent({ prompt, fetchImpl? })` returns a discriminated union
`{ kind: 'pending' | 'applied' | 'error' }`. The real walking-skeleton
route returns 501 → `pending`. Tests inject `fetchImpl` to exercise
every branch including 501-with-non-JSON-body (which maps to `error`,
not `pending`, so a gateway crash doesn't masquerade as the Phase 7
placeholder).

`<AiCopilot>`'s `executor` prop (defaulting to `executeAgent`) is the
same seam at the component level. Phase 7 wires the real planner /
executor / validator behind `fetchImpl` without touching the component.

### 3.5 T-130 legacy importer: return value carries a warning list

`importLegacyDocument(input: unknown) → { document: Document, warnings: Warning[] }`.
The document is final-gated through `documentSchema.parse()` so
callers can trust it; the warning list carries structured
`{ path, reason, detail? }` entries for every lossy mapping
(unsupported element types, shape kinds, gradient backgrounds, bad
timestamps, id sanitizations). UI layer decides how to surface them.

MVP maps text / image / shape / group + solid-color / image
backgrounds. Everything else (chart, table, video, embed,
gradients, timing, animations, captions, brand, etc.) drops with a
warning. Adding new element kind coverage is a per-case addition in
`map-elements.ts`; the public API doesn't change.

### 3.6 Per-id message testids in chat-style UIs

T-128's reviewer caught that `data-testid="ai-message-${role}"` collides
after a second message turn (Playwright strict-mode multi-match).
Fixed to per-id (`ai-message-${m.id}`) with `data-role` for role-level
selectors. Pattern: if a list renders the same role repeatedly, encode
the item's id in the testid and key role queries off `data-role`
instead.

### 3.7 Editor-shell dist rebuild needed for i18n edits

`@stageflip/app-slide` imports editor-shell via `workspace:*` but the
`main` field points at `dist/`. Adding i18n keys to
`packages/editor-shell/src/i18n/catalog.ts` doesn't affect app-slide
unit tests until `pnpm --filter @stageflip/editor-shell build` runs.
Needed three times this session (T-128, T-125a, T-133a). Possibly worth
adding a `source` field or a `tsup --watch` pattern to the dev loop —
but not blocking; easy to miss and easy to diagnose (`t('foo')` returns
the key literal when the dist is stale).

---

## 4. Conventions reinforced this session

- **Pre-merge reviewer subagent pass** is now routine. Every PR this
  session had 2-4 BLOCKING/SHOULD findings that were addressed before
  open → merge. Skipping the reviewer would have shipped real bugs
  (data-testid collisions, undo-stack bloat, stale-closure on PropField
  Escape, non-JSON 501 masquerade).
- **Reviewer triggers on both the initial commit and after fix-ups**.
  Catches regressions introduced by the fix.
- **`gh api --method POST` REST fallback** when GraphQL rate limit is
  exhausted. `gh pr create` uses GraphQL; `/repos/:o/:r/pulls`
  REST works even with GraphQL quota at zero. Same for issue
  comments. Learned mid-session; now the default when rate-limited.
- **Squash-merge** via `gh api --method PUT /repos/.../pulls/N/merge -f merge_method=squash`.
  Keeps the main branch log linear and the PR titles intact.
- **Plan bumps first** when an M-sized row reveals itself to be 2-3
  rows worth. T-125's split into a/b/c via PR #52 kept each
  implementation PR reviewable.
- **Every gesture-based editor gets a transaction**. T-133a set the
  precedent. T-125c and any future physical-input editor should use
  begin/commit; one-off commits should not.

---

## 5. Phase 6 readiness — what the next agent needs

### 5.1 Remaining critical-path order

```
T-125b (ZodForm) ─┐
T-125c (3 domain editors) ──┐
T-129 (remaining components) ┴───→ T-136 (E2E regression) ──┐
T-131 (33 clips) ──────────────────────────────────────────┤
T-134 (branding) ──────────────────────────────────────────┤
T-135 (skill doc) ─────────────────────────────────────────┘
                                                ↓
                              Phase 6 exit criterion met
```

Parallel-eligible after T-125a + T-133a merged (both this session):
T-125b, T-125c, T-129, T-131, T-134. T-136 is the ratification gate.

### 5.2 If your first move is T-125b (ZodForm)

Per the plan v1.10 row: reflective form generator. Port the
introspection module from `reference/slidemotion/apps/editor/src/components/zodform/`
(~800 LOC total) but write fresh — CLAUDE.md §7. Zod 3.25 `_def` fields
differ between versions; verify against our pinned `zod@3.25.76`.

Target: slot into the T-125a PropertiesPanel router at the
`properties.typeEditors` placeholder (look for
`prop-type-placeholder` in `selected-element-properties.tsx`). The
cleanest entry point is `<ClipElementProperties>` for element type
`clip` — clips carry `ClipDefinition.propsSchema`, which ZodForm
walks. Other element types can also opt in incrementally.

Scope discipline: don't bundle typography / color editors — those are
still T-125c. T-125b is purely the reflection + input-emit engine +
the clip-props integration point.

### 5.3 If your first move is T-125c (domain editors)

Three standalone components:
- `<ChartEditor>` — series rows, chart-type picker, axis labels.
- `<TableEditor>` — cell grid, row/col add/remove.
- `<AnimationPicker>` — preset gallery over the animation union.

Each slots into the T-125a router by element type (`element.type ===
'chart'` etc.). Could L-split further if scope balloons (reviewer
happy to pre-split again).

### 5.4 If your first move is T-136 (E2E regression)

Phase 6 ratification gate. Expand `apps/stageflip-slide/e2e/walking-skeleton.spec.ts`
into a real regression suite per the plan row:
- New deck (via CommandPalette's `slide.new`)
- Add slide → assert filmstrip count
- Edit text via inline editor (T-123c)
- Preview mode via SlidePlayer (T-123d)
- Export PNG (Phase 4 renderer-cdp)

The surface needed is all live today. No new product code; the PR is
pure e2e + documentation.

### 5.5 Decisions deferred from phase6-mid

Still open (from §5.5 of that doc):
1. **Golden PNGs committed to repo** — still operator-handled.
2. **`ShortcutHandler` return-type friction** (§3.6) — still open.
3. **Linux+auto BeginFrame hang** — still latent; CI uses
   `captureMode=screenshot`.
4. **Dev harness Phase 3/4/5 demos** — still open.
5. **Video codec thresholds** in parity-testing/SKILL.md — still open.
6. **60fps scrub exit criterion** — still unmeasured.
7. **`readFrameContextValue` identity function** — still open.
8. **GSAP publish-gate legal review** — still open.
9. **T-137 / T-138** visual diff + auto-fix — still carried.
10. **CDP font pre-embedding** — still open.
11. **Chromium `--font-render-hinting=none`** — still open.
12. **Per-package size-limit budgets** — still open.
13. **Firebase storage backend** — still open.
14. **Concrete bake runtime** — still open.
15. **`stageflip doctor` CLI** — still open.
16. **Puppeteer-screenshot rasterization for unsupported embeds** — still open.
17. **Auto-gen `skills/stageflip/reference/cli/SKILL.md`** — still open.

### 5.6 Resolved this session (no longer open)

- **`html2canvas` whitelist** — not used, MIT. Still clear.
- **3 legacy `addEventListener` sites** — still clear.
- **Remotion replacement in SingleSlidePreview + PlayerPreview** — still done.
- **Atom cache eviction** — still pending before T-131; noted again.
- **Drag coalescing in selection-overlay** — **CLOSED by T-133a this session**.

### 5.7 New items worth carrying

- **Editor-shell dist rebuild** friction (§3.7). Not blocking but a
  stumbling block every time editor-shell grows.
- **Ready to ship a `packages/editor-shell/package.json` `source` field**
  or switch the app-slide test config to alias editor-shell to
  `src/index.ts` in dev-mode. Would delete one manual step from
  every multi-package-touching task.

---

## 6. How to resume

### 6.1 Starter prompt

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase6-mid-2.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` (now at v1.10) for Phase 6
> detail, and `docs/migration/editor-audit.md` for the T-120
> inventory. Confirm current state and the next task.

Expected confirmation: *"Phases 1+3+4+5 ratified; Phases 0+2
implementation complete. Phase 6 in progress — T-119 family + T-120
+ T-121 family + T-122 + T-123 family + T-124 + T-126 + T-127 + T-128
+ T-130 + T-133 + T-125a + T-133a merged. T-125b / T-125c / T-129 /
T-131 / T-134 / T-135 / T-136 / T-137 / T-138 pending. Ready."*

### 6.2 Patterns that worked this session

- **Pre-merge reviewer** via `feature-dev:code-reviewer` agent. Cheap
  insurance; found real defects on every PR.
- **Plan-bump PRs first** when scope reveals itself mid-task.
- **Transaction API (T-133a)** as a shared primitive, not one-off
  buffering inside each editor. Future editors reuse instead of
  reinventing.
- **Commit-on-release** for discrete UI controls (sliders, textareas).
- **`gh api` REST fallback** when GraphQL rate-limits.
- **Per-id `data-testid` + `data-role`** for list items in chat-style
  UIs (T-128 lesson).

### 6.3 Known gotchas

- **Editor-shell dist staleness** — rebuild after any catalog edit
  before running `@stageflip/app-slide` tests. Symptom: `t('key')`
  returns the literal key.
- **React 19 batching + synchronous blur** — the PropField Escape
  revert needed a ref guard because `setState` + `blur()` doesn't
  apply the state update before the synchronous `onBlur` commit. If
  you see a "reset on Escape / commit on blur" pattern elsewhere,
  apply the same `isReverting` ref fix.
- **Playwright strict-mode multi-match** on repeated testids. Use
  per-id testids + `data-role` for role-level queries.

---

## 7. Session stats

- **6 merged PRs** (#49 → #54) in one working session.
- **~1417 test cases** across 24 test-active packages + 1 app (+95 vs
  phase6-mid).
- **11 Playwright walking-skeleton tests** (was 9).
- **490 external deps** (+1 `fast-json-patch`).
- **0 Remotion imports** (check-remotion-imports scanned 379 source
  files, was 354).
- **11 CI gates** green on every merge.
- **8 changesets** recorded.
- **2 plan versions** published (v1.9 → v1.10 via #52).
- **1 ratification**-blocking task remaining (T-136).
- **0 escalations** raised.

---

*End of handover. Next agent: start at §6.1. Phase 6 continues —
T-125b / T-125c / T-129 / T-131 / T-134 / T-135 available in
parallel; T-136 gates ratification.*
