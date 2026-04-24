---
title: StageFlip.Display Mode
id: skills/stageflip/modes/stageflip-display
tier: mode
status: substantive
last_updated: 2026-04-24
owner_task: T-209
related:
  - skills/stageflip/profiles/display/SKILL.md
  - skills/stageflip/concepts/display-budget/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
  - skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md
  - skills/stageflip/tools/display-mode/SKILL.md
  - skills/stageflip/workflows/parity-testing/SKILL.md
---

# StageFlip.Display Mode

StageFlip's IAB/GDN-compliant HTML5 banner editor. A Next.js 15 app that
mounts `@stageflip/editor-shell` on a `DisplayContent` document, renders
one composition across multiple fixed-dimension banner sizes
(300×250 / 728×90 / 160×600 at Phase 9 exit), and produces deterministic
ZIPs the ad networks accept at serve time.

The mode exists so programmatic-display creative (retargeting, product
feeds, sale banners) has a first-class workflow that publishes to IAB
specs without forking the engine. Banner grid, fallback pipeline,
optimizer, export ZIP, and compliance validator are display-specific;
schema, RIR, frame runtime, clip runtimes, renderer-core, parity
harness, and the Planner/Executor/Validator agent triad are all shared
with Slide and Video.

## Package map

| Package / app | Purpose |
|---|---|
| `apps/stageflip-display` | The Next.js 15 editor (port 3300). Walking-skeleton entrypoint at `src/app/page.tsx`; the seeded multi-size grid view lives under `src/app/editor-app-client.tsx`. The agent route is `src/app/api/agent/execute/`, wired to the shared `@stageflip/app-agent` orchestrator. |
| `@stageflip/profiles-display` | Profile descriptor: `DISPLAY_ALLOWED_ELEMENT_TYPES`, `DISPLAY_CANONICAL_SIZES`, `DISPLAY_FILE_SIZE_BUDGETS_KB`, `DISPLAY_CLIP_KINDS`, `DISPLAY_TOOL_BUNDLES`, five RIR-level lint rules, and the `displayProfile` aggregate. See `profiles/display/SKILL.md`. |
| `@stageflip/editor-shell` | Mode-agnostic primitives + the T-201 multi-size banner grid (`<BannerSizeGrid>`, `<BannerSizePreview>`, `layoutBannerSizes`). |
| `@stageflip/schema` | Canonical `Document` shape. Display mode operates on `document.content.mode === 'display'`; `content.sizes[]`, `content.budget`, `content.clickTag`, and `content.fallback` carry the IAB-specific surface. |
| `@stageflip/export-html5-zip` | T-203 / T-204 / T-205 / T-208 — the full banner pipeline: deterministic ZIP packer + clickTag injector (T-203a), orchestrator with fallback embed + budget enforcement (T-203b), fallback generator PNG + GIF (T-204), pre-pack optimisation passes (T-205), and IAB/GDN compliance validator (T-208). |
| `@stageflip/app-agent` | Shared Planner/Executor/Validator wiring + `runAgent` entry point. Slide, video, and display apps load the same 16-bundle registry through it. |
| `@stageflip/engine` | Agent tool bundles. Display-specific bundle `display-mode` (16th canonical, T-206) ships `optimize_for_file_size` + `preview_at_sizes`; the other eligible bundles follow `DISPLAY_TOOL_BUNDLES` in the display profile. |
| `@stageflip/runtimes-frame-runtime-bridge` | Houses the five T-202 display-profile clips: `click-overlay`, `countdown`, `cta-pulse`, `price-reveal`, `product-carousel`. |

## Document contract

Display documents carry `content: { mode: 'display', sizes, durationMs, clickTag?, fallback?, budget, elements }`. The core fields:

```ts
interface DisplayContent {
  mode: 'display';
  sizes: BannerSize[];          // at least 1
  durationMs: number;           // positive int, ≤30_000 per GDN
  clickTag?: string;            // IAB exit-URL macro; injected at export
  fallback?: BannerFallback;    // { png: AssetRef, gif?: AssetRef }
  budget: DisplayBudget;        // totalZipKb, externalFontsAllowed, etc.
  elements: Element[];          // the shared 11-variant union
}

interface BannerSize {
  id: string;
  width: number;                // positive int
  height: number;               // positive int
  name?: string;                // "Medium Rectangle" etc.
}

interface DisplayBudget {
  totalZipKb: number;           // hard cap; IAB baseline 150 KB
  externalFontsAllowed: boolean;
  externalFontsKbCap: number;
  assetsInlined: boolean;
}
```

`Element` is the same discriminated union slide + video use, but the
`display-element-types-allowed` rule (T-200) restricts it to
`text / image / shape / group / clip`. See `profiles/display/SKILL.md`
for the full exclusion rationale.

## UI layout

Today's app ships the walking skeleton (T-207) with the multi-size grid
already mounted. Layout, top-to-bottom:

```
 ┌────────────────────────────────────────────────────────────────────┐
 │ Header: title • mode: display                                      │
 ├────────────────────────────────────────────────────────────────────┤
 │ Budget: 3 sizes · 15s · budget 150 KB · assets inlined             │
 ├────────────────────────────────────────────────────────────────────┤
 │   ┌──────300×250──────┐  ┌─728×90─────────────────┐  ┌160×600┐     │
 │   │    MPU            │  │   Leaderboard          │  │       │     │
 │   │    scale N%       │  │   scale N%             │  │ Sky   │     │
 │   └───────────────────┘  └────────────────────────┘  └───────┘     │
 └────────────────────────────────────────────────────────────────────┘
```

`<BannerSizeGrid>` (T-201) threads a shared `currentFrame` into every
cell so a single scrubber drives all three sizes in lockstep. Cells
use a **uniform scale factor** so inter-cell proportions stay honest —
a 300×250 is visibly half the height of a 160×600 no matter how
cramped the container is.

Follow-up work (not yet landed):

- Timeline panel + scrubber wired to feed `currentFrame`.
- AI copilot panel reusing `execute-agent.ts` against
  `/api/agent/execute`.
- Live budget-estimator badge (yellow / red) that consults
  `@stageflip/export-html5-zip`'s optimizer dry-run.
- Real clip-level preview (today each cell shows a placeholder).

## Display-profile clips (T-202)

Five clips registered on `@stageflip/runtimes-frame-runtime-bridge` and
named in `DISPLAY_CLIP_KINDS`:

| Kind | Purpose |
|---|---|
| `click-overlay` | Invisible full-canvas `<a>` routed through the IAB `clickTag` macro. No visible rendering — makes the whole banner a hit target; requires `ariaLabel`. |
| `countdown` | Frame-indexed deadline timer counting down from `startFromSeconds`; `mm:ss` / `hh:mm:ss` / `dd hh:mm:ss` formats. Tabular-nums monospace digits. |
| `cta-pulse` | Call-to-action button pulsing on a deterministic `(1 - cos)/2` envelope. Schema-capped `pulseHz ≤ 4`, `peakScale ∈ [1, 1.5]`. |
| `price-reveal` | "Was X / Now Y" animation. Old price holds then fades to 35%; new price slides up with a scale pop at the midpoint. |
| `product-carousel` | Rotates 2–5 items with a `(hold + crossfade)` loop per item. Opacities always sum to 1 (two-layer crossfade). |

Every clip is deterministic — every numeric is derived from
`useCurrentFrame` + `useVideoConfig`. Theme-slotted on palette roles so
a theme swap re-flows colours. 79 tests across the five (T-202a: 47,
T-202b: 32), 100% line + branch + function coverage.

## Export pipeline (T-203 → T-205 → T-208)

Three-stage, plug-in throughout:

**1. Bundle** — an `HtmlBundler` (not shipped in `export-html5-zip`
itself; each caller provides theirs) turns one `BannerSize` into
`{ html, assets[] }`.

**2. Optimise (T-205)** — `optimizeHtmlBundle(bundle, opts)` runs three
passes before the ZIP packer:
- **strip-unused-css** — drops selectors whose tag/class/id atoms
  aren't referenced in the HTML. Conservative on attribute selectors,
  `:has()`, `:is()` — keeps the rule when unsure.
- **minify-js** — terser on inline `<script>` only; `src=` scripts and
  non-JS types skipped; terser parse-errors keep the original.
- **imageOptimizer** — pluggable contract (`sharp` is LGPL-3.0 and
  **not** pulled in; ADR it separately and register your own adapter).

**3. Export (T-203b)** — `exportHtml5Zip(input, { bundler,
assetResolver, fallbackProvider? })` runs per size: bundle → clickTag
inject → fallback embed → deterministic ZIP → budget check. Returns a
`MultiSizeExportResult` with per-size `zipBytes` + `findings` + a
global `ok` flag that flips `false` on any `error`-severity finding.

**4. Validate (T-208)** — `validateBannerZip(zipBytes, { label? })` is
a second, independent gate. Runs 8 rules against the produced ZIP:
`banner-file-size-within-iab-cap`, `banner-has-index-html`,
`banner-has-fallback-png`, `banner-declares-click-tag`,
`banner-no-external-resources`, `banner-no-dynamic-code` (eval /
Function constructor / document write-call APIs),
`banner-no-xhr-or-fetch`, `banner-no-path-traversal`. A shippable
banner must pass both the orchestrator's budget check AND every
validator rule.

### Fallback generator (T-204)

`createFallbackGenerator({ frameRenderer, resolver, durationMs })`
produces the IAB-mandatory backup image + optional animated GIF from
the midpoint frame:

- **PNG** — `encodePng` via pngjs (MIT) sync writer. Deterministic.
- **GIF** — `encodeGif` via gifenc (MIT). 8 frames evenly spaced
  across `[0.125, 0.875]` of the composition by default; palette
  quantised to 128 colours. Skip GIF via `gifFrameCount: 0`.

A `FrameRenderer` contract (pluggable) does the actual RGBA
production. T-204 ships a mock `createSolidColorFrameRenderer()` for
tests; a renderer-cdp adapter is a follow-up (the orchestrator
contract is complete; plugging in real rendering is a separate concern).

## Deterministic ZIP

Every produced ZIP is byte-identical across runs given identical
inputs:

- Sorted paths (lexicographic).
- Fixed mtime at `2000-01-01T00:00:00Z` via
  `DETERMINISTIC_ZIP_MTIME`.
- fflate (MIT) `zipSync` encoder — deterministic deflate for identical
  input bytes.
- Duplicate-path + path-injection (`..`, backslashes, leading `/`)
  rejection at pack time.

This is a prerequisite for byte-level parity, content-hash caches,
and the T-208 validator's deterministic rule outputs.

## Agent tools

Display mode loads a subset of the 16 canonical bundles — see
`DISPLAY_TOOL_BUNDLES` in `@stageflip/profiles-display` (12 bundles
today): `read`, `create-mutate`, `timing`, `layout`, `validate`,
`clip-animation`, `element-cm1`, `qc-export-bulk`, `semantic-layout`,
`data-source-bindings`, `fact-check`, `display-mode`. Excluded:
`slide-cm1`, `table-cm1`, `domain-finance-sales-okr` (slide-oriented);
`video-mode` (aspect-bouncer is video-specific).

The `display-mode` bundle (T-206, 16th canonical) ships:

- **`optimize_for_file_size`** — plan which pre-pack passes (strip
  CSS / minify JS / optimize images) to enable for a target ZIP size.
  Defaults `targetKb` to `DisplayContent.budget.totalZipKb`, then the
  IAB 150 KB baseline. Returns recommendations sorted by estimated
  saving.
- **`preview_at_sizes`** — resolve per-size preview specs; falls back
  to `DisplayContent.sizes` when `input.sizes` is absent. Returns
  `{ sizeId, width, height, durationMs }` per size.

## Determinism scope

Display-app shell code (editor-app-client, route handler) is outside
the determinism-restricted scope — UI code may use `Date.now`, timers,
`crypto.randomUUID`. **Clip code rendered inside the banner MUST
remain deterministic**; every T-202 clip body is scanned by
`pnpm check-determinism`.

Export + validator code lives outside the runtime/clip scope too —
they run at authoring / export time — but they adhere to a stronger
property: **output reproducibility**. Two runs with the same input
produce byte-identical ZIPs, which CI asserts.

## Parity

Display-mode parity fixtures follow the T-188 pattern — one manifest
per `DISPLAY_CLIP_KINDS` entry under
`packages/testing/fixtures/frame-runtime-<kind>.json`. Manifests for
the T-202 clips are scheduled alongside the render-e2e gate's
goldens-priming pass; this is a non-blocking tooling follow-up shared
with the Phase 7/8 parity carry.

Thresholds default to `minPsnr: 32, minSsim: 0.95, maxFailingFrames: 0`
(standard frame-runtime-bridge tier). Goldens are produced at CDP-
harness time, not committed with the manifests.

## Quality gates

Every display-app or display-profile PR must pass:

- `pnpm typecheck` — TS strict with `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes`.
- `pnpm lint` — Biome.
- `pnpm test` — Vitest; ≥85% coverage on changed code.
- `pnpm check-licenses` — whitelist only (sharp is LGPL-3.0 and
  explicitly not pulled in; the optimizer's image pass is a plug-in
  contract instead).
- `pnpm check-remotion-imports` — zero matches anywhere in the
  display tree.
- `pnpm check-determinism` — clip determinism; still runs for every
  PR.
- `pnpm check-skill-drift` — skills ↔ source.
- `pnpm skills-sync:check` + `pnpm gen:tool-skills:check` —
  registry-driven skill files in sync.
- `pnpm parity` — PSNR + SSIM if rendering touched.

Plus: PR template checklist complete, changeset included if a
publishable package is touched.

## Acceptance (Phase 9 exit criterion)

*"300×250 + 728×90 + 160×600 from one template; each <150 KB; IAB/GDN
validators green."*

The ingredients:

- **One template**: `DisplayContent` with `sizes: DISPLAY_CANONICAL_SIZES`
  (T-200); `<BannerSizeGrid>` previews all three from a single
  composition (T-201).
- **<150 KB per banner**: `DisplayBudget.totalZipKb = 150` (the IAB
  baseline from `DISPLAY_FILE_SIZE_BUDGETS_KB`); enforced by
  `exportHtml5Zip` (T-203b) as an `error` finding + by the
  `banner-file-size-within-iab-cap` rule (T-208); optimised via
  `optimizeHtmlBundle` (T-205).
- **IAB/GDN validators green**: `validateBannerZip` (T-208) runs 8
  error-severity rules — no external resources, no dynamic-code APIs,
  no runtime network I/O, no path traversal, mandatory index.html +
  fallback.png + clickTag.

The full pipeline:

1. Operator edits a `DisplayContent` document in the display app.
2. Agent plans + executes content mutations; Validator reviews.
3. Host calls `exportHtml5Zip` with its `HtmlBundler` (the piece each
   operator owns) + `AssetResolver` + an optional `FallbackProvider`
   from T-204.
4. Orchestrator drives per-size: optimise → inject clickTag →
   embed fallback → pack deterministic ZIP → budget-check.
5. Each ZIP runs through `validateBannerZip`; CI hard-fails on any
   error finding.

## Where things go

| Adding… | Goes in |
|---|---|
| New display clip | `packages/runtimes/frame-runtime-bridge/src/clips/<kind>.tsx` + register in `ALL_BRIDGE_CLIPS` + add to `DISPLAY_CLIP_KINDS` in `@stageflip/profiles-display` + fixture under `packages/testing/fixtures/frame-runtime-<kind>.json` + bump the cdp-host-bundle runtime test count + expected-kinds list. |
| New canonical banner size | Extend `DISPLAY_CANONICAL_SIZES` in `@stageflip/profiles-display`. The grid + preview tools (`preview_at_sizes`) pick it up automatically. Document the IAB label + typical placement in `profiles/display/SKILL.md`. |
| New validator rule | Add to `packages/export-html5-zip/src/validate/rules.ts`, append to `ALL_VALIDATION_RULES`, test each pass / fail path. Rule ids must start with `banner-`. |
| New optimizer pass | Extend `optimizeHtmlBundle` in `packages/export-html5-zip/src/optimize/index.ts`. Add the pass name to `OptimizePassName` + `PASS_ESTIMATED_KB` in the `display-mode` bundle's `optimize_for_file_size` tool so the planner can recommend it. |
| New `display-mode` tool | Append to `DISPLAY_MODE_TOOL_DEFINITIONS` + `DISPLAY_MODE_HANDLERS` in `packages/engine/src/handlers/display-mode/handlers.ts`. Drift-gate tests + the auto-generated `skills/stageflip/tools/display-mode/SKILL.md` update on the next `pnpm gen:tool-skills`. |
| New budget field | Extend `displayBudgetSchema` in `packages/schema/src/content/display.ts`. Wire the new field through the orchestrator's budget check if enforceable; through the optimizer's recommendations if advisory. |

## Related

- `profiles/display/SKILL.md` — profile descriptor + RIR lint rules +
  canonical sizes + tool-bundle allowlist (T-200).
- `concepts/display-budget/SKILL.md` — IAB/GDN file-size enforcement
  points + minification pipeline.
- `tools/display-mode/SKILL.md` — auto-generated per-bundle tool skill
  (T-206).
- `runtimes/frame-runtime-bridge/SKILL.md` — bridge-clip shape.
- `workflows/parity-testing/SKILL.md` — PSNR/SSIM harness.
- Owning task: T-209 (this doc).
