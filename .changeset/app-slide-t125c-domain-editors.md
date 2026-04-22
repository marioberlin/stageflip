---
'@stageflip/app-slide': minor
'@stageflip/editor-shell': minor
---

T-125c — three domain editors slot into the T-125a PropertiesPanel
router plus a universal AnimationPicker section.

- `<ChartElementProperties>` (for `element.type === 'chart'`) — chart
  kind enum picker, legend / axes toggles, inline-data series editor
  (blur-commit name + comma-separated values, add / remove series).
  `DataSourceRef`-bound charts surface a read-only notice (binding UI
  lands with T-167).
- `<TableElementProperties>` (for `element.type === 'table'`) — rows /
  columns read-outs with paired add / remove buttons (remove disabled
  at the schema min of 1), headerRow toggle, per-cell content text
  input (blur-commit) + align select. colspan / rowspan / color are
  deferred.
- `<AnimationPicker>` — always-on section above Delete. Preset buttons
  append an `Animation` with validated defaults for each of the 7
  AnimationKind branches (fade / slide / scale / rotate / color /
  keyframed / runtime); each existing animation renders a read-only
  kind label + remove. IDs minted via `crypto.randomUUID()`.

Every mutation flows through `updateDocument`; continuous inputs
buffer locally and commit on blur / Enter (handover-phase6-mid-2
§3.3), so T-133 captures one undo entry per gesture. Pre-existing
`properties.typeEditorsStub` copy updated — with T-125c shipped, the
stub is reserved for element types without a dedicated editor (text,
shape, image, code, embed, audio, video, group).

New i18n keys under `properties.chart.*`, `properties.table.*`, and
`properties.animation.*`.
