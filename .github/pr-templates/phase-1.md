<!-- PR template for Phase 1: Schema + RIR + Determinism Foundation. See docs/implementation-plan.md § Phase 1. -->

## Task
T-XXX — <title>

## Summary
<What this PR adds to the canonical schema, RIR compiler, determinism shim, or storage contract.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] docs/architecture.md §5 (Schema + RIR), §6 (Determinism), §7 (Storage)
- [ ] skills/stageflip/concepts/schema/SKILL.md
- [ ] skills/stageflip/concepts/rir/SKILL.md
- [ ] skills/stageflip/concepts/determinism/SKILL.md
- [ ] _other skills cited by task_

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` exit 0 (strict, no `any`, no `@ts-ignore`)
- [ ] `corepack pnpm lint` exit 0 (Biome)
- [ ] `corepack pnpm test` exit 0, ≥85% line coverage on changed files
- [ ] `corepack pnpm check-licenses` exit 0
- [ ] `corepack pnpm check-remotion-imports` exit 0
- [ ] `corepack pnpm check-determinism` exit 0
- [ ] `corepack pnpm check-skill-drift` exit 0

## Schema / RIR Specific
- [ ] If element types added: round-trip tests cover all 11 × all animations × all timings
- [ ] If RIR compiler changed: golden fixture tests updated
- [ ] If storage adapter added: all 3 contract methods implemented (snapshot / delta / patch)
- [ ] Zod schemas named consistently; every public type has TSDoc

## Determinism Audit
- [ ] No `Date.now()` / `new Date()` / `performance.now()` / `Math.random()` / `fetch()` / `requestAnimationFrame` / `setTimeout` / `setInterval` in package source (shim/handler sites only, marked with `// determinism-safe: <reason>`)
- [ ] ESLint scoped rule passes (`check-determinism`)

## License & Provenance
- [ ] Every new dep whitelisted; added to `docs/dependencies.md`
- [ ] No code copied from `remotion` or `@remotion/*` docs/source
- [ ] Prior-art URLs read listed below

## Prior Art Read (URLs only, no source copy)
- <url>

## Linked Issues
Closes #…
