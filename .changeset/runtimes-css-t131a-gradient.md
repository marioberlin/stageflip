---
'@stageflip/runtimes-css': minor
---

T-131a — `defineCssClip` now forwards optional `propsSchema` and
`themeSlots` onto the produced `ClipDefinition`. Ships
`gradientBackgroundClip` as a second demonstrator alongside
`solidBackgroundClip`: a two-stop linear gradient with `from` /
`to` / `direction` props, a Zod-validated `propsSchema`, and
`themeSlots` binding `from → palette.primary` and `to → palette.background`.
Parity fixture `css-gradient-background.json` registered.
