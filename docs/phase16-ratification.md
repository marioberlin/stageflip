<!-- docs/phase16-ratification.md — Phase 16 ratification checkpoint (T-554). -->

# Phase 16 — Pack Marketplace — ratification checkpoint

**Status**: P16 substantively complete; orchestrator-signed; PO sign-off pending.
**Author**: orchestrator. **Date**: 2026-05-14.
**Signatories**: orchestrator (signed); PO (pending).

---

## 1. Scope

This checkpoint formally ratifies that all Phase 16 (Pack Marketplace) exit criteria are met or
explicitly waived per §4. The closeout handover at [handover-phase16-complete.md](./handover-phase16-complete.md)
(T-553) is the supporting evidence record; this document is the orchestrator + PO sign-off
artifact per CLAUDE.md §6 ("a human ratifies only at phase boundaries"). T-554 is the final P16
task per [implementation-plan.md](./implementation-plan.md).

---

## 2. Exit-criteria checklist

Legend: `[X]` PASS · `[~]` WARN-acceptable · `[ ]` PENDING.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | All 63 P16 tasks merged (T-493..T-553, plus α ADR tasks T-490/T-491/T-492) | `[X]` | `git log` on `main`; [handover-phase16-complete.md §1](./handover-phase16-complete.md) cluster table |
| 2 | 6 first-party launch packs at v0.2.0 GA | `[X]` | `packs/stageflip/{news-pro,sports-networks,creator-style,finance,wedding-events,frontier-fx}/0.2.0/manifest.json` |
| 3 | 8 `LF-PACK-*` codes catalogued in `@stageflip/pack-format` | `[X]` | 5 from ADR-012 §D10 + `LF-PACK-TRIAL-EXPIRED` + `LF-PACK-TRIAL-WATERMARK` (T-505) + `LF-NPM-TOKEN-MISSING` (T-539) |
| 4 | `pnpm typecheck` green on `main` | `[X]` | [handover-phase16-complete.md §4](./handover-phase16-complete.md) gate table |
| 5 | `pnpm lint` green | `[X]` | §4 gate table |
| 6 | `pnpm test` green (≥85% coverage on changed) | `[X]` | §4 gate table |
| 7 | `pnpm check-licenses` green | `[X]` | §4 gate table |
| 8 | `pnpm check-remotion-imports` green | `[X]` | §4 gate table |
| 9 | `pnpm check-determinism` green | `[X]` | §4 gate table |
| 10 | `pnpm check-skill-drift` green (core only per T-548) | `[X]` | §4 gate table |
| 11 | `pnpm gen:tool-skills:check` green | `[X]` | 27 bundles unchanged in P16 |
| 12 | `pnpm check-pack-integrity` green (T-499) | `[X]` | manifest + signature + license-claim + version-compat validation |
| 13 | Parity harness green where rendering touched | `[X]` | per-pack fixture validation via T-549 + standard `pnpm parity` |
| 14 | `pnpm check-marketplace-ga-readiness` (T-550): 9 PASS / 1 WARN / 0 FAIL | `[~]` | sole WARN is legal-clause sign-off ledger (forward-compat default; gated externally) |
| 15 | Per-pack skill-drift surface (T-548) wired and warning-only | `[X]` | core invariant unchanged; per-pack drift surfaces warn-tier only |
| 16 | Per-bundle parity validator (T-549) shipped with cluster thresholds | `[X]` | `DEFAULT_CLUSTER_THRESHOLDS` covers clusters a–i + default fallback |
| 17 | Pack-author guide (T-551) published | `[X]` | [pack-author-guide.md](./pack-author-guide.md) |
| 18 | Per-pack release process (T-552) published | `[X]` | [pack-release-process.md](./pack-release-process.md) |
| 19 | Closeout handover (T-553) merged | `[X]` | [handover-phase16-complete.md](./handover-phase16-complete.md) |

---

## 3. Pending items, explicitly waived for P16 sign-off

Each waiver below is explicitly acknowledged by the orchestrator signature in §5 and does not
gate Phase 16 ratification. Each is tracked in the closeout handover §5/§7 and routed to the
appropriate post-P16 owner.

- **11 unsigned legal clauses** in [legal-review-marketplace.md](./legal-review-marketplace.md) —
  `pending-counsel-review`. T-550's forward-compat policy is "warns-only by default";
  `--require-legal-signoff` flips to fail and is wired into the GA-launch checklist runbook only,
  NOT routine CI. External-counsel-gated; not P16-blocking.
- **ADR-012 / ADR-013 / ADR-014 status** — currently `Proposed`. Status flip to `Accepted` is a
  mechanical orchestrator action item per CLAUDE.md §6; the `Proposed` state does not gate
  phase-close. Single mechanical PR carries P14 + P15 + P16 ADR flips together (7 ADRs).
- **Cluster C + H + I PO ratification** — separate orchestrator/PO process per
  [handover-phase16-complete.md §6](./handover-phase16-complete.md); not P16-scoped. Cluster I
  parity goldens auto-generate on first CI render via `pnpm generate-audience-clip-parity-fixture`.
- **T-488 §9.12 human security review** — P15-gated carry-forward (WebSocket abuse vectors +
  voter-token auth + voice-clone). Out-of-band sign-off recorded against the existing P15 WARN.
  Not in P16 scope.
- **Track A finale (T-397+)** — security-gated, separate track. No P16 dependency.

---

## 4. Risk assessment for GA launch

Per memory `project_handover_phase9_closeout.md`, ratification checkpoints carry a difficulty
assessment of what gates GA launch beyond the closing phase. Mirrors the cadence of
[handover-phase12-complete.md §5](./handover-phase12-complete.md).

- **Counsel sign-off on 11 legal clauses** — **HIGH risk**. External-party-gated (legal counsel
  turnaround). Required for GA *announcement*, not for any merge. Strict-mode audit
  (`--require-legal-signoff`) gates this on the launch runbook only.
- **Cluster C + H + I PO ratification** — **MEDIUM risk**. Gated on PO availability for visual
  review. Parity-fixture-scoring CI passes on identity goldens (per
  [handover-cluster-d-regression.md](./handover-cluster-d-regression.md)); PO sign-off is the
  formal §13 vehicle for the structural-extension goldens.
- **7 ADR status flips → `Accepted`** — **LOW risk**. Orchestrator action. ADRs 007 + 008 (P14),
  009 + 010 (P15), 012 + 013 + 014 (P16) all `Proposed`. Single mechanical PR clears the sole
  remaining `check-marketplace-ga-readiness` Cat-8/9 FAIL surface beyond legal sign-off.
- **T-488 §9.12 human security review** — **MEDIUM risk**. Security-team-gated; P15 carry.
- **Track A finale T-397+** — **LOW risk**. Security-gated; no P16 dependency.

---

## 5. Sign-off

### Orchestrator
**Signed**: 2026-05-14 by orchestrator
**Statement**: All P16 exit criteria verified per §2 above. Pending items in §3 explicitly
acknowledged and waived for ratification of Phase 16. No P16-scoped FAIL conditions outstanding.

### Product Owner
**Status**: pending
**Date**: ____
**Statement**: ____

---

## 6. What follows

P17 is not currently scoped in [implementation-plan.md](./implementation-plan.md); the plan ends
at T-554. The next orchestrator picks up cross-cutting items per
[handover-phase16-complete.md §8](./handover-phase16-complete.md): the 7-ADR status-flip PR,
counsel sign-off chasing on the 11 unsigned legal clauses, deferred Cluster C + H + I PO
ratification, T-488 §9.12 human security review (P15 carry), and Track A finale (security-gated).
First post-launch publisher onboarding is procedural — [pack-author-guide.md](./pack-author-guide.md)
is the entry point; [pack-release-process.md](./pack-release-process.md) is the per-pack release
runbook — not phase-scoped.
