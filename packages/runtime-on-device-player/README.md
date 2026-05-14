# @stageflip/runtime-on-device-player

Runtime shim the on-device display player binary calls into to mount and
run interactive clips on physical display hardware (DOOH, digital
signage, in-venue screens). Implements T-399 of the Phase 13 / γ block.

Per ADR-005 §D4 + §D5, on-device-player live-mount is **GA-only**:
`features.interactive === 'ga'` permits live-mount; `'preview'` keeps it
on `staticFallback`; `'disabled'` keeps it on `staticFallback`.

## Layering

```
┌────────────────────────────────────────────────────────┐
│  Player binary (T-400, future) — packaging, render loop│
├────────────────────────────────────────────────────────┤
│  THIS PACKAGE — @stageflip/runtime-on-device-player    │
│    boot / mount / unmount / shutdown                   │
│    gate chain: tenant flag → capability → harness      │
├────────────────────────────────────────────────────────┤
│  @stageflip/runtimes-interactive (T-306 + Phase γ)     │
│    InteractiveMountHarness                             │
└────────────────────────────────────────────────────────┘
                       │
                       └→ Telemetry sink (T-401, future)
```

## Refusal reasons

| Reason | Trigger |
|---|---|
| `tenant-flag-disabled` | `featuresInteractive === 'disabled'` |
| `preview-not-ga` | `featuresInteractive === 'preview'` (on-device requires GA) |
| `capability-insufficient` | The device's `DisplayDeviceCapability` lacks a hardware bit the clip family needs (shader → `hasGpu`, voice → `hasMicrophone`, network-using clips → `hasNetwork`) |
| `permission-refused` | The interactive tier's `PermissionShim` denied at mount time |
| `no-factory-registered` | No clip factory registered for the requested family in the binary's registry |

## Capability matrix

| Family | Required device bits |
|---|---|
| `shader` | `hasGpu` |
| `three-scene` | `hasGpu` |
| `voice` | `hasMicrophone` |
| `ai-chat` | `hasNetwork` |
| `live-data` | `hasNetwork` |
| `web-embed` | `hasNetwork` |
| `ai-generative` | `hasNetwork` (NOT `hasGpu` — generation is off-device) |

## See also

- `docs/decisions/ADR-005-frontier-clip-catalogue.md` §D4 + §D5
- `docs/implementation-plan.md` T-399 / T-400 / T-401
- `skills/stageflip/concepts/on-device-player/SKILL.md`
- `packages/runtimes/interactive/src/mount-harness.ts`
