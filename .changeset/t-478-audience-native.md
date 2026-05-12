---
'@stageflip/audience-native': minor
---

T-478 — `@stageflip/audience-native` first concrete `AudienceBackendProvider` impl
wrapping the T-453 `AudienceResultsStore`. Stub-mode v1 (matches P14 reference-
adapter convention); covers all 11 `AudienceClipKind` discriminants including the
three motion-native differentiators. Includes static descriptor, provider factory,
and security manifest per T-446.
