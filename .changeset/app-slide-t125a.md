---
'@stageflip/app-slide': minor
---

T-125a — PropertiesPanel router + SelectedElementProperties + SlideProperties.
Right-rail `<aside>` that branches on selection: when an element is
selected, shows its position / size / rotation / opacity / visibility /
lock / z-order / delete affordances; when no element is selected, shows
a read-only summary of the active slide plus an editable notes textarea.
ZodForm, ChartEditor, TableEditor, AnimationPicker, and the typography
and color editors are deferred to T-125b / T-125c — the element branch
displays a placeholder in their slot. All mutations route through
`updateDocument`, so T-133 undo/redo covers every edit automatically.
