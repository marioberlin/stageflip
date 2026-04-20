<!-- PR template for Phase 5: Parity Harness + Pre-Render Linter. See docs/implementation-plan.md § Phase 5. -->

## Task
T-XXX — <title>

## Summary
<What this PR contributes to parity enforcement or the pre-render linter.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] skills/stageflip/workflows/parity-testing/SKILL.md
- [ ] skills/stageflip/reference/validation-rules/SKILL.md

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] `pnpm parity` green on all existing fixtures (no regression)

## Parity / Linter Specific
- [ ] Per-fixture thresholds recorded: **PSNR ≥ configured**, **SSIM ≥ 0.97** on text-heavy regions
- [ ] Max frame-failure budget documented per fixture
- [ ] Linter rules cross-linked to the skill they come from
- [ ] Auto-fix passes converge (idempotent after second run)
- [ ] Visual diff viewer verified locally (side-by-side / slider / overlay)

## Determinism Audit
- [ ] Parity runs are reproducible: rerunning on same branch yields same metrics
- [ ] No wall-clock-dependent math in linter rules

## Linked Issues
Closes #…
