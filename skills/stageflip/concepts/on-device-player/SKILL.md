---
title: On-Device Display Player
id: skills/stageflip/concepts/on-device-player
tier: concept
status: substantive
last_updated: 2026-05-14
owner_task: T-399
related:
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/concepts/tenant-settings/SKILL.md
---

# On-Device Display Player

The on-device display player is the third deployment target for the
interactive runtime tier (alongside `renderer-cdp` and browser
live-preview). It runs the StageFlip player binary on physical display
hardware: DOOH (digital out-of-home), digital signage, in-venue screens.

Per ADR-005 §D4 the on-device player supports all seven frontier clip
families subject to **device capability**; per ADR-005 §D5 it is
**GA-gated**: live-mount requires `tenantPolicy.featuresInteractive === 'ga'`.
The `'preview'` posture keeps on-device on `staticFallback` (preview is a
browser-only mode).

## Three-layer composition

| Layer | Package | Owner task | Status |
|---|---|---|---|
| Binary packaging + distribution | `@stageflip/on-device-player-packaging` | **T-400** | **This skill** |
| **Runtime shim** | `@stageflip/runtime-on-device-player` | **T-399** | **This skill** |
| Ops + telemetry pipeline | `@stageflip/on-device-player-ops` | **T-401** | **This skill** |

The shim is the abstraction layer the binary calls into. It is **purely
orchestration**: it owns no render loop, draws no pixels. The binary
materialises the `staticFallbackElement` payload on every refusal arm.

## Gate chain

`OnDevicePlayerShim.mount` runs four gates in order. The first refusal
wins; downstream gates are skipped.

1. **Tenant-flag gate** — `evaluateTenantGate({ featuresInteractive })`.
   - `'disabled'` → refuse with `'tenant-flag-disabled'`.
   - `'preview'` → refuse with `'preview-not-ga'` (on-device requires GA).
   - `'ga'` → permit.
2. **Capability gate** — `evaluateCapability({ clipFamily, device })`.
   Each clip family declares which `DisplayDeviceCapability` bits it
   requires; missing bits refuse with `'capability-insufficient'`.
3. **Registry gate** — the harness throws
   `InteractiveClipNotRegisteredError` when no factory is registered for
   the requested family; the shim translates to `'no-factory-registered'`.
4. **Permission gate** — the harness's `PermissionShim.mount()` may deny
   on a tenant-policy or per-permission basis; the shim observes the
   harness's `'mount-fallback'` telemetry and translates to
   `'permission-refused'`.

## The five refusal reasons

```ts
export type OnDevicePlayerRefusalReason =
  | 'tenant-flag-disabled'      // gate 1
  | 'preview-not-ga'            // gate 1
  | 'capability-insufficient'   // gate 2
  | 'permission-refused'        // gate 4
  | 'no-factory-registered';    // gate 3
```

The binary uses the reason to render the binary-supplied
`staticFallbackElement` and surface a diagnostic to the operator. The
shim never throws for any of these — they all return
`{ result: 'fallback', reason }`.

## Capability matrix

| Family | Required device bits | Rationale |
|---|---|---|
| `shader` | `hasGpu` | GLSL fragment shader compilation + draw |
| `three-scene` | `hasGpu` | Three.js / WebGL scene driving |
| `voice` | `hasMicrophone` | Web Audio + MediaRecorder live capture |
| `ai-chat` | `hasNetwork` | LLM round-trip per turn |
| `live-data` | `hasNetwork` | Endpoint fetch + cache |
| `web-embed` | `hasNetwork` | Sandboxed iframe loads allowlisted origin |
| `ai-generative` | `hasNetwork` | Generation is OFF-device; device only renders the returned slot — explicitly NOT gated on `hasGpu` |

Changes to this table require a paired test update in
`packages/runtime-on-device-player/src/shim.test.ts`.

## Telemetry surface (consumed by T-401)

```ts
export type TelemetryEvent =
  | { kind: 'boot'; device: DisplayDeviceCapability }
  | { kind: 'mount-attempted'; clipFamily; clipId }
  | { kind: 'mount-refused'; reason; clipFamily; clipId }
  | { kind: 'mount-success'; clipFamily; clipId; elapsedMs }
  | { kind: 'unmount'; clipId; clipFamily }
  | { kind: 'shutdown'; clipsUnmounted };
```

The shim is sink-agnostic — the binary or T-401 wires the real sink at
`boot` time. `elapsedMs` is computed from the binary-supplied `clock`
function so deployments can use whatever monotonic time source is most
appropriate (POSIX `CLOCK_MONOTONIC`, the platform's GPU vsync clock,
etc.).

## Determinism

The shim lives at `packages/runtime-on-device-player/`, **outside** the
CLAUDE.md §3 determinism perimeter (which scopes
`packages/runtimes/*/src/clips/**`). The shim is still
pure-by-discipline:

- `clock`, `emitTelemetry`, and the underlying `InteractiveMountHarness`
  are all injected — test-controllable, no module-level state.
- The source references no `Date`, `Math.random`, `setTimeout`,
  `setInterval`, `requestAnimationFrame`, `fetch`, or `XMLHttpRequest`.
  Pinned by a source-level scan in `shim.test.ts`.

## Boundary with the binary (T-400)

- Binary calls `boot({ device, emitTelemetry, clock? })` once at start.
- Binary calls `mount({ tenantId, tenantPolicy, clipFamily, clipId,
  clipProps, staticFallbackElement })` per clip; renders the returned
  handle's clip on the device surface, or renders
  `staticFallbackElement` on refusal.
- Binary calls `handle.unmount()` when removing a clip.
- Binary calls `shutdown()` when terminating.

## Binary packaging (T-400)

`@stageflip/on-device-player-packaging` is the host-side scaffold that
wraps the runtime shim into a deployable binary. Per ADR-005 §D4 +
L141, the on-device player is a separate binary with its own supply
chain and update mechanism — security blast-radius is higher than
browser-only clips (see `docs/security-review-track-a.md` R-11). The
package is pure-Node code; actual native binary compilation is
downstream of this workspace.

### Manifest schema (`OnDeviceBinaryManifest`)

The binary reads `manifest.json` at boot:

```ts
{
  manifestVersion: 1,
  binaryVersion: '1.2.3' | '1.2.3-rc.4',
  tenantId: string,
  deviceId: string,
  enabledPackIds: string[],
  enabledClipFamilies: InteractiveClipFamily[],   // per-device feature gate
  updateChannel: UpdateChannelDescriptor,
  codeSigningPolicy: CodeSigningPolicy,
  health: { probeIntervalSec: 15..3600 },
}
```

`writeManifest` is atomic — write-to-temp + fsync + rename, with
temp-file cleanup on failure. The original is left intact on rename
failure. The tempfile tag uses `crypto.randomBytes` (not `Date.now()`)
so the source-level determinism scan stays clean even though this
package is outside the CLAUDE.md §3 perimeter.

### Update channels

Three channels: `stable`, `beta`, `canary`. Each device subscribes to
exactly one via `updateChannel.channel`. The descriptor declares the
discovery endpoint, the publisher key id (refs the
`@stageflip/pack-signing` publisher-key registry), the poll cadence
(60..86400 seconds), and an optional `rolloutPercentage` cohort tag
for staged rollouts.

`resolveUpdate({ descriptor, currentVersion, fetcher })` is a stub —
the production binary injects a real `fetch`-backed fetcher. The
scaffold's default fetcher throws so production callers MUST wire
one explicitly.

### Code-signing posture

Mirrors `@stageflip/pack-signing`: ed25519-first (RSA-PSS-SHA256
supported for vendor / regulatory environments mandating RSA),
publisher keys pinned at provisioning time (TOFU). Three `enforce`
modes:

| Mode | Behaviour |
|---|---|
| `strict` | Required on production devices. Refuse boot on any refusal arm. |
| `warn` | Telemetry-only; suitable for canary / beta. |
| `off` | Developer dev-loop only. Skips all verification. Never on production devices. |

`verifyBinarySignature` is pure — caller supplies the binary bytes,
signature bytes, policy, and pinned publisher key. Returns
`{ verified, reason }` for the five refusal arms: `signature-missing`,
`untrusted-publisher`, `algorithm-mismatch`, `signature-invalid`, plus
the success arm `'verified'`.

### Per-OS packaging tiers

Seven OS targets declared in the schema. Three are **first-class** —
the downstream build pipeline produces artifacts for them at MVP:

| Target | Format | Use case |
|---|---|---|
| `linux-x64` | `tar.gz` | DOOH x86 media players |
| `linux-arm64` | `tar.gz` | DOOH ARM media players |
| `embedded-linux-arm` | `tar.gz` | Yocto / Buildroot signage |

The other four (`darwin-x64`, `darwin-arm64`, `win32-x64`,
`android-arm64`) are declared as **stub** so the manifest stays
forward-compatible, but produce no artifact today.

### Health probe

`buildHealthProbe(...)` is a pure builder. The binary exposes its
result via a local HTTP / IPC endpoint that the operator's
NMS / OpsRamp / fleet-monitor scrapes (T-401 wires the actual
endpoint). Status decision rule:

- failures ≥ 2× threshold → `'failing'`
- failures ≥ threshold     → `'degraded'`
- otherwise                → `'healthy'`

Threshold is configurable; the recommended starting value is 5 mount
failures within the last 10 minutes.

### Boot scaffold

`bootOnDevicePlayer({ manifestPath, device, emitTelemetry, clock, ...
})` is the binary's `main()` entrypoint:

1. **Manifest** → `readManifest`; failure → `'manifest-invalid'`.
2. **Signature** → caller-injected `verifySignature(manifest)`; on
   `verified: false` → `'signature-rejected'` (in production the
   verifier wires the OS-specific download-+-verify path against the
   manifest's `codeSigningPolicy`).
3. **Capability coverage** → check `device` against
   `manifest.enabledClipFamilies` (e.g. shader enabled but
   `!device.hasGpu` → `'capability-mismatch'`).
4. **Shim** → caller-injected `createShim()` (production: real
   `createOnDevicePlayerShim` with a binary-built
   `InteractiveMountHarness`); call `shim.boot({ device,
   emitTelemetry, clock })`; return `{ status: 'booted', shim }`.

The scaffold itself does NOT construct the `InteractiveMountHarness` —
that's binary-specific (different devices may enable different
registries). The production binary wires the harness via
`createShim`.

## Ops + telemetry (T-401)

`@stageflip/on-device-player-ops` ships the **pure design surface** the
binary wires together at runtime. No HTTP server, no real-network
sink, and no Prometheus / Grafana / Datadog exporter live in this
package — those are downstream of the workspace. The pipeline:

```
TelemetryEvent (from runtime-on-device-player)
       │
       ├──► MetricsAggregator.ingest()
       │        │
       │        └──► snapshot() → PlayerMetrics (window-bucketed counters)
       │
       ├──► OpsEventSink.send() ──► (downstream ingestion)
       │
       └──► HealthProbeReport (from packaging) ──► buildHealthHandler ──► HTTP /health
                                                    │
                                                    ▼
                                                  FleetRollupRow ──► buildFleetRollup
```

### `MetricsAggregator` — window-bucketed counters

- `ingest(event, clock)` — O(1) append; records the caller's clock at
  ingest time.
- `snapshot(clock, windowDurationSec = 600)` — returns a
  `PlayerMetrics` covering events inside `[now - windowDurationSec,
  now]`. Events outside the window are excluded from every counter.
- Counters: `bootCount`, `shutdownCount`, `mountAttempts`,
  `mountSuccesses`, `mountRefusals`, `mountSuccessRate`,
  `refusalsByReason` (histogram across the 5 refusal reasons),
  `errorsByClipFamily`, `uptimePctSinceBoot`, `currentlyMounted`
  (clamped at 0).
- **Uptime simplification**: 1.0 when continuously up, 0.0 when no
  boot in window, `bootCount / (bootCount + shutdownCount)` otherwise.
  The real fleet binary computes wall-clock ratios; this surface is
  for smoke checks.

### `buildHealthHandler` — HTTP-shape probe

- `GET /health` → 200 with a fresh `HealthProbeReport` from the
  caller-supplied `probe()` callback.
- `POST /health` → 405.
- Other paths → 404.
- The binary wires this to its embedded HTTP server (Node `http`,
  Rust `hyper`, etc.); `probe()` is called at most once per request.

### `FleetRollup` — cross-device aggregation

`buildFleetRollup({ rows, aggregatedAtSec })` produces a `FleetRollup`
with per-row passthrough plus `totals`:

- `totalDevices`, `healthyDevices`, `degradedDevices`, `failingDevices`
- `weightedMountSuccessRate` — per-row attempt-weighted average
- `aggregateRefusalsByReason` — elementwise sum of every row's
  `refusalsByReason`

### `OpsEventSink` + `OnDeviceTelemetryRecorder`

- `OpsEventSink` is the contract production wires for real-network
  forwarding. `InMemoryOpsEventSink` is the test + dev-loop impl;
  it appends to `sent[]` and `flush()` resolves immediately.
- `OnDeviceTelemetryRecorder` is the test-only recorder. `asSink` is
  the sink callback; `byKind(k)` returns a type-narrowed slice;
  `clear()` empties `recorded`.

## See also

- `docs/decisions/ADR-005-frontier-clip-catalogue.md` §D4 + §D5
- `docs/implementation-plan.md` T-399 / T-400 / T-401
- `docs/security-review-track-a.md` §5 R-11
- `packages/runtimes/interactive/src/mount-harness.ts`
- `packages/runtimes/interactive/src/host/browser-live-preview.tsx`
  (sibling host for the browser deployment target)
