---
'@stageflip/app-audience-join': minor
'@stageflip/audience-join-shared': minor
'@stageflip/editor-shell': minor
---

T-456 — Audience-join UX (P15 β fifth post-hard-gate).

Three concerns ship together:

1. `apps/audience-join` (NEW) — Next.js 15 voter landing page on port
   3500. Routes:
   - `/` — instructions + manual session-id entry form.
   - `/[sessionId]` — voter landing. Mints a voter token via
     `POST /v1/audience/sessions/:sessionId/join` (T-453), opens an
     `AudienceClient` (T-454) against an injected `AudienceBackendProvider`
     (a stub provider ships in-app pending the native browser
     provider T-478), and dispatches per-clip-kind voter UI through
     `<VoterInputDispatcher>`. The connection-status banner surfaces
     the join → connecting → connected → reconnecting → disconnected
     lifecycle plus `LF-AUDIENCE-CONNECTION-LOST` on
     reconnect-budget exhaustion (ADR-009 §D6).
2. `<AudienceJoinModal>` in `@stageflip/editor-shell` (NEW) — QR +
   room-code surface the editor mounts when a presenter opens an
   audience clip's "Invite voters" affordance. Uses the `qrcode` MIT
   lib for QR generation. Tenant-feature-gated via the
   `tenantAudienceEnabled` prop the editor injects from
   `TenantSettings.features.audience.enabled`; when `false`, the modal
   renders a "audience features are disabled for your tenant" notice
   instead of the QR.
3. `@stageflip/audience-join-shared` (NEW workspace package) — pure,
   browser-safe helpers both consumers import:
   - `roomCodeFor(sessionId): Promise<string>` — deterministic 6-char
     code over a Crockford-style alphabet (excludes I, O, 0, 1) backed
     by `crypto.subtle.digest`. Pure.
   - `voterUrlFor({ baseUrl, sessionId })` — voter URL builder with
     baseUrl validation.

Per-clip-kind voter UIs (e.g. `<LivePollMultipleChoiceVoterInput />`)
remain owned by T-461..T-471 — T-456 ships the dispatcher + a generic
`<UnregisteredKindFallback>` placeholder. The default voter-input
registry is empty; downstream tasks register their kinds.

Not a structural extension (per docs/tasks/T-456.md §13 statement) —
adds a new app + new modal but does not change the document model, the
binding model, or the renderer pipeline. Render verification not
applicable; voter UX is exercised via the new
`apps/audience-join/e2e/voter-flow.spec.ts` Playwright smoke (stubs
the apps/api join endpoint via `page.route`) plus unit-level tests on
each new component.

Adds `qrcode@^1.5.4` (MIT — verified by `pnpm check-licenses`).
