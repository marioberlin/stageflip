---
"@stageflip/editor-shell": minor
---

T-248: Loss-flag reporter atom surface in `@stageflip/editor-shell`.

Adds three new public atoms for the import-diagnostics surface consumed
by every editor app:

- `importLossFlagsAtom: Atom<readonly LossFlag[]>` — raw flags from the
  last import. Default `[]`. Inert until the import-pipeline refactor
  writes to it (separate follow-up task).
- `dismissedLossFlagIdsAtom: Atom<ReadonlySet<string>>` — per-session
  dismissed ids. Survives `importLossFlagsAtom` rewrites so re-imports
  respect prior dismissals.
- `visibleLossFlagsAtom` — derived: `importLossFlagsAtom` minus
  `dismissedLossFlagIdsAtom`, sorted severity-desc then source-asc then
  code-asc.

`apps/stageflip-slide` consumes the triple via a new `<LossFlagBadge>`
status-bar slot that opens a `<LossFlagReporter>` modal — see
`skills/stageflip/concepts/loss-flags/SKILL.md` §"Reporter UI (T-248)".

**Runtime deps added**: `@stageflip/loss-flags` (workspace; provides the
canonical `LossFlag` type the atoms are typed against).
