<!-- docs/handover-phase16-complete.md — Phase 16 (Pack Marketplace) closeout handover (T-553). -->

# Phase 16 — Pack Marketplace — closeout handover

**Status**: P16 substantively complete. T-493 → T-552 all merged.
T-553 (this document) lands per memory `feedback_phase_closeout_timing.md`
— phase-N closeout doc lands at phase-N+1 start, not at phase-N end. P17 is
not defined; per task spec, this doc ships at "first pack-extension PR if
no P17."

**Author**: orchestrator. **Date**: 2026-05-14.

---

## 1. Phase 16 status snapshot — END STATE

| Cluster | Status | Notes |
|---|---|---|
| **α — hard-gate ADRs (T-490, T-491, T-492)** | ✅ COMPLETE | ADR-012 (Bundle Format & License Runtime), ADR-013 (First-party Pack Catalogue & Pricing Tiers), ADR-014 (Marketplace — Hosting + Distribution) all ratified `Proposed`; status flip to `Accepted` is orchestrator action (sole remaining P16 GA-readiness FAIL surface beyond legal sign-off). |
| **β — publishing tooling (T-493..T-505)** | ✅ COMPLETE | 13 tasks. `@stageflip/pack-format`, `@stageflip/pack-loader`, license runtime in `@stageflip/engine`, `@stageflip/pack-cli`, `@stageflip/pack-signing`, `check-pack-integrity` CI gate, `@stageflip/pack-publish-cli`, license-template generator, version compatibility matrix, `@stageflip/pack-telemetry`, `@stageflip/pack-discovery`, `@stageflip/pack-trial`. 8 `LF-PACK-*` codes catalogued. |
| **γ — first-party launch packs (T-506..T-535)** | ✅ COMPLETE | 30 tasks → 6 first-party packs at v0.2.0 GA. Each pack ships skill-tree contributions per CLAUDE.md §5 (`skills/stageflip/concepts/pack-<id>/SKILL.md` + per-preset entries). Cluster I motion-native presets land via Frontier Effects per P15 carry-forward. |
| **δ — marketplace + lock-in (T-536..T-552)** | ✅ COMPLETE | 17 tasks. Registry server, Stripe, browsing UI, npm-path, upgrade-planner, telemetry dashboard, admin pack inventory, tier system, conversion + churn, refunds + disputes, editor pack-discovery surface, CLAUDE.md §5 update, `check-skill-drift` per-pack extension, parity validator, GA-readiness audit + legal review file, pack-author guide, per-pack release process. |

**Final P16 ratification status**:
- ADRs 012 + 013 + 014 — currently `Proposed`. PO/orchestrator action item: flip to `Accepted`.
- Inaugural `pnpm check-marketplace-ga-readiness` (T-550): 9 PASS / 1 WARN / 0 FAIL. Sole WARN is the legal-clause sign-off ledger at `docs/legal-review-marketplace.md` (forward-compatible default; unsigned clauses surface `warn`, never fail).
- `--require-legal-signoff` flag wired into the GA-launch checklist runbook only — NOT into routine CI.
- 11 commercial-terms clauses in `docs/legal-review-marketplace.md` UNSIGNED at merge (`pending-counsel-review`); counsel sign-off process kicks off post-merge.

---

## 2. What shipped this phase (highlights; 60 tasks merged across β/γ/δ)

### β — Publishing tooling (T-493..T-505)
- `skills/stageflip/concepts/bundles/SKILL.md` — bundle concept skill (T-493).
- **`@stageflip/pack-format`** — manifest spec + signature scheme + Zod validators per ADR-012 (T-494). Catalogues the `LF-PACK-*` code family.
- **`@stageflip/pack-loader`** — extends skill-tree loader to discover `~/.stageflip/packs/**`; the loader is the mechanism CLAUDE.md §5 cites for installed packs contributing into the tenant's effective context (T-495).
- License runtime in `@stageflip/engine` — refuses to instantiate paywall-locked clips when license absent or expired per ADR-012 §D7 (T-496).
- **`@stageflip/pack-cli`** — `install` / `list` / `info` / `remove` / `verify`; `upgrade` subcommand added in T-540 (T-497).
- **`@stageflip/pack-signing`** — first-party signing key + verifier (T-498).
- `check-pack-integrity` CI gate — manifest + signature + license-claim + version-compatibility validation (T-499).
- **`@stageflip/pack-publish-cli`** — third-party publishing tooling: `validate` / `sign` / `publish` (T-500).
- License-template generator — boilerplate per tier (commercial / attribution / non-commercial) (T-501).
- Pack version compatibility matrix — engine version ↔ pack-format-version table (T-502).
- **`@stageflip/pack-telemetry`** — install / activation / usage tracking; opt-out per ADR-001 (T-503).
- **`@stageflip/pack-discovery`** — discovery API for editor surface listings + recommendations (T-504).
- **`@stageflip/pack-trial`** — time-limited activation + watermarked output; LF-PACK-TRIAL-EXPIRED + LF-PACK-TRIAL-WATERMARK (T-505).

ADR anchors: ADR-012 (bundle format + license runtime), ADR-013 (catalogue + pricing tiers).

### γ — First-party launch packs (T-506..T-535)
30 tasks → 6 packs at v0.2.0 GA. Each ships `skills/stageflip/concepts/pack-<id>/SKILL.md` + per-preset entries per CLAUDE.md §5 contract.

- **`@stageflip/pack-news-pro`** (SKU `news-pro-1y`, Cluster A primary) — Sky News register (T-507), ITV register (T-508), RAI register (T-509), Premium News Ticker preset (T-510). v0.2.0 GA via T-510 closeout.
- **`@stageflip/pack-sports-networks`** (SKU `sports-networks-1y`, Cluster F) — NBA Pro register (T-512), NFL Pro register (T-513), MLB register (T-514), F1 Pro register + AR formations bundle integration (T-515). Skeleton T-511.
- **`@stageflip/pack-creator-style`** (SKU `creator-style-1y`, Cluster B + Pattern C) — MKBHD-pro register (T-517), Vox-deluxe register (T-518), Linus-Tech-Tips-pro register (T-519), prestige-creator preset (T-520). Skeleton T-516.
- **`@stageflip/pack-finance`** (SKU `finance-1y`, Cluster G + Cluster I bridge) — earnings-call composition templates (T-522), investor-deck composition templates (T-523), Bloomberg-pro adapter premium tier (T-524), finance-domain semantic-tool extensions (T-525). Skeleton T-521.
- **`@stageflip/pack-wedding-events`** (SKU `wedding-events-1y`, Cluster E) — theme variants rustic/modern/classic (T-527), composition templates (T-528), wedding-specific transitions + bumpers (T-529), pre-licensed audio bed library (T-530). Skeleton T-526.
- **`@stageflip/pack-frontier-fx`** (SKU `frontier-fx-1y`, Cluster D + custom shaders) — premium shaders bundle (T-532), pre-licensed 3D asset library (T-533), premium ReactionStream particle physics presets (T-534), premium TitleSequence templates (T-535). Skeleton T-531. Carries P15 motion-native preset deferral (Cluster I reaction-stream / heatmap / audience-ai-prompt presets land here).

SKU registry: `packages/marketplace-stripe/src/pricing/sku-map.ts` `FIRST_PARTY_SKU_MAP` — 6 entries; tier `paid-per-tenant` for all; placeholder `priceId` values are wired to live Stripe Price ids via the same `createSkuMap` constructor at production cutover.

### δ — Marketplace + lock-in (T-536..T-552)
- **`@stageflip/marketplace-registry`** — registry server per ADR-014 (T-536).
- **`@stageflip/marketplace-stripe`** — Stripe payment integration; webhook handlers for checkout / subscription / refund events; SKU map (T-537).
- Pack browsing / search UI in `apps/docs` (T-538).
- **`@stageflip/marketplace-npm`** — npm-path: auth token management + license-claim verification; LF-NPM-TOKEN-MISSING (T-539).
- Pack upgrade / migration tooling — `pack upgrade` subcommand + 4-status `planUpgrade` (`compatible` / `needs-upgrade` / `blocked` / `manifest-version-incompatible`) (T-540).
- **`@stageflip/marketplace-telemetry-dashboard`** — first-party packs only initially (T-541).
- Per-tenant pack inventory in `apps/api` admin surface (T-542).
- **`@stageflip/marketplace-tier`** — 4-state tier system per ADR-012 (`free` / `paid` / `enterprise` / `none`) + 5-state `TenantEntitlement` (`active` / `lapsed` / `revoked` / `pending` / `trial`) (T-543).
- **`@stageflip/marketplace-conversion`** — trial-to-paid conversion + churn recovery; `DEFAULT_CHURN_STRATEGY` (3 retries / 1h base / 24h max / exponential backoff) (T-544).
- **`@stageflip/marketplace-refunds`** — refund + dispute handling; `DEFAULT_REFUND_POLICY` (7-day full / 30-day pro-rata / 60-day cutoff) (T-545).
- Editor pack-discovery surface — recommendations based on cluster usage (T-546).
- CLAUDE.md §5 update — skill tree explicitly includes installed packs (T-547).
- `check-skill-drift` extension — packs are loaded but tier-coverage gate is core-only; per-pack drift surfaces as warnings, never fails the build (T-548).
- **`@stageflip/pack-parity-validator`** — pack-shipped fixtures must pass our PSNR thresholds; `DEFAULT_CLUSTER_THRESHOLDS` for clusters a–i + default fallback (T-549).
- GA readiness audit + legal review ledger — `pnpm check-marketplace-ga-readiness` (9 categories) + `docs/legal-review-marketplace.md` (T-550).
- `docs/pack-author-guide.md` — pack authoring documentation (T-551).
- Per-pack release process docs — semantic versioning + changelog format (T-552).

---

## 3. Architectural decisions ratified or deferred

- **ADR-012 (Bundle Format & License Runtime)** — `docs/decisions/ADR-012-bundle-format-license-runtime.md`. Status: **Proposed**. Orchestrator action item: flip to `Accepted`.
- **ADR-013 (First-party Pack Catalogue & Pricing Tiers)** — `docs/decisions/ADR-013-pack-catalogue-pricing-tiers.md`. Status: **Proposed**. Orchestrator action item: flip to `Accepted`.
- **ADR-014 (Marketplace — Hosting + Distribution)** — `docs/decisions/ADR-014-marketplace.md`. Status: **Proposed**. Orchestrator action item: flip to `Accepted`.
- **8 LF-PACK-* codes** catalogued in `@stageflip/pack-format`: 5 from ADR-012 §D10 + 2 from T-505 trial mode (`LF-PACK-TRIAL-EXPIRED`, `LF-PACK-TRIAL-WATERMARK`) + 1 from T-539 npm-path (`LF-NPM-TOKEN-MISSING`).
- **Tier system 4 states** (T-543): `free` / `paid` / `enterprise` / `none`.
- **5-state `TenantEntitlement`** (T-543): `active` / `lapsed` / `revoked` / `pending` / `trial`.
- **4-status `planUpgrade`** (T-540): `compatible` / `needs-upgrade` / `blocked` / `manifest-version-incompatible`.
- **`DEFAULT_REFUND_POLICY`** (T-545): 7-day full refund window / 30-day pro-rata window / 60-day cutoff.
- **`DEFAULT_CHURN_STRATEGY`** (T-544): 3 retry attempts / 1h base interval / 24h max interval / exponential backoff.
- **`DEFAULT_CLUSTER_THRESHOLDS`** (T-549): per-cluster PSNR/SSIM thresholds for clusters a–i + default fallback.

---

## 4. Quality gates as of Phase 16 close

| Gate | Status | Notes |
|---|---|---|
| `pnpm typecheck` | PASS | TS strict across all P16 packages. |
| `pnpm lint` | PASS | Biome. |
| `pnpm test` | PASS | Vitest; ≥85% coverage on changed code. |
| `pnpm check-licenses` | PASS | Whitelist only. |
| `pnpm check-remotion-imports` | PASS | Zero matches. |
| `pnpm check-determinism` | PASS | Engine + frame-runtime + clip code. |
| `pnpm check-skill-drift` | PASS | Core only; per-pack drift surfaces as warnings (T-548). |
| `pnpm gen:tool-skills:check` | PASS | 27 bundles unchanged in P16 (no new canonical bundles). |
| `pnpm check-pack-integrity` | PASS (new T-499) | Manifest + signature + license-claim + version-compatibility validation. |
| `pnpm check-marketplace-ga-readiness` | 9 PASS / 1 WARN / 0 FAIL (new T-550) | WARN = legal-clause sign-off ledger pending. |

T-548 per-pack skill drift is warns-only by design — pack authors own their own skill drift; the workspace gate is core-only.
T-550 `--require-legal-signoff` strict-mode flag is wired into the GA-launch checklist runbook, NOT routine CI.

---

## 5. Remaining P16 work (orchestrator-scheduled)

- **T-553** (this document) — the deliverable.
- **T-554** (Phase 16 ratification checkpoint) — PO/orchestrator action; separate PR.
- **11 unsigned legal clauses** in `docs/legal-review-marketplace.md` — `pending-counsel-review`. Forward-compatible default surfaces these as `warn`; not a blocker for GA-readiness warn-tier. Strict-mode (`--require-legal-signoff`) gates the GA *announcement*, not merges.

---

## 6. Cluster ratification status

PO ratification of Cluster C + Cluster H + Cluster I parity-fixture goldens is deferred (separate orchestrator actions, NOT Phase-16 blockers):
- **Cluster I** — 11 audience-clip parity-fixture skeletons from P15 (T-476) ship UNSIGNED; goldens auto-generate on first CI render via `pnpm generate-audience-clip-parity-fixture`.
- **Cluster C + H** — older PO-ratification tasks carried forward; Phase 16 does not block.

---

## 7. Remaining-phases risk

Per memory `project_handover_phase9_closeout.md` — closeout handover includes difficulty assessment of what gates GA launch beyond P16.

- **Counsel sign-off on 11 legal clauses** in `docs/legal-review-marketplace.md` — **HIGH risk**; external-party-gated (legal counsel turnaround). Required for GA *announcement*, not for any merge. Strict-mode audit gates this on the launch runbook.
- **Cluster C + H + I PO ratification** — **MEDIUM risk**; gated on PO availability for visual review. Parity-fixture-scoring CI passes on identity goldens (per `docs/handover-cluster-d-regression.md`); PO sign-off is the formal §13 vehicle.
- **7 ADR status flips → `Accepted`** — **LOW risk**; orchestrator action. ADRs 007 + 008 (P14), 009 + 010 (P15), 012 + 013 + 014 (P16) all `Proposed`. The flip clears the sole `check-ga-readiness` Cat-8/9 FAIL criterion and the corresponding criterion in the marketplace audit.
- **T-488 §9.12 human security review** (P15 carry) — **MEDIUM risk**; security-team-gated. WebSocket abuse vectors + voter-token auth + voice-clone (T-471a). Out-of-band sign-off recorded against the WARN.
- **Track A finale T-397+** — **LOW risk**; security-gated. No P16 dependency.

The carry-forward from P16 that affects post-launch:
- Per-vendor production wire-up (T-479a..T-483a) opportunistic — first paid tenant on a vendor triggers the audit.
- First post-launch publisher onboarding is a procedural milestone, not a code task.

---

## 8. Handover to next orchestrator

- Dispatch **T-554** (Phase 16 ratification checkpoint) — separate PR; PO sign-off on `pnpm check-marketplace-ga-readiness` results.
- **Counsel sign-off chasing** on `docs/legal-review-marketplace.md` — 11 clauses from `pending-counsel-review` to `signed:YYYY-MM-DD <signer-name>`. Edit the file by hand; PR-review flow ratifies.
- **First post-launch publisher onboarding** — procedural; the pack-author guide (T-551) is the entry point.
- **Pack-extension PRs from third parties** — the doc ledger is now public; expect inbound. `@stageflip/pack-publish-cli` (T-500) is the canonical authoring surface; `check-pack-integrity` (T-499) gates third-party submissions.
- **ADR status flips** — ADR-012 + ADR-013 + ADR-014 (this phase) plus P14 + P15 carries. Single mechanical PR.

---

## 9. Memory entries this orchestrator added

No new memory entries this session; the existing memory remained authoritative throughout P16:
- `feedback_phase_closeout_timing.md` — drove this doc's landing point (P17 absent → ship at "first pack-extension PR" per T-553 spec).
- `project_handover_phase9_closeout.md` — drove §7 "Remaining-phases risk" inclusion.
- `feedback_parity_signoff_doc_is_procedural.md` — applied to per-pack parity sign-off (parity validator T-549 fixtures live in pack frontmatter, not in `docs/ops/parity-fixture-signoff.md`).
- `feedback_git_add_specific_paths.md` — applied throughout β/γ/δ dispatches.
- `feedback_biome_format_before_commit.md` — applied; scoped to touched dirs per the T-469 lesson.
- `feedback_subagent_worktree_bash.md` + `feedback_subagent_shared_worktree.md` — drove serial dispatch cadence (no concurrent worktrees).

---

**End of P16 closeout handover.** P16 substantively complete. Outstanding orchestrator-scheduled work: T-554 ratification checkpoint + ADR ratification (7 ADRs total across P14 + P15 + P16) + counsel sign-off on 11 commercial-terms clauses + Cluster C/H/I PO ratification + T-488 §9.12 human security review.
