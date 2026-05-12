---
'@stageflip/audience-vevox': minor
---

T-482 — `@stageflip/audience-vevox` fourth vendor `AudienceBackendProvider`
adapter per ADR-009 §D8. Stub-mode v1 (production REST integration gated on
T-482a). Supports 7 of 11 `AudienceClipKind` discriminants — omits the three
motion-native differentiators AND `leaderboard` per the §D8 parity matrix
(Vevox does not support standalone leaderboard).
