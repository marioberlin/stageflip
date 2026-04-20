# Handover — Phase 2 midstream (2026-04-20)

This doc is written for the next agent session. If you are that agent: start
here. Read this once top to bottom, then go to `CLAUDE.md` for the immutable
rules, then `docs/implementation-plan.md` for the task catalogue. The content
below is everything that cannot be reconstructed from the code alone —
architectural decisions with their rationale, flagged risks, conventions
established across the session, and the exact next move.

Current commit on `main`: `3596455` (Merge T-041 + T-043).
Working tree is clean. Every gate is green.

---

## 1. Where we are

- **Phase 0 (Bootstrap)** — ratified 2026-04-20. T-001 through T-017 merged or marked covered-by-T-001. ADR-001 accepted (BSL 1.1 + Node 22) and ADR-002 accepted (Phase 0 toolchain).
- **Phase 1 (Schema + RIR + Determinism)** — ratified 2026-04-20. T-020 through T-034 merged. T-035–T-039 (Firebase storage backend) **deferred** to a dedicated infra pass; does not block Phase 2.
- **Phase 2 (Frame Runtime)** — in progress. Merged so far: T-040 (FrameContext + hooks), T-041 (interpolate + 25 easings + cubicBezier), T-043 (spring physics).

### Per-package test counts on `main`

| Package | Cases | Notes |
|---|---|---|
| `@stageflip/schema` | 92 | elements + animations + content + migrations + property-based round-trip |
| `@stageflip/rir` | 36 | compile + finalize + 9 golden fixtures |
| `@stageflip/storage` | 23 | contract + dev-grade concurrency tests |
| `@stageflip/frame-runtime` | 97 | frame-context + easings + interpolate + spring |
| `@stageflip/determinism` | 14 | runtime shim intercepts 9 APIs |
| `@stageflip/skills-core` | 14 | parse + load + validate |
| `@stageflip/testing` | 2 | smoke |
| **Total** | **278** | |

### Active CI gates

| Gate | Script | Owner task |
|---|---|---|
| `pnpm typecheck` | turbo + tsc | T-002 (covered-by-T-001) |
| `pnpm lint` | turbo + biome | T-003 (covered-by-T-001) |
| `pnpm test` | turbo + vitest | T-004 |
| `pnpm build` | turbo + tsup | T-001 |
| `pnpm check-licenses` | `scripts/check-licenses.ts` | T-010 |
| `pnpm check-remotion-imports` | `scripts/check-remotion-imports.ts` | T-010 |
| `pnpm check-skill-drift` | `scripts/check-skill-drift.ts` | T-014 |
| `pnpm check-determinism` | `scripts/check-determinism.ts` | T-028 |
| `pnpm skills-sync:check` | `scripts/sync-skills.ts --check` | T-034 |
| `pnpm e2e` | Playwright | T-005 |

All listed gates are wired in `.github/workflows/ci.yml`.

### Not yet wired

- `size-limit` per-package bundle budgets (T-049)
- Parity harness (PSNR + SSIM) (T-100)
- Firebase deployment (T-230, T-231)

---

## 2. Commit graph, most recent first

```
3596455 Merge T-041 + T-043: interpolate + 25 easings + spring
cc59953 Merge deps backfill for Phase 2
df62937 Merge T-040: FrameContext + useCurrentFrame + useVideoConfig
65dc91d Merge Phase 1 ratification (2026-04-20)
681c8b5 Merge T-033: concepts final pass
285aeb0 Merge T-034: schema reference auto-generation
611db99 Merge T-026: dev-grade in-memory storage adapter
7747315 Merge T-032: RIR golden fixtures
10e5bfe Merge T-031: timing-flatten + stacking-context
0a0b3b9 Merge T-030: RIR compiler (theme/vars/components/bindings/fonts)
e958167 Merge T-024: exhaustive round-trip property tests
22e3a76 Merge T-023: versioning + migrations framework
dd1d85f Merge T-021: mode-specific content + Document
82800eb Merge T-022: animations + timing primitives B1-B5
50a786b Merge T-029: RIR types
8ca64c2 Merge T-028: determinism source-lint gate
31f998b Merge T-027: determinism runtime shim
8b0d9cd Merge T-020: 11 discriminated element types
71b361c Merge ADR-002: Phase 0 Toolchain Ratification
10274ad Merge phase0-tooling-hardening
```

`git log --oneline --all --graph -40` shows the full picture.

---

## 3. Architectural decisions (load-bearing; preserve rationale)

These are in rough "will bite you if you don't know" order.

### 3.1 `z.union` instead of `z.discriminatedUnion` for `elementSchema`

**Decision.** `packages/schema/src/elements/index.ts` uses `z.union`, not `z.discriminatedUnion`.

**Why.** Two reasons chained:
1. `GroupElement.children: Element[]` is recursive. That forces `z.lazy(() => elementSchema)` in the group schema. Lazy-wrapped branches are not valid `ZodDiscriminatedUnionOption`.
2. `ShapeElement` originally carried a `.refine()` for the "custom-path requires path" constraint. `.refine()` turns a `ZodObject` into a `ZodEffects`, which `z.discriminatedUnion` also rejects.

**Tradeoffs.** `z.union` tries each branch at parse time (O(n)) vs. discriminator lookup (O(1)). At 11 branches this is negligible. Top-level error messages remain readable because every branch still has a `type` literal.

**Semantic validators live separately.** `validateShapeElement` in `packages/schema/src/elements/shape.ts` checks the custom-path constraint. Pattern: keep the schema shape narrow; layer semantic checks as pure functions that take a parsed value.

### 3.2 Recursive `Element` type + `as unknown as z.ZodType<X>` pattern

**Decision.** `GroupElement` is declared as an explicit TS type (not `z.infer`), and `groupElementSchema` is cast via `as unknown as z.ZodType<GroupElement>`.

**Why.** TS cannot infer a self-referential shape from `z.infer` alone. The explicit interface + cast is the standard Zod 3.x recursive pattern.

**Same applies to** `elementSchema`, `rirElementSchema`, `groupElementSchema`, and any future recursive schema. If you add one, follow the existing pattern.

### 3.3 B1–B5 timing primitive semantics are "my interpretation"

**Decision.** `packages/schema/src/timing.ts` defines five timing primitives: absolute (B1), relative (B2), anchored (B3), beat (B4), event (B5).

**Why it's fragile.** The plan says "animations + timing primitives (B1–B5)" without spelling out what B1–B5 mean. I picked a reasonable set during T-022. Commit message and the file's top comment both flag this.

**What to do.** If any plan doc, reviewer, or product owner pushes back with different semantics, the primitive count is stable (5) — only the field names inside each primitive would change. `packages/rir/src/compile/finalize.ts::resolveTimingPrimitive` is the single point that consumes them.

### 3.4 B4 beat + B5 event are warn-only in T-031

**Decision.** `packages/rir/src/compile/finalize.ts::resolveTimingPrimitive` emits diagnostics for beat and event timings and returns the container window as a placeholder.

**Why.** Beat needs a composition BPM source (Phase 8 BGM + Whisper). Event needs a runtime event bus (T-152 Executor). Phase 1 ships neither.

**What to do.** When T-184 adds caption/BGM metadata, wire BPM into the beat resolver. When T-152 lands, event timings become runtime-handled (not compile-time).

### 3.5 `animations: Animation[]` field on `ElementBase` was missed in T-020

**Decision.** Added to `ElementBase` in T-030 with `default([])`.

**Why it's lurking.** The concept skill (`concepts/schema/SKILL.md`) explicitly documented animations attaching to elements. T-020 implemented all 11 element types but forgot to add the field to the base. Caught when building the RIR compiler.

**What to do.** Nothing right now. The default of `[]` kept existing tests green. If a future schema cleanup refactors `ElementBase`, keep `animations` on it.

### 3.6 RIR `timing` + `animations` at T-030 vs T-031

**Decision.** T-030 `elementToRIR` emits `timing = identity` and `animations = []`. T-031 `finalizeRIR` refines both.

**Why.** Two-stage separation made T-030 + T-031 land independently with clean test boundaries. The T-030 tests still pass against pre-finalize output by checking the values T-030 produces (identity timing, empty animations).

**What to watch.** Any future pass that assumes a finalized RIR should run *after* `finalizeRIR` or should call it inline. `compileRIR` orchestrates the full chain; individual pass functions are also exported for testing + future reuse.

### 3.7 Component-expand is a stub

**Decision.** `packages/rir/src/compile/passes.ts::expandComponents` emits an info diag when `doc.components` is non-empty and returns the doc unchanged.

**Why.** Component body shape is not yet specified. T-249 (design-system learning) fills the `ComponentDefinition.body` contract.

**What to do.** When T-249 lands, wire the expand pass to inline components. The pass signature is stable; only the body of `expandComponents` changes.

### 3.8 Binding provider is optional

**Decision.** `resolveBindings` emits a warn when a chart has `ds:<id>` data but no provider is supplied.

**Why.** The compiler is usable without bindings (documents with inline data don't care). Providers are supplied by Phase 7 data-source-bindings tools (T-167).

**What to do.** When T-167 arrives, wire a default provider. Until then, every caller that needs bindings passes one in `CompileRIROptions.dataSourceProvider`.

### 3.9 Determinism gate uses the TS compiler API, not ESLint

**Decision.** `scripts/check-determinism.ts` walks AST via `ts.createSourceFile` + `ts.forEachChild`. Not ESLint.

**Why.** ADR-002 §D5 originally said "narrow custom ESLint plugin". Revision added in T-028 commit: the TS compiler API is already installed (typescript devdep), keeps logic alongside other `check-*` scripts, and handles the `// determinism-safe` escape-hatch uniformly.

**Implication.** If you need to extend the determinism rules, add a rule to the `RULES` array in `scripts/check-determinism.ts`. Don't reach for ESLint.

**Scope.** The gate only scans `packages/frame-runtime/src/**`, `packages/runtimes/*/src/clips/**`, `packages/renderer-core/src/clips/**`. Non-test files only. The shim package itself is deliberately out of scope (it *is* the tool).

### 3.10 Determinism shim Date uninstall needs two steps

**Decision.** `packages/determinism/src/shim.ts::uninstall` restores BOTH the Date ctor (swapped via reassignment) AND the `Date.now` method (mutated in-place on the stored ctor reference).

**Why.** `target.Date.now = fakeNow` mutates `Date.now` on the constructor identity. Storing `originals.DateCtor = target.Date` captures the same reference whose `.now` we just clobbered. Only restoring the ctor doesn't unset the clobber.

**Test.** The "uninstall restores originals" test would silently pass without this — it got caught during T-027 work and is now covered.

### 3.11 Spring integrator uses adaptive substepping

**Decision.** `packages/frame-runtime/src/spring.ts` computes an internal `dt` based on stability criterion `1 / (max(sqrt(k/m), c/m) * 8)`, capped at 1000 substeps per outer frame.

**Why.** Naive `dt = 1/fps` explodes at extreme parameter ratios. fast-check found `{mass: 0.1, damping: 77}` as a counter-example in T-043. Adaptive substepping keeps the integrator stable across the realistic envelope; the 1000/frame cap prevents runaway compute on pathological params.

**Tradeoffs.** For default params (`mass=1, stiffness=100, damping=10`) substepsPerFrame is 1–3. For extreme configs it can hit the cap; a final NaN defense-in-depth throw catches any remaining pathology.

**Contract.** Per T-043 [rev]: `mass > 0, stiffness > 0, damping >= 0.01, frame >= 0, fps > 0`. Anything else throws on `resolveConfig`.

### 3.12 `-0` vs `+0` in property tests

**Decision.** `packages/schema/src/roundtrip.test.ts` defines `noNegativeZero = (v) => Object.is(v, -0) ? 0 : v` and maps it over every numeric arbitrary.

**Why.** `JSON.stringify(-0)` returns `"0"` (sign is lost). Vitest's `toEqual` uses `Object.is` which distinguishes `-0` and `+0`. Round-trip fails.

**Apply where.** Any property-based test that exercises JSON serialization as a round-trip needs this guard. I've only applied it in one place; future property tests should follow.

### 3.13 `fc.record` cannot be spread

**Decision.** Per-element arbitraries enumerate every field explicitly (no `{...baseArb, type: 'text', text: ...}`).

**Why.** `fc.record`'s input is an object of arbitraries; spreading `baseElementArb` (a single `Arbitrary<object>`) doesn't give a field map. Runtime throws.

**Apply where.** Any new fast-check record. See `packages/schema/src/roundtrip.test.ts` for the pattern.

### 3.14 `gray-matter` parses YYYY-MM-DD as JS Date

**Decision.** `packages/skills-core/src/types.ts::skillFrontmatterSchema` has `z.preprocess` on `last_updated` to coerce Date → `YYYY-MM-DD` string.

**Why.** `gray-matter` uses `js-yaml` which parses unquoted dates as `Date` objects. Our schema wants strings.

**Apply where.** Any frontmatter schema that references dates. Quoting the value in the markdown file (`last_updated: "2026-04-20"`) also works but isn't enforced.

### 3.15 `incremental: true` removed from `tsconfig.base.json`

**Decision.** No `incremental` in the base config.

**Why.** `tsup --dts` rejects the flag without an explicit `tsBuildInfoFile`. `tsup` manages its own incremental caching, so `tsc`-level incremental adds nothing.

**Apply where.** Any new per-package `tsconfig.json` that turns on `incremental` needs to also set `tsBuildInfoFile`. Don't re-enable it in the base unless `tsup` behavior changes.

### 3.16 Storage adapter: version tracked via `snapshot.version ?? history.length`

**Decision.** `packages/storage/src/in-memory.ts::applyPatch` derives the "current version" from `snapshot?.version` when a snapshot exists, otherwise from `history.length`.

**Why.** Tests and fresh-doc flows apply patches to docs with no snapshot yet. Version has to come from somewhere.

**Implication for real backends.** The Firebase adapter (T-036) should probably require a snapshot exist (or create one on first patch) rather than inferring from history. This in-memory behavior is a dev/test convenience, not a contract.

### 3.17 Storage adapter buffer is bounded with drop-oldest

**Decision.** `UpdateQueue` has `maxBuffered = 1024` by default; overflow drops the oldest update and increments `droppedCount`.

**Why.** Dev-grade in-memory adapter shouldn't pin unbounded memory if a consumer stops reading. Real backends (Firestore, Postgres) have their own flow-control model — don't assume this behavior applies.

### 3.18 Component test env uses happy-dom, not jsdom

**Decision.** `packages/frame-runtime/vitest.config.ts` sets `environment: 'happy-dom'`.

**Why.** Faster than jsdom for React rendering. No functionality is missing for our needs.

**If you add a package that needs DOM for tests** and happy-dom lacks an API, either polyfill locally or switch just that package to jsdom via a per-package vitest.config.

### 3.19 React is a runtime dep of `@stageflip/frame-runtime`, will become a peer at T-054

**Decision.** Currently: `"dependencies": { "react": "19.2.5", "react-dom": "19.2.5" }`.

**Why.** Tests work cleanly this way. Publishing the package means consumers would get two React copies if they also install React — that's T-054's public-API-freeze concern.

**What to do at T-054.** Flip to peer dep + add to `devDependencies` for tests.

### 3.20 Skill file `id` must match path

**Decision.** `validateSkill` fails if `frontmatter.id` doesn't equal the file path with `/SKILL.md` stripped.

**Why.** Enforces cross-reference integrity. `related:` fields resolve by id; id drift breaks the graph.

**Implication.** When moving a SKILL.md, also update its `id` field. `check-skill-drift` catches this.

### 3.21 Package-name convention: dash, not slash

**Decision.** `packages/runtimes/css` ships as `@stageflip/runtimes-css` (dash), `packages/profiles/slide` as `@stageflip/profiles-slide`.

**Why.** npm package names don't support multi-segment paths. Docs sometimes use `@stageflip/runtimes/css` as conceptual shorthand; the actual package name has a dash.

**Documented in.** `skills/stageflip/concepts/skills-tree/SKILL.md` "Package-name convention" section.

### 3.22 Every merge uses `--no-ff`

**Decision.** Every task PR is merged with `git merge --no-ff`.

**Why.** Preserves the task boundary as a first-class node in git history. `git log --oneline --graph` shows each merge commit with the task number in its message.

**Implication.** `main` has both the feature commit and a merge commit per task. `git log --first-parent main` shows merges only, which is the "tasks landed" view.

### 3.23 Commit messages via file (heredoc) when they contain backticks

**Decision.** Long commit messages go through `cat > /tmp/t-XXX-msg.txt <<'EOM' ... EOM; git commit -q -F /tmp/t-XXX-msg.txt`.

**Why.** `git commit -m "..."` with embedded backticks confuses zsh's command substitution. Hit this during T-027 work; the heredoc-with-file pattern is reliable.

### 3.24 `pnpm install --frozen-lockfile` doubles as lockfile-drift check

**Decision.** CI runs `pnpm install --frozen-lockfile` (not a separate `pnpm install --lockfile-only` step).

**Why.** `--frozen-lockfile` fails if `package.json` and `pnpm-lock.yaml` disagree. That IS the lockfile-drift check.

**Implication.** Local dev should also use `--frozen-lockfile` unless intentionally adding a dep. CONTRIBUTING.md documents this.

### 3.25 Blocked majors encoded in Dependabot ignore list

**Decision.** `.github/dependabot.yml` ignores major bumps for TS, Biome, Vitest, Zod, Next, Firebase, Puppeteer, size-limit.

**Why.** `docs/dependencies.md` §4 lists blocked-majors that need ADRs. Without the Dependabot ignore, weekly PRs would constantly try these bumps.

**Implication.** When an ADR unblocks a major, remove the corresponding entry from `dependabot.yml`.

### 3.26 T-034 schema-reference generator uses Zod `_def` internals

**Decision.** `packages/skills-sync/src/introspect.ts` reads Zod schemas via `schema._def.typeName` + `schema._def.shape()`.

**Why.** Zod 3.x has no public introspection API. `_def` is stable within 3.x. Zod 4 breaks this — if we ever unblock Zod 4 via ADR, the introspector needs a rewrite.

**Scope limit.** The `describeInner` function handles the types we currently use. If a future schema uses something new (e.g. `ZodBranded`, `ZodPipeline`), add a case.

---

## 4. Conventions not in CLAUDE.md but established practice

These are things I did consistently across the session that a future agent should keep doing.

- **Branch per task.** `task/T-XXX-<slug>` for planned tasks; `chore/<slug>` for closeouts not in the plan (like this handover).
- **Per-task commit message includes:** what shipped, why (if non-obvious), decisions worth preserving, verification output, flagged follow-ups.
- **Merge with `--no-ff`.** Message is `"Merge T-XXX: <short title>"`.
- **After every file write, expect a biome autofix pass.** `pnpm exec biome check --write <dir>` is safe to run; it'll touch import order + formatting. Re-run tests after autofix if the touched file is test-critical (like a generated skill).
- **When a commit message has backticks**, use the heredoc-to-file pattern (`cat > /tmp/... <<'EOM' ... EOM; git commit -F /tmp/...`).
- **Flag ambiguity in the commit.** If the plan is unclear (e.g. B1–B5 semantics), make a reasonable call, ship it, and explicitly flag the interpretation in the commit message.
- **Follow-ups live in commit messages.** We don't have a tracker. The cumulative "flagged for follow-up" is this doc's §6.
- **Gate sweep before merge.** `pnpm typecheck && pnpm lint && pnpm test && pnpm check-licenses && pnpm check-remotion-imports && pnpm check-skill-drift && pnpm check-determinism && pnpm skills-sync:check`. All PASS or no merge.
- **When introducing a new dep**, add it to `docs/dependencies.md` §3 as a row, update the "installed at root" list in §4 if hoisted, and note the install-site otherwise. Backfill pass if you forget (see Phase 2 backfill commit `cc59953`).
- **No emojis in files.** CLAUDE.md rule. Skill files and commits follow.

---

## 5. How to resume in a fresh session

### 5.1 Local dev environment

This is **my** dev-machine setup; it may not apply to a fresh session on a different box.

```sh
# 1. pnpm via corepack (one-time)
corepack enable   # on macOS with Homebrew Node, needs sudo
corepack prepare pnpm@9.15.0 --activate

# Fallback if you can't sudo:
mkdir -p ~/.local/bin
cat > ~/.local/bin/pnpm <<'EOS'
#!/usr/bin/env bash
exec corepack pnpm "$@"
EOS
chmod +x ~/.local/bin/pnpm
export PATH="$HOME/.local/bin:$PATH"   # add to shell rc

# 2. Install
pnpm install --frozen-lockfile

# 3. Verify
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm check-licenses && pnpm check-remotion-imports
pnpm check-skill-drift && pnpm check-determinism && pnpm skills-sync:check

# 4. Optional: E2E browser
pnpm e2e:install   # ~150 MB Chromium
pnpm e2e
```

CONTRIBUTING.md has more detail. If `pnpm` is not on `$PATH`, turbo can't invoke it and `pnpm test/build` fail. This is the #1 gotcha for fresh environments.

### 5.2 Starter prompt for the next session

Copy-paste to bootstrap:

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase2-midstream.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` Phase 2. Confirm your understanding
> of the current state (commit `3596455`, Phase 2 T-040/T-041/T-043
> merged) and the next task.

Expected confirmation shape: "On `main` at `3596455`. Phase 0+1 ratified.
Phase 2 partially complete. Next task is T-042 (`interpolateColors` via
`culori`). Ready."

---

## 6. Flagged risks + follow-ups (by urgency)

### Active — may need attention at the next relevant task

1. **B1–B5 timing primitive semantics are my interpretation** (§3.3). If the product owner or reviewer has different semantics, T-031 is the load-bearing pass to update.
2. **Spring integrator capped at 1000 substeps/frame** (§3.11). Realistic params hit 1–3; pathological params may undercount. Monitor when T-048 property tests go wider.
3. **React dep posture** (§3.19). Will need a peer-dep flip at T-054 (public API freeze).

### Deferred — waiting on a later task

4. **Firebase storage backend (T-035–T-039)** — deferred. Non-blocking for any Phase 2+ task. Pick up in its own infra pass; the contract shape (T-025) is stable.
5. **Migration framework `down()` / `reversibleMigrate()`** — deferred until the first reversible migration. Add alongside it.
6. **Beat timing (B4) BPM source** — wire when T-184 (Whisper + BGM metadata) lands.
7. **Event timing (B5) runtime bus** — wire when T-152 (Executor) lands.
8. **Component-expand pass is a stub** — wire when T-249 (design-system learning) defines `ComponentDefinition.body`.
9. **`@stageflip/export-loss-flags` is an empty package** — fills when T-248 lands.

### Low-urgency cleanups

10. **Auto-generated schema skill shows "object" for union variants** — `describeInner` returns a type summary; for unions it's currently "object object object…". Acceptable; a richer summary would require either a separate variant-entry table or enumerating the discriminator values.
11. **REVIEWED_OK allowlist in `check-licenses.ts` hardcodes `spawndamnit`** — will need revisit if dep tree evolves. The entry is documented with rationale.
12. **Turbo remote cache not enabled** — acknowledged in ADR-002 §D2. Revisit when CI run times become painful.
13. **`back-in`/`back-out` easings overshoot** — not monotonic; tests exempt them explicitly. Expected behavior; don't "fix".

---

## 7. Next-task recommendation

### T-042 — `interpolateColors()` via `culori`

Size S/M. Pairs naturally with `interpolate`.

**What to build.**
```ts
interpolateColors(
  input: number,
  inputRange: readonly number[],
  outputColors: readonly string[],
  options?: InterpolateOptions & { colorSpace?: 'rgb' | 'hsl' | 'oklch' }
): string
```

- Parse each outputColor via `culori.parse` (accepts hex, named, rgb(), hsl()).
- Interpolate in the chosen color space (default `'rgb'` for speed; `'oklch'` for perceptual uniformity).
- Handle alpha channel linearly in every space.
- Return a hex string or `rgba(...)` depending on alpha presence.

**Test coverage to match T-041 style.**
- Endpoints: `interpolateColors(0, [0,100], ['#000', '#fff'])` returns `#000000`; at 100 returns `#ffffff`.
- Midpoint: at 50 returns `#808080` (rgb space).
- Alpha: interpolates linearly; endpoint `rgba(0,0,0,0)` and `rgba(0,0,0,1)` at midpoint yields `rgba(0,0,0,0.5)`.
- Input validation: inherits from `interpolate`.
- Color-space switching produces different midpoints.

**Dep to add.**
- `culori` at the version pinned in `docs/dependencies.md` §3 (`4.0.2`).
- Backfill `culori` as installed in `@stageflip/frame-runtime`.

**Why this first.**
- Small + well-bounded.
- Fresh context gets a gentle re-entry.
- Builds the full numeric+color surface before the (harder) component work in T-044–T-047.

### After T-042

- **T-044** `<Sequence>` — frame gate + remap. Medium. React component territory; probably 2 Bash calls + 1 Write + 1 tests file.
- **T-047** `<Composition>` + `renderFrame(compId, frame, props)` — the renderer entry point everything else hangs off. Medium-large.
- **T-048** formal property test consolidation — some already written inline; this task gathers them.
- **T-049** `size-limit` per-package budgets — small but requires `.size-limit.json` config. Freezes frame-runtime at ≤ 25 KB gz.
- **T-051** `runtimes/frame-runtime/SKILL.md` — reflight the existing placeholder with the actual API surface once T-054 freezes.
- **T-055** `useMediaSync(ref, { offsetMs, durationMs })` — drives `<video>` / `<audio>` `.currentTime` from FrameClock. Important for video mode.

---

## 8. File map — where to find things

```
docs/
  architecture.md              — system design, invariants, stack choices
  implementation-plan.md       — task catalogue (Phase 1 ✅ ratified badge added)
  dependencies.md              — locked versions + Audit 0 + Audit 1 addendum
  user-manual.md               — product-level overview
  handover-phase2-midstream.md — this doc
  decisions/
    ADR-001-initial-stack.md   — license + Node LTS (Accepted)
    ADR-002-phase0-toolchain.md — pnpm/Turbo/Vitest/Playwright/Biome/tsup/Changesets/GH Actions (Accepted, §D5 revision noting TS-compiler-API for determinism gate)

skills/stageflip/
  concepts/                    — 17 substantive; T-033 added "Current state" sections
  reference/schema/SKILL.md    — auto-generated by @stageflip/skills-sync (T-034)
  runtimes/ modes/ profiles/ tools/ workflows/ reference/ clips/
                               — 40 placeholders authored in T-012

packages/
  schema/                      — T-020..T-024: 92 tests; 11 elements + content + animations + migrations
  rir/                         — T-029..T-032: 36 tests; compile orchestrator + finalize + 9 fixtures
  storage/                     — T-025 + T-026: 23 tests; contract + dev-grade in-memory
  frame-runtime/               — T-040/T-041/T-043: 97 tests; context + easings + interpolate + spring
  determinism/                 — T-027: 14 tests; runtime shim
  skills-core/                 — T-013: 14 tests; parse/validate/load
  skills-sync/                 — T-034: Zod introspection + schema-gen
  testing/                     — T-004: 2 tests (smoke)
  (40 others scaffolded; stubs until their task lands)

apps/
  6 stubs with "Stub. … scaffolded by Phase N (T-NNN)." descriptions.
  Per-app scaffolding is Phase 6 (slide), 8 (video), 9 (display), 10 (cli).

scripts/
  check-licenses.ts            — T-010
  check-remotion-imports.ts    — T-010
  check-skill-drift.ts         — T-014
  check-determinism.ts         — T-028 (TS compiler API walker)
  sync-skills.ts               — T-034 (--check mode for CI gate)

tests/
  e2e/smoke.spec.ts            — Playwright smoke (T-005)
  fixtures/                    — parity fixtures placeholder (T-102+)

.github/
  workflows/ci.yml             — verify + e2e + changesets jobs
  workflows/audit.yml          — weekly pnpm audit
  pr-templates/phase-{0..12}.md — 13 per-phase templates (T-015)
  dependabot.yml               — ignores blocked majors (T-019)
  pull_request_template.md     — default
```

---

## 9. Statistics — where we stand

- **59 commits** on `main` across two phases + toolchain + ratifications
- **278 test cases** passing across 6 packages
- **402 external deps** license-audited (PASS)
- **55 source files** scanned for Remotion imports (PASS)
- **57 SKILL.md files** in the skills tree; 1 auto-generated, 17 substantive, 40 placeholders
- **10 CI gates** wired in GitHub Actions
- **2 ADRs** accepted; ADR-001 (license + Node) and ADR-002 (Phase 0 toolchain)
- **4 merge types** used: task/T-XXX, chore/<slug>, docs/adr-*, merge commits

---

*End of handover. Next agent: go to §5.2 for the starter prompt.*
