<!-- PR template for Phase 3: Runtime Contract + Core Live Runtimes. See docs/implementation-plan.md § Phase 3. -->

## Task
T-XXX — <title>

## Summary
<Runtime/clip being added and its tier (live/bake). Note any new runtime kind.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] skills/stageflip/runtimes/<kind>/SKILL.md (the one being added or touched)
- [ ] skills/stageflip/clips/authoring/SKILL.md
- [ ] skills/stageflip/concepts/fonts/SKILL.md (if FontManager touched)

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] **Parity fixture** added for the runtime's demo clip (reference frames at t=0, mid, end) and `pnpm parity` green

## Runtime Specific
- [ ] Runtime registered with tier: `live` | `bake`
- [ ] `ClipRuntime` contract fully implemented (no partial surface)
- [ ] `frame-runtime-bridge` integration verified if runtime renders via frame-runtime
- [ ] `FontRequirement[]` declared if runtime uses text
- [ ] Shaders declare `precision highp float;` (shader runtime only)
- [ ] New runtime adds an ADR (per ADR-001 §Consequences)

## Determinism Audit
- [ ] Runtime pauses on mount; advances only by RIR-provided frame
- [ ] No wall-clock reads in clip or runtime code
- [ ] GSAP/Lottie/etc. timelines are seeked, not played

## License & Provenance
- [ ] New runtime deps whitelisted
- [ ] GSAP Business Green license referenced if GSAP runtime (THIRD_PARTY.md)

## Prior Art Read (URLs only)
- <url>

## Linked Issues
Closes #…
