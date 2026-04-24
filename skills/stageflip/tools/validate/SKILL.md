---
title: Tools — Validate Bundle
id: skills/stageflip/tools/validate
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-159
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/agent-validator/SKILL.md
  - skills/stageflip/tools/read/SKILL.md
---

# Tools — Validate Bundle

Four read-tier tools for schema + structural integrity checks. All four
type against `DocumentContext`; no mutations, no patches. `Validator`
(T-153) calls them via `extraProgrammaticChecks` hook; planners call them
ad-hoc.

Registration: `registerValidateBundle(registry, router)`.

## Tools

### `validate_schema` — `{}`

`documentSchema.parse` with every Zod issue (path + code + message)
reported. `ok: true` when the doc parses clean.

### `check_duplicate_ids` — `{}`

Scan for duplicate slide ids and duplicate element ids (elements must
have globally-unique ids across the deck). Returns two arrays;
`ok: true` when both empty. Non-slide modes return `ok: true` with
empty arrays — the check has no work to do.

### `check_timing_coverage` — `{}`

Report per-slide `durationMs` coverage + sum the known durations. The
`slidesWithoutDuration[]` array names slides that would hang a non-
interactive export. Non-slide modes surface `mode: 'video' | 'display'`
and zero counts.

### `validate_all` — `{}`

Run every other check in this bundle and aggregate findings into a
single `{ ok, findings: { kind, message, path? }[] }` shape. Convenient
for "please lint the doc" prompts; prefer the individual tools when the
planner already knows which axis to inspect.

## Invariants

- Read-tier only — no `patchSink`; never mutates.
- Every handler declares `bundle: 'validate'`.
- Tool count 4 → well within the 30-tool I-9 budget.
- Handlers never throw for caller-controllable errors.

## Related

- Concept: `concepts/agent-validator/SKILL.md` — validator uses these
  via `extraProgrammaticChecks`.
- Sibling (read): `tools/read/SKILL.md`
- Task: T-159
