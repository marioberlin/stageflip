<!--
This is the default PR template. For tasks executed under the agent workflow
(CLAUDE.md §2), replace this body with the phase-specific template from
.github/pr-templates/phase-{N}.md where N matches the task's phase in
docs/implementation-plan.md.

If this PR is not tied to a task (e.g., a typo fix in docs), use the minimal
form below.
-->

## Summary
<One paragraph.>

## Linked Issues
Closes #…

## Checks
- [ ] `corepack pnpm typecheck` / `lint` / `test` green
- [ ] No Remotion imports (verified by `pnpm check-remotion-imports` once T-010 lands)
- [ ] No new runtime deps added without a `docs/dependencies.md` entry
