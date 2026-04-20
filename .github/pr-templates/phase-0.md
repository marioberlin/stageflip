<!-- PR template for Phase 0: Bootstrap. See docs/implementation-plan.md § Phase 0. -->

## Task
T-XXX — <title>

## Summary
<One paragraph: what state the repo is in before and after this PR.>

## Skills Read (Reviewer verifies)
<!-- List each SKILL.md the task cited, and check that the Reviewer read it. -->
- [ ] CLAUDE.md
- [ ] docs/architecture.md (relevant section)
- [ ] _skill files here if cited by task_

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm install` clean
- [ ] `corepack pnpm build` exit 0
- [ ] `corepack pnpm typecheck` exit 0
- [ ] `corepack pnpm lint` exit 0
- [ ] `corepack pnpm test` exit 0
- [ ] Bootstrap-specific: `.gitignore` covers any new artifact kinds introduced
- [ ] Phase 0 is pre-CI: gates run manually; CI wiring itself is T-006

## License & Provenance
- [ ] No new runtime deps added without a `docs/dependencies.md` entry
- [ ] No code copied from reference/ or any forbidden prior art
- [ ] If LICENSE or NOTICE touched, ADR-001 linked

## Determinism Audit
Phase 0 does not touch runtime code, so no determinism risks expected. Confirm:
- [ ] No `Date.now()` / `Math.random()` / `performance.now()` / `fetch()` / timers added anywhere (N/A for scaffold)

## Linked Issues
Closes #…
