---
'@stageflip/pack-telemetry': minor
---

T-503 — New `@stageflip/pack-telemetry` leaf package providing an
opt-in, dependency-injected telemetry sink for pack install /
activation / usage tracking per ADR-001's privacy posture. Three
event kinds (`PackInstallEvent`, `PackActivationEvent`,
`PackUsageEvent`) on a discriminated `PackTelemetryEvent` union;
`hashPackId(publisherId, packId)` anonymizes identifiers via
SHA-256 before they leave the host (the transport never sees
plaintext publisher / pack names). `PackTelemetryRecorder` defaults
to `enabled: false` — every `record*` call is a silent no-op until
the host flips the master switch (gated on T-541's user-facing
opt-in surface). Three transports ship: `NoopTransport` (default
drop), `BufferedTransport` (auto-flush at bufferSize, default 16),
and `HttpTransport` (POSTs JSON to a configured endpoint with
optional `Authorization: Bearer <token>`; 4xx drops, 5xx retries
once, network errors retry once, never throws). The receiving
endpoint lands in T-541; this package is wire-format-only today and
tested against an injected `FetchLike` shim. No workspace
dependencies — leaf package.
