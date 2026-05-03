# Parity-fixture sign-off workflow

Per **ADR-004 §D5** and **T-313**, every premium preset (cluster A–H) requires
a signed parity fixture before its cluster can merge. This document codifies
the four-step procedure. Operators (the product owner per cluster) own the
inspect + sign step; the CLIs handle generate + check.

## The four steps

### 1. Generate

```
$ pnpm generate-parity-fixture --preset=<id> [--frame=<n>]
```

This:

- Resolves the preset via `@stageflip/schema/presets/node` (T-304's loader).
- Builds a `FixtureManifest` from the preset's `clipKind`, `preferredFont`,
  and `fallbackFont` (resolved via the T-307 font registry).
- Renders the canonical reference frame at the chosen `--frame` (default
  `60` — mid-hold per ADR-004 §D5).
- Writes three artifacts under `parity-fixtures/<cluster>/<preset>/`:
  - `manifest.json` — composition + clip props + reference frames.
  - `golden-frame-<n>.png` — the rendered reference frame.
  - `thresholds.json` — PSNR + SSIM thresholds (defaults from `@stageflip/parity`).

The render path requires the operational pipeline (`@stageflip/renderer-cdp`
+ Chrome + ffmpeg). When invoked outside that pipeline (e.g., a vanilla
local checkout), the CLI exits 1 with `rendering pipeline unavailable: ...`.
Tests use a stub renderer (DI'd into `runGenerate`).

### 2. Inspect

The product owner for the cluster:

- Opens `parity-fixtures/<cluster>/<preset>/golden-frame-<n>.png`.
- Validates the rendered frame against the compass source for the preset
  (`docs/compass_artifact.md#<anchor>` per the preset's `source` frontmatter).
- Confirms typography, colors, motion-end-state, and brand alignment match
  the compass description.

If the frame is **not** acceptable: open an issue against the preset, do not
sign. Per ADR-004 §D5 the product owner's word is the sign-off authority for
the cluster — there is no second-tier approval.

### 3. Sign

```
$ pnpm generate-parity-fixture --preset=<id> --mark-signed
```

This re-runs the generate step **and** mutates the preset's
`signOff.parityFixture` frontmatter field from `pending-user-review` to
`signed:YYYY-MM-DD` (today's UTC date).

Mutation safety guards (per T-313 §D-T313-4):

- Re-reads the preset file fresh (no stale-cache races).
- Round-trips through gray-matter — body and unrelated frontmatter fields
  preserve byte-stably.
- Writes via temp-file + rename — a mid-write crash leaves the original
  intact (best-effort across platforms; Windows EBUSY accepted with a warning).
- **Re-sign guard**: if the value is already `signed:...`, the CLI exits 1
  unless `--force` is supplied. Re-signing is intentional and requires
  explicit confirmation.

### 4. Cluster batch merge

Once **every** preset in a cluster is signed (or `na` for text-free presets
like the Coinbase QR-only CTA):

```
$ pnpm check-cluster-eligibility --cluster=<letter|name>
```

Output:

```
Cluster A — news (8 presets)
  PASS cnn-classic (signed:2026-04-29)
  PASS bbc-reith-dark (signed:2026-04-29)
  ...
Cluster A: ELIGIBLE — all 8 preset(s) signed.
```

Exit 0 when eligible. The cluster's preset PRs may merge.

When any preset is still `pending-user-review` (or malformed), the CLI exits
1 with `Cluster <letter>: NOT ELIGIBLE — N preset(s) pending sign-off.` —
list the pending presets, return to step 1 for each.

## Cluster identifiers

Both letter (A through H) and name (`news`, `sports`, `weather`, `titles`,
`data`, `captions`, `ctas`, `ar`) are accepted, case-insensitive. Mirrors
the resolver style of `pnpm invoke-type-design-consultant`.

## Multi-variant fixtures (T-359a)

Some presets render more than one canonical visual state from a single preset
id. The exemplar is **`f1-sector-purple-green`** (cluster E, `clipKind: bigNumber`),
whose body declares three states: `sessionBest` / `personalBest` / `neutral`.
T-359a (extending T-313) adds the `--variant=<name>` flag for these presets:

```
$ pnpm tsx scripts/generate-preset-parity-fixture.ts \
    --preset=f1-sector-purple-green \
    --variant=sessionBest \
    --variant=personalBest \
    --variant=neutral \
    --frame=60 \
    --mark-signed
```

Equivalent comma-separated form:

```
$ pnpm tsx scripts/generate-preset-parity-fixture.ts \
    --preset=f1-sector-purple-green \
    --variant=sessionBest,personalBest,neutral \
    --frame=60 \
    --mark-signed
```

What changes vs. the single-variant T-313 flow:

- One golden file is written per declared variant —
  `golden-frame-60-sessionBest.png`, `golden-frame-60-personalBest.png`,
  `golden-frame-60-neutral.png`.
- `manifest.json` gains an object-keyed `variants` field
  (`{ sessionBest: { frames: [60] }, ... }`); single-variant invocations
  still produce the byte-identical T-313 shape (no `variants` key).
- Variant names must match `^[a-z][a-zA-Z0-9]*$` (camelCase, no hyphens).
- **Per-manifest atomic sign-off.** `--mark-signed` requires every declared
  variant to render cleanly. A partial render failure aborts before any
  frontmatter mutation — no half-signed states. (Per-variant sign-off would
  require schema changes outside T-359a's scope.)

The renderer must know which React component to mount for the preset's
`clipKind`. T-359a ships a tiny v1 resolver in `@stageflip/parity-cli`
(`DEFAULT_CLIP_KIND_RESOLVER`) that wires `bigNumber → animated-value`
(documented in the f1 preset's body). Cluster owners extend the resolver
as their first preset reaches sign-off. Unknown clipKinds surface as
`RenderUnavailableError: no component bound for clipKind '<x>'`.

For real PNG renders (production goldens), invoke the wrapper that binds
the puppeteer/CDP-backed renderer:

```
$ pnpm tsx scripts/generate-preset-parity-fixture-prod.ts ...
```

The standalone `generate-preset-parity-fixture.ts` script keeps its
backward-compat behavior — it always exits 1 with `rendering pipeline
unavailable: ...` because no renderer is bound.

## Out-of-scope items (deferred per T-313 + T-359a §"Out of scope")

- Multi-frame fixtures (loop-entry + mid-hold + loop-exit) within a single
  variant. T-313 ships the single canonical frame; T-359a adds multi-VARIANT
  (multiple state slices) but NOT multi-FRAME (multiple time slices of one
  state). Multi-frame remains a future task.
- Per-variant frontmatter sign-off. Sign-off is per-manifest atomic
  (T-359a D-T359a-2).
- A formal `clipKind → runtime-clip` dispatcher. T-359a's resolver map is
  the v1 surface; a registry-driven dispatcher is a follow-up.
- Mass migration of the 44+ existing `pending-user-review` stubs. Owners
  run the generator individually as their cluster batches reach merge
  readiness (per T-359a D-T359a-7).
- Per-cluster batch sign-off UI. The CLI is the v1 surface; a UI is a future
  productivity affordance.
- Auto-detection of fixture drift on compass source change. T-308 +
  skill-drift cover the static side; re-rendering on change is operational.
- Per-frame PSNR/SSIM threshold tuning. Default thresholds suffice for v1;
  per-cluster tuning is operational.

## Authority + escalation

Per ADR-004 §D5, the product owner per cluster is the sign-off authority. If
the consultant view (T-311 type-design-consultant for clusters A/B/D/F/G)
disagrees with the product owner on a fallback choice, the disagreement is
about typography — escalate per CLAUDE.md §6 to the Orchestrator. The parity
fixture itself is signed against what the renderer produced; if the
renderer's output diverges from the compass intent, that's a renderer bug,
not a sign-off question.

## Related

- `docs/decisions/ADR-004-preset-system.md` (§D5 — parity sign-off authority).
- `docs/tasks/T-313.md` — original parity-fixture pipeline spec.
- `docs/tasks/T-359a.md` — multi-variant + bound-renderer extension spec.
- `skills/stageflip/concepts/presets/SKILL.md` — preset concept overview.
- `parity-fixtures/README.md` — directory layout.
- `scripts/generate-preset-parity-fixture.ts` — generate CLI (test/stub renderer).
- `scripts/generate-preset-parity-fixture-prod.ts` — generate CLI (puppeteer-bound renderer).
- `scripts/check-cluster-eligibility.ts` — eligibility CLI.
- `packages/parity-cli/src/generate-fixture.ts` — clipKind resolver + RIRDocument builder used by the bound renderer.
