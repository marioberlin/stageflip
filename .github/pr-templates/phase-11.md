<!-- PR template for Phase 11: Importers. See docs/implementation-plan.md § Phase 11. -->

## Task
T-XXX — <title>

## Summary
<Which importer (PPTX / Google Slides / Hyperframes HTML / SlideMotion legacy) this PR touches.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] skills/stageflip/workflows/import-<kind>/SKILL.md
- [ ] skills/stageflip/concepts/loss-flags/SKILL.md
- [ ] skills/stageflip/concepts/design-system-learning/SKILL.md (if theme learning touched)

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] Import fixtures green — at least one from each supported source format

## Importer Specific
- [ ] Every import step emits loss flags (with severity + recovery suggestion)
- [ ] Nested group transforms accumulated correctly (T-241a pattern for OOXML)
- [ ] Unsupported shapes either rasterized from thumbnail or fail with a loss-flag
- [ ] AI-QC loop (Gemini multimodal convergence) converges within max iterations; diverging inputs fail fast
- [ ] Asset extraction uploads to Firebase Storage with content-hash dedup
- [ ] Theme learning pipeline steps documented; each step's output is reproducible

## License & Provenance
- [ ] PPTX parsing uses permitted libs (fast-xml-parser + jszip)
- [ ] Google Slides OAuth scopes are minimum needed (read-only by default)

## Determinism Audit
- [ ] Same source file + same version of importer → same canonical output (deterministic id assignment, stable asset hashes)

## Linked Issues
Closes #…
