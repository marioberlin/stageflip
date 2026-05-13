---
'@stageflip/pack-trial': minor
'@stageflip/pack-format': minor
'@stageflip/pack-loader': minor
'@stageflip/engine': minor
---

T-505 — Trial / demo mode for paid packs. New leaf package
`@stageflip/pack-trial` ships a three-state policy machine
(`'none' | 'trial-active' | 'trial-expired'` via `evaluateTrialPolicy`)
and the canonical watermark request shape (`WATERMARK_TEXT`,
`defaultWatermarkRequest()` returning a frozen `{ text, opacity:
0.18, position: 'bottom-right' }`). Two new loss-flag codes land in
`@stageflip/pack-format`'s catalogue: `LF-LICENSE-TRIAL-ACTIVE`
(warn) and `LF-LICENSE-TRIAL-EXPIRED` (error). The
`@stageflip/pack-loader` extends `TenantEntitlement.status` with a
`'trial'` variant; install-time gate 5 admits trial entitlements
whose `expiresAt` is missing / in the future, and denies expired
trials via the existing `LF-LICENSE-PACK-DENIED` code. The engine's
`LicenseRuntime.canMountClip` branches on `'trial'` status: active
trials return `{ ok: true, warning: { code:
'LF-LICENSE-TRIAL-ACTIVE', detail } }` (new optional `warning?` field
on `LicenseMountResult`); expired trials return `{ ok: false, reason:
'LF-LICENSE-TRIAL-EXPIRED', detail }`. The visual watermark
rendering itself is deferred to a renderer-core integration; this
package ships the policy + the request shape only. Library lives
OUTSIDE the determinism perimeter per CLAUDE.md §3 (renderer
consumes the request deterministically).
