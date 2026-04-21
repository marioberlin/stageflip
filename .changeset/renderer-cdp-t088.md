---
"@stageflip/renderer-cdp": minor
---

Export artifact storage (T-088 [rev]).

Defines the `ArtifactStore` interface — the home for completed
exports — and ships two reference implementations. Firebase Storage
adapter is deferred (mirrors the T-035..T-039 Firebase deferral
from Phase 1; non-blocking); plan row T-088 annotated `[rev]`.

New module `packages/renderer-cdp/src/artifact-store.ts`:

- `ArtifactStore` — `put(key, sourcePath)`, `has`, `get`, `list`,
  `delete`. Keys are path-safe: `[A-Za-z0-9._-]` segments joined by
  single-level `/`. `..`, absolute paths, double slashes, and
  non-ASCII characters are rejected.
- `sanitizeArtifactKey(key)` — exposed so callers can pre-validate
  before building a key dynamically.
- `InMemoryArtifactStore` — zero-IO, test-friendly; records every
  call via `.calls`, exposes `bytesFor(key)` for byte-level
  assertions. `localPath` is a synthetic `memory:<key>` URL.
- `LocalFsArtifactStore({ rootDir })` — filesystem-backed, one file
  per key; sub-directories created on demand. Key sanitation plus
  defence-in-depth `resolve` check blocks any write outside
  `rootDir`.

Test surface: 19 cases for the store (+ existing 140 = 159 total
across 15 files). Covers sanitiser edge cases (empty, leading /
trailing slash, `..`, invalid chars, non-string), in-memory +
FS round-trips (put/has/get/list/delete), nested-key directory
creation, missing-key null returns, list returns empty on
missing rootDir, delete is a no-op on absent keys.

Deferred: Firebase Storage adapter (tracked via the T-088 [rev]
marker in `docs/implementation-plan.md`, alongside Phase 1's
Firebase deferrals T-035..T-039).
