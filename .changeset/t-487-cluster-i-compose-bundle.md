---
'@stageflip/engine': minor
'@stageflip/app-agent': minor
---

T-487 — Cluster I `compose_*` semantic-tools bundle. Adds the 27th canonical
bundle `cluster-i-compose` with 3 read-only composer tools that bind a
semantic Cluster I (Live audience) brief to a ratified preset id +
audience clipKind + opaque props payload:

- `compose_live_poll` → `slido-classic-poll` | `mentimeter-bar-vote`
- `compose_audience_qa` → `bbc-question-time` | `conference-qa-upvote`
- `compose_quiz_round` → `kahoot-competitive` | `classroom-quiz`

Output is `(presetId, clipKind, props)`. Closes Cluster I.
