---
"@stageflip/presets-titles": patch
---

Cluster D regression — revert 5 presets to pending-user-review after PO ratification 2026-05-08 caught a multi-clip composition rendering bug.

T-348 / T-351 / T-352 / T-353 / T-349 all rendered as blank or near-blank frames in their parity goldens. The `ClipKindBinding.overlays?` mechanism wires elements correctly into RIRDocument.elements, but the parity-CLI renderer treats each entry as an isolated rendering surface with an opaque white background — z-stacked overlays cover the parent titleSequence's title content. The TOPMOST overlay (photographic-overlay) is the only thing visible, explaining the pale-yellow tint for sepia mode and pure-white for cinematic-LUT/fade modes.

Parity-fixture-scoring CI passed because both expected and actual goldens are equally blank (byte-identical). PO visual ratification caught it.

`squid-game-geometric` (T-350; pre-multi-clip mechanism; signed prior session 2026-05-05) renders correctly and remains signed.

Cluster D goes 6/6 ELIGIBLE → 1/6 NOT ELIGIBLE. The 5 spec docs + 5 impl PRs stay on main as architectural-pattern deliverables. Re-signing happens after the multi-clip composition bug is fixed (separate task).

See `docs/handover-cluster-d-regression.md` for the full finding + remediation plan.
