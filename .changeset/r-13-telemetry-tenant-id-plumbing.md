---
'@stageflip/runtimes-interactive': minor
---

Close T-403 YELLOW residual R-13: thread tenantId through clip-level telemetry events. MountContext.tenantId (optional for back-compat) propagates to all 7 frontier-clip factories' emitTelemetry calls. Per-tenant incident triage now scoped per-event. PO direction 2026-05-15 (YELLOW batch 2). 2 YELLOW residuals remain for batch 3 (R-6 shader frame-budget + R-7 three-scene memory ceiling).
