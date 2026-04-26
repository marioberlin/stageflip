---
"@stageflip/import-pptx": minor
---

T-243c: PPTX embedded font asset extraction.

`<p:embeddedFontLst>` in `ppt/presentation.xml` now parses to a
deck-level `CanonicalSlideTree.embeddedFonts: ParsedEmbeddedFont[]`
collection. Each `<p:embeddedFont>` becomes one record carrying a
`family` (from `<p:font typeface="…">`), an optional opaque `panose`,
and up to four typeface-variant face refs (`regular` / `bold` /
`italic` / `boldItalic`). Faces start as `ParsedAssetRef.unresolved`
pointing at the in-ZIP byte path; faces whose relId does not resolve
in `presentation.xml.rels` (or whose rel carries
`TargetMode="External"`) are dropped at parse time so resolveAssets
sees only well-formed in-package refs.

`resolveAssets` extends with a deck-level font branch that mirrors
the existing image / video branches: dedup by sha256 across image,
video, and font bytes; upload through the abstract `AssetStorage`;
rewrite each face ref to schema-typed `asset:<id>`; drop a family's
`LF-PPTX-UNRESOLVED-FONT` flag once every populated face resolves.
Idempotent via the existing `assetsResolved` marker.

Public surface adds `ParsedEmbeddedFont`, the `embeddedFonts?` field
on `CanonicalSlideTree`, and the `readEmbeddedFonts` parser entry
point. `LossFlagCode` gains `LF-PPTX-UNRESOLVED-FONT`
(severity `info`, category `font`). `inferContentType` extends with
five font MIMEs (`.ttf` → `font/ttf`, `.otf` → `font/otf`, `.eot` →
`application/vnd.ms-fontobject`, `.woff` → `font/woff`, `.woff2` →
`font/woff2`).

Schema integration (binding `Document.embeddedFonts` to the canonical
schema and wiring text elements' `fontFamily` to resolved font assets)
is a follow-up after T-251.
