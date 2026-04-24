<!-- PR template for Phase 13: Premium motion library & frontier runtime. See docs/implementation-plan.md § Phase 13. -->

## Task
T-XXX — <title>

## Summary
<What this PR adds: preset, cluster skill, gap clip, frontier clip (shader / three / voice / ai-chat / live-data / web-embed / ai-generative), interactive-tier primitive, fast-variant-gen, deployment target, CI gate, ADR, or plan patch.>

## Track
- [ ] A — Frontier runtime (`packages/runtimes/interactive/`, shader, three, live clips, deploy targets)
- [ ] B — Preset library (cluster build-out, gap clips, parity fixtures, cluster skills)
- [ ] C — Supporting plumbing (chart family, `arrange_reveal`, export matrix, CI)

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md (full, including §3 + amended §6)
- [ ] docs/decisions/ADR-003-interactive-runtime-tier.md (if Track A or interactive preset)
- [ ] docs/decisions/ADR-004-preset-system.md (if preset or cluster skill)
- [ ] docs/decisions/ADR-005-frontier-clip-catalogue.md (if frontier clip)
- [ ] skills/stageflip/presets/<cluster>/SKILL.md (if preset in that cluster)
- [ ] skills/stageflip/concepts/determinism/SKILL.md (if Track A or interactive preset)
- [ ] skills/stageflip/agents/type-design-consultant/SKILL.md (if bespoke-font preset)

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] `corepack pnpm check-preset-integrity` green (new gate; always required in Phase 13)
- [ ] Parity harness green if rendering touched; interactive tier's live-mount smoke tests green if `liveMount` touched

## Preset PRs
- [ ] Frontmatter complete: `id` / `cluster` / `clipKind` / `source` / `preferredFont` / `fallbackFont` / `permissions`
- [ ] Body has all six sections: Visual tokens, Typography, Animation, Rules, Acceptance, References
- [ ] Parity fixture auto-generated and attached; cluster sign-off status noted (user signs per cluster batch)
- [ ] If bespoke font: linked to cluster's type-design-consultant batch review

## Frontier-clip PRs (Track A)
- [ ] `staticFallback` non-empty and rendered deterministically by frame-runtime
- [ ] `liveMount` declares `permissions: Permission[]`
- [ ] Fallback smoke test: export target that forces `staticFallback` renders without executing `liveMount`
- [ ] If shader / three: uniform updaters pass the `check-determinism` shader sub-rule
- [ ] Security-sensitive surface (network, mic, camera, iframe) listed in PR description for security review queue

## Gap-clip PRs (Track B)
- [ ] Clip schema added to `packages/schema/src/clips/`
- [ ] Registered in the clip registry
- [ ] At least one preset in the dependent cluster consumes it (or a stub preset stands in)

## Deployment-target PRs (Track A, γ-deploy)
- [ ] `renderer-cdp` interactive hosting tests green (if applicable)
- [ ] Browser live-preview integration tests green (if applicable)
- [ ] On-device display player packaging + ops telemetry wired (if applicable)

## Documentation
- [ ] Cluster SKILL.md updated if preset added (presets list, tool list)
- [ ] Semantic tool registered in the tool-router if `compose_*` added
- [ ] `docs/implementation-plan.md` changelog entry updated for phase progress

## Linked Issues
Closes #…
