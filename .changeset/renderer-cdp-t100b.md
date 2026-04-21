---
"@stageflip/renderer-cdp": minor
---

BeginFrame capture integration for `PuppeteerCdpSession` (T-100b).

**The deterministic-fidelity gap closes.** Before this task,
`PuppeteerCdpSession.capture()` always went through
`page.screenshot()` — non-deterministic across runs because
Chrome's real compositor cadence leaks through. T-100b adds an
alternative capture path using `HeadlessExperimental.beginFrame`,
which drives the compositor atomically with a caller-supplied
virtual clock. Same session API (`mount` / `seek` / `capture` /
`close`), new `captureMode` option picks the protocol.

**Capture mode selection** via the new `CaptureMode` type:

- `'auto'` (default) — BeginFrame when the host platform is Linux
  AND the page exposes `createCDPSession` AND the runtime probe
  confirms `HeadlessExperimental.beginFrame` is callable;
  screenshot otherwise. Auto never throws — an unsupported
  environment silently downgrades so a macOS dev machine still
  produces (non-deterministic) captures without extra config.
- `'beginframe'` — force BeginFrame. Throws at mount time if the
  page has no CDP client or if the probe fails. For CI on
  chrome-headless-shell.
- `'screenshot'` — force the pre-T-100b behaviour.

**New exports from `@stageflip/renderer-cdp`**:

- `CaptureMode` type.
- `BEGIN_FRAME_LAUNCH_ARGS` — frozen readonly array of the
  Chrome flags the BeginFrame protocol needs (`--deterministic-mode`,
  `--enable-begin-frame-control`, and friends). Cross-referenced
  with the vendored engine's `browserManager.ts`.
- `probeBeginFrameSupport(cdp, { timeoutMs? })` — the runtime probe;
  returns boolean, never throws. Caller decides the fallback.
- `PuppetCdpClient` interface (narrow `.send()` + `.detach()`
  slice of puppeteer-core's `CDPSession`).

**API seam extensions**:

- `PuppetPage.createCDPSession?()` is now an optional method on
  the `PuppetPage` interface. Production `puppeteer-core` pages
  satisfy it automatically; test fakes that only exercise the
  screenshot path can continue to omit it.
- `PuppeteerCdpSessionOptions.captureMode` + `platform` options.
  The `platform` injection is a test-only escape hatch so the
  Linux-gated BeginFrame branch is exercisable from macOS CI.
- `createPuppeteerBrowserFactory({ captureMode: 'beginframe' })`
  appends `BEGIN_FRAME_LAUNCH_ARGS` to the launch args. Other
  modes leave args untouched — `--enable-begin-frame-control`
  under screenshot mode wedges the compositor.

**Per-handle BeginFrame state**:

- `beginFrameIntervalMs` (= `1000 / fps`) initialised at mount.
- `beginFrameTimeTicks` advanced by `seek(frame)` to
  `frame * intervalMs`. Absolute, not relative — non-monotonic
  seeks (scrub preview) still render correctly.
- `close(handle)` detaches the CDP client before closing the page
  (detach errors swallowed).

**Intentionally NOT in scope** (deferred to T-100c): real
React + runtime-mounting host HTML bundle. The canvas placeholder
remains the default host. BeginFrame is fully wired today but
against the placeholder — the parity harness can still exercise
the BeginFrame path via goldens captured under the placeholder.

**Tests**: +15 cases in `puppeteer-session.test.ts` (11 → 26).
Covers mode selection (auto on darwin/linux, explicit beginframe /
screenshot), probe success / failure / timeout, BeginFrame clock
advancement, forced secondary beginFrame when `screenshotData` is
absent, error propagation, and `close(handle)` CDP detach
ordering. The three-fixture e2e reference-render suite still
passes on macOS (auto correctly falls through to screenshot).

**Skill**: `skills/stageflip/reference/export-formats/SKILL.md`
updated — the "Concrete implementation" section now documents
both protocols + auto-fallback + per-frame clock; the
"Determinism (structural)" section updates the old screenshot-gap
language; the module-surface table gains the new T-100b exports;
the deferred-work table drops the BeginFrame line (T-100c still
owns the real host bundle).
