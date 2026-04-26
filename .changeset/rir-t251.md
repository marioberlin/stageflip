---
'@stageflip/rir': minor
---

T-251 — Add `apply-inheritance` pass at the front of the `compileRIR` pass list. The pass is a thin wrapper around `@stageflip/schema`'s pure `applyInheritance(doc)` helper plus diagnostic emission for unresolved references. New diagnostic codes: `LF-RIR-LAYOUT-NOT-FOUND` (slide carries a `layoutId` that does not resolve in `Document.layouts`) and `LF-RIR-PLACEHOLDER-NOT-FOUND` (element `inheritsFrom.placeholderIdx` does not match any placeholder on the layout or its master). `compilerDiagnosticSchema.pass` enum extended with `'apply-inheritance'`. Fast path: documents with empty `layouts` and `masters` produce byte-identical RIR output.
