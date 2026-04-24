---
title: Agent — Validator
id: skills/stageflip/concepts/agent-validator
tier: concept
status: substantive
last_updated: 2026-04-24
owner_task: T-153
related:
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/concepts/llm-abstraction/SKILL.md
  - skills/stageflip/workflows/parity-testing/SKILL.md
---

# Agent — Validator

The Validator is the quality gate after the Executor finishes. It gives a
thumbs-up (or a specific list of required fixes) before a result reaches the
user or lands in CI.

## The programmatic / LLM split

Two categories of checks, intentionally separated:

| Category | Mechanism | Examples |
|---|---|---|
| Quantitative | Programmatic (PSNR + SSIM, Zod shape, RIR round-trip) | visual parity, schema validity, timing correctness |
| Qualitative | LLM | brand voice, claim plausibility, aesthetics, reading level |

**Quality tier is set programmatically, not by LLM.** A failing PSNR score
drops the tier regardless of what the LLM thinks looks fine. LLMs are
unreliable at pixel math; they're reliable at "this reads like a marketing
person wrote it".

## Programmatic checks

- `pnpm parity` — PSNR/SSIM vs fixtures on affected surfaces
- `pnpm check-determinism` — no forbidden APIs in runtime code
- Schema round-trip — `parse(serialize(doc))` equals `doc`
- Linter — 30+ rules from pre-render linter (T-104) that run without actual
  rendering (timing overlap, stale bindings, theme-slot violations)

## LLM checks

Used sparingly and always with evidence:

- Brand voice check — compare against `skills/stageflip/modes/<mode>/SKILL.md`
  brand guide section
- Claim plausibility — "the revenue figure `$3.2B` appears plausible given
  the input data; source linked below"
- Reading level — target grade 8 for body copy, grade 10 for titles
- Accessibility text — alt-text quality for auto-generated images

Each LLM verdict comes with citations back into the document so a human
reviewer can re-check.

## Output

```ts
interface ValidationResult {
  tier: 'pass' | 'pass-with-notes' | 'fail';
  programmatic: { name: string; status: 'pass' | 'fail'; detail?: string }[];
  qualitative:  { name: string; verdict: string; evidence: string }[];
  required_fixes?: string[];
}
```

A `fail` or `pass-with-notes` routes back to the Executor (or to the user,
depending on severity).

## Current state (Phase 7, T-153 shipped)

`@stageflip/agent` exports `createValidator({ provider, extraProgrammaticChecks? })`
returning a `Validator` whose `validate(request, { signal? })` yields a
`ValidationResult`.

**Built-in programmatic checks** (run on every call):

- `schema_round_trip` — `documentSchema.parse` succeeds AND
  `JSON.stringify(parse(doc))` round-trips byte-for-byte. Catches
  Executor-side patches that land a shape the schema silently accepts
  but the serializer can't.

**Additional programmatic checks** ride through `extraProgrammaticChecks`
on the factory; each implements `{ name, run(document) }`. Intended plugs:

- Pre-render lint (T-104's `@stageflip/validation`) — wrap
  `lintDocument(rir(document))` and map `severity: 'error'` to `fail`.
- Parity PSNR/SSIM — inject a closure that captures the current render +
  golden pair and scores it; the Validator stays render-agnostic.

**Qualitative checks** (opt-in via `request.qualitativeChecks: QualitativeCheckName[]`):

- `brand_voice` — single LLM call; tone/diction/claim-style consistency
  across slides.
- `claim_plausibility` — internal consistency of numeric + named facts
  (no outside-world fact-check).
- `reading_level` — estimates effective grade level of body copy.
- Every check uses one forced `emit_qualitative_verdict` tool call with
  a Zod-validated `{ verdict, evidence, suggestedFix? }` payload.

**Tier computation** (authoritative, matches the skill's core rule —
"Quality tier is set programmatically, not by LLM"):

- Any programmatic `fail` → `tier: 'fail'`.
- Otherwise, any qualitative check emitting `suggestedFix` →
  `tier: 'pass-with-notes'`.
- Otherwise → `tier: 'pass'`.

`required_fixes` aggregates every qualitative `suggestedFix`, even under
`tier: 'fail'` (the Executor / UI may still surface them alongside the
programmatic failure reason).

Error surface: `QualitativeCheckError` with `kind: 'no_tool_call' | 'invalid_verdict'`
lets the caller retry or surface a diagnostic. Programmatic checks that
throw are captured as `status: 'fail'` so a broken check cannot panic
the run.

Aborting between qualitative checks is supported — the signal is polled
at each boundary; already-completed checks stay in the result.

## Related

- Executor: `concepts/agent-executor/SKILL.md`
- Parity harness: `workflows/parity-testing/SKILL.md`
- Pre-render linter: T-104, T-106 (auto-fix passes)
