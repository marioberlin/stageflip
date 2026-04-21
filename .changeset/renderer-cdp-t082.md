---
"@stageflip/renderer-cdp": minor
---

Author `packages/renderer-cdp/vendor/README.md` (T-082).

Human-readable index to the vendor directory: what's vendored, why
we vendor rather than reimplement, how vendored code is excluded
from the package's gates, the modification policy, and the upgrade
protocol for re-pinning to a new upstream commit.

Cross-links to `NOTICE`, `engine/LICENSE`, `engine/PIN.json`,
`THIRD_PARTY.md` §2, and `docs/dependencies.md` §5 so the provenance
story can be read starting from any of those files.

Calls out the in-scope / out-of-scope boundary for the vendor drop:
CDP engine is vendored; `@hyperframes/core`'s two helpers used by
engine (`MEDIA_VISUAL_STYLE_PROPERTIES`, `quantizeTimeToFrame`) are
NOT vendored — T-083 decides whether to re-implement or vendor a
second payload.

`vendor-integrity.test.ts` extended with 5 cases covering README
existence, engine pin match, the "why + upgrade + ADR" rationale
prose, the modifications section, and cross-references to the four
canonical provenance files.
