<!-- PR template for Phase 10: Skills + MCP + Distribution. See docs/implementation-plan.md § Phase 10. -->

## Task
T-XXX — <title>

## Summary
<What this PR adds to the skills-sync generators, MCP server, Claude plugin, CLI, docs site, or deployment config.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] skills/stageflip/concepts/skills-tree/SKILL.md
- [ ] skills/stageflip/reference/cli/SKILL.md (if CLI touched)
- [ ] skills/stageflip/concepts/mcp-integration/SKILL.md

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] Every skill file satisfies the four non-negotiables (one-screen, examples-over-prose, cross-linked, single-source-of-truth)

## Distribution Specific
- [ ] Changeset included for every publishable package
- [ ] npm publish dry-run succeeds (`corepack pnpm publish --dry-run -r`)
- [ ] `claude plugin install stageflip` tested locally end-to-end
- [ ] MCP auth flow (OAuth → JWT → local config) verified
- [ ] Docs site builds and every skill link resolves
- [ ] Cloud Run render worker image builds reproducibly

## Auto-gen Coverage
- [ ] `reference/cli/SKILL.md` regenerated from CLI registry and committed
- [ ] `skills/stageflip/clips/catalog/SKILL.md` / `tools/*/SKILL.md` / `runtimes/index/SKILL.md` regenerated if touched sources changed

## Linked Issues
Closes #…
