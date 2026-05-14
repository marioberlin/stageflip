---
'@stageflip/on-device-player-packaging': minor
---

New package: on-device player binary packaging + distribution scaffold per ADR-005 §D4 / T-400. Manifest schema (binary version, tenant, enabled packs + clip families, update channel, code-signing policy, health probe), per-OS package descriptors (3 first-class Linux targets; macOS/Windows/Android stubs), code-signing posture mirroring `@stageflip/pack-signing` (ed25519 / rsa-pss-sha256; 3 enforce levels), update-channel descriptor (stable/beta/canary), buildHealthProbe, bootOnDevicePlayer entrypoint scaffold. No actual binary compilation; that's the downstream build pipeline.
