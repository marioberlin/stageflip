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
| Binary (packaging, distribution, render loop) | (TBD) | T-400 | Future |
| **Runtime shim** | `@stageflip/runtime-on-device-player` | **T-399** | **This skill** |
| Telemetry + ops dashboard | `@stageflip/marketplace-telemetry-dashboard` | T-401 | Future |

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

## See also

- `docs/decisions/ADR-005-frontier-clip-catalogue.md` §D4 + §D5
- `docs/implementation-plan.md` T-399 / T-400 / T-401
- `docs/security-review-track-a.md` §5 R-11
- `packages/runtimes/interactive/src/mount-harness.ts`
- `packages/runtimes/interactive/src/host/browser-live-preview.tsx`
  (sibling host for the browser deployment target)
