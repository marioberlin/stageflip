---
'@stageflip/audience-contract': minor
---

T-484 — WebEmbed allowlist update for audience origins. Adds
`AUDIENCE_BACKEND_ORIGINS` constant + `isAudienceBackendOrigin` helper to
`@stageflip/audience-contract`. Lists the 10 vendor origins (api + app for
Slido / Mentimeter / Poll Everywhere / Vevox / Wooclap) that the
`audience-network` permission scope grants WebEmbed egress to. Applies the
ADR-005 amendment T-393 landed.
