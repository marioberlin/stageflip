---
title: Display Budget
id: skills/stageflip/concepts/display-budget
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-021
related:
  - skills/stageflip/modes/stageflip-display/SKILL.md
  - skills/stageflip/profiles/display/SKILL.md
---

# Display Budget

HTML5 banner ads live under strict file-size caps set by ad networks (IAB
150 KB baseline; GDN variants). Every decision in StageFlip.Display traces
back to the budget.

## `DisplayContent.budget` shape (from T-021)

```ts
interface DisplayBudget {
  totalZipKb: number;             // 150 for IAB baseline
  externalFontsAllowed: boolean;  // default false
  externalFontsKbCap: number;     // applies only if externalFontsAllowed
  assetsInlined: boolean;         // true = everything in the ZIP; false = CDN refs allowed
}
```

## Enforcement points

| Point | Check |
|---|---|
| RIR compile | Reject bindings/components that would bloat output |
| Editor preview | Live estimator badge (green / yellow / red) |
| Export | Minifiers + image optimization run before final size check |
| Validator | Hard fail if `totalZipKb` exceeded |
| CI | IAB/GDN validator image (T-208) must accept the ZIP |

## Minification pipeline

In order:

1. Strip unused CSS (PurgeCSS-equivalent, scoped to the banner's components)
2. JS mangle + tree-shake (tsup output post-processed)
3. `sharp` image optimization: WebP/AVIF where supported by the target
4. Font subsetting: only glyphs actually rendered in any frame of the banner
5. Inline vs external decision: applied per-asset based on `assetsInlined`
6. Deterministic ZIP (stable file order, stable timestamps for parity)

## "Fallback" asset

Every banner ships a fallback static PNG (T-204) derived from the midpoint
frame, and an animated GIF for browsers without HTML5 display. Both count
against the total budget.

## Anti-patterns

- Loading fonts from Google Fonts at runtime — bans `externalFontsAllowed`
  unless network guarantees apply.
- Large animated SVGs — rasterize to APNG and measure.
- Any XHR / fetch — blocked at runtime by the display export target's CSP.

## Related

- Profile: `profiles/display/SKILL.md`
- Mode: `modes/stageflip-display/SKILL.md`
- Export task: T-203
- Compliance validators: T-208
