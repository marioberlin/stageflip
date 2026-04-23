---
'@stageflip/runtimes-frame-runtime-bridge': minor
---

T-131f.3 — financial-statement composite. Largest single port in
the T-131 family.

- `financial-statement` — hierarchical financial statement slide
  with four sub-components inlined as module-private helpers:
  - **KpiStrip** — semantic-role-keyed KPIs (revenue / ebitda /
    cash / etc.) extracted from table rows. Default role sets per
    `statementType` (pnl / balance_sheet / cash_flow).
  - **StatementTable** — hierarchical line / section / subtotal /
    total / note / spacer rows with indentation by level, period
    columns (primary period highlighted), optional variance
    columns (absolute + percent), negative-number style
    (`parentheses` default; `red` or `minus` alternatives),
    density-aware row heights (board / standard / appendix), zebra
    rows + `hiddenInBoardMode` filtering.
  - **CommentsRail** — priority-ordered side rail of commentary
    cards with type-driven accent colours. Cap per density (5 /
    8 / 3).

Option B flat-prop Zod schema — no `StatementTableContent` /
`StatementRow` / etc. domain types imported from
`@slidemotion/schema`. `themeSlots`: `background` →
`palette.background`, `textColor` → `palette.foreground`,
`surface` → `palette.surface`. Single 0..15-frame fade-in
entrance.

Determinism: `toLocaleString('en-US', …)` with the locale argument
pinned is deterministic (Intl ships with Node). The locale-
sensitive form (`toLocaleString()` without args) is the one that
drifts between CI runners — this port uses only the safe form.

`ALL_BRIDGE_CLIPS` now exposes 30 clips. KNOWN_KINDS +
cdp-host-bundle clip-count test + parity fixture + plan row all
updated. T-131f.3 marked `[shipped]`.
