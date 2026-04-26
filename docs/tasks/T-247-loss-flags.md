---
title: T-247-loss-flags — Extract LossFlag to @stageflip/loss-flags
id: docs/tasks/T-247-loss-flags
phase: 11
parent: T-248
size: S
owner_role: implementer
status: draft
last_updated: 2026-04-26
---

# T-247-loss-flags — Extract `LossFlag` to `@stageflip/loss-flags`

**Branch**: `task/T-247-loss-flags-extract`

## Goal

Extract the `LossFlag` shape, the severity/category vocabulary, and the deterministic-id emitter from `@stageflip/import-pptx` into a new shared package `@stageflip/loss-flags` so that:

1. `apps/stageflip-slide` (and the editor-shell layer in general) can import `LossFlag` to render the loss-flag reporter UI **without** depending on `@stageflip/import-pptx`. (Editor-shell depending on importers is the wrong direction.)
2. Sibling importers — T-244 (`@stageflip/import-google-slides`), T-247 (`@stageflip/import-hyperframes-html`) — can emit `LossFlag` records that share one shape, one severity vocabulary, and one id-hashing scheme without re-implementing the emitter.

This is a **type-and-emitter extraction only**. Zero behavior change. No new flags, no new severities, no new categories. Same hashes, same emit signatures, same outputs at every callsite. The PR is intentionally mechanical.

Hard prerequisite for **T-248** (loss-flag reporter UI) per `docs/handover-phase11-mid.md` §5 decision #1 + `docs/implementation-plan.md` §Phase 11 row text.

## Dependencies

- T-240 merged (provides the existing `LossFlag` shape + `emitLossFlag` in `@stageflip/import-pptx`).
- T-241a, T-242a/b, T-243a/b/c, T-242c batch 1 merged (callers; they all import `LossFlag` indirectly through the parser's `CanonicalSlideTree`).
- No new external runtime dependencies.

## Out of scope

| Item | Why deferred |
|---|---|
| New loss-flag codes | Importer-specific. T-243b/c add `LF-PPTX-UNRESOLVED-VIDEO` / `LF-PPTX-UNRESOLVED-FONT` in their own PRs; T-244 adds `LF-GSLIDES-*`. T-247-loss-flags ships the shared shape only. |
| Reporter UI | T-248. |
| Schema integration | `@stageflip/schema` does not import from `@stageflip/loss-flags`. The reporter UI consumes `LossFlag` independently of canonical document state. |
| Centralized union of every importer's codes | Anti-pattern: would force every importer's PR to also touch `@stageflip/loss-flags`. Each importer owns its own code union; the shared package types `code` as `string` with the documented convention `LF-<SRC>-<DESCRIPTOR>`. |
| Telemetry / aggregation helpers | T-248 may add reducer / counter helpers; T-247-loss-flags ships the type + emitter only. |

## Architectural decisions

### Package layout

```
packages/loss-flags/
  package.json                 # @stageflip/loss-flags, private until T-248 needs it published
  tsconfig.json
  src/
    index.ts                   # public re-exports
    types.ts                   # LossFlag, LossFlagSeverity, LossFlagCategory, LossFlagSource
    emit.ts                    # emitLossFlag generic + id-hash helper
    types.test.ts              # type-shape pin tests (compile-only assertions)
    emit.test.ts               # determinism + severity/category default tests
```

`package.json` mirrors `packages/storage-firebase/package.json` shape (sibling small-package precedent): `"private": false` so future Reporter / Editor packages can depend on it; `peerDependencies` empty; one runtime dep (`node:crypto` is built-in, no install). **No `vitest.config.ts`** — `storage-firebase` doesn't have one; both packages inherit the workspace-root vitest config.

### Public API

The new package exports:

```ts
// @stageflip/loss-flags

/**
 * Per-importer source identifier. Typed as `string` (not a closed union) for
 * the same reason `code` is a string: each importer owns its source name
 * locally; new importers don't touch the shared package. Convention is to use
 * the importer package's suffix:
 *   - `'pptx'`             from `@stageflip/import-pptx`
 *   - `'gslides'`          from `@stageflip/import-google-slides`
 *   - `'hyperframes-html'` from `@stageflip/import-hyperframes-html`
 * The Reporter UI (T-248) renders any `source` string; type-safe enums are an
 * importer-local concern.
 */
export type LossFlagSource = string;

export type LossFlagSeverity = 'info' | 'warn' | 'error';

export type LossFlagCategory =
  | 'shape'
  | 'animation'
  | 'font'
  | 'media'
  | 'theme'
  | 'script'
  | 'other';

/**
 * Canonical loss-flag record. `code` is typed as `string` so each importer's
 * `LF-<SRC>-<DESCRIPTOR>` enum can flow through without forcing every new
 * importer to amend a shared union. Importers narrow with their own union
 * type (e.g. `type PptxLossFlag = LossFlag & { code: PptxLossFlagCode }`).
 */
export interface LossFlag {
  /** sha256(source + category + location + originalSnippet).slice(0, 12). */
  id: string;
  source: LossFlagSource;
  code: string;
  severity: LossFlagSeverity;
  category: LossFlagCategory;
  location: {
    slideId?: string;
    elementId?: string;
    oocxmlPath?: string;
  };
  message: string;
  recovery?: string;
  originalSnippet?: string;
}

export interface EmitLossFlagInput {
  source: LossFlagSource;
  code: string;
  severity: LossFlagSeverity;
  category: LossFlagCategory;
  message: string;
  location: LossFlag['location'];
  recovery?: string;
  originalSnippet?: string;
}

/**
 * Pure: derives the `id` field deterministically from
 * `source + category + location + originalSnippet`. Same inputs → same id
 * across runs. Uses node's `node:crypto` `createHash('sha256')`. Signature
 * matches the existing `emitLossFlag` in `@stageflip/import-pptx` *minus*
 * the source-default; importers pass `source` explicitly.
 */
export function emitLossFlag(input: EmitLossFlagInput): LossFlag;
```

### `@stageflip/import-pptx` after extraction

`packages/import-pptx/src/types.ts`:
- **Removes**: `LossFlagSeverity`, `LossFlagCategory`, `LossFlag` (re-exports from `@stageflip/loss-flags` for backward compat at the same export name).
- **Keeps + narrows**: `LossFlagCode` becomes the PPTX-specific union (`'LF-PPTX-CUSTOM-GEOMETRY' | ... | 'LF-PPTX-NOTES-DROPPED'`) and is now defined as a string-narrowing type. Importers of `LossFlagCode` from `@stageflip/import-pptx` continue to work.

`packages/import-pptx/src/loss-flags.ts`:
- Becomes a thin wrapper around the generic `emitLossFlag`. Holds the PPTX-specific `CODE_DEFAULTS` map (severity + category per code) and exposes a PPTX-narrowed `emitPptxLossFlag(input)` that auto-fills `source: 'pptx'`, `severity`, and `category` from the lookup.
- Existing callsites continue to call `emitPptxLossFlag(...)` (renamed export — see migration below) with the same argument shape they pass today, so callsites change at most by import path.

### Migration of existing callsites

Every file currently importing `emitLossFlag` from `./loss-flags.js` continues to import from the same module — it just now re-exports the renamed `emitPptxLossFlag`. Either:

- **Option A (preferred, minimum diff)**: keep the existing function name `emitLossFlag` in `@stageflip/import-pptx`. The PPTX wrapper exports `emitLossFlag` as the same name; the new `@stageflip/loss-flags` exports its generic emitter under the same name too. Disambiguation is by package, not by symbol name. Callsites change zero lines.
- **Option B**: rename the PPTX wrapper to `emitPptxLossFlag`. Cleaner but every callsite changes. Reject.

Pick A. **Risk + mitigation**: an editor IDE auto-import for `emitLossFlag` could ambiguously suggest either package. The PPTX wrapper's `emitLossFlag(input: PptxEmitInput)` accepts a *narrower* input type than the generic `emitLossFlag(input: EmitLossFlagInput)` (the wrapper drops the `source` / `severity` / `category` fields, auto-filling them), so calling the generic emitter from inside `import-pptx` would fail to compile due to the missing required fields — a typecheck wall, not a silent footgun. Document this asymmetry in `loss-flags.ts`'s file header.

### What `apps/*` and editor-shell can now do

After this PR, `apps/stageflip-slide` (or `packages/editor-shell` once T-248 lands) can:

```ts
import type { LossFlag, LossFlagSeverity } from '@stageflip/loss-flags';
```

…without pulling in any importer code.

## Files to create / modify

```
packages/loss-flags/                              # NEW PACKAGE
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    emit.ts
    types.test.ts
    emit.test.ts

packages/import-pptx/
  package.json                                    # add "@stageflip/loss-flags": "workspace:*" to dependencies
  src/
    types.ts                                      # drop LossFlag/Severity/Category; re-export from @stageflip/loss-flags
    loss-flags.ts                                 # delegate to @stageflip/loss-flags's emitLossFlag; keep PPTX defaults
    # No changes to other src/ files. Imports of `LossFlag*` from `./types.js`
    # continue to work via the re-export.

pnpm-workspace.yaml                                # no change — packages/* already globbed
.changeset/loss-flags-t247.md                      # NEW — `minor` on @stageflip/loss-flags, `patch` on @stageflip/import-pptx
```

Total: ~7 new files in the new package + 3 modified files in `import-pptx` + 1 changeset. Net diff should be small.

## Acceptance criteria

Each gets a Vitest test, written first and failing.

1. `@stageflip/loss-flags` package builds: `pnpm --filter @stageflip/loss-flags build` exits 0; `tsconfig.json` extends the workspace base; `pnpm typecheck --filter @stageflip/loss-flags` exits 0.
2. `LossFlag`, `LossFlagSeverity`, `LossFlagCategory`, `LossFlagSource`, `EmitLossFlagInput`, `emitLossFlag` are all exported from `@stageflip/loss-flags` (compile-only test pins the export shape).
3. `emitLossFlag(input)` is pure: same input → same `id` across runs (Vitest test runs the same input 1000× and asserts every output equal).
4. `emitLossFlag(input)` derives `id` from `sha256(source + category + location + originalSnippet).slice(0, 12)` — exact algorithm pinned by a fixed-input → fixed-id test.
5. `emitLossFlag` accepts every `LossFlagSeverity` and every `LossFlagCategory` value without runtime narrowing — round-trip tests for each.
6. `@stageflip/import-pptx` re-exports `LossFlag`, `LossFlagSeverity`, `LossFlagCategory`, `LossFlagSource`, and `emitLossFlag` from `@stageflip/loss-flags` so existing imports of these names from `@stageflip/import-pptx` continue to compile **and link at runtime**. Test imports them from `@stageflip/import-pptx`'s public surface and exercises both type-only re-exports (interfaces / type aliases) and value re-export (the `emitLossFlag` function — assert it's callable and returns a `LossFlag`).
7. The `import-pptx` `emitLossFlag(input)` wrapper produces **byte-identical `LossFlag` records** to what the pre-extraction implementation produced for the same inputs. Pin via a test fixture: 8 inputs (one per existing `LossFlagCode`) → 8 expected `LossFlag` outputs (id + severity + category populated from the existing `CODE_DEFAULTS` map). **Sequencing to avoid circularity**: in **Commit 1** (failing tests + scaffolding), capture the 8 expected outputs by invoking the **current pre-extraction `emitLossFlag`** against the 8 inputs and pinning the actuals as expected fixtures (the new package's emitter doesn't exist yet, so the test fails with an import error). In **Commit 2** (the extraction), the new generic emitter + the rewired PPTX wrapper must produce the pinned outputs — any drift is a real regression. Do **not** generate the fixtures from the new implementation; that would make AC #7 tautological.
8. The full `@stageflip/import-pptx` test suite continues to pass with no changes to test fixtures. Any change to a pinned `lossFlags[].id` is a regression. **Pin the suite size at this branch's base commit** (`f669bf1`, the merge of PR #183 = T-242c spec): `pnpm --filter @stageflip/import-pptx test` reports `N` passing tests at base; the same command on the T-247-loss-flags branch tip must report `N` passing tests too. If T-242c batch 1 (PR #184) merges into main between the branch base and this PR landing, rebase and re-pin to the new base; do not assume the count.
9. `apps/stageflip-slide` (or the smallest existing `apps/*` package) builds with a no-op `import type { LossFlag } from '@stageflip/loss-flags'` added — proves the package is consumable from app code without pulling in `@stageflip/import-pptx`.
10. Coverage on `packages/loss-flags/src/**` is ≥90% (small surface, easy bar).
11. `pnpm check-licenses` passes — `@stageflip/loss-flags` declares no new third-party deps (uses `node:crypto` only).
12. `pnpm check-determinism` passes — the new package has no `Date.now()`, no `Math.random()`, no I/O.

## Public-spec / library references

- Existing in-repo precedents:
  - `packages/storage-firebase/` — sibling small-package layout (one src module, narrow public surface, structural typing for external collaborators).
  - `packages/import-pptx/src/types.ts` lines 109–162 — the canonical types being extracted.
  - `packages/import-pptx/src/loss-flags.ts` — the emitter being generalized.
  - `skills/stageflip/concepts/loss-flags/SKILL.md` — the contract this package implements; treat as source of truth.

## Skill updates (in same PR)

- `skills/stageflip/concepts/loss-flags/SKILL.md` — note that the canonical type now lives in `@stageflip/loss-flags`; importers extend with their own code unions; cross-link the new package.
- `skills/stageflip/workflows/import-pptx/SKILL.md` — update the line at L116 (currently `Loss flags (\`skills/stageflip/concepts/loss-flags\`) are emitted at every`) to mention that the canonical emitter now lives in `@stageflip/loss-flags` and `import-pptx` exports a PPTX-defaulted wrapper.

No other skill files reference `LossFlag` directly today (verified via repo grep before drafting).

## Quality gates (block merge)

Standard CLAUDE.md §8 set:

- `pnpm typecheck` (workspace-wide, since two packages change).
- `pnpm lint`.
- `pnpm test` — full suite. AC #8 is the no-regression bar.
- Coverage ≥85% on changed files (AC #10 sets the bar at ≥90% for the new package).
- `pnpm check-licenses`.
- `pnpm check-remotion-imports`.
- `pnpm check-determinism`.
- `pnpm check-skill-drift`.
- `pnpm size-limit` — `@stageflip/import-pptx` should shrink slightly (types moved out); `@stageflip/loss-flags` is brand new and below any meaningful budget.

No parity-fixture runs (no rendering touched).

## PR template + commit

- Title: `[T-247-loss-flags] @stageflip/loss-flags — extract LossFlag from import-pptx`
- Conventional commits:
  - Commit 1: `test(loss-flags): T-247-loss-flags — failing tests + scaffolding for new package`
  - Commit 2: `refactor(loss-flags): T-247-loss-flags — extract LossFlag from @stageflip/import-pptx`
- Branch: `task/T-247-loss-flags-extract`
- Changeset: `.changeset/loss-flags-t247.md` — `minor` on `@stageflip/loss-flags`, `patch` on `@stageflip/import-pptx` (re-export-only behavioral change).

## Escalation triggers (CLAUDE.md §6)

- AC #7 (byte-identical `LossFlag` records) fails for any existing fixture. The id hash algorithm has drifted somewhere; do not silently update fixtures. Escalate with the input + the diff between expected and actual.
- A consumer import of `LossFlag` from `@stageflip/import-pptx` breaks (existing public surface contract). Re-export must hold; if it doesn't, escalate before changing the consumer.
- Workspace dependency cycle detected (`@stageflip/loss-flags` → `@stageflip/import-pptx` or vice versa). The new package must have **zero** intra-workspace dependencies. If a cycle appears, the design is wrong; escalate.

## Notes for the Orchestrator

1. **Mechanical PR; bias to merge fast.** No new behavior, no new flags, no callsite changes outside `types.ts` + `loss-flags.ts`. Reviewer should focus on (a) the new package's public-surface shape matching the spec exactly, (b) zero `LossFlag*` import-path changes outside the two `import-pptx` files, (c) AC #7 and #8 — the pinned-id and full-suite passes are what catches behavior drift.
2. **Bumps T-248 from "blocked" to "ready to spec."** Once this merges, T-248's spec can land (it'll cite `@stageflip/loss-flags` as a hard dep) and T-248's Implementer can be dispatched.
3. **Sibling-importer payoff.** T-243b / T-243c / T-244's spec text already declares new `LF-*` codes. After this extraction, those codes are genuinely importer-local — no edits to a shared file needed when adding them. Document this in the `import-pptx` SKILL update.
4. **Dispatch convention** (this session): foreground Implementer, no `isolation: worktree`. Reviewer dispatch likewise foreground.
