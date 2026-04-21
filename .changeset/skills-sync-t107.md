---
"@stageflip/skills-sync": minor
---

Auto-gen validation-rules reference + workflow guidance (T-107).

**Closes out the Phase 5 skill surface.** The parity-testing skill
gains substantive "when to update a golden / triage a tanked SSIM /
threshold tuning" guidance; the validation-rules reference switches
from hand-curated to auto-generated so rule-surface drift can't
silently go undocumented.

**New generator — `generateValidationRulesSkill(pkg)`**:

Exported from `@stageflip/skills-sync`. Reads every
`LintRule`'s `id`, `severity`, and `description` from the live
`@stageflip/validation` module surface + the category-grouped
arrays (`TIMING_RULES`, `TRANSFORM_RULES`, etc.) and emits a
deterministic markdown catalogue with:

- Frontmatter (`status: auto-generated`, `owner_task: T-107`)
- Intro with rule-count summary
- Severity legend
- Quick-start snippet
- Per-category rule tables (id / severity / what)
- Customising + lifecycle prose

Pipe-in-description and newline-in-description get escaped so they
survive the markdown table. Empty categories render with a
"_No rules registered in this category._" placeholder so the
skeleton is stable across future rule additions.

**Wiring**:

- `scripts/sync-skills.ts` gains a second job (`reference/validation-rules`)
  alongside the existing schema job.
- `pnpm skills-sync` writes both SKILL.md files.
- `pnpm skills-sync:check` now fails if either drifts from its
  generator output — same mechanism as the schema skill.
- `@stageflip/skills-sync` adds `@stageflip/validation` as a
  workspace dep. Validation is type-only-imported from outside
  (runtime imports are self-contained), so tsx resolves the source
  without requiring rir/runtimes-contract to be built first.

**Workflow guidance (parity-testing SKILL.md)**:

The "What comes later" T-107 row is replaced with three new
substantive sections:

- **When to update a golden** — never casually; bump thresholds
  instead of replacing goldens when drift is codec noise; always
  document rationale; always re-run locally first.
- **Triage playbook for a tanked SSIM** — 5-step process: region
  bounds → side-by-side → per-frame breakdown → local reproduction
  → isolate non-determinism source. Explicitly discourages
  silencing via `maxFailingFrames` bumps.
- **Threshold tuning** — per-runtime class reference table (CSS
  lossless, Lottie, Shader, GSAP text, Three 3D, h264, prores)
  with typical PSNR + SSIM floors. "Start strict" framing.
- **Priming goldens** — 5-step first-time setup.

Skill also adds a `related:` link to `reference/validation-rules`
for proximity to the linter reference.

**Tests**: 8 generator cases (group layout, frontmatter shape,
rule-count totalling, pipe-escape, empty-category placeholder,
determinism, prose inclusion, rule-order preservation). Uses a
synthetic `ValidationRulesPkg` fixture rather than importing the
real validation surface so test output stays hermetic under rule
churn.

**Plan note**: the validation-rules SKILL.md was previously
hand-curated (T-104 ship). T-107 overwrites it with the generator
output; the catalogue tables stay identical because T-104's
hand-written tables matched the rule metadata exactly. Any future
rule addition now only requires a `pnpm skills-sync`; no more
hand-editing the skill.
