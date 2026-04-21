---
title: FontManager
id: skills/stageflip/concepts/fonts
tier: concept
status: substantive
last_updated: 2026-04-21
owner_task: T-072
related:
  - skills/stageflip/concepts/rir/SKILL.md
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/clips/authoring/SKILL.md
  - skills/stageflip/reference/export-formats/SKILL.md
---

# FontManager

Fonts are the #1 cause of render drift between live preview and headless
export. The FontManager makes font resolution a first-class pipeline stage,
not an afterthought.

## Surface

Every runtime that consumes text declares its font needs:

```ts
// @stageflip/runtimes/contract
export interface FontRequirement {
  family: string;
  weight?: number | string; // "400", "bold", "variable"
  style?: 'normal' | 'italic';
  subsets?: string[];       // 'latin', 'cyrillic', 'latin-ext'
  features?: string[];      // 'ss01', 'tnum'
}
```

The RIR compiler walks all elements and aggregates a `FontRequirementSet` per
document.

## Two runtimes, one contract

| Context | What FontManager does |
|---|---|
| Editor / live preview | Blocks canvas render on `document.fonts.ready` AND explicit `FontFace.load()` per declared family. Never renders a frame with fallback glyphs. |
| CDP export (Phase 4) | Pre-embeds fonts via `@fontsource` base64 injection; then `document.fonts.check()` verifies each family is resident before capture starts. |

Chromium render flag used for CDP: `--font-render-hinting=none`. Hinting
introduces sub-pixel differences across platforms and breaks parity.

## Invariants

- **No FOIT/FOUT in export.** The capture loop does not start until every
  declared family is loaded.
- **No network fetches at render time.** Fonts are pre-resolved and either
  inlined or loaded from disk before the first frame.
- **Declared > discovered.** Runtimes declare requirements; they don't rely
  on the browser to lazily load from a CSS rule.

## Example

```ts
// A GSAP motion-text clip that uses Inter 600 and Inter 400 italic
export const fonts: FontRequirement[] = [
  { family: 'Inter', weight: 600, style: 'normal', subsets: ['latin'] },
  { family: 'Inter', weight: 400, style: 'italic', subsets: ['latin'] },
];
```

## Current state (Phase 3 exit)

- **RIR font aggregation** is live: `compileRIR` walks text + clip elements and
  emits a deduplicated `FontRequirement[]` (by family / weight / style / subsets).
  See `packages/rir/src/compile/passes.ts` → `aggregateFonts`.
- **FontManager runtime (editor side)** landed with T-072. See
  `@stageflip/fonts`:
  - `aggregateFontRequirements(iterable)` — canonical dedup +
    union over subsets / features + stable sort.
  - `formatFontShorthand(req, px?)` — CSS shorthand suitable for
    `document.fonts.check` / `.load`.
  - `useFontLoad(requirements, options?)` — React hook returning
    `{ status, error, loaded }`. Blocks the consumer's canvas render
    on `document.fonts.check` / `.load` for every requirement.
- **CDP pre-embedding + `@fontsource` base64 injection** is Phase 4
  (T-084a asset preflight). The Chromium `--font-render-hinting=none`
  flag lands with the CDP renderer vendor integration (T-080+).

## Implementation map

| File | Task | Purpose |
|---|---|---|
| `packages/runtimes/contract/src/index.ts` → `FontRequirement` | T-060 + T-072 | Shared type. T-072 added `subsets` + `features`. |
| `packages/rir/src/compile/passes.ts::aggregateFonts` | T-031 | Walks RIR elements, emits deduplicated `FontRequirement[]` per document. |
| `packages/fonts/src/aggregate.ts` | T-072 | `aggregateFontRequirements` + `formatFontShorthand`. |
| `packages/fonts/src/use-font-load.ts` | T-072 | `useFontLoad` React hook — editor / preview blocking. |
| CDP preflight (`T-084a`) | _Phase 4, pending_ | `@fontsource` base64 embedding + `document.fonts.check` verification. |

## Related

- Runtime contract (the `FontRequirement` shape): `runtimes/contract/SKILL.md`
- RIR font aggregation pass: `concepts/rir/SKILL.md`
- Clip-authoring guide (how to declare `fontRequirements`):
  `clips/authoring/SKILL.md`
- Owning tasks: T-072 (editor runtime, done), T-084a (CDP preflight,
  Phase 4), T-080+ (Chromium `--font-render-hinting=none` flag).
