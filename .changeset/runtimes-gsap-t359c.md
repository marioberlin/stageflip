---
"@stageflip/runtimes-gsap": patch
---

T-359c: fix tsx ↔ gsap ESM/CJS interop in `host.tsx`.

Switched `import { gsap } from 'gsap'` → `import gsap from 'gsap'` in
`packages/runtimes/gsap/src/host.tsx`. The named-import form loaded
under plain Node but crashed under tsx 4.21.0's esbuild loader (which
strips gsap's named re-exports — only `default` survives). gsap's
`default` IS the gsap namespace itself (gsap publishes
`export { gsap as default } from "gsap/gsap-core"`), so the simple
default-alias is the correct portable form.

Unblocks the prod-bound parity generator
(`scripts/generate-preset-parity-fixture-prod.ts`) which transitively
imports this runtime via `@stageflip/cdp-host-bundle`. Closes the
T-359b parity sign-off blocker. Behavior unchanged at runtime — only
the import form moves.
