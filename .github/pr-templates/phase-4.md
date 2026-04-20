<!-- PR template for Phase 4: Vendored CDP Engine + Export Dispatcher. See docs/implementation-plan.md § Phase 4. -->

## Task
T-XXX — <title>

## Summary
<What part of the headless export pipeline this PR adds. Note whether vendored code is touched.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] docs/architecture.md §8 (Runtimes) and §9 (Export)
- [ ] skills/stageflip/reference/export-formats/SKILL.md
- [ ] THIRD_PARTY.md §2 (vendored code obligations)

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] `pnpm parity` green on affected fixtures
- [ ] `ffprobe` verifies any produced MP4/MOV/WebM

## Vendored Code (Apache 2.0 obligations)
- [ ] `packages/renderer-cdp/vendor/LICENSE` and `NOTICE` preserved verbatim from upstream
- [ ] Every modified file carries `Modified by StageFlip, YYYY-MM-DD` header
- [ ] Upstream commit hash pinned in `docs/dependencies.md` §5
- [ ] Top-level `NOTICE` includes Hyperframes attribution block
- [ ] THIRD_PARTY.md §2 updated if vendored surface changes

## Export Pipeline Specific
- [ ] Asset preflight rewrites remote URLs to `file://` before capture (T-084a)
- [ ] Unsupported sources (YouTube, arbitrary iframes) either rasterize or fail fast with loss-flag
- [ ] FFmpeg path resolved via `doctor` command; no bundled binary
- [ ] Bake-runtime async jobs settle in preflight, not during capture

## Determinism Audit
- [ ] Export given same RIR produces byte-identical artifact across runs (deterministic seeds, fixed frame timestamps)
- [ ] `--font-render-hinting=none` applied; fonts pre-embedded and verified

## Linked Issues
Closes #…
