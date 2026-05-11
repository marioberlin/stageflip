---
"@stageflip/audience-contract": minor
---

T-452 — New `@stageflip/audience-contract` package per ADR-009 §D2 / §D11 +
ADR-010 §D2 / §D3 / §D5. Pure-contracts package shipping
`AudienceBackendProvider` (extends `AdapterDescriptor` from T-418; four
methods openSession / submitVote / subscribe / closeSession),
`AudienceCapabilityDescriptor` + `validateAudienceCapability`,
`VotePayload` discriminated union (10 variants; leaderboard excluded per
ADR-010 §D2 derived-clip invariant), `AggregationSnapshot` +
`AggregationValue` discriminated union (11 variants), `AudienceProvenance`
schema preview, and sealed `LF_AUDIENCE_CODES` const array of 8 codes.
First post-hard-gate task in Phase 15 α. Mirrors T-419
(`@stageflip/asset-gen-contract`) structurally.
