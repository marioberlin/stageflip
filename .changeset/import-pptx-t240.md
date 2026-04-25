---
"@stageflip/import-pptx": minor
---

T-240: `@stageflip/import-pptx` — ZIP + PresentationML structural parser.

`parsePptx(buffer: Uint8Array): Promise<CanonicalSlideTree>` reads a `.pptx`
file and emits a parser-side intermediate tree. The tree mirrors the
canonical schema for variants the structural parser can resolve (text,
schema-mapped preset shapes, top-level groups) and uses parser-only types
for variants deferred to sibling P11 tasks:

- `ParsedAssetRef` — image bytes deferred to T-243.
- `UnsupportedShapeElement` — custom + un-mapped preset geometries deferred to T-242 / T-245.
- Group transforms not accumulated into descendants — deferred to T-241a.

`LossFlag` matches `skills/stageflip/concepts/loss-flags`; the parser-side
`code` field carries the `LF-PPTX-*` enum so the editor and export manifest
filter by stable cause.

Public surface:

```ts
import {
  parsePptx,
  PptxParseError,
  emitLossFlag,
  type CanonicalSlideTree,
  type LossFlag,
  type LossFlagCode,
  type ParsedAssetRef,
  type ParsedElement,
  type ParsedGroupElement,
  type ParsedImageElement,
  type ParsedSlide,
  type UnsupportedShapeElement,
} from '@stageflip/import-pptx';
```

Package is `private: true` for now; the publish posture lands with
`@stageflip/import-google-slides` (T-244) where importers' distribution
shape gets pinned.
