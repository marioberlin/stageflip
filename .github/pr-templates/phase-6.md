<!-- PR template for Phase 6: Slide Migration (greenfield shell + component port). See docs/implementation-plan.md § Phase 6. -->

## Task
T-XXX — <title>

## Summary
<Which SlideMotion component is being ported, or which greenfield editor-shell subsystem is being added.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] skills/stageflip/modes/stageflip-slide/SKILL.md
- [ ] docs/migration/editor-audit.md (T-120 output)
- [ ] _component-specific skill if the ported component has one_

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] `pnpm parity` green if the ported component affects rendering
- [ ] Playwright E2E green (new deck / add slide / edit text / preview / export PNG)

## Port Specific
- [ ] Component rewritten against new RIR + frame-runtime + storage contract — **no SlideMotion imports remain**
- [ ] i18n strings go through `t('key')`; no bare literal UI strings
- [ ] Keyboard shortcuts registered via `useRegisterShortcuts` (no raw `addEventListener('keydown')`)
- [ ] Jotai atoms scoped per component; no cross-component mutable globals
- [ ] Abyssal Clarity visual language preserved
- [ ] Undo/redo works via `fast-json-patch` integration

## Determinism Audit
- [ ] Editor live preview uses frame-runtime; no direct DOM animation timers
- [ ] `useMediaSync` used for any `<video>`/`<audio>` interaction

## Prior Art Read
- Path in `reference/slidemotion/` that was read: <path>
- Confirmed implementation is a fresh port against new APIs (not copy-paste)

## Linked Issues
Closes #…
