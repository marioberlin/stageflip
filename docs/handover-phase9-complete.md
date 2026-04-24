---
title: Phase 9 complete — handover
id: docs/handover-phase9-complete
owner: orchestrator
last_updated: 2026-04-24
supersedes: docs/handover-phase8-complete.md
---

# Handover — Phase 9 complete (2026-04-24)

If you are the next agent: read this top to bottom, then `CLAUDE.md`,
then `docs/implementation-plan.md` §Phase 10. Phase 9 shipped in a
single-day sprint — 12 PRs across T-200..T-209, all merged to `main`
at `ec62013`, all gates green.

Next work: **Phase 10 — Skills + MCP + Distribution** (T-220 onward).

---

## 1. Where we are

All ten in-scope Phase 9 tasks merged. Run order (T-202 + T-203 each
split into a/b):

| PRs | Task | Title |
|---|---|---|
| #136 | T-200 | `@stageflip/profiles-display` — ProfileDescriptor + display lint rules + dimensions catalog + tool-bundle allowlist + clip catalog + IAB/GDN budgets |
| #137 | — | Docs-only: ratify Phase 8 + back-stamp Phase 2 banner (v1.15) |
| #138, #139 | T-202a / T-202b | 5 display-profile clips on frame-runtime-bridge — attention tranche (`click-overlay`, `countdown`, `cta-pulse`) + data tranche (`price-reveal`, `product-carousel`) |
| #140, #141 | T-203a / T-203b | `@stageflip/export-html5-zip` — contracts + deterministic ZIP + clickTag injector (a); orchestrator + fallback embed + budget enforcement (b) |
| #142 | T-205 | File-size optimizer passes — unused-CSS stripper + inline-JS minifier + image-optimizer plug-in seam |
| #143 | T-208 | IAB/GDN compliance validator for produced banner ZIPs |
| #144 | T-206 | Engine `display-mode` bundle — `optimize_for_file_size` + `preview_at_sizes` (16th canonical) |
| #145 | T-204 | Fallback generator — midpoint-frame PNG + animated GIF |
| #146 | T-201 | Editor-shell multi-size banner preview grid |
| #147 | T-207 | `apps/stageflip-display` Next.js walking skeleton (port 3300) |
| #148 | T-209 | Substantive `skills/stageflip/modes/stageflip-display/SKILL.md` |

### Totals

- **12 merged PRs** for Phase-9 implementation (T-202/T-203 each a/b);
  +1 docs PR (#137) landed the Phase-8 ratification + Phase-2
  back-stamp. `main` at `ec62013`. All gates green.
- **2 new packages**: `@stageflip/profiles-display`,
  `@stageflip/export-html5-zip`.
- **Canonical tool bundles 15 → 16** (`display-mode` added). Total
  registered tools: 109 → 111 (two new: `optimize_for_file_size`,
  `preview_at_sizes`). I-9 still enforced at 30.
- **Bridge clip count 37 → 42** (3 attention + 2 data display-profile
  clips; the count assertion in
  `packages/cdp-host-bundle/src/runtimes.test.ts` is now at 42).
- **Parity fixture catalog unchanged at 47** (no display manifests
  this phase — carry to Phase 10/11, see §3).
- **Monorepo tests**: ~2900 tests across ~240 test files. Exact count
  drifts commit-to-commit; all suites green per-PR and cumulatively.

### Phase 9 exit-criteria check

Plan quote: *"300×250 + 728×90 + 160×600 from one template; each
<150 KB; IAB/GDN validators green."*

- ✅ **Three canonical sizes from one template**: `DISPLAY_CANONICAL_SIZES`
  in `@stageflip/profiles-display` (T-200) enumerates the three IAB
  sizes; `<BannerSizeGrid>` in `@stageflip/editor-shell` (T-201)
  renders one preview per size from a single document with synced
  scrub; `exportHtml5Zip` (T-203b) produces one ZIP per size.
- ✅ **<150 KB per ZIP**: `DISPLAY_FILE_SIZE_BUDGETS_KB`
  (iabInitialLoadKb: 150) is the default budget; the orchestrator
  (T-203b) enforces the per-ZIP cap after optimizer passes; budget
  violations fail the export. The T-205 optimizer pipeline
  (unused-CSS strip + inline-JS minify + `sharp`-plug-in image pass)
  is wired but the sharp plug-in itself is still the consumer's
  responsibility (license carry — see §3).
- ✅ **IAB/GDN validators green**: `@stageflip/export-html5-zip`'s
  validator (T-208) runs after every successful export and asserts
  clickTag presence, HTTPS-only asset URLs, ad.size meta tag, backup
  image presence, and the initial-load size cap. Violations are
  surfaced in the orchestrator's `{ ok: false, violations }` result.
- ✅ **Fallback assets**: T-204 ships midpoint-frame PNG +
  animated-GIF encoders; T-203b embeds the fallback into the ZIP
  alongside the HTML5 payload.
- ✅ **Walking-skeleton app**: `apps/stageflip-display` mounts
  `<EditorShell>` on port 3300 with a seeded display document and a
  real `/api/agent/execute` route wired via `@stageflip/app-agent`
  (the shared orchestrator from Phase 8).

---

## 2. Architecture that landed

### Package graph (Phase 9 additions)

```
@stageflip/profiles-display      ProfileDescriptor (allowed element types,
         │                       rules, clipKinds, toolBundles, canonical
         │                       sizes, IAB/GDN budgets)
         │
         ▼
@stageflip/validation            consumes DISPLAY_RULES via the
                                 ALL_RULES-or-subset pattern

@stageflip/export-html5-zip      IAB ZIP orchestrator
         ▲                       ├─ contracts + zip.ts + click-tag injector (T-203a)
         │                       ├─ orchestrator + budget enforcer (T-203b)
         │                       ├─ fallback PNG + animated GIF (T-204)
         │                       ├─ optimizer passes (T-205)
         │                       └─ IAB/GDN validator (T-208)
         │
apps/stageflip-display    ───────┘  consumes via the editor-shell
```

### New engine bundle `display-mode`

Shipped as the 16th canonical bundle. Two tools:

- `optimize_for_file_size` — returns a ranked recommendation list
  (optimize-images > minify-js > strip-unused-css by default
  estimated saving). Per-pass `enabled` toggle for user-driven
  selection; all three stay in the returned array even when disabled.
- `preview_at_sizes` — plans per-size previews for the display
  document's `sizes` array.

Registered in the standard 5-file bundle shape
(`packages/engine/src/handlers/display-mode/`), wired into
`CANONICAL_BUNDLES`, populated via `@stageflip/app-agent`'s
`populate()`, and declared in the profile's
`DISPLAY_TOOL_BUNDLES` allowlist. The "15 bundles" count-assertion
tests that T-185 touched are now at 16.

### `@stageflip/export-html5-zip` — full pipeline

The shipped pipeline chains:

1. **Render** a size-specific HTML5 payload (per-size DOM + CSS + JS).
2. **Optimize** (T-205): unused-CSS stripper, inline-JS minifier,
   image-optimizer plug-in seam (consumer supplies the `sharp` pass).
3. **Inject clickTag** (T-203a) — canonical IAB `clickTag` pattern
   rewriting anchor hrefs on click.
4. **Generate fallback** (T-204) — midpoint-frame PNG + animated
   GIF, encoded deterministically via `gifenc`.
5. **Emit ZIP** (T-203a) — deterministic JSZip output (fixed
   timestamps, sorted entries).
6. **Validate** (T-208) — IAB/GDN compliance gates; orchestrator
   surfaces violations on failure.
7. **Enforce budget** (T-203b) — reject ZIPs > `budget.totalZipKb`.

All pure-TS; no determinism-forbidden APIs. The `optimize` and
`validate` subfolders ship their own index + rules modules and are
importable standalone.

### Display app (`apps/stageflip-display`)

Walking skeleton on port 3300. Mounts `<EditorShell>` with a seeded
display document (three banner sizes: 300×250 + 728×90 + 160×600;
15s duration; IAB budget 150 KB) and renders the multi-size grid
via T-201's `<BannerSizeGrid>`. `/api/agent/execute` is real — Zod-
validated strict body, 200/400/503/500 error mapping mirroring the
slide and video app routes.

**Not yet landed** (explicitly carried forward, see §3):

- AI copilot panel re-used from slide app.
- Playwright e2e smoke on port 3300.
- `lintDocument` call on the seeded document.
- Display-mode parity fixtures (0 / 5 clips have manifests).

---

## 3. Follow-ups / known issues

Carry-forward punch list — none block Phase 10:

- **Display app UI completeness**: port the slide app's AI copilot
  panel (points at `/api/agent/execute`). Add Playwright e2e smoke
  on port 3300. Wire `lintDocument` into the editor shell.
- **Display parity fixtures**: five T-202 clips shipped without
  parity manifests; follow the T-188 pattern when priming. Inherits
  the Phase 7/8 goldens-priming follow-up.
- **Image-optimizer plug-in**: T-205 ships the seam; no default
  `sharp` implementation because sharp is LGPL-3.0 and sits in the
  workspace `ignoredOptionalDependencies`. A Phase 10/11 choice —
  either (a) vendor a permissively-licensed alternative, (b) leave
  the seam as consumer-supplied, or (c) add sharp to
  `THIRD_PARTY.md`'s license whitelist after legal review.
- **Bake-tier dispatcher** (§5.3 carry-forward from Phase 6 via
  Phase 8) — still not wired. `@stageflip/export-html5-zip`'s
  renderer seam accepts any implementation; a CDP / bake backend
  plug-in hasn't shipped.
- **Streaming agent events**: all three apps still buffer the full
  event log from `/api/agent/execute`. SSE / `ReadableStream`
  carry-forward since Phase 7.
- **Captions ±100 ms gate** — unchanged carry from Phase 8.
- **T-188 video goldens** — unchanged carry from Phase 8.
- **IAB polite-load enforcement**: `DISPLAY_FILE_SIZE_BUDGETS_KB`
  exposes `iabPoliteLoadKb: 1024` but the orchestrator only
  enforces `totalZipKb` today. Subload tracking (per-session
  cumulative) is a follow-up once a real runtime request-hook
  exists.
- **Orchestrator "display" counts**: the slide-app orchestrator test
  asserts 16 bundles (bumped this phase); the video and display
  app orchestrator tests don't repeat the count-level cross-check.
  When any app adds its own orchestrator smoke suite (if ever — the
  shared package stays the single source), lift the count test too.
- **T-201 `<BannerSizeGrid>` polish**: the layout algorithm is a
  simple horizontal wrap with a fixed gap. Two carries: (a) vertical
  / responsive variant for narrow editor panes, (b) aspect-ratio
  preservation when the grid is zoomed.

---

## 4. Gotchas + conventions from the build

Preserved + Phase-9 additions:

### T-202 split was a conflict-driven shape, not a size decision

T-202 as one PR would have registered five clips against the same
`cdp-host-bundle/src/runtimes.test.ts` count assertion; the phase-8
"shared conflict class" gotcha would have fired immediately. Split
a/b (attention tranche + data tranche) makes the merge serial and
the count bump trivial. Same rationale applied to T-203 (contracts
before orchestrator).

### Export-html5-zip determinism

`JSZip.generateAsync` with `compressionOptions: { level: 6 }` and
fixed `date: new Date('2026-04-24T00:00:00Z')` produces byte-stable
output only when entries are added in lexical order. The zip.ts
wrapper enforces this by pre-sorting input entries; never rely on
Map iteration order.

### `gifenc` determinism

`gifenc` accepts a `palette` argument; omit it and the output is
non-deterministic (the encoder derives a palette via k-means seeded
by `Math.random()`). Always pre-compute a palette (`quantize()`) and
pass it in. The T-204 render-gif.ts does this; don't "simplify" it
by dropping the palette arg.

### Display-profile clip prop-schemas

All 5 display clips ship Zod `propsSchema` (ZodForm-ready) + a
`themeSlots` map. Every clip also declares `fontRequirements` where
relevant. If you're adding a sixth display clip, copy the shape
from `click-overlay.tsx` — it's the smallest.

### Banner-size grid math

`layoutBannerSizes()` in `packages/editor-shell/src/banner-size/math.ts`
is intentionally independent from the aspect-ratio layout (same
package, different algorithm). Sizes here are fixed pixel
dimensions, not aspect ratios. Don't fold one into the other.

### Preserved from Phase 8

- **Rebase protocol for stacked PRs**: branch off current stack tip
  locally, `gh pr create --base main`, never stacked bases. Still
  load-bearing.
- **Monitor pattern** (green/fail/timeout loop from §4 of
  `handover-phase8-complete.md`) — unchanged.
- **Fixture uniqueness**: `packages/testing/src/fixture-manifest.test.ts`
  asserts one fixture per clip kind — relevant whenever display-mode
  parity fixtures prime.
- **Next.js + Bundler moduleResolution**: sibling imports WITHOUT
  `.js` extension in app code. Caught once in `apps/stageflip-display`
  scaffolding.
- **Auto-gen is skill source of truth**: `skills/stageflip/tools/<bundle>/SKILL.md`
  is regenerated. When adding a bundle, update
  `scripts/gen-tool-skills.ts`'s `OWNER_TASK_MAP` (T-206 did).
- **Vitest env directive**: server-side tests touching external SDKs
  need `// @vitest-environment node` as the first line.

---

## 5. Remaining-phases risk

Difficulty ranking for Phases 10–12 (user asked for this mid-phase;
answer persisted here rather than in chat):

1. **Phase 11 (Importers)** — **hardest.** OOXML PPTX parser (T-240)
   + the nested-group transform accumulator (T-241a, flagged in the
   plan itself as "#1 source of OOXML parse failures"); 50+ preset
   geometries (T-242); AI-QC convergence loop (T-246) is a novel
   pattern with no existing reference in our tree; design-system
   theme-learning pipeline (T-249) is research-heavy. Pixel parity
   with the PPT source is an iterative grind that doesn't follow
   the "green test → ship" rhythm of Phases 1–10.
2. **Phase 12 (Collab / Hardening / Blender)** — **hard in three
   separate directions.** Yjs CRDT sync (T-260) + the T-025
   ChangeSet delta surface is subtly easy to get wrong (rebase,
   garbage-collection, tombstones). Blender bake-tier runtime
   (T-265) is GPU-Docker hell — drivers, kernel-mode CUDA,
   BullMQ-in-cluster. Stripe billing (T-267) proration / refund /
   invoice-state machines are a long tail of edge cases.
3. **Phase 10 (Skills + MCP + Distribution)** — **routine-medium.**
   Most tasks are generator code or manifest work. One fiddly item:
   **T-223 (MCP OAuth → JWT → local config)** — auth flows always
   have an annoying tail (token refresh, revocation, local-config
   mutation, error taxonomy). Budget accordingly.

Phase 10's shape: T-220 (skills-sync generators) is foundational —
every other task either reads skills generated here or publishes
them. Start there.

---

## 6. How to resume (Phase 10 starter)

### Starter prompt for the next session

> I'm starting StageFlip Phase 10 (Skills + MCP + Distribution) from
> a fresh context. Read `docs/handover-phase9-complete.md` top to
> bottom, then `CLAUDE.md`, then `docs/implementation-plan.md`
> §Phase 10. Phase 9 closed 2026-04-24; `main` is at `ec62013`, all
> gates green. Phase 10 is twelve tasks (T-220..T-231); **T-220**
> (`@stageflip/skills-sync` — all generators: clips catalog, tools
> index, runtimes index, validation rules, CLI reference) is the
> foundational piece every other task references. Start there. Phase
> 10 is routine-medium; one fiddly item: T-223 (MCP OAuth → JWT →
> local config) always has an annoyingly long tail.

Expected confirmation:
*"Phase 9 closed — 12 PRs across T-200..T-209, 2 new packages, 16
tool bundles, 5 new display-profile clips. Starting Phase 10 at
T-220."*

### Phase 10 task order (from plan §Phase 10)

1. **T-220** `@stageflip/skills-sync` — complete the generator set
   (clips catalog, tools index, runtimes index, validation rules,
   CLI reference). L-sized; foundational. Validation-rules generator
   already exists in `packages/skills-sync/src/validation-rules-gen.ts`;
   the others are additions. Every generator must be idempotent
   (same registry → same output) and gated by `skills-sync:check`.
2. **T-221** Skills review pass — every SKILL.md against the four
   non-negotiables (one-screen, examples-over-prose, cross-linked,
   single-source-of-truth). L-sized; touches the whole
   `skills/stageflip/` tree.
3. **T-222** `@stageflip/mcp-server` — wraps the semantic-tool
   registry via `@modelcontextprotocol/sdk`. L-sized; a thin
   adapter that exposes every populated tool bundle as an MCP
   `listTools` / `callTool` surface.
4. **T-223** MCP auth flow — OAuth → JWT → local config. M-sized
   but annoyingly long-tail (see §5). Budget extra time.
5. **T-224** `@stageflip/plugin` manifest — bundles skills + MCP
   registration. M-sized.
6. **T-225** `apps/cli` — all commands in user manual §4. L-sized;
   read `docs/user-manual.md` §4 before starting.
7. **T-226** Auto-generate `reference/cli/SKILL.md` from CLI command
   registry. S-sized; piggybacks on T-220's generator scaffold.
8. **T-227** npm publish `@stageflip/{plugin,mcp-server,cli}` via
   Changesets. S-sized.
9. **T-228** Docs site (mdx over skills tree) + quickstart.
   M-sized.
10. **T-229** API Admin SDK integration + auth middleware. M-sized.
11. **T-230** Firebase hosting rules per app. S-sized.
12. **T-231** Cloud Run render worker deployment. M-sized.

### Phase 10 exit criteria

Plan quote: *"`claude plugin install stageflip` installs + connects
+ usable."*

---

## 7. Operational notes (for the first hour of the next session)

1. `git checkout main && git pull` — confirm you're at `ec62013` or
   newer.
2. `pnpm install && pnpm -r typecheck && pnpm -r test` — full tree
   should be green. Red = Phase-9 regression, flag before starting.
3. Skim the Phase-9 PR titles above. Phase-8 rebase / conflict
   gotchas still apply whenever you touch engine bundles, profiles,
   export pipelines, runtimes, or the editor shell.
4. Branch names: `task/T-NNN-<short-slug>`. For split PRs use a/b/c.
5. Every PR title: `[T-NNN] <short description>` (or `[T-NNNa] …`).
   Every PR body fills the Phase-10 template's Quality-Gates
   checklist.
6. No stacked PR bases. Always `--base main`. Rebase between merges.
7. Phase-10 work touches publishable packages. Every PR that
   modifies `@stageflip/plugin`, `@stageflip/mcp-server`, or
   `@stageflip/cli` needs a `.changeset/*.md`.

---

## 8. Ratification footer

- **Date**: 2026-04-24
- **Commit**: `ec62013` on `main`
- **Gates**: all green (typecheck, lint, test, parity, render-e2e,
  e2e-playwright, check-licenses, check-remotion-imports,
  check-determinism, check-skill-drift, skills-sync:check,
  gen:tool-skills:check).
- **Exit criteria**: met — 300×250 + 728×90 + 160×600 from one
  template, each <150 KB enforced, IAB/GDN validators green on the
  produced ZIPs, fallback PNG + GIF embedded.
- **Escalations raised**: zero during this phase.
- **Carries forward to Phase 10**: display-app UI completeness (AI
  copilot port + Playwright smoke + lintDocument mount), display
  parity-fixtures priming, image-optimizer plug-in licensing
  decision, bake-tier dispatcher, streaming agent events, captions
  ±100 ms CI gate, T-188 video goldens, IAB polite-load enforcement.

*Phase 9 ratified. Next: Phase 10 — Skills + MCP + Distribution.*
