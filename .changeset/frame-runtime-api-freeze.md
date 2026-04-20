---
"@stageflip/frame-runtime": minor
---

Public API freeze before Phase 3 (T-054).

- `react` and `react-dom` move from `dependencies` to `peerDependencies`
  (`^19.0.0`). Consumers that already install React get one React copy;
  previously they would have shipped two.
- `react` and `react-dom` added as `devDependencies` (pinned `19.2.5`) for
  tests.
- `culori` and `flubber` remain regular runtime `dependencies` — they are
  implementation details of `interpolateColors` / `interpolatePath` and
  their output shapes are wrapped by this package's own formatter, not
  re-exported.

Surface locked. Additions after this ship as a minor bump; removals or
breaking signature changes require a major. See
`skills/stageflip/runtimes/frame-runtime/SKILL.md` for the documented
surface.
