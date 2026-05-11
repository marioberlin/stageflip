---
title: Display Mode — IAB HTML5 ZIP Export
id: skills/stageflip/concepts/display-mode
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-439
related:
  - skills/stageflip/concepts/display-budget/SKILL.md
  - skills/stageflip/profiles/display/SKILL.md
  - skills/stageflip/modes/stageflip-display/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/concepts/optimistic-placeholders/SKILL.md
---

# Display Mode — IAB HTML5 ZIP Export

The display product targets IAB / GDN HTML5 banner ads. The export
pipeline lives in `@stageflip/export-html5-zip` and produces one
deterministic ZIP per `BannerSize` containing:

- `index.html` — the rendered banner with the IAB clickTag macro injected
- `fallback.png` — mandatory static backup image (IAB requirement)
- `fallback.gif` — optional animated fallback
- `assets/*` — non-inlined images / fonts referenced from the HTML

The orchestrator (`exportHtml5ZipForSize` / `exportHtml5Zip`) is opaque
to the bundler: a pluggable `HtmlBundler` produces the HTML and asset
set; the orchestrator handles clickTag injection, fallback embedding,
ZIP packing, and budget enforcement.

## AI content auto-disclosure (T-439)

T-439 extends the orchestrator with provenance-aware AI content
auto-disclosure per **FTC** (US Federal Trade Commission) Endorsement
Guides (16 CFR Part 255) and **EU AI Act** Article 50(2). Any document
MediaElement whose `provenance.kind` indicates AI-generated content is
auto-marked at export time without any per-banner authoring effort.

### Inputs

The orchestrator accepts an opt-in list on `BannerExportInput`:

```ts
interface BannerExportInput {
  // ... existing fields
  readonly aiElements?: readonly AiElementInputRow[];
}

interface AiElementInputRow {
  readonly elementId: string;
  readonly provenance?: MediaProvenance;
}
```

Hosts populate `aiElements` by walking the document's MediaElements
(audio / image / video / future GLB-bearing wrappers) and emitting one
row per element. Rows whose `provenance` is absent OR whose
`provenance.kind === 'imported'` are filtered out by the walker.

### AI-kind classification

`classifyAiKind(kind)` returns `true` for:

- `'tts'` — text-to-speech
- `'video-gen'` — video generation
- `'music-gen'` — music generation
- `'sfx'` — sound effects
- `'three-d'` — 3D asset generation
- `'image-gen'` — image / infographic generation
- `'asset-gen-pending'` — T-438 non-terminal placeholder kind (disclosed
  conservatively at export time; the renderer filters placeholders
  upstream)

Returns `false` for `'imported'` and unknown / undefined kinds.

### Outputs

For each banner size, when ≥1 AI element is present, the orchestrator
produces three observable artifacts:

1. **Visible badge** — a small `<aside data-ai-disclosure>` snippet
   injected immediately before `</body>`. Position / text / color /
   font-size configurable per-tenant via
   `ExportOrchestratorOptions.aiBadge`. Default: `'AI'` top-right,
   semi-transparent black background, 10px white text.

2. **HTML attribute** — when the bundler exposes a
   `data-element-id="<id>"` attribute on the mount node,
   `annotateAiElementsInHtml` rewrites the matching node to also carry
   `data-ai-generated="true"`. Silent no-op when no matching node is
   found (the visible badge + manifest disclosure still fire).

3. **Manifest field** — `BannerExportResult.aiContent` carries the
   aggregated disclosure record:

   ```ts
   interface AiContentDisclosure {
     readonly elements: readonly AiContentDisclosureElement[];
     readonly disclosure: {
       readonly ftc: 'compliant' | 'requires-tenant-config';
       readonly euAiAct: 'compliant' | 'requires-tenant-config';
     };
   }

   interface AiContentDisclosureElement {
     readonly elementId: string;
     readonly provider: string;     // 'tts-kokoro' / etc.; 'unknown' when absent
     readonly modality: string;     // from provenance.kind
     readonly cacheKey?: string;
     readonly prompt?: string;
   }
   ```

### Compliance scoring

The `disclosure: { ftc, euAiAct }` summary is a coarse compliance hint:

- `ftc = 'compliant'` requires the visible badge enabled AND at least
  one row carries `provenance.provider`.
- `euAiAct = 'compliant'` requires the visible badge enabled AND at
  least one row carries both `provenance.provider` AND
  `provenance.model`.
- Otherwise both fields read `'requires-tenant-config'`.

Final compliance is the tenant's responsibility — they must enable the
badge for FTC-regulated jurisdictions and ensure adapters emit
provider + model in the provenance shape.

### Tenant configuration

```ts
interface AiDisclosureBadgeConfig {
  text: string;              // '' disables the visible badge
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color: string;
  background: string;
  fontSize: number;
}
```

`ExportOrchestratorOptions.aiBadge?: Partial<AiDisclosureBadgeConfig>`
flows in from the host; the orchestrator merges with `DEFAULT_AI_BADGE`.
Setting `text: ''` suppresses the visible badge BUT the manifest
`aiContent` field still surfaces the AI elements (with
`disclosure.{ftc,euAiAct} = 'requires-tenant-config'`).

### Back-compat

When `BannerExportInput.aiElements` is absent or contains no AI-kind
elements, the export path is byte-identical to non-AI banners. The
21 existing orchestrator tests pass unchanged. The new
`BannerExportResult.aiContent` field is `undefined` in that case.

### §13 statement

T-439 is NOT a structural extension: no schema changes, no new
RIRElement, no new ClipKindBinding field, no compositing changes, no
runtime kind. The render pipeline is unchanged for non-AI elements
and unchanged for AI elements (provenance metadata is read post-render
during the export walk). Render verification N/A — display IAB export
produces HTML, not pixel goldens.

## Related

- `concepts/display-budget/SKILL.md` — file-size caps the orchestrator enforces
- `profiles/display/SKILL.md` — the StageFlip.Display profile
- `concepts/schema/SKILL.md` — `MediaProvenance` definition (T-421 + T-438)
- `concepts/optimistic-placeholders/SKILL.md` — T-438's `'asset-gen-pending'` kind
- Regulatory references:
  - FTC Endorsement Guides — 16 CFR Part 255
  - EU AI Act Article 50(2) — AI-generated content disclosure
  - China Generative AI Service Measures (2023-08-15)
