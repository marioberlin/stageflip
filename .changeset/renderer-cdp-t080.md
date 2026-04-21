---
"@stageflip/renderer-cdp": minor
---

Vendor `@hyperframes/engine` into `packages/renderer-cdp/vendor/engine/` (T-080).

- Upstream: https://github.com/heygen-com/hyperframes
- Pinned commit: `d1f992570a2a2d7cb4fa0b4a7e31687a0791803d`
- License: Apache-2.0 (upstream `LICENSE` preserved at vendor root)
- Pin manifest: `packages/renderer-cdp/vendor/engine/PIN.json`

Drop-only: no wiring, no adapter, no dispatcher. Subsequent Phase 4
tasks build on top:

- T-081 — NOTICE file with StageFlip modification attributions.
- T-082 — vendor `README.md` explaining scope, modifications, and
  upgrade path.
- T-083 — ClipRuntime ↔ CDP bridge adapter.

Vendor directory is excluded from the package's typecheck (src-only
`tsconfig.include`) and test discovery (new `vitest.config.ts` scopes
`include` to `src/**`). The upstream engine's own test suite is kept
verbatim alongside the source but is not executed here.

Integrity is enforced by `src/vendor-integrity.test.ts` which asserts
LICENSE preservation, PIN.json shape (upstream / package / 40-char
commit / ISO date / license), and presence of the engine entrypoint.
