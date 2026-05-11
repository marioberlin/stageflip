---
---

T-451 — ADR-010 Live Audience Clip Family — Phase 15 α hard-gate #2;
clears the gate.

docs ADR.

Defines the nine v1 audience clip families (six standard: LivePoll
multi-choice/open-text/rating, LiveQA, LiveQuiz, Leaderboard,
WordCloud, Survey; three motion-native differentiators: Heatmap,
ReactionStream, AudienceAiPrompt) spanning the eleven
`AudienceClipKind` discriminants from ADR-009 §D2. Specifies:
per-clip-kind `VotePayload.value` shapes (typed discriminated union);
per-clip-kind `AggregationSnapshot.aggregation` shapes (typed
discriminated union); per-clip-kind snapshot-size hygiene (Firestore
document cap discipline); `staticFallback` snapshot semantics (when
snapshot is taken, what bytes/JSON it carries, how renderer
materializes a frame per clip family, three snapshot-selection
policies: `final` / `peak` / `at-frame`); full `AudienceProvenance`
schema extending ADR-009 §D9 preview with `snapshotPolicy` +
`clipKind` + inlined `aggregation` payload (mirrors `MediaProvenance`
inlined-bytes-for-export-durability posture from ADR-008);
`permissions: ['audience-network']` requirement on every audience clip
enforced by T-455 CI gate per ADR-005 §D2 manifest convention;
motion-native dependency footprint (ReactionStreamClip depends on
T-383 ShaderClip from P13 γ; AudienceAiPromptClip depends on T-430
Seedance video + T-432 ACE-Step music from P14 β); static-fallback vs.
live-mount routing posture (three-state model: live / static-fallback
/ empty live-mount); tenant frontier-enablement gating
(`TenantSettings.features.audience` extends T-411a with two-flag
enablement — `enabled` + `motionNativeEnabled` for phased rollout);
Cluster I preset cluster (~6 audience presets, T-486); determinism
posture inherited from ADR-009 §D10; loss-flag inventory inherited
from ADR-009 §D11 (no new flags); plugin manifest extensions
inherited.

Together with ADR-009 (T-450, merged 2026-05-11 via PR #512 / v1.28),
**this clears the Phase 15 α hard gate**. T-452+ can dispatch:
`@stageflip/audience-contract` (T-452), audience backend service
(T-453), `packages/runtimes/audience/` (T-454),
`check-audience-permissions` (T-455), audience-join UX (T-456),
`tools/audience-engagement/SKILL.md` (T-457), rate-limit / spam
protection (T-458), result-export (T-459), `AudienceProvenance` type
(T-460), the nine clip family implementations (T-461 → T-471),
static-fallback consolidation (T-472), quiz fairness (T-473),
audience-data persistence (T-474), latency tests (T-475), Cluster I
parity fixtures (T-476), SLA load test (T-477), the five vendor
adapters (T-479 → T-483), WebEmbed allowlist update (T-484), vendor
regression suite (T-485), Cluster I preset cluster (T-486), Cluster I
SKILL + `compose_*` tools (T-487), GA readiness + security review
(T-488), Phase 15 closeout handover (T-489).

NOT a structural extension — pure docs ADR. The schema additions
ADR-010 specifies (`VotePayloadValue` + `AggregationValue`
discriminated unions, full `AudienceProvenance` schema, per-clip
manifests + clip implementations) land in T-452
(`@stageflip/audience-contract`) + T-460 (`AudienceProvenance` type) +
T-461..T-471 (the nine clip family implementations) which DO bear the
§13 obligation; T-476 Cluster I parity fixtures + the PO ratification
sign-off carry the end-to-end render verification per CLAUDE.md §13
means-of-verification option 2.

No code, package, fixture, parity-golden, or skill changes — pure
docs. No publishable package version bumps.
