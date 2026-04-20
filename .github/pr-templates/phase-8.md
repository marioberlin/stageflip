<!-- PR template for Phase 8: StageFlip.Video. See docs/implementation-plan.md § Phase 8. -->

## Task
T-XXX — <title>

## Summary
<What this PR contributes to the Video profile, editor tracks, captions, or multi-aspect bounce.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] skills/stageflip/modes/stageflip-video/SKILL.md
- [ ] skills/stageflip/profiles/video/SKILL.md
- [ ] skills/stageflip/concepts/captions/SKILL.md (if captions touched)

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] `pnpm parity` green on audio-sync, captions, and aspect-bounce fixtures

## Video Specific
- [ ] Captions sync ±100 ms verified on at least one fixture
- [ ] Aspect-ratio bounce (9:16 / 1:1 / 16:9) produces consistent hierarchy across sizes
- [ ] Export multi-aspect variants complete in parallel
- [ ] Track types (visual / audio / caption / overlay) enforced by Zod
- [ ] `useMediaSync` verified for any media element added to timeline

## Determinism Audit
- [ ] Audio mixing deterministic across runs
- [ ] Whisper API call wrapped so transcription is cached by content hash (no re-fetch on identical input)

## Linked Issues
Closes #…
