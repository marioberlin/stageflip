---
title: Agent — Validator
id: skills/stageflip/concepts/agent-validator
tier: concept
status: substantive
last_updated: 2026-04-20
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

## Current state (Phase 1 exit)

Not yet implemented. Phase 7 (T-153) delivers the Validator. Parity harness
(the programmatic half) lands in Phase 5 (T-100).

## Related

- Executor: `concepts/agent-executor/SKILL.md`
- Parity harness: `workflows/parity-testing/SKILL.md`
- Pre-render linter: T-104, T-106 (auto-fix passes)
