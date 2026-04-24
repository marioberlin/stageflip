# Handover — Phase 7 mid (2026-04-24)

If you are the next agent: read this top to bottom, then `CLAUDE.md`, then
`docs/implementation-plan.md` (v1.13). Phase 7 is **in flight**; Phases 0 +
1 + 2 + 3 + 4 + 5 + 6 are all ratified. The three-agent triad (Planner +
Executor + Validator) ships end-to-end; handler bundles are partially
populated.

Status at write time: **Phase 7 in-progress**. 10 PRs merged so far
(T-150 / 151 / 151a / 152 / 153 / 154 / 155 / 156 / 157 / 158 / 159).
Working tree clean; every gate green on every merge.

---

## 1. Where we are

### Phase history

- Phases 0–6: ratified (see prior handover docs).
- **Phase 7 (Agent + Semantic Tools)** — in-flight.
  - Agent plane: Planner ✅, Executor ✅, Validator ✅.
  - Tool infrastructure: bundle registry/loader ✅, tool router ✅.
  - Handler bundles: 5 of 14 shipped.

### Phase 7 tasks as shipped

| ID | Title | PR |
|---|---|---|
| T-150 | `@stageflip/llm-abstraction` | #90 |
| T-151 | Planner (`createPlanner`) | #91 |
| T-151a | Bundle registry + loader (I-9 enforcement) | #92 |
| T-154 | Tool router (Zod I/O + observer) | #93 |
| T-152 | Executor (tool-call loop + patch sink) | #94 |
| T-155 | Handler bundle 1: `read` (5 tools) | #95 |
| T-153 | Validator (programmatic tier + LLM qualitative) | #96 |
| T-156 | Handler bundle 2: `create-mutate` (8 tools) | #97 |
| T-157 | Handler bundle 3: `timing` (4 tools) | #98 |
| T-158 | Handler bundle 4: `layout` (5 tools) | #99 |
| T-159 | Handler bundle 5: `validate` (4 tools) | #100 |

### Phase 7 tasks remaining

| ID | Title | Size | Tool count |
|---|---|---|---|
| T-160 | Handler bundle 6: `clip-animation` | L | 14 |
| T-161 | Handler bundle 7: `element-cm1` | L | 12 |
| T-162 | Handler bundle 8: `slide-cm1` + accessibility | M | 6 |
| T-163 | Handler bundle 9: `table-cm1` | M | 6 |
| T-164 | Handler bundle 10: `qc-export-bulk` | M | 9 |
| T-165 | Handler bundle 11: `fact-check` | M | 2 |
| T-166 | Handler bundle 12: `domain-finance-sales-okr` | L | 27 |
| T-167 | Handler bundle 13: `data-source-bindings` | M | 2 |
| T-168 | Handler bundle 14: `semantic-layout` | M | 4 |
| T-169 | Auto-gen `tools/*/SKILL.md` from registry | M | — |
| T-170 | Wire orchestrator into AI copilot | S | — |

Remaining tool surface: **86 tools across 9 handler bundles**, plus T-169
skill auto-gen + T-170 copilot wiring.

---

## 2. The shipped architecture (what not to redesign)

### Package graph (Phase 7 shape)

```
@stageflip/llm-abstraction   provider-neutral LLM interface
         ▲
         │
@stageflip/engine            bundle registry + loader + router + handlers
         ▲
         │
@stageflip/agent             Planner + Executor + Validator
         ▲
         │
apps/stageflip-slide         /api/agent/execute (501 stub — T-170 fixes)
```

Zero circular deps. Engine is the home for **all handler bundles**
(CLAUDE.md §10 is explicit: "Handler bundle in `packages/engine/`"). Do
not create per-bundle packages.

### Context types (engine router/types.ts)

Three nested contexts; write-tier handlers declare the narrowest they
need. Executor's `ExecutorContext` satisfies all three.

```ts
interface ToolContext       { signal?: AbortSignal }
interface DocumentContext   extends ToolContext { document: Document; selection?: DocumentSelection }
interface MutationContext   extends DocumentContext { patchSink: PatchSink; stepId?: string }
```

- **Read-tier handlers** (e.g. `read`, `validate`): type against
  `DocumentContext`.
- **Write-tier handlers** (e.g. `create-mutate`, `timing`, `layout`):
  type against `MutationContext`.
- Agent's `ExecutorContext extends MutationContext` adds `stepId: string`
  (required) + a `PatchSink` with `drain` + `size` for the batch-apply loop.

### Contract discipline (applies to every handler)

- Input + output both Zod-validated by the router (T-154).
- Output is a **discriminated union on `ok`**:
  - `{ ok: true, ... }` — success, carries ids + counts.
  - `{ ok: false, reason: z.enum([...]) }` — failure. Collapse every
    failure branch into **one** Zod object with a `reason` enum. Zod's
    `z.discriminatedUnion` rejects duplicate `ok: false` literal values
    across union arms.
- Handlers **never throw** for caller-controllable errors. They return
  a structured failure so the LLM can self-correct (the router feeds it
  back via `is_error: true`). Only programmer-mistake errors (unknown
  bundle, already-loaded bundle) can throw — they bubble out to
  `/api/agent/execute`.
- Failure reason names are consistent across bundles: `wrong_mode`,
  `not_found` / `slide_not_found` / `element_not_found`, `rejected_fields`,
  `last_slide`, `mismatched_ids`, `mismatched_count`.
- Every `.object({...})` is `.strict()`. No implicit pass-through.
- No `.default()` on input Zod fields — the Zod input/output types
  diverge and break the `ToolHandler` generic. Use `.optional()` +
  `??` defaulting inside `handle()`.

### Per-bundle file layout

```
packages/engine/src/handlers/<bundle-name>/
  handlers.ts          all N handlers + LLMToolDefinition array + barrel
  handlers.test.ts     1 happy + 1–3 edge cases per handler
  register.ts          registerXBundle(registry, router)
  register.test.ts     6 standard tests (populates / registers / drift /
                       bundle-name invariant / ≤30 / throws on missing)
  ids.ts               (create-mutate only — slide/element id helpers)
```

Every bundle exports three public surfaces from its `register.ts`:
`<BUNDLE>_BUNDLE_NAME`, `<BUNDLE>_HANDLERS`, `<BUNDLE>_TOOL_DEFINITIONS`,
plus `register<Bundle>Bundle(registry, router)`.

The engine barrel re-exports all four per bundle. Agent does **not**
re-export handler-bundle symbols (only the registry / loader / router /
context types).

### Skill tier

`skills/stageflip/tools/<bundle>/SKILL.md` exists for every bundle as a
placeholder (T-012). Flipping it to `status: substantive` is part of each
handler-bundle task. `skills/stageflip/concepts/tool-bundles/SKILL.md`
documents the catalog + I-9 + the registration pattern.

---

## 3. The handler-bundle template (copy this for T-160–T-168)

The T-155 / T-156 / T-157 / T-158 / T-159 PRs are the reference. T-156
(create-mutate) is the canonical write-tier example; T-155 / T-159 cover
read-tier. A new bundle is ~500–1200 LOC depending on tool complexity.

### Template per handler

```ts
const fooInput = z.object({ /* ... */ }).strict();
const fooOutput = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), /* ... */ }).strict(),
  z.object({
    ok: z.literal(false),
    reason: z.enum(['wrong_mode', 'not_found' /* , ... */]),
    detail: z.string().optional(), // when reasons need free-text context
  }).strict(),
]);

const foo: ToolHandler<
  z.infer<typeof fooInput>,
  z.infer<typeof fooOutput>,
  MutationContext // or DocumentContext for read-tier
> = {
  name: 'foo',
  bundle: <BUNDLE>_BUNDLE_NAME,
  description: '...',
  inputSchema: fooInput,
  outputSchema: fooOutput,
  handle: (input, ctx) => { /* ... */ },
};
```

### Template for `register.ts`

```ts
import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { <BUNDLE>_BUNDLE_NAME, <BUNDLE>_HANDLERS, <BUNDLE>_TOOL_DEFINITIONS } from './handlers.js';

export { <BUNDLE>_BUNDLE_NAME, <BUNDLE>_HANDLERS, <BUNDLE>_TOOL_DEFINITIONS };

export function register<Bundle>Bundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(<BUNDLE>_BUNDLE_NAME, <BUNDLE>_TOOL_DEFINITIONS);
  for (const handler of <BUNDLE>_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
```

The `as unknown as` cast is the variance workaround — TContext always
extends MutationContext (or DocumentContext for read-tier), so handlers
typed against the narrower context work at runtime. Don't remove the cast.

### Template for `register.test.ts`

6 standard tests (see T-155 / T-156 for exact assertions):

1. `populates the X bundle with matching tool defs`
2. `registers every handler on the router`
3. `router ↔ registry name sets agree (drift gate)`
4. `every handler declares bundle === "<bundle>"`
5. `tool count ≤ 30 (I-9)`
6. `throws when the target registry has no <bundle> bundle`

### Skill template for `tools/<bundle>/SKILL.md`

Replace the placeholder with substantive content. See T-156's
`tools/create-mutate/SKILL.md` for the canonical format:

- Frontmatter: `status: substantive`, `last_updated: <today>`, `owner_task`,
  `related: [tool-bundles, tool-router, any sibling tools]`.
- One `### toolName — { input }` section per tool.
- `## Invariants` list (bundle name, I-9 budget, read-only / write-only).

### Changeset template

One entry per bundle. See `.changeset/t156-create-mutate-handlers.md` or
`.changeset/t159-validate-handlers.md` — tight list of bullets describing
each tool + ship stats.

---

## 4. Gotchas + conventions I learned

### Schema gotchas

- **`z.discriminatedUnion` hates duplicate `ok: false` literals**. Collapse
  every failure case into one object with a `reason: z.enum([...])`. T-156
  hit this mid-implementation; do not split failure branches.
- **Zod `.default()` on input fields breaks `ToolHandler`**. The `_input`
  type becomes optional while `_output` stays required; ToolHandler's
  Zod type generic rejects the mismatch. Use `.optional()` + default
  inline in `handle()`.
- **`fast-json-patch`'s `Operation` type is narrower than engine's
  `JsonPatchOp`.** Executor casts when calling `applyPatch(doc, ops as
  Operation[])`. Handlers can push either shape since engine's is looser.
- **`documentSchema` is idempotent** (only `.default()` + `.strict()`,
  no `.transform()`). `parse(parse(x))` byte-matches `parse(x)`, so
  `validate_schema`'s round-trip check is really just a parse check
  today. Don't remove it — `.transform()` could land later.

### TypeScript variance workaround

`ToolRouter<TContext>.register(handler)` requires `handler` typed against
`TContext`. Our handlers are typed against `DocumentContext` or
`MutationContext` (narrower than Executor's `ExecutorContext`). The cast
`handler as unknown as ToolHandler<_, _, TContext>` is safe because every
caller's `TContext extends (Document|Mutation)Context` — the handler
touches only fields the wider context has.

### Id generation

`create-mutate` ships `nextSlideId(doc)` + `nextElementId(doc, prefix?)`
that scan existing ids and pick the next free integer suffix. Between
tool calls the Executor re-reads the document, so sequential
`add_*` calls in one plan step get `slide-1 / slide-2 / slide-3` etc.
Reuse these helpers (import from `handlers/create-mutate/ids.js`) when
you need generated ids in other bundles — do not reinvent.

### Fixture pattern for tests

Every handler test file uses the same pattern:

```ts
function collectingSink() { /* push/pushAll/drain */ }
function ctx(document) { return { document, patchSink: collectingSink() } }
function doc() { /* valid slide-mode Document with `as unknown as Document` */ }
```

The `as unknown as Document` cast is everywhere — typing a real Document
through Zod would make fixtures unreadable. Keep the cast; add `as never`
on element-level fields for the discriminated union.

### fast-json-patch in tests

Engine has `fast-json-patch` as a **devDependency only**. Tests do
`applyPatch(doc, patches as Operation[], false, false).newDocument` to
verify patches actually hit the document. Handlers themselves never
import fast-json-patch — they push ops to the sink, Executor applies.

---

## 5. The Phase 7 finish line

Recommended order for T-160–T-170:

1. **T-160** (clip-animation, 14) — L-sized, biggest animation/clip
   surface. Reads `ClipDefinition` + `animationSchema` from schema.
2. **T-161** (element-cm1, 12) — L-sized, text runs / style / etc per
   element type. Touches every discriminant of `elementSchema`.
3. **T-162** (slide-cm1 + a11y, 6) — M-sized, slide notes / alt text.
4. **T-163** (table-cm1, 6) — M-sized, table row/column/cell ops.
5. **T-164** (qc-export-bulk, 9) — M-sized, includes export triggers
   (may require calling `@stageflip/export-*` or stubbing them).
6. **T-165** (fact-check, 2) — M-sized, integrates a web-search tool.
7. **T-166** (domain, 27) — L-sized, largest bundle. Domain composites
   for finance / sales / OKR; probably calls `clip-animation` under the
   hood. Consider sub-splitting into 166a/b/c before starting.
8. **T-167** (data-source-bindings, 2) — M-sized, ingests CSV / Sheets.
9. **T-168** (semantic-layout, 4) — M-sized, two-column / KPI strip
   composites.
10. **T-169** (skill auto-gen) — generator scans every registered bundle
    and emits `tools/<name>/SKILL.md`; replaces the hand-authored skills.
11. **T-170** (copilot wiring) — wires the orchestrator into
    `/api/agent/execute`; replaces the 501 stub with real Planner →
    Executor → Validator. Tiny code delta; end-to-end user-visible win.

### Phase 7 exit criteria (per plan §427)

> `create_deck_from_prompt` end-to-end; 80+ tools registered; ≤30 tools
> in any agent context.

- Tools-registered goal met at the end of T-168 (103 tools total across
  14 bundles; 23 already shipped in T-155–T-159).
- `create_deck_from_prompt` wired in T-170.
- I-9 (≤30 tools loaded) is enforced by `BundleLoader`; the Planner is
  prompt-guided to stay within budget. No additional work needed.

---

## 6. Test + gate surface (2026-04-24)

### Per-package test counts

| Package | Cases |
|---|---|
| `@stageflip/llm-abstraction` | 45 |
| `@stageflip/agent` | 67 |
| `@stageflip/engine` | **135** |

Engine breakdown:
- bundles (registry + loader + types): 20
- router: 16
- handlers/read: 22
- handlers/create-mutate: 24
- handlers/timing: 19
- handlers/layout: 18
- handlers/validate: 16

### CI gates — all green on `main`

```
pnpm typecheck                   — 70 tasks
pnpm lint                        — 50 tasks
pnpm test                        — 69 tasks, 2218 → ~2400 cases
pnpm check-licenses              — 495 deps
pnpm check-remotion-imports      — ~585 files, 0 matches
pnpm check-determinism           — 57 files
pnpm check-skill-drift           — link + tier coverage
pnpm skills-sync:check           — reference/validation-rules in sync
pnpm size-limit                  — frame-runtime 19.52 kB, bundle 367.33 kB
```

---

## 7. How to resume

### Starter prompt for the next session

> I'm continuing StageFlip Phase 7 from a fresh context. Read
> `docs/handover-phase7-mid.md` top to bottom. Then `CLAUDE.md`. Then
> `docs/implementation-plan.md` (v1.13). T-156/157/158/159 are the
> reference PRs for the handler-bundle pattern. Pick up with T-160
> (clip-animation, 14 tools).

Expected confirmation: *"Phase 7 in-flight — triad shipped, 5 of 14
handler bundles populated, 9 remaining (T-160–T-168) + T-169 skill
auto-gen + T-170 copilot wiring. Next task: T-160."*

### Before starting T-160

- Read `packages/schema/src/animations.ts` for `animationSchema`.
- Read `packages/runtimes-contract/src/*` for `ClipDefinition`.
- Read `packages/schema/src/elements/clip.ts` — the `clip` element type
  the animation handlers will reference.
- Skim T-156 (`packages/engine/src/handlers/create-mutate/`) for the
  write-tier pattern.

### Orchestrator checklist at Phase 7 exit

Before stamping "Phase 7 ratified":

- [ ] `pnpm install --frozen-lockfile` clean.
- [ ] All 9 gates green on `main`.
- [ ] 14 handler bundles registered (T-155 + T-156–T-168).
- [ ] Tool-router-registry drift-gate tests green for all 14 bundles.
- [ ] T-170's `/api/agent/execute` route exercises Planner → Executor →
      Validator end-to-end against a real model (integration test).
- [ ] `docs/implementation-plan.md` Phase 7 row gets the ✅ Ratified banner.
- [ ] A new `docs/handover-phase7-complete.md` supersedes this one.

---

*End of mid-phase handover. Next agent: start at §7.1. Phase 7 finish
line is T-160–T-170; the pattern is stamped on 5 bundles already.*
