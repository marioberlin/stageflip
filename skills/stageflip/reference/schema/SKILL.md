---
title: Reference — Schema (auto-gen)
id: skills/stageflip/reference/schema
tier: reference
status: auto-generated
last_updated: 2026-04-20
owner_task: T-034
related:
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/concepts/rir/SKILL.md
---

# Reference — Schema

**This file is auto-generated** by `@stageflip/skills-sync` from the Zod schemas in
`@stageflip/schema`. Do not edit by hand; run `pnpm skills-sync` to regenerate.
The `check-skill-drift` CI gate (T-014) will fail if this file drifts from the
generator's current output.

Every concept and convention lives in the source skills:
`concepts/schema/SKILL.md` is the narrative source of truth; this reference is
a deterministic table-of-shapes for quick lookup.

## Table of contents

- [Document](#document)
- [DocumentMeta](#documentmeta)
- [Theme](#theme)
- [ElementBase](#elementbase)
- [Element (discriminated union)](#element-discriminated-union)
- [TextElement](#textelement)
- [ImageElement](#imageelement)
- [VideoElement](#videoelement)
- [AudioElement](#audioelement)
- [ShapeElement](#shapeelement)
- [ChartElement](#chartelement)
- [TableElement](#tableelement)
- [ClipElement](#clipelement)
- [EmbedElement](#embedelement)
- [CodeElement](#codeelement)
- [GroupElement](#groupelement)
- [SlideContent](#slidecontent)
- [VideoContent](#videocontent)
- [DisplayContent](#displaycontent)
- [DisplayBudget](#displaybudget)
- [Animation](#animation)
- [TimingPrimitive](#timingprimitive)

## Document

**Identifier:** `documentSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `meta` | object | ✓ |
| `theme` | object | ✓ |
| `variables` | record<string, union<string \| number \| boolean \| null>> (default) | — |
| `components` | record<string, object> (default) | — |
| `masters` | array<object> (default) | — |
| `layouts` | array<object> (default) | — |
| `content` | discriminated-union(mode) | ✓ |

## DocumentMeta

**Identifier:** `documentMetaSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `version` | number | ✓ |
| `createdAt` | string | ✓ |
| `updatedAt` | string | ✓ |
| `title` | string? | — |
| `authorId` | string? | — |
| `locale` | string (default) | — |
| `schemaVersion` | number (default) | — |

## Theme

**Identifier:** `themeSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `tokens` | record<string, union<string \| string \| number>> (default) | — |
| `palette` | object? | — |

## ElementBase

**Identifier:** `elementBaseSchema`
**Note:** Shared base every element type merges with.
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |

## Element (discriminated union)

**Identifier:** `elementSchema`
**Note:** Top-level 11-variant union across every element type.
**Kind:** union of 13 variants

**Variants:**
- object
- object
- object
- object
- object
- object
- object
- object
- object
- object
- object
- lazy<…>
- lazy<…>

## TextElement

**Identifier:** `textElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("text") | ✓ |
| `text` | string | ✓ |
| `runs` | array<object>? | — |
| `fontFamily` | string? | — |
| `fontSize` | number? | — |
| `color` | union<string \| string>? | — |
| `align` | enum(center \| justify \| left \| right) (default) | — |
| `lineHeight` | number? | — |

## ImageElement

**Identifier:** `imageElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("image") | ✓ |
| `src` | string | ✓ |
| `alt` | string? | — |
| `fit` | enum(contain \| cover \| fill \| none \| scale-down) (default) | — |

## VideoElement

**Identifier:** `videoElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("video") | ✓ |
| `src` | string | ✓ |
| `trim` | object (refined)? | — |
| `muted` | boolean (default) | — |
| `loop` | boolean (default) | — |
| `playbackRate` | number (default) | — |

## AudioElement

**Identifier:** `audioElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("audio") | ✓ |
| `src` | string | ✓ |
| `trim` | object (refined)? | — |
| `mix` | object? | — |
| `loop` | boolean (default) | — |

## ShapeElement

**Identifier:** `shapeElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("shape") | ✓ |
| `shape` | enum(custom-path \| ellipse \| line \| polygon \| rect \| star) | ✓ |
| `path` | string? | — |
| `fill` | union<string \| string>? | — |
| `stroke` | object? | — |
| `cornerRadius` | number? | — |

## ChartElement

**Identifier:** `chartElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("chart") | ✓ |
| `chartKind` | enum(area \| bar \| combo \| donut \| line \| pie \| scatter) | ✓ |
| `data` | union<object \| string> | ✓ |
| `legend` | boolean (default) | — |
| `axes` | boolean (default) | — |

## TableElement

**Identifier:** `tableElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("table") | ✓ |
| `rows` | number | ✓ |
| `columns` | number | ✓ |
| `headerRow` | boolean (default) | — |
| `cells` | array<object> | ✓ |

## ClipElement

**Identifier:** `clipElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("clip") | ✓ |
| `runtime` | string | ✓ |
| `clipName` | string | ✓ |
| `params` | record<string, unknown> (default) | — |
| `fonts` | array<object>? | — |

## EmbedElement

**Identifier:** `embedElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("embed") | ✓ |
| `src` | string | ✓ |
| `sandbox` | array<enum(allow-forms \| allow-modals \| allow-popups \| allow-same-origin \| allow-scripts)> (default) | — |
| `allowFullscreen` | boolean (default) | — |

## CodeElement

**Identifier:** `codeElementSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `name` | string? | — |
| `transform` | object | ✓ |
| `visible` | boolean (default) | — |
| `locked` | boolean (default) | — |
| `animations` | array<object> (default) | — |
| `inheritsFrom` | object? | — |
| `type` | literal("code") | ✓ |
| `code` | string | ✓ |
| `language` | enum(bash \| css \| go \| html \| java \| javascript \| json \| jsx \| kotlin \| markdown \| other \| php \| plaintext \| python \| ruby \| rust \| scss \| sql \| swift \| toml \| tsx \| typescript \| yaml) (default) | — |
| `theme` | string? | — |
| `showLineNumbers` | boolean (default) | — |
| `wrap` | boolean (default) | — |

## GroupElement

**Identifier:** `groupElementSchema`
**Note:** Recursive — `children: Element[]`.
**Kind:** recursive (self-referential)

**Shape:** recursive (see canonical schema source).

## SlideContent

**Identifier:** `slideContentSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `mode` | literal("slide") | ✓ |
| `slides` | array<object> | ✓ |

## VideoContent

**Identifier:** `videoContentSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `mode` | literal("video") | ✓ |
| `aspectRatio` | union<enum(16:9 \| 1:1 \| 21:9 \| 4:5 \| 9:16) \| object> | ✓ |
| `durationMs` | number | ✓ |
| `frameRate` | number (default) | — |
| `tracks` | array<object> | ✓ |
| `bgm` | string? | — |
| `captions` | object? | — |

## DisplayContent

**Identifier:** `displayContentSchema`
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `mode` | literal("display") | ✓ |
| `sizes` | array<object> | ✓ |
| `durationMs` | number | ✓ |
| `clickTag` | string? | — |
| `fallback` | object? | — |
| `budget` | object (refined) | ✓ |
| `elements` | array<union<object \| object \| object \| object \| object \| object \| object \| object \| object \| object \| object \| lazy<…> \| lazy<…>>> | ✓ |

## DisplayBudget

**Identifier:** `displayBudgetSchema`
**Note:** Per T-021 [rev]: totalZipKb, externalFontsAllowed, externalFontsKbCap, assetsInlined.
**Kind:** object (refined)

**Shape:** object (refined)

## Animation

**Identifier:** `animationSchema`
**Note:** Carries a TimingPrimitive (B1–B5) + AnimationKind.
**Kind:** strict object

| Field | Type | Required |
|---|---|---|
| `id` | string | ✓ |
| `timing` | discriminated-union(kind) | ✓ |
| `animation` | discriminated-union(kind) | ✓ |
| `autoplay` | boolean (default) | — |

## TimingPrimitive

**Identifier:** `timingPrimitiveSchema`
**Note:** B1–B5 union: absolute / relative / anchored / beat / event.
**Kind:** discriminated union on `kind` (5 branches)
**Discriminator:** `kind`

**Variants:**
- object
- object
- object
- object
- object


---
*Regenerate with `pnpm skills-sync`. Adding or removing an exported schema in `@stageflip/schema` flows through automatically when the corresponding entry is added to `buildSchemaEntries` in `@stageflip/skills-sync/src/schema-gen.ts`.*
