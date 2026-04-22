---
'@stageflip/app-slide': patch
---

T-133a — `<SelectionOverlay>` now coalesces drag / resize / rotate
gestures into one undo entry per gesture. Every `pointerDown` opens a
T-133a transaction via `beginTransaction`; `pointerUp` commits it;
`pointerCancel` aborts it and restores the element to its pre-drag
transform. A 100-event drag that previously produced 100 undo entries
now produces exactly one. No API surface change.
