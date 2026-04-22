---
'@stageflip/app-slide': minor
---

T-128 — AI copilot stub: `<AiCopilot>` right-rail sidebar (chat log +
input), `<AiCommandBar>` header with status + close, `<AiVariantPanel>`
empty-state scaffold. Submitting a prompt POSTs to the existing
`/api/agent/execute` route (501 today) and renders a "Phase 7"
placeholder. Sidebar opens via a header toggle or `Mod+I`, closes on
`Escape` (scoped via `useRegisterShortcuts`). Three components +
`executeAgent` fetch wrapper + i18n keys for copilot status, welcome,
variants, and error copy. No document writes; Phase 7 will wire the
planner/executor/validator behind the same fetch seam.
