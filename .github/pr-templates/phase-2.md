<!-- PR template for Phase 2: Frame Runtime. See docs/implementation-plan.md § Phase 2. -->

## Task
T-XXX — <title>

## Summary
<What this PR adds to `@stageflip/frame-runtime`. Call out any public API surface.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] docs/architecture.md §6 (Determinism) and §8 (Runtimes)
- [ ] skills/stageflip/runtimes/frame-runtime/SKILL.md
- [ ] skills/stageflip/concepts/determinism/SKILL.md

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` exit 0
- [ ] `corepack pnpm lint` exit 0
- [ ] `corepack pnpm test` exit 0, ≥85% coverage
- [ ] `corepack pnpm check-licenses` exit 0
- [ ] `corepack pnpm check-remotion-imports` exit 0 (**critical in this package**)
- [ ] `corepack pnpm check-determinism` exit 0
- [ ] `corepack pnpm check-skill-drift` exit 0
- [ ] **Bundle size budget**: `size-limit` — frame-runtime ≤ 25 KB gz (T-049)

## Frame Runtime Specific
- [ ] New public API has TSDoc with at least one example
- [ ] Property-based tests (`fast-check`) added for numeric functions: monotonicity, convergence, boundary
- [ ] Input validation rejects invalid params with a useful error (never returns NaN)
- [ ] API shape documented in `skills/stageflip/runtimes/frame-runtime/SKILL.md`
- [ ] No Remotion code or distinctive structural choices reproduced

## Determinism Audit
- [ ] Zero `Date.now()` / `Math.random()` / `performance.now()` / `fetch()` / `requestAnimationFrame` / timers in package source
- [ ] `renderFrame(compId, frame, props)` given same inputs yields identical output

## Prior Art Read (URLs only)
- <remotion.dev/docs url if applicable>

## Linked Issues
Closes #…
