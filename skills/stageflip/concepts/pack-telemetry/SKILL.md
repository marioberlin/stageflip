---
title: Pack Telemetry
id: skills/stageflip/concepts/pack-telemetry
tier: concept
status: substantive
last_updated: 2026-05-13
owner_task: T-503
related:
  - skills/stageflip/concepts/bundles/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
---

# Pack Telemetry

`@stageflip/pack-telemetry` is the install / activation / usage
tracking sink for the pack ecosystem (marketplace packs per ADR-012 +
ADR-013 + ADR-014). It records three event kinds, hashes pack
identifiers before they leave the host, and is **default-disabled**
per ADR-001's opt-in privacy posture.

## ADR-001 posture in one paragraph

ADR-001 picked BSL 1.1 with auto-conversion to Apache 2.0 and a tight
license whitelist. The unwritten corollary is that the project does
not exfiltrate identifying data without explicit consent. The
pack-telemetry recorder defaults to `enabled: false`; until a future
host-side configuration surface (T-541) flips the switch, every
`record*` call is a silent no-op and no event ever reaches the
transport. Once enabled, only anonymous aggregate counts ship, keyed
by an irreversible SHA-256 hash of the pack identifier.

## What is transmitted

When telemetry is **opted in**:

| Field | Purpose | Anonymized? |
|---|---|---|
| `packIdHash` | Pack identity | Yes — SHA-256 of `${publisherId}/${packId}`. |
| `packVersion` | Pack version | No — semver string, not identifying alone. |
| `licenseKind` | Tier counts | No — one of `'open' \| 'paid-per-tenant' \| 'enterprise'`. |
| `engineVersion` | Engine cohort | No — semver string. |
| `platform` | Platform cohort | Coarse: `'darwin' \| 'linux' \| 'win32' \| 'unknown'`. |
| `mountedAnyClip` | Active-use signal | Bool. |
| `clipMountCount` | Aggregate window count | Integer. |
| `windowSeconds` | Window length | Integer. |
| `at` | Timestamp | ISO 8601 UTC, second resolution. |

## What is NEVER transmitted

- Publisher names or pack names in plaintext (always `packIdHash`).
- Tenant ids — the package has no concept of tenant. If a downstream
  pipeline wants per-tenant aggregation it must add tenant on the
  receive side, behind its own consent gate.
- Document, scene, or clip ids.
- User-facing strings, file paths, or asset content.
- IP addresses or other implicit network metadata. (The HTTP
  transport sends only the JSON body the recorder built; any
  additional metadata the receiver attaches lives outside this
  package's surface.)

## The three event kinds

```ts
import { PackTelemetryRecorder, HttpTransport } from '@stageflip/pack-telemetry';

const recorder = new PackTelemetryRecorder({
  enabled: false,           // ADR-001 default — flip to true only after explicit user opt-in
  transport: new HttpTransport({ endpointUrl: '…', bearerToken: '…' }),
  engineVersion: '0.42.0',
});

recorder.recordInstall({ publisherId, packId, packVersion, licenseKind });
recorder.recordActivation({ publisherId, packId, packVersion, mountedAnyClip });
recorder.recordUsage({ publisherId, packId, packVersion, clipMountCount, windowSeconds });
await recorder.flush();
```

- **install** — fires once per (tenant, pack, version) when the
  pack-loader successfully verifies + registers a pack. Captures
  `licenseKind`, `engineVersion`, and `platform`.
- **activation** — fires per reporting window. `mountedAnyClip`
  distinguishes "installed but never used" from "installed and
  actively used"; no per-clip detail.
- **usage** — aggregate `clipMountCount` over a window of length
  `windowSeconds`. No per-instance attribution.

## Transports

Three implementations ship with the package:

- **`NoopTransport`** — drops every event silently. Use when the
  recorder is disabled or the host has not yet configured a real
  endpoint.
- **`BufferedTransport`** — wraps another transport with a fixed
  buffer; auto-flushes at `bufferSize` (default 16) or on explicit
  `flush()`. The recorder uses this internally.
- **`HttpTransport`** — POSTs JSON to a configured endpoint. 4xx →
  log + drop. 5xx → retry once, then log + drop. Network error →
  retry once, then log + drop. Never throws to the caller. The
  receiving endpoint lands in T-541 — until then the transport is
  wire-format-only.

`fetch` is dependency-injected (`FetchLike`) so tests run without
network calls.

## Determinism perimeter

`@stageflip/pack-telemetry` lives **OUTSIDE** the determinism
perimeter (CLAUDE.md §3 — perimeter is `packages/runtimes/**`,
`packages/frame-runtime/**`, `packages/renderer-core/src/clips/**`).
`Date.now()` is permitted; tests inject `now()` for stability.

## How to enable

For now: nothing. The recorder is constructed with `enabled: false`
in every host call site and stays that way until the user-facing
opt-in surface lands (T-541). When that surface lands, it will:

1. Persist the user's opt-in choice (default `false`).
2. Re-construct the recorder with `enabled: <user-choice>` at host
   boot.
3. Surface a "view what we collect" link to this skill.

## Cross-references

- **ADR-001** — Initial Stack & License (license whitelist + the
  opt-in posture this package implements).
- **ADR-012** — Bundle Format & License Runtime (§D8 marketplace
  observability; §D9 audit log scope).
- **ADR-013** — First-party Pack Catalogue & Pricing Tiers
  (`licenseKind` enum source of truth).
- **`@stageflip/pack-format`** — `LicenseClaim.kind` enum mirrors
  `PackLicenseKind`.
- **T-541** — Pack telemetry dashboard (downstream consumer that
  ships the receiving endpoint and the user-facing opt-in toggle).
