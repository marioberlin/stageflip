---
"@stageflip/runtimes-interactive": minor
---

T-385: permission envelope UX + enforcement — `usePermissionFlow` hook, denial banner, pre-prompt modal.

`@stageflip/runtimes-interactive`:

- New subpath export `@stageflip/runtimes-interactive/permission-flow` carrying the React surface that wraps `PermissionShim` (T-306) with a state machine + telemetry hooks. State discriminator `PermissionFlowState = idle | pre-prompt | requesting | granted | denied`; `denied.reason` widens to include `'pre-prompt-cancelled'` (D-T385-4).
- `usePermissionFlow(clip, { shim, prePrompt?, emitTelemetry? })` hook drives the state machine, calls `shim.mount()` on entering `requesting`, and clears the failed permission's cache entry on `retry()`. Tenant-denied retries are no-ops (AC #6). The seven D-T385-5 telemetry events (`permission.pre-prompt.shown` / `.confirmed` / `.cancelled`, `permission.dialog.shown`, `permission.retry.clicked` / `.granted` / `.denied`) layer on top of the shim's existing `tenant-denied` / `permission-denied` channel without replacing it.
- `<PermissionDenialBanner>` + `<PermissionPrePromptModal>` ship as the default visual surface. Both accept all user-facing text via `messages` props — no English-string defaults live in the package, per CLAUDE.md §10 (verified by an in-package i18n posture test). Both components forward `data-testid` (AC #14).
- `PermissionShim.clearCacheEntry(family, permission)` — production-callable per-key cache invalidation used by the retry path. The existing `clearCache()` test seam is preserved unchanged.
- `MountContext.permissionPrePrompt?: boolean` — backward-compatible optional field that signals to consuming factories the user came through a pre-prompt branch (D-T385-4).
- `InteractiveMountHarness.mount(clip, root, signal, { permissionPrePrompt? })` accepts a new mount-options argument; pre-existing 3-arg callers continue to type-check (AC #19, #20). When the flag is on AND the harness was constructed with `permissionPrePromptHandler`, the harness yields a pre-prompt cycle before the shim. Cancelling routes to `staticFallback` with a new `mount-fallback` reason `'pre-prompt-cancelled'`.
- No schema changes — permissions are already typed in `@stageflip/schema/clips/interactive` (D-T385-8).
