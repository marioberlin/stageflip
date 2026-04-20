<!-- PR template for Phase 7: Agent + Semantic Tools. See docs/implementation-plan.md § Phase 7. -->

## Task
T-XXX — <title>

## Summary
<What tool bundle, agent stage, or LLM-abstraction piece this PR adds.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] skills/stageflip/concepts/agent-planner/SKILL.md
- [ ] skills/stageflip/concepts/agent-executor/SKILL.md
- [ ] skills/stageflip/concepts/agent-validator/SKILL.md
- [ ] skills/stageflip/concepts/tool-bundles/SKILL.md
- [ ] skills/stageflip/tools/<category>/SKILL.md (auto-generated; confirm in sync)

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green

## Agent / Tool Specific
- [ ] Every new tool has a Zod schema for input and output
- [ ] Every new tool is in exactly one bundle (no cross-bundle leakage)
- [ ] **I-9 enforced**: ≤30 tools loaded in agent context at any time (verified by test)
- [ ] Bundle meta-tools (`list_bundles`, `load_bundle`, `expand_scope`) available to Planner only
- [ ] Validator uses programmatic PSNR+SSIM for quality tier; LLM only for qualitative checks (T-153)
- [ ] Streaming events follow canonical event shape; AbortController honored
- [ ] `skills/stageflip/tools/**/SKILL.md` regenerated (check-skill-drift green)

## LLM Abstraction
- [ ] New SDK versions follow `docs/dependencies.md` §7 policy
- [ ] Default to most capable Claude model unless task argues for cheaper

## Determinism Audit
- [ ] Agent side-effects produce deterministic doc mutations given same seed/context (tools called at idempotent boundaries)

## Linked Issues
Closes #…
