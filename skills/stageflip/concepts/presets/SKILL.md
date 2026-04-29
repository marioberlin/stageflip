---
title: Preset schema primitive
id: skills/stageflip/concepts/presets
tier: concept
status: substantive
last_updated: 2026-04-29
owner_task: T-304
related:
  - skills/stageflip/presets/news/SKILL.md
  - skills/stageflip/presets/sports/SKILL.md
  - skills/stageflip/presets/weather/SKILL.md
  - skills/stageflip/presets/titles/SKILL.md
  - skills/stageflip/presets/data/SKILL.md
  - skills/stageflip/presets/captions/SKILL.md
  - skills/stageflip/presets/ctas/SKILL.md
  - skills/stageflip/presets/ar/SKILL.md
  - skills/stageflip/concepts/skills-tree/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
---

# Preset schema primitive

Per **ADR-004**, every preset in the StageFlip premium clip library is a
SKILL.md file at `skills/stageflip/presets/{cluster}/{preset-id}.md`. The
frontmatter is machine-readable and drives the loader; the body is the
compass-distilled rule set (visual tokens / typography / animation / rules /
acceptance / references).

**T-304** ships the loader + validator + frontmatter parser at
`@stageflip/schema`. The surface is split across two subpaths so browser
bundles (apps/stageflip-slide, apps/stageflip-display) never pull in
`node:fs` / `node:path`:

- **`@stageflip/schema`** (browser-safe): schemas + types + body parser + error classes.
- **`@stageflip/schema/presets/node`** (Node-only): loader + registry.

Consumers:

- **T-307** — font-license registry (validates the canonical license vocabulary).
- **T-308** — `check-preset-integrity` CI gate.
- Future semantic-router and preset-builder tasks.

## API surface

```ts
// Browser-safe (schemas + types + errors + body parser):
import {
  presetFrontmatterSchema,
  clusterSkillFrontmatterSchema,
  PresetValidationError,
  PresetParseError,
  PresetRegistryLoadError,
} from '@stageflip/schema';

// Node-only (loader + registry — uses node:fs / node:path):
import {
  loadPreset,
  loadCluster,
  loadAllPresets,
  PresetRegistry,
} from '@stageflip/schema/presets/node';
```

Three loader tiers:

- `loadPreset(filePath)` — parses one file. Throws `PresetParseError` for
  malformed YAML, `PresetValidationError` for shape violations, plain Node
  `ENOENT` for missing files.
- `loadCluster(clusterPath)` — parses the cluster `SKILL.md` plus every
  `*.md` file in the directory. Returns `{ skill, presets }`.
- `loadAllPresets(rootPath)` — walks `rootPath/*/`, builds a memoized
  `PresetRegistry`. **Aggregates** errors across clusters — every malformed
  file appears in a single `PresetRegistryLoadError.issues` array (T-304 AC
  #21).

## Frontmatter shape (preset)

```yaml
id: <kebab-slug>
cluster: <news | sports | weather | titles | data | captions | ctas | ar>
clipKind: <canonical clip kind>
source: <path or anchor into the compass canon>
status: <stub | substantive>
preferredFont:
  family: <string>
  license: <non-empty string>            # vocabulary owned by T-307
fallbackFont:                            # optional
  family: <string>
  weight: <positive integer>
  license: <non-empty string>
permissions: []                          # network | mic | camera | geolocation
signOff:
  parityFixture: pending-user-review | signed:YYYY-MM-DD | na
  typeDesign:    pending-cluster-batch | signed:YYYY-MM-DD | na
```

Strict: unknown top-level fields throw with a clear path (typos in field
names — e.g. `clipKnd` — fail loud rather than silently default).

License **vocabulary** is intentionally permissive in T-304 (`z.string().min(1)`
on the value). Per **ADR-004 §D3** and the 2026-04-28 Orchestrator amendment,
T-307 owns the canonical license enum + composite-expression handling
(`apache-2.0 + ofl`, `commercial-byo`, etc.). T-304 validates SHAPE; T-307
validates VOCABULARY.

## Font-license registry (T-307)

`@stageflip/schema/presets/node` exports `FontLicenseRegistry`, which walks
the loaded `PresetRegistry` and indexes every `(family, license)` pair by
canonical family name. The browser-safe entry `@stageflip/schema` exports the
parser + atom enum so consumers without Node access can validate
free-form license expressions.

```ts
// Browser-safe vocabulary + parser:
import { parseFontLicenseExpression, FONT_LICENSE_ATOMS } from '@stageflip/schema';

// Node-only registry:
import { FontLicenseRegistry } from '@stageflip/schema/presets/node';
```

### License atoms

The 12-atom enum (`FONT_LICENSE_ATOMS`) is the registry's contract. New
preset stubs MUST use only these atoms in `preferredFont.license` /
`fallbackFont.license`:

| Atom | Meaning |
|---|---|
| `ofl` | SIL Open Font License (the dominant fallback license). |
| `apache-2.0` | Apache 2.0 (e.g., Roboto). |
| `mit` | MIT. |
| `public-domain` | Public domain. |
| `cc0-1.0` | CC0 1.0 Universal. |
| `proprietary-byo` | Bring-your-own (e.g., CNN Sans, BBC Reith). Must pair with `fallbackFont`. |
| `commercial-byo` | Licensed commercially; bring license (e.g., ITC Benguiat). |
| `platform-byo` | Platform fonts (TikTok Sans, Apple SF) — assume installed. |
| `license-cleared` | Informal "we know it's OK"; escalate to type-design-consultant (T-311). |
| `license-mixed` | Multi-license fallback group. |
| `ofl-equivalent` | OFL-compatible custom (e.g., 8-bit pixel fonts). |
| `na` | Text-free presets (e.g., QR-only CTAs). |

### Composite expressions

Two operators are recognised in license strings:

- **AND (`+`)** — every atom required (e.g., `'apache-2.0 + ofl'` for a font that
  ships both licenses simultaneously).
- **OR (`/`)** — any one atom suffices (e.g., `'apache-2.0 / ofl / commercial-byo'`
  for a fallback set where the user picks whichever is convenient).

Mixing `+` and `/` in one expression is rejected at the parser level.
Parenthesised annotations (e.g., `'ofl-equivalent (custom)'`) are stripped —
the annotation is informational; the canonical atom is what reaches the
registry.

### CI gate (T-307 + T-308)

`scripts/check-licenses.ts` validates the full preset corpus on every push:

- Every license expression must parse (unknown atoms fail loud).
- Every preset must use only atoms in `FONT_ALLOWED_ATOMS`.
- `proprietary-byo` entries without a fallback are flagged for audit (not a
  hard error; T-308's `check-preset-integrity` upgrades this to a hard gate
  via invariant 3).

## Integrity gate (T-308)

`scripts/check-preset-integrity.ts` (run as `pnpm check-preset-integrity`)
enforces seven invariants from **ADR-004 §D6**, aggregating violations across
the entire preset corpus into a single report (mirrors the T-304 loader's
aggregating posture). Gate failure blocks merge.

### The seven invariants

| # | Invariant | Severity | Notes |
|---|---|---|---|
| 1 | Every preset has valid frontmatter | error | Loader Zod validation. |
| 2 | `clipKind` exists in the script's `VALID_CLIP_KINDS` set | error | Hardcoded per T-308 §D-T308-5. |
| 3 | Bespoke-font preset (`proprietary-byo` / `commercial-byo`) declares a `fallbackFont` | error | Hard upgrade of T-307's audit-flag posture. |
| 4 | Interactive-family clipKind has non-empty `staticFallback` | error | Per ADR-003 §D2. Reads raw frontmatter (loader schema is `.strict()` and excludes the field). |
| 5 | Cluster A/B/D/F/G preset has `signOff.typeDesign` populated | error | Cluster-scoped — does NOT apply to weather (C), data (E), AR (H). Text-free presets (`preferredFont.license = 'na'`) are exempt. |
| 6 | `signOff.parityFixture` populated | warning | Non-blocking pre-cluster-merge per T-308 §D-T308-2. |
| 7 | Preset's `source` resolves to a real anchor in `docs/compass.md` | error | SKIPS with one-time warning when `docs/compass.md` is absent (graceful degradation per T-308 §D-T308-4). External `https://...` URLs accepted without verification. |

### Cluster scoping for invariant 5

| Cluster | Directory | Type-design sign-off required? |
|---|---|---|
| A | `news` | Yes |
| B | `sports` | Yes |
| C | `weather` | No |
| D | `titles` | Yes |
| E | `data` | No |
| F | `captions` | Yes |
| G | `ctas` | Yes |
| H | `ar` | No |

Invariant 5 is the most common bug class — clusters A/B/D/F/G is the
required-sign-off set; C/E/H are exempt. The `na` exemption for text-free
presets is narrow (preferredFont.license atom = `'na'`).

## Parity fixtures (T-313)

Per **ADR-004 §D5**, every preset requires a signed parity fixture before its
cluster may merge. T-313 ships two CLIs and a workflow doc:

- `pnpm generate-parity-fixture --preset=<id> [--frame=<n>] [--mark-signed]`
  — auto-generates the canonical reference-frame fixture under
  `parity-fixtures/<cluster>/<preset>/` (manifest.json + golden-frame-<n>.png
  + thresholds.json). With `--mark-signed`, mutates the preset's
  `signOff.parityFixture` frontmatter to `signed:YYYY-MM-DD`. Re-sign is
  guarded by `--force` per ADR-004 §D5.
- `pnpm check-cluster-eligibility --cluster=<letter|name>` — walks the
  cluster, reports per-preset sign-off state, exits 0 when every preset is
  signed (or `na`).

The four-step product-owner-per-cluster workflow (generate → inspect → sign →
cluster batch merge) is documented at
[`docs/ops/parity-fixture-signoff.md`](../../../ops/parity-fixture-signoff.md).

T-313 reuses the existing parity infrastructure at `packages/testing/fixtures/`
(T-067) — the fixture-manifest schema is shared. The new top-level
`parity-fixtures/` tree is preset-level (one bundle per preset); the existing
`packages/testing/fixtures/` tree remains clip-runtime-level (per
runtime+kind).

## Skill drift gate (T-310)

`scripts/check-skill-drift.ts` (run as `pnpm check-skill-drift`) extends the
T-014 link-integrity + tier-coverage checks with two **tree-level** preset
checks. Each runs against the on-disk preset corpus on every push:

| Check | What it enforces |
|---|---|
| `preset-cluster-coverage` | Every cluster directory under `skills/stageflip/presets/` has a `SKILL.md`, AND every preset's frontmatter `cluster` field matches its parent directory name. |
| `preset-id-coherence` | Every preset's frontmatter `id` matches its filename (sans `.md`), AND every cluster `SKILL.md` has `id: skills/stageflip/presets/<cluster>` exactly. |

These complement (do **not** duplicate) `check-preset-integrity` (T-308):

- T-308 enforces the seven ADR-004 §D6 invariants on **individual** presets.
- T-310 enforces tree-level invariants — coverage, naming, location.

Both gates aggregate violations: a single run reports every error across every
preset (no fail-on-first), matching the T-304 loader's posture.

Sample output at HEAD:

```
check-skill-drift [link-integrity]: PASS
check-skill-drift [tier-coverage]: PASS
check-skill-drift [preset-cluster-coverage]: PASS (8 clusters, 50 presets)
check-skill-drift [preset-id-coherence]: PASS

check-skill-drift: PASS
```

## Frontmatter shape (cluster)

```yaml
title: <string>
id: skills/stageflip/presets/<cluster>
tier: cluster
status: <stub | substantive>
last_updated: YYYY-MM-DD
owner_task: T-NNN
related: []
```

The cluster discriminator is the filename `SKILL.md` (the loader treats every
other `.md` in the same directory as a preset).

## Body parsing

H2 split on canonical sections:

- `## Visual tokens`
- `## Typography`
- `## Animation`
- `## Rules`
- `## Acceptance` / `## Acceptance (parity)`
- `## References`

Unknown headers preserve in `body.unknown` for forward compatibility. Body
parsing is intentionally **best-effort** in T-304 — section content is not
strictly validated. Downstream tasks tighten section schemas as concrete
consumers surface needs.

## Determinism

Same input file → same parsed `Preset` across builds. The loader uses
synchronous `fs.readFileSync` + `path.join` only — no time / random / network
behavior. Output canonicality is pinned by AC #30 (100-invocation hash test).

## Related

- [ADR-004 — preset system](../../../decisions/ADR-004-preset-system.md)
- [ADR-003 — interactive runtime tier](../../../decisions/ADR-003-interactive-runtime-tier.md)
  (defines `permissions` field)
- [skills/stageflip/concepts/schema](../schema/SKILL.md) (parent concept)
- T-307 (font-license registry — license vocabulary; **shipped**)
- T-308 (`check-preset-integrity` CI gate — first downstream consumer)
- T-310 (`check-skill-drift` preset-tree gate — tree-level coverage + id coherence)
- T-313 (parity-fixture pipeline + sign-off workflow — `pnpm generate-parity-fixture`, `pnpm check-cluster-eligibility`, [`docs/ops/parity-fixture-signoff.md`](../../../ops/parity-fixture-signoff.md))
