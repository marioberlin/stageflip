---
title: Pack Trial Mode
id: skills/stageflip/concepts/pack-trial
tier: concept
status: substantive
last_updated: 2026-05-13
owner_task: T-505
related:
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/pack-telemetry/SKILL.md
  - skills/stageflip/concepts/loss-flags/SKILL.md
---

# Pack Trial Mode

`@stageflip/pack-trial` is the policy library for the publisher-facing
"try before you buy" experience. A tenant can mount clips from a paid
pack without holding a full entitlement; the engine admits the pack,
emits `LF-LICENSE-TRIAL-ACTIVE` (warn) at clip-mount, and the
renderer-core integration overlays a visible watermark.

## The three-state machine

`TrialPolicyState` has three values:

| State | Trigger |
|---|---|
| `'none'` | No entitlement on file, or entitlement is not in `'trial'` status. |
| `'trial-active'` | Trial entitlement, no `expiresAt` (perpetual trial) OR `expiresAt` in the future OR unparseable `expiresAt` (fails open). |
| `'trial-expired'` | Trial entitlement, `expiresAt` ≤ `now`. |

`evaluateTrialPolicy({ entitlement, nowMs })` is a pure function — same
input → same output. Callers pass a structural subset of
`TenantEntitlement` (`{ status, expiresAt? }`); the loader's concrete
type is not required.

```ts
import { evaluateTrialPolicy } from '@stageflip/pack-trial';

const state = evaluateTrialPolicy({
  entitlement: { status: 'trial', expiresAt: '2026-12-31T00:00:00Z' },
  nowMs: Date.now(),
});
// → 'trial-active'
```

## The two loss-flag codes (added to `@stageflip/pack-format`)

| Code | Severity | Emitted by |
|---|---|---|
| `LF-LICENSE-TRIAL-ACTIVE` | warn | Engine `canMountClip` — emitted alongside `ok:true` whenever a clip mounts under an active trial. Surface to the user as a "trial mode" badge + render-time watermark. |
| `LF-LICENSE-TRIAL-EXPIRED` | error | Engine `canMountClip` — emitted with `ok:false` when a trial entitlement has expired but is still on file. Distinct from `LF-LICENSE-PACK-DENIED` (the install-time code) so telemetry can tell "expired trial at runtime" from "no entitlement at install". |

Build a typed record via the helpers:

```ts
import { trialActiveLossFlag, trialExpiredLossFlag } from '@stageflip/pack-trial';

trialActiveLossFlag('publisher.demo-pack');
// → { code: 'LF-LICENSE-TRIAL-ACTIVE', severity: 'warn', packId, detail }

trialExpiredLossFlag('publisher.demo-pack', '2024-02-01T00:00:00Z');
// → { code: 'LF-LICENSE-TRIAL-EXPIRED', severity: 'error', packId, detail }
```

## Where trial gating fires

1. **Pack-loader install gate (`load-pack.ts` gate 5)** — A pack with a
   `'trial'` entitlement is admitted at install time **unless** the
   `expiresAt` is in the past, in which case the loader returns
   `LF-LICENSE-PACK-DENIED` with detail `"trial entitlement for sku
   <sku> expired at <expiresAt>"`. (The install gate uses the existing
   `PACK-DENIED` code, not the new runtime `TRIAL-EXPIRED` code,
   because at install time the failure mode is structurally identical
   to any other denied entitlement.)

2. **Engine `LicenseRuntime.canMountClip`** — At clip-mount time the
   runtime branches on `entitlement.status === 'trial'`:
   - `'trial-active'` → `{ ok: true, warning: { code:
     'LF-LICENSE-TRIAL-ACTIVE', detail } }`
   - `'trial-expired'` → `{ ok: false, reason:
     'LF-LICENSE-TRIAL-EXPIRED', detail }`

   The new `warning?` field on `LicenseMountResult` lets callers
   distinguish "ok with active trial" from "ok no warning" without
   forcing every consumer of `canMountClip` to switch on
   `entitlement.status` themselves.

## Watermark policy (not the render)

The library declares the data shape downstream renderers consume; the
actual visual rendering lives elsewhere (deferred renderer-core
integration).

```ts
import { WATERMARK_TEXT, defaultWatermarkRequest } from '@stageflip/pack-trial';

WATERMARK_TEXT;
// → 'StageFlip trial — purchase for production use'

defaultWatermarkRequest();
// → frozen { text: WATERMARK_TEXT, opacity: 0.18, position: 'bottom-right' }
```

`defaultWatermarkRequest()` returns a **frozen** object on every call
so callers cannot accidentally mutate the policy; obtain a fresh one
if you need to override (don't reach into the shared instance).

## Determinism perimeter

`@stageflip/pack-trial` lives **OUTSIDE** the determinism perimeter
per CLAUDE.md §3 (perimeter is `packages/runtimes/**`,
`packages/frame-runtime/**`, `packages/renderer-core/src/clips/**`).
`Date.parse` is permitted here; the renderer-core integration that
draws the watermark consumes `WatermarkRequest` deterministically
(text + opacity + position resolved at scene-compile time, no live
clock access in the render loop).

## Trial → paid conversion path

The library ships the policy only; the conversion UI is T-544. A
typical lifecycle:

1. User accepts a trial offer → host writes `TenantEntitlement` with
   `status: 'trial'` + `expiresAt = now + 14d`.
2. Pack-loader admits → engine registers → first clip mount fires
   `LF-LICENSE-TRIAL-ACTIVE`.
3. Renderer overlays watermark on every output frame.
4. T-544 surfaces a "convert" CTA; on purchase, the entitlement is
   re-issued with `status: 'active'` and the watermark stops on the
   next session.
5. If the trial expires first, the engine emits
   `LF-LICENSE-TRIAL-EXPIRED` and the host falls back to
   `staticFallback` (same path as a revoked clip per ADR-012 §D6).

## Cross-references

- **ADR-012** — Bundle Format & License Runtime (the install + runtime
  gates this library extends).
- **ADR-013** — First-party Pack Catalogue & Pricing Tiers
  (`entitlement.status` enum that gains the `'trial'` variant).
- **`@stageflip/pack-format`** — `PackFormatLossFlagCode` catalogue
  (now includes `LF-LICENSE-TRIAL-ACTIVE` + `LF-LICENSE-TRIAL-EXPIRED`).
- **`@stageflip/pack-loader`** — `TenantEntitlement.status` union (now
  includes `'trial'`); `load-pack.ts` gate 5 implements the install
  branch.
- **`@stageflip/engine`** — `LicenseRuntime.canMountClip` consumes the
  helpers from this package.
- **T-538** — Marketplace UX (consumer that surfaces the trial badge).
- **T-544** — Trial-to-paid conversion (consumer that flips
  `entitlement.status` from `'trial'` to `'active'`).
