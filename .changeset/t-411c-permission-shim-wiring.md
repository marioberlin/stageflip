---
'@stageflip/runtimes-interactive': patch
---

T-411c — Permission-shim wiring for tenant frontier flag (3rd of T-411
multi-PR sequence).

Adds `packages/runtimes/interactive/src/host/tenant-flag-cache.ts` — a
tenant-flag cache with a sync `readSync(tenantId, target)` mount-time
read (pure, hot-path safe) and an async `populate(tenantId)` populator
(the only network/await surface, called from the host shell at session
start). Default-deny on populator returning `null` (T-411 D-T411-5).

Wires the D-T411-4 `(features.interactive, target)` matrix into the
existing `PermissionShim`'s mount-time check via a new optional
`tenantFlagGate` mount option that runs as STEP 0 (before the existing
tenant-policy gate). When omitted, the shim behaves exactly as the
T-306 / T-385 baseline (back-compat).

The `PermissionResult.reason` discriminator gains a third value
`'tenant-flag-denied'`; consumers using `assertNever`-style
exhaustiveness will need to add a case.

NO admin UI (T-411e); NO docs cross-link or skill file (T-411d).
NOT a structural extension per CLAUDE.md §13 — wires existing storage
contract (T-411a) into existing permission-shim. Render verification
N/A.
