---
'@stageflip/audience-slido': minor
---

T-479 — `@stageflip/audience-slido` first vendor `AudienceBackendProvider` adapter
per ADR-009 §D8. Stub-mode v1 (production REST integration gated on T-479a).
Supports 8 of 11 `AudienceClipKind` discriminants (omits the three motion-native
differentiators per ADR-010 §D7). Includes static descriptor, provider factory
with mode discriminator, and security manifest declaring remote-network
perimeter.
