# Phase 14 — Asset Generation — closeout handover

**Status**: P14 substantively complete. T-415 → T-448 all merged.
T-449 (this document) lands per memory `feedback_phase_closeout_timing.md`
— phase-N closeout doc lands at phase-N+1 start, not at phase-N end.
Phase 15 has been actively dispatching since 2026-05-11; T-450..T-460
all merged. This doc records the closeout state at the boundary.

**Author**: orchestrator. **Date**: 2026-05-12.

---

## 1. Phase 14 status snapshot — END STATE

| Cluster | Status | Notes |
|---|---|---|
| **α — substrate (T-415..T-425)** | ✅ COMPLETE | ADR-007 (Provider Seam Pattern, meta) + ADR-008 (Asset Generation contract) ratified; `@stageflip/adapters-core` + `@stageflip/asset-gen-contract` + `@stageflip/asset-cache` + schema-side `MediaElement.provenance` slot + `check-asset-licenses` CI gate + capability router + asset-generation handler bundle (#25). |
| **β — 9 reference adapters (T-426..T-435)** | ✅ COMPLETE | Kokoro / Fish Speech / Tripo / Meshy / Seedance / Runway / ACE-Step / YuE / Stable Audio Open. All 9 ship descriptor + provider stub-mode (production wire-up deferred per-adapter); `check-adapter-regression` CI gate ships per-vendor snapshots. |
| **γ — cross-cutting integrations (T-436..T-442)** | ✅ COMPLETE | TTS↔captions bypass-Whisper (eliminates Whisper cost on synthesized audio); 3D↔ThreeSceneClip GLB consumer via asset-cache cacheKey; optimistic placeholder UX for async asset-gen; provenance-aware exporters for IAB display, video (opt-in watermark + sidecar), PPTX `<a:extLst>`; cost-budget surfacing with retry-with-cheaper-provider; SSE streaming agent events (resolves Phase 7 carry-forward). |
| **δ — security + telemetry + GA gates (T-443..T-448)** | ✅ COMPLETE | TenantCostTrackerStore facet; per-modality usage telemetry (`AdapterUsageEvent` + `query_usage_telemetry` tool); adapter sandbox model (`SandboxRunner` per `sandbox.kind` + `TenantAdapterCredentialsStore` + audit emitter); per-provider data-flow security audit (`SecurityManifest` schema + `check-data-flow-security` CI gate + 9 adapter manifests); P14 GA readiness criteria (Category 8 — 11 criteria); P14 documentation pass (user-manual + skill-index + apps/docs). |
| **T-449 closeout handover (this doc)** | ✅ landing now | Per memory: at P15 start. |

**Final P14 ratification status**:
- ADRs 007 + 008 — currently `Proposed`. PO action item: flip to `Accepted` (the only outstanding `check-ga-readiness` Category 8 FAIL, see §3 below).
- 25 PASS / 1 FAIL / 9 WARN on `pnpm check-ga-readiness` for Category 8.
- All 9 reference adapters ship in stub mode. Production wire-up is per-adapter follow-up (no shipping deadline; defer until first paid traffic on the modality).

---

## 2. What shipped this phase (chronological)

P14 took the codebase from "no asset-generation surface" → "9 reference adapters across 5 modalities + provenance-aware exporters + tenant cost / consent / sandbox / telemetry / security audit primitives + GA readiness criteria" in 35 tasks.

### Hard-gate ADRs (T-415, T-416)
- **ADR-007 (Provider Seam Pattern, meta)** — codifies the pattern across P14, P15, P16. Renumbered from plan-stated ADR-006 to resolve a collision with the existing ADR-006 (collab-crdt-transport).
- **ADR-008 (Asset Generation contract)** — folds the source-grounded-providers proposal into a single 786-line ADR (D1-D13).
- **ADR renumber cascade**: ADRs 009, 010 (Phase 15) shifted forward to compensate.

### Substrate packages (T-417..T-425)
- `@stageflip/adapters-core` — `AdapterDescriptor`, `AdapterRegistry`, `CapabilityDescriptorParser`, `LicenseGate`, `FallbackChainExecutor`.
- `@stageflip/asset-gen-contract` — five β modality contracts (TTS / video-gen / music-gen / sfx / three-d) + seven source-grounded provider interfaces + `TenantVoiceConsentStore` facet.
- `@stageflip/asset-cache` — canonical cache-key derivation per ADR-008 §D1 + `InMemoryAssetCacheStore` (Firestore impl deferred).
- Schema-side `MediaElement.provenance` + `Document.research` slots per ADR-008 §D2/§D3 (T-421; structural extension §13 option-3 deferral).
- `check-asset-licenses` CI gate (T-422) — adapter-aware per-modality license whitelist; matches the canonical pattern that later reused for `check-data-flow-security` and inspired the `check-audience-permissions` gate in P15.
- `asset-generation` handler bundle (T-423) — canonical tool bundle #25 (3 tools).
- `reference/asset-providers` auto-gen catalog (T-424) — table of capability/license/cost/latency.
- `@stageflip/capability-router` (T-425) — `AdapterDescriptor` filter + rank engine; FINAL P14 α task; unblocks T-426..T-434.

### 9 reference adapters (T-426..T-434)
| Adapter | Modality | License | Notes |
|---|---|---|---|
| `@stageflip/tts-kokoro` | TTS | Apache 2.0 | First reference adapter |
| `@stageflip/tts-fish-speech` | TTS | Apache 2.0 | Voice cloning (TenantVoiceConsentStore-gated) |
| `@stageflip/3d-tripo` | three-d | proprietary-byo | Quad topology + auto-rigging (characters) |
| `@stageflip/3d-meshy` | three-d | proprietary-byo | Triangle topology (props + environment) |
| `@stageflip/video-seedance` | video-gen | proprietary-byo | 15s 1080p + native audio + lip-sync |
| `@stageflip/video-runway` | video-gen | proprietary-byo | Production-tier, no audio |
| `@stageflip/music-acestep` | music-gen | MIT | First music modality; 5-min track in <10s |
| `@stageflip/music-yue` | music-gen | Apache 2.0 | Attribution required; monetizable |
| `@stageflip/sfx-stable-audio` | sfx | Apache 2.0 | Short-form |

All 9 ship in **stub mode** — production wire-up to the vendor APIs is per-adapter follow-up. Each carries a descriptor + provider impl + stub-{audio,glb,video} fixture + sandbox metadata + (T-446) security manifest.

`check-adapter-regression` CI gate (T-435) closes P14 β with per-vendor snapshots.

### Cross-cutting integrations (T-436..T-442)
- TTS→captions bypass-Whisper integration (T-436) — Kokoro + Fish Speech word-timestamp consumer; eliminates Whisper cost on synthesized audio.
- 3D→ThreeSceneClip GLB consumer (T-437) — Tripo + Meshy mount via asset-cache cacheKey.
- Optimistic placeholder UX (T-438; structural §13 option-3 deferral) — async asset-gen returns placeholder immediately; progressive swap on completion.
- Provenance-aware exporters: IAB display (T-439, FTC + EU AI Act auto-mark); video (T-440, opt-in watermark + sidecar); PPTX (T-441, `<a:extLst>`).
- SSE streaming agent events (T-442) — resolves Phase 7 carry-forward; unlocks T-438 placeholder swaps.

### Security + telemetry + GA (T-443..T-448)
- Cost-budget surfacing (T-443; structural §13 option-3) — `generate_asset` returns `costIncurred`+`budgetRemaining`; agent retries with cheaper provider; `TenantCostTrackerStore` facet.
- Adapter sandbox model (T-444) — `SandboxRunner` per `sandbox.kind` + `TenantAdapterCredentialsStore` + audit emitter; ~2480 LOC; FINAL P14 γ; gates T-446 → T-447.
- Per-modality usage telemetry (T-445) — `AdapterUsageEvent` + `InMemoryEmitter` + `aggregateUsage` + `query_usage_telemetry` tool.
- Per-provider data-flow security audit (T-446) — `SecurityManifest` schema + 9 adapter manifests + `check-data-flow-security` CI gate + inaugural audit report. L-sized.
- P14 GA readiness criteria (T-447) — extends `check-ga-readiness` with Category 8 (11 criteria); inaugural report regen — 25 PASS / 1 FAIL / 9 WARN; sole FAIL is 8.1 (ADRs 007/008 status flip — orchestrator action).
- P14 documentation pass (T-448) — user-manual + skill-index + apps/docs Astro coverage refresh; mirrors the T-412 P13 pattern.

---

## 3. Outstanding P14 work (orchestrator-scheduled)

### 3.1 ADR ratification (single GA-audit FAIL)
- **ADR-007 (Provider Seam Pattern)** — currently `Proposed`. Flip to `Accepted`.
- **ADR-008 (Asset Generation contract)** — currently `Proposed`. Flip to `Accepted`.
- This clears the sole `check-ga-readiness` Category 8 FAIL (criterion 8.1).

### 3.2 Per-adapter production wire-up
Each of the 9 reference adapters ships in stub mode. Production wire-up is per-adapter follow-up:
- No shipping deadline. Defer until first paid traffic on the modality.
- Wire-up tasks are NOT in the Phase 14 numbering — they're carry-forward (e.g., `T-426a Kokoro production wire-up`, `T-427a Fish Speech production wire-up`, etc.).
- Each wire-up should add a per-adapter live-call integration test + flip the descriptor's `mode` from `'stub'` to `'production'` (or whatever the convention crystallises to).

### 3.3 Carry-forward into P15+
- `audienceProvenance` schema slot (T-460, just merged in P15) re-uses the `MediaProvenance` (T-421) shape verbatim — the structural-extension pattern is now battle-tested.
- The `check-asset-licenses` adapter-walk exclusion list grew during P15 (`-contract`, `-shared`); future modality-prefixed sibling packages can extend `NON_ADAPTER_SUFFIXES` rather than require special-cases.

---

## 4. Established workflow conventions (P14 lessons)

These crystallised during P14 dispatching and continued to pay off through P15 α/β:

1. **Serial dispatch** (one PR at a time on substrate-cluster work) avoids §4.2 rebase tax. Cluster H paid 0 rebase tax with serial; Cluster C paid 4-of-6.
2. **§3 lessons baked into compose-bundle dispatches**: registry-count assertion bump + orchestrator wiring as the SECOND register site + tools/SKILL.md regen via `pnpm gen:tool-skills`.
3. **Pre-empt skills-sync drift** — every subagent prompt explicitly cites this; `pnpm skills-sync` after `pnpm gen:tool-skills`. Drift gate hit 5+ times before this became standard.
4. **NEVER `git add -A`** — workspace generates untracked build artifacts (firebase functions lib, next-env.d.ts) that broad sweeps clobber. Per memory `feedback_git_add_specific_paths.md`.
5. **Biome format before commit** — `pnpm lint` (biome check) can pass locally on code CI biome rejects; per memory `feedback_biome_format_before_commit.md`.
6. **`isolation: worktree` agents can't run Bash** — gate-running work routes elsewhere. Per memory `feedback_subagent_worktree_bash.md`.
7. **Background sub-agents share git HEAD** — avoid concurrent git checkout/commit/push. Per memory `feedback_subagent_shared_worktree.md`.
8. **§13 structural-extension deferral (option 3)** — for metadata-only schema extensions (T-421, T-438, T-443, T-460), the §13 obligation is explicitly deferred to downstream consumer tasks; reviewers verify the deferral note + consumer task IDs, not pixel-level evidence.
9. **`gh pr merge` worktree error is harmless** — `fatal: 'main' is already used by worktree` from gh CLI; the merge succeeds on GitHub regardless. Confirm with `gh pr view --json state,mergeCommit`.
10. **render-e2e flake** (`Page.captureScreenshot timed out`) — recurring; standard fix is `gh run rerun <id> --failed`. Hit on T-455, T-498, T-509, T-456 in P14; T-454, T-460 in P15. **NEW lesson**: when render-e2e is the ONLY remaining job for >10 min, it's stuck — cancel + rerun (rather than wait further).
11. **ADR renumber cascade** (P14 hit this once: ADR-007 vs existing ADR-006; renumbered all P14+ ADRs forward) — when a new ADR collides with an existing one, renumber forward + document in plan version note.

---

## 5. Architecture — key files + entry points (P14 surface)

### Substrate packages
- `packages/adapters-core/src/` — `AdapterDescriptor`, `AdapterRegistry`, `CapabilityDescriptorParser`, `LicenseGate`, `FallbackChainExecutor`, `parseSecurityManifest`.
- `packages/asset-gen-contract/src/` — five β modality contracts (`tts-provider.ts`, `video-gen-provider.ts`, etc.); seven source-grounded provider interfaces; `TenantVoiceConsentStore`.
- `packages/asset-cache/src/` — canonical cache-key derivation; in-memory store.
- `packages/capability-router/src/` — three-stage filter + rank engine.

### 9 reference adapters
- `packages/{tts-kokoro,tts-fish-speech,3d-tripo,3d-meshy,video-seedance,video-runway,music-acestep,music-yue,sfx-stable-audio}/src/` — each ships descriptor + provider stub-mode + stub-{audio,glb,video} fixture + sandbox metadata + security manifest.

### Schema-side wiring
- `packages/schema/src/elements/media-provenance.ts` (T-421) — `MediaProvenance` Zod schema; the audience analog (T-460) mirrors this pattern verbatim.
- `Document.research` slot for source-grounded providers.

### Cross-cutting integrations
- `packages/runtimes/interactive/src/clips/voice/` — TTS→captions bypass-Whisper integration.
- `packages/runtimes/interactive/src/clips/three-scene/` — 3D→ThreeSceneClip GLB consumer.
- `packages/optimistic-placeholder/` (T-438) — async asset-gen optimistic UX.
- `packages/export-iab/src/` (T-439), `packages/export-video/src/` (T-440), `packages/export-pptx/src/` (T-441) — provenance-aware exporters.
- `packages/agent/src/streaming-events/` (T-442) — SSE / ReadableStream transport.

### Security + telemetry
- `packages/storage/src/tenant-cost-tracker-store.ts` (T-443).
- `packages/storage/src/tenant-adapter-credentials-store.ts` (T-444).
- `packages/storage/src/tenant-voice-consent-store.ts` (T-419).
- `packages/adapter-sandbox/src/` (T-444) — `SandboxRunner` per `sandbox.kind`.
- `packages/usage-telemetry/src/` (T-445).
- `scripts/check-data-flow-security.ts` (T-446) — CI gate; mirrors `check-asset-licenses` shape.
- `scripts/check-asset-licenses.ts` (T-422) — adapter-walk + per-modality license whitelist.
- `scripts/check-ga-readiness.ts` (T-447) — Category 8 (11 P14 GA criteria).

### Tool bundles
- `packages/engine/src/handlers/asset-generation/` — canonical bundle #25 (3 tools).
- Auto-gen skill at `skills/stageflip/tools/asset-generation/SKILL.md`.

### Orchestrator wiring
- `packages/app-agent/src/orchestrator.ts` — registers all 25 canonical bundles (now 26 with audience-engagement T-457).

### ADRs
- `docs/decisions/ADR-007-provider-seam-pattern.md`
- `docs/decisions/ADR-008-asset-generation.md`

---

## 6. Memory files relevant to P15+ work

The full set in `~/.claude/projects/-Users-mario-projects-stageflip/memory/MEMORY.md` (referenced in CLAUDE.md). The ones MOST relevant to ongoing dispatch:

- `feedback_phase_closeout_timing.md` — phase-N closeout doc lands at phase-N+1 start.
- `feedback_subagent_worktree_bash.md` — `isolation: worktree` agents can't run Bash.
- `feedback_subagent_shared_worktree.md` — background non-worktree sub-agents share git HEAD.
- `feedback_biome_format_before_commit.md` — `pnpm lint` can pass locally where CI biome rejects.
- `feedback_t304_lessons.md` — audit on-disk fixture vocabulary; check for browser-bundle hazards (Node-only `fs`/`path` imports); subpath-export pattern.
- `feedback_git_add_specific_paths.md` — NEVER `git add -A` / `.`.
- `feedback_parity_signoff_doc_is_procedural.md` — preset specs MUST NOT instruct Implementers to append entries to `docs/ops/parity-fixture-signoff.md`; sign-off lives in preset frontmatter only.
- `project_handover_phase9_closeout.md` — phase closeout should include difficulty assessment for remaining phases.

---

## 7. Quick command reference (P15+ standard)

```bash
# Sync main + cut a task branch
git fetch origin main
git checkout -b task/T-XXX-<slug> origin/main

# After tests + impl
pnpm typecheck
pnpm lint
pnpm test
pnpm check-licenses
pnpm check-remotion-imports
pnpm check-determinism
pnpm check-skill-drift
pnpm check-adapter-regression
pnpm check-asset-licenses
pnpm check-data-flow-security
pnpm check-audience-permissions  # new in P15 (T-455)
pnpm check-ga-readiness
pnpm gen:tool-skills              # then commit any regen
pnpm skills-sync                  # then commit any sync
pnpm gen:tool-skills:check
pnpm biome format --write <touched>

# Stage SPECIFIC paths only
git add path/one path/two .changeset/foo.md

# Commit + push + open PR
git push -u origin task/T-XXX-<slug>
gh pr create --title "..." --body "..."

# Monitor + merge
gh pr view <num> --json mergeStateStatus,statusCheckRollup --jq '...'
gh pr merge <num> --squash --delete-branch  # ignore worktree-error

# render-e2e flake
gh run rerun <runId> --failed
```

---

## 8. Phase 15 progress at handover boundary (informational)

P15 entered α 2026-05-11 with ADRs 009 + 010 (T-450 + T-451); the hard gate cleared with T-451 merge. Through 2026-05-12, the following P15 tasks merged:

- T-450 ADR-009 (Audience Backend) — merged
- T-451 ADR-010 (Live Audience Clip Family) — merged
- T-452 `@stageflip/audience-contract` — merged (PR #514)
- T-453 audience backend service — merged (PR #515)
- T-454 `@stageflip/runtimes-audience` — merged (PR #516)
- T-455 `check-audience-permissions` CI rule — merged (PR #517)
- T-456 audience-join UX — merged (PR #518)
- T-457 `audience-engagement` bundle (canonical bundle #26) — merged (PR #519)
- T-458 rate-limit / spam protection — merged (PR #520)
- T-459 result-export — merged (PR #521)
- T-460 schema `AudienceProvenance` — merged (PR #522)

P15 β substantively complete. P15 γ work (T-461..T-471 nine clip families + T-472..T-489) remains — see plan §"Phase 15".

**Remaining-phases risk** (per memory `project_handover_phase9_closeout.md`):
- **P15 γ — clip families (T-461..T-471)**: nine XL/L tasks; each a structural extension §13 with real-render verification. Substantial.
- **P15 δ — Cluster I parity + GA + closeout**: standard cluster pattern.
- **P16 — Bundles & marketplace**: 65 tasks (T-490..T-554); standalone — no dependency on P15 γ pixel-verified clip rendering.

---

## 9. Recommended next-session opening move

1. PO: flip ADR-007 + ADR-008 status `Proposed` → `Accepted` (clears the sole `check-ga-readiness` Category 8 FAIL).
2. Orchestrator: dispatch first P15 γ clip family (recommended start: `T-461 LivePollMultipleChoiceClip` — simplest standard clip; pure layout; smallest §13 surface).
3. Continue serial dispatch through T-462..T-471 in clip-family order; consider parallel after T-472 (static-fallback consolidation) lands.

---

**End of P14 closeout handover.** P14 substantively complete. Outstanding orchestrator-scheduled work: ADR ratification + per-adapter production wire-up. Forward.
