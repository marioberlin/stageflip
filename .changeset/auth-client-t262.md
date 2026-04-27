---
'@stageflip/auth-client': minor
---

T-262 — initial release. React hooks for
`apps/stageflip-{slide,video,display}`: `useCurrentUser`,
`useCurrentOrg`, `useRole`, and the `switchOrg` action that calls
the `setActiveOrg` callable + force-refreshes the ID token. No
hard dep on `firebase` — consumers wire a structurally-compatible
`AuthClient`. Source of truth:
`skills/stageflip/concepts/auth/SKILL.md`.
