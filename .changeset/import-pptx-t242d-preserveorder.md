---
'@stageflip/import-pptx': patch
---

T-242d Sub-PR 1: switch the shared XML parser to `preserveOrder: true` and
cascade the callsite updates. Internal refactor only — every existing test
passes byte-identical (no behavioral change). Adds `firstChild`, `children`,
`attrs`, `attr`, `allChildren`, `tagOf` helpers in `opc.ts` for the new
node shape; element converters consume them via the `elements/shared.ts`
re-export. Sub-PR 2 will land `<a:arcTo>` cust-geom support and
`chord` / `pie` / `donut` preset generators on top.
