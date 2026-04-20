<!-- PR template for Phase 9: StageFlip.Display. See docs/implementation-plan.md § Phase 9. -->

## Task
T-XXX — <title>

## Summary
<What this PR contributes to the Display profile, multi-size canvas, HTML5 zip export, or compliance validation.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] skills/stageflip/modes/stageflip-display/SKILL.md
- [ ] skills/stageflip/profiles/display/SKILL.md
- [ ] skills/stageflip/concepts/display-budget/SKILL.md

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] `pnpm parity` green on display fixtures
- [ ] **IAB/GDN validators green** on produced ZIPs

## Display Specific (file-size critical)
- [ ] Each produced banner ≤ 150 KB gzipped (300×250 / 728×90 / 160×600 — baseline)
- [ ] External fonts obey `DisplayContent.budget.externalFontsAllowed` + `externalFontsKbCap`
- [ ] Assets inlined when `assetsInlined: true`
- [ ] Fallback generated (static PNG + animated GIF from midpoint frame)
- [ ] `clickTag` convention honored
- [ ] Minifiers (unused CSS, JS mangle, `sharp`-optimized images) actually shrink output measurably

## Determinism Audit
- [ ] Same input RIR + budget → identical ZIP contents byte-for-byte
- [ ] `sharp` settings pinned; no version-dependent quantization drift

## Linked Issues
Closes #…
