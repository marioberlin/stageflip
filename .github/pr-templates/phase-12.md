<!-- PR template for Phase 12: Collab + Hardening + Blender. See docs/implementation-plan.md § Phase 12. -->

## Task
T-XXX — <title>

## Summary
<What this PR adds: CRDT sync, presence, auth/tenancy, rate limiting, observability, Blender bake runtime, render-farm deployment, billing, load testing, or storage adapter work.>

## Skills Read (Reviewer verifies)
- [ ] CLAUDE.md
- [ ] docs/architecture.md §7 (Storage) and §10 (Observability)
- [ ] skills/stageflip/concepts/collab/SKILL.md (if Yjs/presence)
- [ ] skills/stageflip/concepts/auth/SKILL.md (if auth/tenancy)
- [ ] skills/stageflip/runtimes/blender/SKILL.md (if bake runtime)

## Acceptance Criteria (copied verbatim from task spec)
- [ ] …

## Quality Gates
- [ ] `corepack pnpm typecheck` / `lint` / `test` green, ≥85% coverage
- [ ] `corepack pnpm check-licenses` / `check-remotion-imports` / `check-determinism` / `check-skill-drift` green
- [ ] Load test (K6) green against declared SLOs (if endpoint added/changed)
- [ ] Security review complete for any new surface (auth, billing, public API)

## Hardening Specific
- [ ] CRDT deltas exercise the storage contract's `applyUpdate`/`subscribeUpdates`
- [ ] Presence data lives in Realtime Database, not Firestore (per architecture §7)
- [ ] Rate limits declared per user / org / key; documented in `skills/stageflip/concepts/rate-limits/SKILL.md`
- [ ] OpenTelemetry spans added on hot paths; Sentry alerts configured for new error classes
- [ ] BigQuery export schema updated if new telemetry event added
- [ ] GDPR data residency respected for EU Firestore region (if applicable)
- [ ] Backup + point-in-time recovery verified for any new critical dataset

## Blender / Render Farm
- [ ] BullMQ queue shape matches bake-runtime scaffolding (T-089)
- [ ] Worker Docker image reproducibly built; GPU drivers pinned
- [ ] Render-farm failover paths tested

## Linked Issues
Closes #…
