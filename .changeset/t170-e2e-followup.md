---
'@stageflip/app-slide': patch
'@stageflip/editor-shell': patch
---

T-170 follow-up — align the AI copilot UI + e2e coverage with the new
`/api/agent/execute` contract.

- Copilot now branches explicitly on `kind: 'not_configured'` (new 503
  path) and `kind: 'applied'` (the real orchestration result). Applied
  results render a one-line summary of `<stepCount> steps, validation:
  <tier>`; detailed diff preview is downstream work.
- New i18n key `copilot.notConfigured` carries the
  `ANTHROPIC_API_KEY` hint.
- Playwright smoke updated: the "assistant reply" assertion now
  accepts `Error:`, `ANTHROPIC_API_KEY`, `not configured`, or the
  legacy `Phase 7` phrasing (any of the documented response paths is
  valid during rollout). Two new API-level specs assert the 400
  `invalid_request` + 503 `not_configured` paths directly.
- Two new unit tests cover the `not_configured` and `applied` render
  branches.

No behaviour change for already-wired deploys — this is pure rollout
alignment.
