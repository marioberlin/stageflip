---
title: Browser live-preview — same-origin isolation audit
id: docs/security-architecture/live-preview-isolation
related:
  - docs/security-review-track-a.md (R-16)
  - packages/runtimes/interactive/src/host/browser-live-preview.tsx
status: signed
reviewedAt: 2026-05-15
reviewer: codex (AI security reviewer per PO direction)
---

# Browser live-preview — same-origin isolation audit (R-16)

## 1. Scope

This document closes T-403 R-16. It records the deliberate same-origin
posture between the editor shell (`apps/stageflip-*`) and the
`BrowserLivePreview` React host
(`packages/runtimes/interactive/src/host/browser-live-preview.tsx`).
It enumerates what the editor shares with clip code at mount time,
what is segregated, the threat model, and the mitigations.

The audit DOES NOT redesign the boundary; the same-origin posture is
load-bearing for the React host's `useEffect` lifecycle, the clip
factory's direct DOM access, and the export pipeline's render-pass
observability. Re-architecting toward an iframe-isolated boundary is
out of scope for this risk closure and is tracked as a future
hardening item.

## 2. What is shared

The clip code that mounts inside `BrowserLivePreview` runs in the
EDITOR'S origin. As such it has read access to:

- The editor's `document` (full DOM) and every event listener
  attached to it.
- The editor's `window` properties.
- `document.cookie` (any cookie scoped to the origin without
  `HttpOnly`).
- `localStorage` and `sessionStorage` for the origin.
- `IndexedDB` databases on the origin (any database the clip can
  enumerate by name).
- `caches` (Cache Storage API) entries for the origin.
- Any `globalThis` modules / refs the editor leaves attached.

This is by design. The clip factory needs DOM access for primitives
like canvas mounting, Three-scene renderer attach, AudioWorklet mic
graph, and `<iframe>` web-embed insertion.

## 3. What is NOT shared (or is segregated)

- **Tenant API keys** — never persisted to `localStorage` or
  `sessionStorage`. The editor's tenant-vault credential pattern
  (per ADR-005 §D3 + the Phase 14 SecurityManifest contract)
  fetches credentials per-mount via the host shell's authenticated
  service worker route and holds them in closure scope of the
  provider seam (e.g., `LLMChatProvider` /
  `LiveDataProvider` / `AiGenerativeProvider`). Closure references
  are not enumerable from clip code that did not capture the seam
  itself.
- **Service worker scope** — the editor's service worker
  registers a scope that excludes `/preview/*` routes; the clip
  code cannot intercept editor fetches via service worker
  hijacking because the SW does not register a handler for the
  preview surface.
- **Chrome / cross-origin iframes** — any `<iframe>` mounted by
  `WebEmbedClip` runs in its own browsing context with the
  schema-enforced sandbox tokens (T-404 R-3 closure: a sandbox
  array containing both `allow-scripts` AND `allow-same-origin`
  is rejected at parse time). Inside-iframe code cannot reach
  the editor origin.

## 4. Threat model

A malicious or buggy preset that lands a clip into the live-preview
surface can:

1. **Read** `document.cookie`, `localStorage`, `sessionStorage`,
   IndexedDB databases.
2. Read every DOM node, including any rendered tenant data the
   editor has on screen.
3. Send fetched data to an attacker-controlled host (subject to the
   T-403 R-5 network gate during the warn window; subject to the
   T-404 R-1 LiveData SSRF allowlist for `LiveDataClip`).

What it CANNOT do:

1. Reach tenant API keys held in closure scope by the provider
   seams (see §3).
2. Bypass the T-403 R-12 per-tenant grant cache scoping (a
   tenant-A grant in this shim instance does NOT carry into a
   tenant-B mount on the same shim).
3. Intercept editor fetches via service worker registration —
   `/preview/*` is excluded from the editor SW scope.

## 5. Mitigations

### 5.1 Existing (pre-R-16)

- **Pack signing** (`@stageflip/pack-signing`) — every preset that
  ships a clip in the live-preview surface is signed; pack-loader
  refuses unsigned packs in production.
- **Schema-level credential-header denylist** (T-404 R-2) — the
  `LiveDataClip` schema rejects `headers` keys that match
  canonical credential names.
- **Permission envelope** (`PermissionShim`) — `mic` / `camera`
  cannot be acquired without the per-(family) browser prompt; the
  R-12 closure ensures this prompt's grant does not leak across
  tenants on the same shim.
- **Network gate** (T-404 R-5) — `'network'` permission consults
  the global host allowlist; warn-then-enforce rolls in
  2026-06-13.

### 5.2 Added by R-16

- **Defensive observability hook** — `BrowserLivePreview` now runs
  a one-time per-page-load audit at first mount that scans
  `localStorage` keys for credential-shaped tokens
  (`apikey`, `api_key`, `api-key`, `secret`, `token`, `bearer`,
  `password`, `credential`). Any match is reported via the
  configurable `setLivePreviewCredentialAuditSink(sink)` hook;
  default sink is `console.warn`. Production hosts SHOULD route
  this to OTel.
- This is INSTRUMENTATION, not enforcement. A match means
  "operator should investigate"; it does not block live-preview
  mount.

### 5.3 Recommended follow-up (not blocking R-16 closure)

- **Same-origin-isolation lint check** — a future ESLint /
  Biome plugin that flags editor code paths writing
  credential-shaped values to `localStorage` /
  `sessionStorage`. Tracked as future hardening; out of scope
  for the YELLOW closure batch.
- **CSP for preview surface** — a `Content-Security-Policy`
  header restricting `connect-src` on `/preview/*` to
  allowlisted hosts. Pairs naturally with the T-404 R-5
  network gate's host allowlist.
- **Iframe-isolated preview** — the load-bearing design choice
  to keep live-preview same-origin can be revisited if the
  threat model shifts; a dedicated `<iframe sandbox="">` host
  with `postMessage` handshake would close the residual
  cross-origin attack surface entirely. Significant
  re-architecture; not a R-16 closure prerequisite.

## 6. Audit conclusion

The same-origin posture is intentional, documented, and the residual
risks are bounded by:

- Tenant credentials never landing in localStorage (provider seams
  hold them in closure scope only).
- Pack signing gating which clips can mount.
- Per-tenant grant cache scoping (R-12).
- Network gate (R-5) plus LiveData SSRF allowlist (R-1).

R-16 is closed as MITIGATED. The defensive observability hook
provides the missing visibility into accidental credential storage;
the recommended CSP + iframe follow-ups are future hardening items
tracked but not blocking GA.
