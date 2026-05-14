---
'@stageflip/runtime-on-device-player': minor
---

New package: on-device display player runtime shim per ADR-005 §D4 (T-399). GA-gated; refuses live-mount unless `tenantPolicy.featuresInteractive === 'ga'`. Includes 5-reason refusal enum (tenant-flag-disabled, preview-not-ga, permission-refused, capability-insufficient, no-factory-registered), per-clip-family capability matrix (shader→GPU, voice→mic, network-clips→network, etc.), `InteractiveMountHarness` adapter, telemetry seam consumed by T-401. Binary packaging is T-400.
