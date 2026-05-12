---
'@stageflip/audience-contract': minor
'@stageflip/storage': minor
'@stageflip/app-api': minor
---

T-473 — Quiz fairness. Adds pure Kahoot-canon scoring primitives
(`computeQuizScore` + `applyLateJoinerLock`) on
`@stageflip/audience-contract`, an optional `quizState?` field on
`AudienceSessionDoc` + an `updateQuizState` mutator on
`AudienceResultsStore` (in-memory impl) on `@stageflip/storage`, and a
server-side `QuizStateManager` + WS `live-quiz` vote routing on
`@stageflip/app-api`. Late-joiner-lock rejections reuse
`LF-AUDIENCE-VOTER-RATE-LIMITED` per the frozen T-452 inventory; voter
scores persist on the session doc so disconnect/reconnect resumes at
the cumulative tally.
