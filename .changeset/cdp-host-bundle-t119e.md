---
'@stageflip/cdp-host-bundle': patch
---

T-119e: fix bundle-boot regression in real Chrome.

`vite.config.ts` was missing a `define` for `process.env.NODE_ENV`.
In library mode (what we're in for the IIFE build) Vite does NOT
auto-substitute the constant like it does in app mode. The browser
IIFE contained 12 raw `process.env.NODE_ENV` references (mostly from
React + react-dom) which threw `ReferenceError: process is not
defined` at boot — `window.__sf.ready` never flipped, and any
consumer using `createRuntimeBundleHostHtml` timed out waiting.

The 28 unit tests under happy-dom didn't catch this because happy-dom
provides a `process` polyfill. The existing `reference-render.e2e`
suite didn't catch it because it uses `canvasPlaceholderHostHtml`,
not the real bundle. T-119b surfaced the symptom; T-119e pins the
root cause and fixes it in 3 lines.

After the fix:
- Bundle shrinks 1.58MB → 1.27MB raw (production-mode React)
- Gzipped size 313.82KB → 323KB (still well under the 500KB budget)
- `pnpm parity:prime --reference-fixtures --out …` produces all 9
  PNGs in ~5s locally; render-e2e CI job firms up T-119c's
  previously-lenient `continue-on-error` guard.

No public API change.
