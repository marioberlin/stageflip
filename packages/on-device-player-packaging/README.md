# @stageflip/on-device-player-packaging ⚠ DEPRECATED 2026-05-15

> **Deployment target dropped per PO 2026-05-15.** On-device player removed from the StageFlip product roadmap; binary will NOT be built; no consumer is planned. This package remains in-tree as a deprecated scaffold. See `ADR-005 §D4` (amended) + `skills/stageflip/concepts/on-device-player/SKILL.md`. **Do NOT add new work here without first reverting the deprecation.**

---

Binary packaging + distribution scaffold for the on-device display
player. Implements T-400 of the Phase 13 / γ-deploy block.

Per ADR-005 §D4 + L141, the on-device player is a **separate binary**
with its own supply chain and update mechanism — security blast-radius
is higher than browser-only clips per `docs/security-review-track-a.md`
R-11. This package is the host-side scaffold that wraps the runtime
shim (`@stageflip/runtime-on-device-player`, T-399) into a deployable
artifact. Actual native binary compilation is downstream of this
workspace.

## Surfaces

| Module | Purpose |
|---|---|
| `manifest.ts` | `OnDeviceBinaryManifest` Zod schema + atomic `readManifest` / `writeManifest`. |
| `update-channel.ts` | `UpdateChannelDescriptor` (stable / beta / canary) + `resolveUpdate(fetcher)`. |
| `code-signing.ts` | `CodeSigningPolicy` (strict / warn / off) + `verifyBinarySignature` (ed25519 + RSA-PSS-SHA256). |
| `package-os.ts` | `PackageDescriptor` for the 7 declared OS targets. 3 first-class Linux variants; 4 stub. |
| `health-probe.ts` | `buildHealthProbe` pure builder. Status: healthy / degraded / failing. |
| `entrypoint.ts` | `bootOnDevicePlayer` — the binary's `main()` calls into this. |

## Boot sequence

```
manifest read → signature verify → capability coverage → shim.boot()
       │                │                  │                  │
       ▼                ▼                  ▼                  ▼
'manifest-invalid' 'signature-rejected' 'capability-mismatch' 'booted'
```

## First-class OS targets

| Target | Format | Use case |
|---|---|---|
| `linux-x64` | `tar.gz` | DOOH x86 media players |
| `linux-arm64` | `tar.gz` | DOOH ARM media players |
| `embedded-linux-arm` | `tar.gz` | Yocto / Buildroot signage |

`darwin-x64`, `darwin-arm64`, `win32-x64`, `android-arm64` are declared
in the schema for forward compatibility but produce no artifact at MVP.

## Code-signing posture

Mirrors `@stageflip/pack-signing`: publisher keys are pinned at
provisioning time (TOFU). The default algorithm is **ed25519**;
**RSA-PSS-SHA256** is supported for vendor / regulatory environments
that mandate RSA. The three `enforce` modes:

- `strict` — required on production devices. Refuse boot on any
  refusal arm.
- `warn` — telemetry-only; suitable for canary / beta channels.
- `off` — developer dev-loop only; never used on production devices.

## See also

- `docs/decisions/ADR-005-frontier-clip-catalogue.md` §D4 + L141
- `docs/implementation-plan.md` T-399 / T-400 / T-401
- `docs/security-review-track-a.md` §2.10 + R-11 + §3
- `skills/stageflip/concepts/on-device-player/SKILL.md`
- `packages/runtime-on-device-player/` (T-399, the runtime shim this
  scaffold boots)
- `packages/pack-signing/` (the publisher-key + TOFU pattern this
  package mirrors)
