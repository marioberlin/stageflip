---
"@stageflip/cdp-host-bundle": minor
"@stageflip/renderer-cdp": minor
---

Runtime bundle host — scaffold + CSS runtime (T-100d).

**New package `@stageflip/cdp-host-bundle`**: a Vite-emitted browser
IIFE that bundles React + ReactDOM + `@stageflip/frame-runtime` +
`@stageflip/runtimes-contract` + `@stageflip/runtimes-css` + a
React composition renderer. Inlined into the host HTML so Chrome
loads one self-contained file — no module resolution, no network.

**What the bundle does at boot**:

1. Registers `@stageflip/runtimes-css` with the shared runtime
   registry (other 5 runtimes land with T-100e).
2. Reads the `RIRDocument` from the `<script id="__sf_doc"
   type="application/json">` tag that the host HTML embeds.
3. Mounts `<BootedComposition>` (a `FrameProvider` wrapping a
   `<Composition>`) into `#__sf_root` at frame 0.
4. Exposes `window.__sf.setFrame(n)` — every call re-renders via
   `createRoot().render()` so React diffs frame-to-frame instead
   of re-mounting.
5. Sets `window.__sf.ready = true`.

**Module surface**:

- `Composition({ document, frame })` — React component. Walks
  `document.elements`, renders shape / text / clip / video-image /
  unknown. Clip elements dispatch through `findClip(kind)` and
  return a labelled `__sf_placeholder` when the runtime is missing
  or mismatched. Hides elements outside `[startFrame, endFrame)`
  AND when `element.visible === false` (same semantic as
  `richPlaceholderHostHtml` from T-100c).
- `BootedComposition` — `<FrameProvider>` wrapping `<Composition>`.
  Lets runtime-rendered clips call `useCurrentFrame()`.
- `loadBundleSource()` — async reads `dist/browser/bundle.js`
  relative to the package root. Walks up from `import.meta.url` to
  find `package.json` so it works both from `src/` (tests against
  source) and `dist/node/` (production).
- `bundlePath()` — path-only variant.

**Builder wiring in renderer-cdp**:

- New `createRuntimeBundleHostHtml(bundleSource)` in
  `packages/renderer-cdp/src/puppeteer-session.ts`. Returns a
  `HostHtmlBuilder` that emits an HTML document containing
  `#__sf_root`, the document JSON in a `<script
  type="application/json">` tag (with the same `</script` + U+2028/29
  escapes as `richPlaceholderHostHtml`), and the compiled IIFE.
- Exported from `@stageflip/renderer-cdp`.

**Intentionally NOT in scope (T-100e)**: GSAP, Lottie, Shader,
Three, frame-runtime-bridge runtimes. Each adds significant
bundle weight (three.js alone ≈ 1 MB) and each needs its own
integration checks — better as separate reviewable units.

**Build**: the package exposes `pnpm build` which runs Vite
(emits `dist/browser/bundle.js` — ~636 KB, ~194 KB gzipped) then
tsup (emits `dist/node/index.js` — ESM-only, dropping CJS because
`import.meta.url` is unavailable there). The renderer-cdp
workspace dep picks up both at runtime via the package `exports`
map.

**Plan-row split** in `docs/implementation-plan.md`: T-100d
narrowed to "scaffold + CSS runtime" (M), T-100e added for "add
GSAP / Lottie / Shader / Three / frame-runtime-bridge" (M). The
original L-sized T-100d would have landed React + 6 runtimes + a
Vite build pipeline in one PR — too much for one review. Plan
version bumped v1.3 → v1.4.

**Tests**: 13 new cases across
`packages/cdp-host-bundle/src/composition.test.tsx` (11: shape /
text / timing window / editorial visible / clip dispatch / missing
runtime / runtime-id mismatch / zIndex / root dimensions / frame
stamp / BootedComposition smoke) and
`packages/cdp-host-bundle/src/index.test.ts` (2: `loadBundleSource`
reads the compiled IIFE + `bundlePath` matches `loadBundleSource`'s
read path). All 9 CI gates green.

**Skill**: `skills/stageflip/reference/export-formats/SKILL.md`
updated — the pluggable-host section now documents all three
builders (third is partial), module-surface table adds the T-100d
exports, deferred-work row re-aimed at T-100e.
