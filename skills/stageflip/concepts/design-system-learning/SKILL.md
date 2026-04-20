---
title: Design System Learning
id: skills/stageflip/concepts/design-system-learning
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-249
related:
  - skills/stageflip/workflows/import-pptx/SKILL.md
  - skills/stageflip/workflows/import-google-slides/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
---

# Design System Learning

When a user imports an existing deck (PPTX, Google Slides), StageFlip does
**not** just translate the bytes. It reads the design intent — palette,
type scale, spacing grid, component patterns — and emits a canonical theme
and a library of components. The result: new slides authored in the editor
look like they belong in the same deck.

## The 8-step pipeline (T-249)

1. **Asset inventory.** Extract every image, font, and vector asset. Cluster
   by embedded color histograms and visual roles.
2. **Color palette.** Harvest colors from text fills, shapes, images;
   cluster into brand / semantic / neutral buckets; fit into a 9-step scale
   per bucket.
3. **Type scale.** Detect font families in use; detect weight/size tiers
   (display, h1, h2, body, caption); emit a modular scale.
4. **Spacing grid.** Measure common gaps between elements; detect the base
   unit (usually 4 or 8 px); emit spacing tokens.
5. **Radii and shadows.** Histogram corner radii + shadow presets; pick
   representative values.
6. **Component detection.** Cluster repeated element compositions (e.g.
   "title + subtitle + divider + three-column grid"); emit a component with
   slots.
7. **Layout templates.** Detect slide-level patterns (title slide, section
   divider, bullet list, agenda); emit layout components.
8. **Confidence + review.** Every output carries a confidence score. Low-
   confidence outputs flag for human review; the editor surfaces a "theme
   review" mode before unlocking edits.

## Output

```ts
interface LearnedTheme {
  tokens: { colors, typography, spacing, radii, shadows };
  components: ComponentDefinition[];
  layouts:   LayoutDefinition[];
  confidence: { overall: number; per_section: Record<string, number> };
  loss_flags: LossFlag[];    // things the learner saw but couldn't model
}
```

## LLM role

The pipeline is **programmatic** for steps 1–5 (math + clustering). LLM is
used in steps 6–8 for "what role does this component play?" judgments.
Convergence loop: run the LLM, validate its output programmatically (does
the theme still tile? do the layouts render?), iterate until stable or
capped.

See `workflows/import-*/SKILL.md` for how each importer invokes this
pipeline.

## Current state (Phase 1 exit)

Not yet implemented. Phase 11 (T-249) delivers the 8-step pipeline; T-246
adds the AI-QC convergence loop. The `Theme` shape (`themeSchema`) the
pipeline outputs into is live in `@stageflip/schema`.

## Related

- Schema theme tokens: `concepts/schema/SKILL.md`
- AI-QC loop: T-246
- Task: T-249
