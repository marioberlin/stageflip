---
'@stageflip/app-slide': minor
---

T-136 — Phase 6 E2E regression suite + `Mod+Z` / `Mod+Shift+Z` shortcut
wiring. The Playwright suite now covers three new round-trip scenarios
critical to ratifying slide mode:

- **Inline text editor round-trip** — double-click → edit → blur commits
  through the document atom and re-renders in both canvas and filmstrip.
- **Undo / redo chain** — two sequential transform commits undo in LIFO
  order via `Mod+Z`; redo restores via `Mod+Shift+Z`.
- **Element delete** — `prop-delete` drops the element from canvas + doc
  and the slide's element-count read-out reflects the new total.

Building the regression suite surfaced a gap: T-133 wired the undo/redo
API but no shortcut ever reached the user. Two `essential`-category
shortcuts (`Mod+Z` undo, `Mod+Shift+Z` redo) are now registered in the
editor frame.

The opacity commit-on-release contract stays unit-tested only — range
inputs don't replay cleanly under Playwright's `fill()` and the unit
test already exercises the exact behavior.

Export PNG coverage is explicitly deferred: no export button exists in
app-slide today, and wiring the full CDP export flow would balloon
T-136. Renderer-cdp has its own PNG e2e at the package level (T-119
reference-render test).

E2E: 14 passing (was 11). No product-code tests changed.
