---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-348a — Cluster D multi-clip composition rendering fix (Phase 2 of regression remediation).

`photographic-overlay` SVG container declares `mix-blend-mode: multiply`
so the post-filter tonal output composites multiplicatively with content
rendered below in the z-stack rather than masking it. Solo-use against
the host's white canvas backdrop is byte-identical to pre-T-348a output
(`white × tinted-white = tinted-white`); multi-clip overlay-use tints
underlying content (`titleSequence-content × tinted-white = tinted-content`).

`title-sequence` no longer hard-codes `#000000` when caller omits
`props.background` — defensive default for future overlay-context use.
The 5 affected Cluster D multi-clip preset bindings continue to pass
`background: '#000000'` explicitly at zIndex 0 for the canvas backdrop;
`palette-jump-cut` `colorPanel` override unaffected.

Closes the multi-clip composition regression caught by PO ratification
2026-05-08 — see `docs/handover-cluster-d-regression.md` and
`docs/tasks/T-348a.md`. Phase 3 (re-generate + re-sign 5 affected
goldens) and Phase 4 (CI gate against blank parity goldens) ship in
separate PRs.
