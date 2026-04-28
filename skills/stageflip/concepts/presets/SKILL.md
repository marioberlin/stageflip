---
title: Preset schema primitive
id: skills/stageflip/concepts/presets
tier: concept
status: substantive
last_updated: 2026-04-27
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
- T-307 (font-license registry — license vocabulary)
- T-308 (`check-preset-integrity` CI gate — first downstream consumer)
