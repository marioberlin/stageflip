---
"@stageflip/import-pptx": minor
---

T-243b: PPTX video asset extraction.

`<p:videoFile>` shape extensions on `<p:sp>` now parse to a new
`ParsedVideoElement` (parser-side type that mirrors schema's `VideoElement`
but with `src: ParsedAssetRef`). The walker disambiguates in-ZIP videos
(`r:embed` or `r:link` with `TargetMode="Internal"`) from external `r:link`
URLs — in-ZIP videos route through `parseVideo` and drop any shape body
(text / geometry) with an info `LF-PPTX-UNSUPPORTED-ELEMENT` flag; external
URLs fall through to `parseShape` and emit `LF-PPTX-UNSUPPORTED-ELEMENT`
with `originalSnippet: 'external video URL'` (until a future task adds
`LF-PPTX-LINKED-VIDEO`).

`resolveAssets` extends with a `'video'` branch that mirrors the existing
image branch: dedup by sha256, upload through the abstract `AssetStorage`,
rewrite refs to schema-typed `asset:<id>`, drop `LF-PPTX-UNRESOLVED-VIDEO`
flags, and reuse `LF-PPTX-MISSING-ASSET-BYTES` for absent video bytes.

Public surface adds `ParsedVideoElement`. `LossFlagCode` gains
`LF-PPTX-UNRESOLVED-VIDEO`. `inferContentType` extends with the six
standard video MIMEs (`.mp4` / `.m4v` / `.mov` / `.webm` / `.avi` /
`.wmv`). `OpcRel` gains an optional `targetMode: 'Internal' | 'External'`.

No schema changes (`VideoElement` is already a stable shape). Audio and
embedded-font extraction remain follow-up tasks.
