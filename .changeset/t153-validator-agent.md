---
'@stageflip/agent': minor
---

T-153 — `@stageflip/agent` ships the Validator, the third of the
three-agent triad. `createValidator({ provider, extraProgrammaticChecks? })`
returns a `Validator` whose `validate(request, { signal? })` yields a
`ValidationResult`.

Honours the skill's core boundary: **quality tier is set
programmatically, never by LLM**.

- **Built-in programmatic check**: `schema_round_trip` — the document
  must `documentSchema.parse` cleanly AND re-serialise + re-parse
  byte-for-byte. Catches Executor-side patches that produce a shape
  the schema silently accepts but the serializer can't round-trip.
- **`extraProgrammaticChecks` hook** for T-104's pre-render linter and
  T-100's parity PSNR/SSIM to plug in. Both are currently render-aware
  and live outside agent, so the Validator stays render-agnostic.
- **Three qualitative checks** opt-in by name on the request:
  `brand_voice` / `claim_plausibility` / `reading_level`. Each is one
  provider.complete call with a forced `emit_qualitative_verdict` tool;
  Zod-validated `{ verdict, evidence, suggestedFix? }` payload.
- **Tier**: any programmatic `fail` → `fail`; else any qualitative
  `suggestedFix` → `pass-with-notes`; else `pass`. `required_fixes`
  aggregates every `suggestedFix` (still populated under `fail`).
- **Errors**: `QualitativeCheckError` with `kind: 'no_tool_call' |
  'invalid_verdict'`. Programmatic checks that throw are captured as
  `status: 'fail'` so a broken check cannot panic the run.
- **Abort** between qualitative checks is supported; already-completed
  checks remain in the result.

Public surface: `createValidator`, `Validator`, `ValidatorRequest`,
`ValidatorCallOptions`, `CreateValidatorOptions`, `ValidationResult`,
`ValidationTier`, `ProgrammaticCheck`/`ProgrammaticCheckResult`,
`QualitativeCheckName`/`QualitativeCheckResult`,
`DEFAULT_PROGRAMMATIC_CHECKS`, `runProgrammaticChecks`,
`schemaRoundTripCheck`, `QUALITATIVE_CHECKS`,
`EMIT_QUALITATIVE_VERDICT_TOOL(_NAME)`, `runQualitativeCheck`,
`QualitativeCheckError`, `qualitativeToolInputSchema`,
`validationResultSchema`.

21 new tests (5 programmatic + 10 qualitative + 6 validator). 64 total
agent tests; 93% line coverage on validator modules. All 9 gates green.
Skill `concepts/agent-validator/SKILL.md` flipped to the shipped
contract, including the tier rule and the extraProgrammaticChecks plug
points for T-104/T-100.

Phase 7's three-agent triad (Planner T-151 + Executor T-152 + Validator
T-153) now ships end-to-end. T-170 is the remaining copilot-wiring step
for the editor; T-155–T-168 populate real handlers.
