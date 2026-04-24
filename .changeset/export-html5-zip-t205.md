---
"@stageflip/export-html5-zip": minor
---

T-205: File-size optimizer passes for `@stageflip/export-html5-zip`.

Three pre-pack optimisation passes that run over an `HtmlBundle` before
it enters the deterministic ZIP packer. MIT/BSD-only runtime deps —
`sharp` (LGPL-3.0) is **not** pulled in; callers who want native image
re-encoding register their own `ImageOptimizer` after ADR-ing the dep
per CLAUDE.md §3.

- **`stripUnusedCssFromHtml(html)`** (`optimize/unused-css.ts`): walks
  every inline `<style>` block, drops selectors whose tag / class / id
  atoms don't appear in the document. Conservative — attribute
  selectors, `:has()`, `:is()`, and any other unfamiliar syntax keep
  the rule. `@media` / `@keyframes` at-rules pass through untouched.
- **`minifyInlineJsInHtml(html)`** (`optimize/minify-js.ts`): runs
  terser (BSD-2-Clause) on every inline `<script>`. Skips `src=`-loaded
  scripts (IAB budget forbids runtime fetches anyway) and non-JS
  `type=...` scripts (JSON-LD, module-maps). On terser parse-error
  keeps the original — never drops a script because the banner still
  needs to run.
- **`optimizeHtmlBundle(bundle, opts)`** (`optimize/index.ts`):
  end-to-end pass. Applies CSS + JS passes + an optional pluggable
  `ImageOptimizer` (runs on `.png/.jpg/.jpeg/.gif/.webp/.avif` assets
  only; must preserve `asset.path`). Options let callers disable any
  pass and pass custom terser options.

Deterministic — identical inputs produce byte-identical output. 44 new
tests (25 unused-css + 10 minify-js + 9 end-to-end), 98.8% coverage on
the package. New runtime dep: `terser 5.46.2` (BSD-2-Clause, on the
whitelist).
