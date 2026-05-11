---
'@stageflip/runtimes-audience': minor
---

T-454 — `@stageflip/runtimes-audience` — audience runtime tier extending
`@stageflip/runtimes-interactive` per ADR-003 §D1.

Ships the substrate the nine v1 audience clip families (T-461..T-471)
plug into: `AudienceMountContext` / `AudienceMountHandle` interfaces
(audience-tier extension of T-306's `MountContext` / `MountHandle`);
`runAudienceClient` WebSocket subscription wrapper implementing the
ADR-009 §D6 reconnect-budget policy (6 attempts × `min(2^attempt × 1s,
30s)` exponential backoff, close-code 4000 short-circuit, abort-signal
disposal) and emitting `LF-AUDIENCE-CONNECTION-LOST` (the eighth
client-side code) on budget exhaustion; `AudienceClipRegistry` keyed by
the eleven `AudienceClipKind` discriminants from
`@stageflip/audience-contract`; `StaticFallbackRenderer` dispatcher
honouring the three snapshot-selection policies (`final` / `peak` /
`at-frame`) per ADR-010 §D4 and emitting `LF-AUDIENCE-SNAPSHOT-MISSING`
on integrity-mismatch; three-state mount router per ADR-010 §D8 (`live`
when sessionId present; `staticFallback` when only provenance present;
`empty-live-mount` when neither); `audienceRuntime` implementing the
`@stageflip/runtimes-contract` `ClipRuntime` interface (`id:
'audience'`, `tier: 'live'`) plus `registerAudienceClipDefinition` for
per-kind `findClip(kind)` plumbing.

T-454 ships substrate only — no concrete clip implementations (owned by
T-461..T-471), no concrete `AudienceBackendProvider` (native T-478;
vendor adapters T-479..T-483), no host / editor integration, no CI
permission rule (T-455), no Cluster I parity fixtures (T-476), no
Cluster I preset cluster (T-486).
