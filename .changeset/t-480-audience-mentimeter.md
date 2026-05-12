---
'@stageflip/audience-mentimeter': minor
---

T-480 — `@stageflip/audience-mentimeter` second vendor `AudienceBackendProvider`
adapter per ADR-009 §D8. Stub-mode v1 (production REST integration gated on
T-480a). Supports 8 of 11 `AudienceClipKind` discriminants (omits the three
motion-native differentiators per ADR-010 §D7). Mirrors T-479 structurally
with Mentimeter-specific vendor fields.
