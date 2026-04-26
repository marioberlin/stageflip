---
'@stageflip/editor-shell': minor
---

T-251 — Add `materializedDocumentAtom` (derived from `documentAtom` via `@stageflip/schema`'s `applyInheritance(doc)` helper) and `materializedSlideByIdAtom(slideId)` factory. Editor canvases consume these so per-element `inheritsFrom` placeholder fills appear in the rendered DOM without invoking the full RIR compile pipeline. Identity-on-empty-layouts fast path: documents without templates resolve to the same `Document` reference, so existing call-sites see zero re-render churn on the back-compat path.
