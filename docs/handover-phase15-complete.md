# Phase 15 — Live Audience — closeout handover

**Status**: P15 substantively complete. T-450 → T-488 all merged.
T-489 (this document) lands per memory `feedback_phase_closeout_timing.md`
— phase-N closeout doc lands at phase-N+1 start, not at phase-N end.

**Author**: orchestrator. **Date**: 2026-05-12.

---

## 1. Phase 15 status snapshot — END STATE

| Cluster | Status | Notes |
|---|---|---|
| **α — hard-gate ADRs (T-450, T-451)** | ✅ COMPLETE | ADR-009 (audience backend) + ADR-010 (live audience clip family) ratified `Proposed`; status flip to `Accepted` is orchestrator action (sole remaining P15 GA-audit FAIL). |
| **β — substrate (T-449, T-452..T-460)** | ✅ COMPLETE | `@stageflip/audience-contract`, `apps/api` audience backend service, `@stageflip/runtimes-audience`, `check-audience-permissions` CI rule, audience-join UX (new `apps/audience-join` app + `<AudienceJoinModal>` in editor-shell), `audience-engagement` bundle (canonical bundle #26 — 11 compose_audience_* tools), rate-limit hardening (AbuseTrackingStore + per-clip-kind overrides), result-export endpoint, schema-side `AudienceProvenance`. T-449 P14 closeout handover landed in this cluster per memory. |
| **γ — 11 clip families (T-461..T-471)** | ✅ COMPLETE | 8 standard (LivePoll mc/ot/rating, LiveQA, LiveQuiz, Leaderboard, WordCloud, Survey) + 3 motion-native differentiators (Heatmap canvas raster, ReactionStream shader, AudienceAiPrompt three-state with P14 cache-key reference). Each ships clip-definition + factory + static-fallback + manifest + render-e2e §13 verification. |
| **δ — closeout (T-472..T-489)** | ✅ COMPLETE | static-fallback SVG export consolidation (T-472), quiz fairness scoring (T-473, Kahoot-canon time-bonus + late-joiner + reconnect), Firestore audience-results store (T-474), latency tests (T-475), parity-fixture skeletons (T-476), K6 SLA load-test (T-477), native + 5 vendor adapters (T-478..T-483), WebEmbed allowlist (T-484), vendor parity matrix CI gate (T-485), Cluster I preset cluster (T-486), Cluster I `compose_*` bundle (T-487, canonical bundle #27), Phase 15 GA readiness Category 9 (T-488). |

**Final P15 ratification status**:
- ADRs 009 + 010 — currently `Proposed`. PO action item: flip to `Accepted`.
- Inaugural `pnpm check-ga-readiness` Category 9: 10 PASS / 1 FAIL / 1 WARN. Sole FAIL is 9.1 (ADR status flip — orchestrator action); sole WARN is 9.12 (security review — human-gated).
- 6 audience-backend adapters ship in stub mode. Production wire-up is per-adapter follow-up (T-478a..T-483a; no shipping deadline).
- Cluster I parity goldens UNSIGNED at merge; PO ratification process kicks off post-merge.

---

## 2. What shipped this phase (highlights; 40 tasks merged)

### Hard-gate ADRs (T-450, T-451)
- **ADR-009 (Audience Backend)** — `docs/decisions/ADR-009-audience-backend.md` (~668 lines). Backend service architecture, `AudienceBackendProvider` interface, SLA target (1000 voters, p50<200ms / p95<500ms), rate-limit model, WebSocket transport, persistence model, vendor adapter bridge contract, `AudienceProvenance` preview, 8 `LF-AUDIENCE-*` codes.
- **ADR-010 (Live Audience Clip Family)** — `docs/decisions/ADR-010-live-audience-clip-family.md` (~815 lines). 9 v1 clip families × 11 `AudienceClipKind` discriminants; per-kind `VotePayload` + `AggregationSnapshot` shapes; staticFallback semantics + 3 snapshot policies (final / peak / at-frame); `AudienceProvenance` full schema; motion-native dependencies (T-383 ShaderClip, T-430 Seedance, T-432 ACE-Step).

### Substrate (T-452..T-460)
- `@stageflip/audience-contract` — `AudienceBackendProvider` + `VotePayload` + `AggregationSnapshot` + `AudienceProvenance` preview + 8 `LF-AUDIENCE-*` codes (T-452).
- `apps/api` audience backend service — `/v1/audience/*` REST + WebSocket multiplexer + 7 server-side LF emissions + `TenantSettings.features.audience.*` (T-453).
- `@stageflip/runtimes-audience` — audience-tier runtime + `runAudienceClient` with 6-attempt reconnect budget + 3-state router (live/staticFallback/empty-live-mount) (T-454).
- `check-audience-permissions` CI gate (T-455).
- `apps/audience-join` Next.js voter app + `<AudienceJoinModal>` in editor-shell + `@stageflip/audience-join-shared` (room-code + voter-url helpers) (T-456).
- `audience-engagement` canonical bundle (26th) — 11 `compose_audience_*` tools (T-457).
- `AbuseTrackingStore` facet + escalating-cooldown rate-limit hardening + per-clip-kind voter-rate overrides (reaction-stream 10 Hz) (T-458).
- `GET /v1/audience/sessions/:id/export?format=csv|json` + RFC 4180 CSV helper (T-459).
- Schema-side `AudienceProvenance` canonical declaration (T-460; structural §13 option-3 deferral).

### Clip families (T-461..T-471) — all 11 motion-native + standard
| T | Family | Static-fallback rendering |
|---|---|---|
| T-461 | LivePollMultipleChoice | horizontal bar chart |
| T-462 | LivePollOpenText | top-N text list with counts |
| T-463 | LivePollRating | histogram + mean + highlighted mode |
| T-464 | LiveQA | question cards + upvotes + tabbed Submit/Browse voter UI |
| T-465 | LiveQuiz | per-question result blocks with correct-option highlight |
| T-466 | Leaderboard | ranked list with medal-style highlights (first view-only clip) |
| T-467 | WordCloud | flex-wrap font-sized text spans |
| T-468 | Survey | multi-question dashboard with type-dispatched mini-renderers |
| T-469 | Heatmap | **canvas raster** Gaussian-kernel splat + blue→red colormap (first canvas-rendering clip; marquee differentiator #1) |
| T-470 | ReactionStream | **ShaderClip** fragment-shader particle storm (marquee differentiator #2; depends on T-383) |
| T-471 | AudienceAiPrompt | **three-state** voting/generation/final dispatcher + per-modality asset embedding (marquee differentiator #3; depends on T-430 + T-432) |

Each clip family ships render-e2e.test.ts as the §13 option-1 verification.

### Closeout cluster (T-472..T-488)
- Static-fallback SVG export consolidation across all 11 clip kinds + PPTX exporter integration (T-472).
- Kahoot-canon quiz scoring + late-joiner lock + disconnect-reconnect preservation (T-473).
- Firestore-backed `AudienceResultsStore` (T-474).
- Opt-in vitest latency harness asserting ADR-009 §D4 budget (T-475).
- 11 parity-fixture skeletons + `pnpm generate-audience-clip-parity-fixture` CLI (T-476; §13 deferred to PO sign-off post-merge).
- K6 1000-voter SLA load-test + workflow_dispatch GH Action (T-477).
- `@stageflip/audience-native` (T-478) — first concrete `AudienceBackendProvider`; 11 clip kinds; motion-native.
- 5 vendor adapters (T-479 Slido, T-480 Mentimeter, T-481 Poll Everywhere, T-482 Vevox, T-483 Wooclap) — 8 clip kinds each (Vevox 7 — omits leaderboard); motion-native blocked at vendor per ADR-010 §D7.
- `AUDIENCE_BACKEND_ORIGINS` allowlist for WebEmbed audience-network permission (T-484).
- `check-audience-vendor-parity` CI gate verifying ADR-009 §D8 vendor parity matrix (T-485).
- Cluster I preset cluster (6 named compositions) + `audience` added to PRESET_CLUSTERS + `audience-network` to PRESET_PERMISSIONS (T-486).
- `cluster-i-compose` canonical bundle (27th) — 3 compose tools binding semantic briefs to ratified preset ids (T-487).
- Phase 15 GA readiness Category 9 (12 criteria; 10 PASS / 1 FAIL / 1 WARN) (T-488).

---

## 3. Outstanding P15 work (orchestrator-scheduled)

### 3.1 ADR ratification (single GA-audit FAIL)
- **ADR-009 (Audience Backend)** — currently `Proposed`. Flip to `Accepted`.
- **ADR-010 (Live Audience Clip Family)** — currently `Proposed`. Flip to `Accepted`.
- Together with the still-pending P14 ADRs 007/008, this is the orchestrator's GA punch list across both phases.

### 3.2 Cluster I parity-fixture sign-off (PO process)
- 11 fixture skeletons at `parity-fixtures/audience/<kind>/` ship UNSIGNED.
- Goldens auto-generate on first CI render via the new `pnpm generate-audience-clip-parity-fixture` CLI.
- PO ratification signs them off via `manifest.auditTagged` (NOT via `docs/ops/parity-fixture-signoff.md` per memory `feedback_parity_signoff_doc_is_procedural.md`).

### 3.3 GA security review (T-488 §9.12 WARN)
- Auth flow (presenter token + voter session token; per-IP join cap).
- WebSocket abuse vectors (ADR-009 §D6 — 6-attempt reconnect budget; close codes 4000-4003).
- Voice-clone (if AudienceAiPromptClip uses TTS production wire-up, T-471a).
- T-488 Category 9 §9.12 carries this as WARN until human sign-off recorded out-of-band.

### 3.4 Per-vendor production wire-up
Each of the 5 vendor adapters ships in stub mode. Production REST integration is per-vendor follow-up:
- T-479a Slido REST + OAuth audit
- T-480a Mentimeter REST
- T-481a Poll Everywhere REST
- T-482a Vevox REST (live-quiz partial-support nuance)
- T-483a Wooclap REST

No shipping deadline; deferred until tenant demand justifies the audit cost.

### 3.5 Carry-forward into P16
- ReactionStreamClip's fragment shader is a minimal v1 stand-in — Phase 16 marketplace can ship polished shader variants.
- AudienceAiPromptClip's cache-key URL resolution (cache:// → http://...) is deferred to a future task.
- Heatmap 3D-scene tap (vs. flat image) is out of v1; future hardening.
- Cluster I motion-native presets (heatmap / reaction-stream / audience-ai-prompt) absent from v1 — Phase 16 marketplace packs add them.

---

## 4. Established workflow conventions (P15 lessons + reinforcement)

These continued to pay off through P15:

1. **Serial dispatch** — one PR at a time; avoids §4.2 rebase tax. 39 P15 PRs merged this loop session with ZERO rebase conflicts.
2. **§3 lessons baked into compose-bundle dispatches** — registry count bump (catalog.ts), orchestrator wiring (the SECOND register site), gen-tool-skills regen. Now four register sites for canonical bundles: catalog.ts + engine/index.ts + app-agent/orchestrator.ts + scripts/gen-tool-skills.ts + scripts/sync-skills.ts.
3. **happy-dom factory-test flake** — recurring "AsyncTaskManager destroyed" cascade on factory tests. **NEW lesson**: `setTimeout(r, 50)` (vs the original `r, 0`) gives React effects time to run on slow CI runners; bumped 44 sites across 11 clip families in T-475's flake-fix sub-commit.
4. **Biome-format scope** — workspace-wide `pnpm biome format --write` swept a RIR golden fixture in T-469, breaking the byte-equality goldens.test.ts. **Lesson reinforced** (now memory-class): scope biome-format to actually-touched dirs only.
5. **Adapter package conventions** — packages matching modality prefixes (audience-*, tts-*, etc.) get discovered by check-asset-licenses + check-data-flow-security. Helper packages (audience-contract, audience-join-shared) need explicit suffix exclusion (-contract, -shared) per T-484-class fix.
6. **§13 verification scaling** — clip families × 11 kinds → 11 render-e2e.test.ts files. Each asserts on observable DOM + pixel-bucket non-blankness (DOM proxy where WebGL/canvas-2D unavailable in happy-dom). PO ratification post-merge is the formal §13 sign-off vehicle for the Cluster-I-level parity fixtures.
7. **Audience-backend modality license whitelist** — added during T-415 ADR drafting; `proprietary-byo` admitted, vendor adapters use it.
8. **GA-readiness category cadence** — Category 8 (T-447 / P14) + Category 9 (T-488 / P15) per phase. Each ~12 criteria; ~150 LOC. Same shape (ADRs + deliverables + CI gates + closeout + WARN-gated human items).
9. **Vendor parity matrix as CI gate** — T-485's `check-audience-vendor-parity` mechanically verifies the ADR-009 §D8 matrix. New vendor adapter PR? Extend the matrix; gate enforces consistency.
10. **Phase closeout-at-N+1-start** — T-449 P14 closeout landed at P15 start; T-489 (this doc) lands at P16 start. Memory `feedback_phase_closeout_timing.md` baked.

---

## 5. Architecture — key files + entry points (P15 surface)

### Substrate packages
- `packages/audience-contract/src/` — `AudienceBackendProvider`, `VotePayload`, `AggregationSnapshot`, `AudienceProvenance`, `LF_AUDIENCE_CODES`, `quiz-fairness.ts`, `audience-backend-origins.ts`.
- `packages/runtimes/audience/src/` — `audience-client.ts`, `registry.ts`, `static-fallback.ts`, `three-state-router.ts`, `audience-runtime.ts`, `clip-manifest.ts`, `export-frame.ts` + 11 per-clip-family dirs (manifest + clip-definition + factory + static-fallback + export-frame + render-e2e.test).
- `packages/audience-native/`, `packages/audience-slido/`, `packages/audience-mentimeter/`, `packages/audience-polleverywhere/`, `packages/audience-vevox/`, `packages/audience-wooclap/` — 6 adapter packages.
- `packages/audience-join-shared/src/` — `room-code.ts`, `voter-url.ts`.

### apps
- `apps/api/src/routes/audience-sessions.ts` + `audience-ws.ts` + `audience-rate-limit.ts` + `audience-export-csv.ts` + `audience-quiz-state.ts`.
- `apps/audience-join/` — Next.js voter app + Playwright smoke.

### Schema-side
- `packages/schema/src/elements/audience-provenance.ts` + 11 audience-clip element variants.
- `packages/schema/src/presets/frontmatter.ts` — `'audience'` added to `PRESET_CLUSTERS`, `'audience-network'` to `PRESET_PERMISSIONS`.

### Storage facets
- `packages/storage/src/audience-results.ts` + `audience-results-store.ts` + `abuse-tracking-store.ts`.
- `packages/storage-firebase/src/audience-results.ts` — Firestore impl.

### Skills + presets
- `skills/stageflip/presets/audience/` — cluster SKILL + 6 preset markdown files.
- `skills/stageflip/tools/audience-engagement/SKILL.md` + `skills/stageflip/tools/cluster-i-compose/SKILL.md` (both auto-gen).

### Parity fixtures
- `parity-fixtures/audience/<kind>/` × 11 — manifest + snapshot + thresholds.
- `parity-fixtures/audience/README.md`.

### CI gates
- `scripts/check-audience-permissions.ts` (T-455) — manifest scan; 11 clips inspected.
- `scripts/check-audience-vendor-parity.ts` (T-485) — ADR-009 §D8 matrix verification; 6 adapters inspected.
- `scripts/check-asset-licenses.ts` (T-422; extended in T-452 + T-456) — 15 adapters inspected.
- `scripts/check-data-flow-security.ts` (T-446; extended in T-478..T-483) — perimeter manifests for 15 adapters.
- `scripts/check-ga-readiness.ts` (T-447 + T-488) — Categories 1-9.

### ADRs
- `docs/decisions/ADR-009-audience-backend.md`.
- `docs/decisions/ADR-010-live-audience-clip-family.md`.

---

## 6. Quick command reference (P15 + extends T-449 P14 list)

```bash
# Sync main + cut a task branch
git fetch origin main
git checkout -b task/T-XXX-<slug> origin/main

# Standard workspace gates (UNCHANGED from P14)
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
pnpm check-ga-readiness

# P15-specific gates
pnpm check-audience-permissions       # T-455
pnpm check-audience-vendor-parity     # T-485

# Tool-skills + sync
pnpm gen:tool-skills                  # 27 bundles
pnpm gen:tool-skills:check
pnpm skills-sync

# Cluster I parity-fixture generation
pnpm generate-audience-clip-parity-fixture --clip-kind=live-poll-multiple-choice

# Latency / SLA testing
pnpm --filter @stageflip/app-api test:latency
pnpm audience-sla-loadtest:smoke

# Biome format — SCOPE TO TOUCHED DIRS (per T-469 lesson)
pnpm biome format --write packages/<touched>/ apps/<touched>/

# Stage SPECIFIC paths (NEVER `git add -A`)
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

## 7. Phase 15 deliverable totals (vs. P14)

| Metric | P14 | P15 |
|---|---|---|
| Tasks | 35 | 40 |
| New ADRs | 2 (ADR-007, ADR-008) | 2 (ADR-009, ADR-010) |
| New canonical tool bundles | 1 (asset-generation #25) | 2 (audience-engagement #26, cluster-i-compose #27) |
| Reference adapter packages | 9 | 6 (1 native + 5 vendor) |
| Schema-side variants | 1 (MediaProvenance slot) | 12 (AudienceProvenance + 11 audience clip variants) |
| Preset markdown files | 0 | 6 (Cluster I) |
| New CI gates | 3 (check-asset-licenses, check-data-flow-security, check-adapter-regression) | 2 (check-audience-permissions, check-audience-vendor-parity) |
| Parity-fixture skeletons | 0 | 11 (audience/) |
| GA-readiness category | Category 8 (11 criteria) | Category 9 (12 criteria) |

---

## 8. Remaining-phases risk

Per memory `project_handover_phase9_closeout.md` — closeout handover includes difficulty assessment.

- **Phase 16 (Bundles & Marketplace)**: 65 tasks (T-490 → T-554). Standalone — no dependency on P15 production wire-up or human security review. Six first-party launch packs (News Pro / Sports Networks / Creator Style / Earnings & Investor / Wedding & Events / Frontier Effects). License runtime gates paywall-locked clips at instantiation. Marketplace UX. **Estimated difficulty: moderate**. Per-pack work is well-bounded; the runtime license gate is the novel piece.

The carry-forward from P15 that affects P16:
- Cluster I motion-native presets land in Phase 16 marketplace packs (not in v1 Cluster I).
- Per-vendor production wire-up (T-479a..T-483a) is opportunistic — first paid tenant on a vendor triggers the wire-up + audit.

---

## 9. Recommended next-session opening move

1. **Orchestrator**: flip ADR-007 + ADR-008 + ADR-009 + ADR-010 status `Proposed` → `Accepted` (clears the only 2 `check-ga-readiness` FAIL criteria: 8.1 + 9.1).
2. **PO**: ratify the Cluster I parity-fixture goldens via `manifest.auditTagged` updates (post-merge process; goldens auto-generate on first CI render).
3. **Orchestrator**: dispatch first P16 task (per `docs/implementation-plan.md` §"Phase 16").

P15 substantively complete. Forward to P16.

---

**End of P15 closeout handover.** P15 substantively complete. Outstanding orchestrator-scheduled work: ADR ratification (4 ADRs total across P14 + P15) + Cluster I parity sign-off + human security review for T-488 §9.12 + per-vendor production wire-up (no deadline).
