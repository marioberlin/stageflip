---
'@stageflip/pack-format': minor
'@stageflip/pack-loader': patch
'@stageflip/pack-publish-cli': patch
---

T-502 — engine ↔ pack-format `manifestVersion` compatibility matrix.

New surface in `@stageflip/pack-format`: `COMPATIBILITY_MATRIX`,
`isCompatible(engineVersion, manifestVersion)`,
`readableManifestVersions(engineVersion)`,
`matchingRows(engineVersion)`, plus the `CompatibilityRow` type. The
matcher utility `satisfiesRange` moves from `@stageflip/pack-loader` to
`@stageflip/pack-format` (pack-loader keeps a re-export shim for
back-compat — no consumer-visible change).

`@stageflip/pack-loader` gains a SECOND install-time compatibility
check: after the existing manifest-declared `platformCompatibility`
range gate, the loader consults `isCompatible(engineVersion,
manifest.manifestVersion)`. Failure surfaces as
`LF-PACK-INCOMPATIBLE-VERSION` (same code; differentiated detail
string). Dormant today (`manifestVersion` is `z.literal('1')` and the
single matrix row covers `>=2.0.0 → ['1']`); activates when
`manifestVersion: '2'` ships.

`@stageflip/pack-publish-cli`'s `validate` command emits a new
`compatibility-advisory` warn-level issue: prints the matching matrix
row's `note` for valid packs, or warns when a pack declares a
`manifestVersion` not listed in any row. Never fails the validate
gate — publisher does not know which engine versions consumers will
run.

See `docs/handover-pack-compatibility-matrix.md` for the bump policy
and two-gate model.
