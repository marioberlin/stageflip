---
'@stageflip/runtimes-contract': minor
---

T-131a — optional `themeSlots?: Readonly<Record<string, ThemeSlot>>` on
`ClipDefinition` plus a new `resolveClipDefaultsForTheme(clip, theme, props)`
helper. A clip declares which of its props pull defaults from the document
theme; the helper fills any prop whose value is `undefined` with the
theme's value for that slot, leaving explicit values untouched. Slot
flavours: `palette` (named role on `Theme.palette`) and `token` (dotted
path on `Theme.tokens`). Non-breaking: existing runtimes compile and
register unchanged; clips without `themeSlots` short-circuit by reference.
