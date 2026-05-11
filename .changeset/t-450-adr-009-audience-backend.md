---
---

T-450 — ADR-009 Audience Backend — Phase 15 α hard-gate #1.
docs ADR.

Defines the Live Audience backend architecture: WebSocket multiplexer +
Firestore `audience-sessions` collection extending `apps/api`; the
`AudienceBackendProvider` interface (four-method contract: `openSession`,
`submitVote`, `subscribe`, `closeSession`) extending `AdapterDescriptor`
from ADR-007; the three-layer rate-limit model (per-tenant + per-session
voter cap + per-voter anti-spam, drop-not-queue backpressure); the
real-time SLA target (1000 concurrent voters v1; p50 < 200 ms / p95 <
500 ms voter-tap → screen); the persistence model (Firestore
`tenants/{tenantId}/projects/{projectId}/audience-sessions/{sessionId}`
with `events/` + `snapshots/` sub-collections, TTL, voter-token hashing
at rest); the WebSocket transport (lifecycle, exponential backoff
reconnect — 6 attempts × max 30 s, heartbeat); the dual-trust-domain
auth model (presenter admin + anonymous voter session token); the
vendor adapter bridge contract for Slido / Mentimeter / Poll Everywhere
/ Vevox / Wooclap + vendor parity matrix (motion-native differentiators
= native-only for v1); an `AudienceProvenance` schema preview (full
schema in ADR-010); eight `LF-AUDIENCE-*` loss-flag codes; plugin
manifest per-modality extensions; permissions manifest cross-reference
(`audience-network` per ADR-005 + T-455).

First Phase 15 task + first of two Phase 15 α hard-gate ADRs (T-451 /
ADR-010 follows). Together they clear the Phase 15 α hard gate;
downstream tasks T-452 (`@stageflip/audience-contract`), T-453
(audience backend service), T-454 (`packages/runtimes/audience/`),
T-455 (`check-audience-permissions`), T-456 (audience-join UX), T-457
(`tools/audience-engagement/SKILL.md`), T-458 (rate-limit / spam
protection), T-459 (CSV / JSON post-event analytics), T-460
(`AudienceProvenance` type), all Phase 15 β / γ / δ work can dispatch.

NOT a structural extension — pure docs ADR. The schema additions
ADR-009 specifies (`AudienceBackendProvider` interface,
`AudienceProvenance` preview) land in T-452 + T-460 which DO bear the
§13 obligation.

No code, package, fixture, parity-golden, or skill changes — pure docs.
No publishable package version bumps.
