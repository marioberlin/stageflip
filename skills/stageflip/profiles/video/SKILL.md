---
title: Video Profile
id: skills/stageflip/profiles/video
tier: profile
status: substantive
last_updated: 2026-04-24
owner_task: T-180
related:
  - skills/stageflip/modes/stageflip-video/SKILL.md
  - skills/stageflip/concepts/captions/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/tools/clip-animation/SKILL.md
---

# Video Profile

`@stageflip/profiles-video` is StageFlip's mode profile for horizontal-timeline
video content (ads, social clips, explainers). It carries everything a
mode-aware consumer needs to know about the video surface in one typed
object — `videoProfile: ProfileDescriptor` — and contributes RIR-level lint
rules to `@stageflip/validation`.

Profiles are intentionally small. They declare *what is valid*; they don't
own implementations. Clip runtimes, engine handlers, and editor panels ship
elsewhere; this profile points at them by name.

## What a profile contains

```ts
interface ProfileDescriptor {
  readonly mode: Mode;                            // 'video'
  readonly allowedElementTypes: ReadonlySet<ElementType>;
  readonly rules: readonly LintRule[];
  readonly clipKinds: ReadonlySet<string>;
  readonly toolBundles: ReadonlySet<string>;
}
```

Every field is required. An empty set is the correct declaration when a
profile has nothing to contribute to that surface.

## Element-type allowlist

`VIDEO_ALLOWED_ELEMENT_TYPES` is the subset of `ELEMENT_TYPES` that may
appear in a video document:

- `text`, `image`, `video`, `audio`, `shape`, `group`, `clip`, `embed`

Explicitly excluded:

- `chart`, `table`, `code` — slide-oriented authoring types. If a video ad
  genuinely needs a chart, render it into the visual track as an `image`
  or a runtime-specific `clip`.

The `video-element-types-allowed` rule enforces this on the compiled
RIR; anything outside the allowlist emits an `error` finding.

## Lint rules

Four RIR-level rules compose with `@stageflip/validation`'s `ALL_RULES`.
Every rule gates on `doc.mode === 'video'` so composing `VIDEO_RULES`
with a non-video document is a no-op.

| id | severity | what it checks |
|---|---|---|
| `video-element-types-allowed` | `error` | every element's `type` is in `VIDEO_ALLOWED_ELEMENT_TYPES` |
| `video-aspect-ratio-recognized` | `warn` | `width/height` maps to 16:9 / 9:16 / 1:1 / 4:5 / 21:9 (±0.01) |
| `video-duration-within-budget` | `warn` | composition duration ≤ 10 minutes |
| `video-has-visual-element` | `error` | at least one non-audio element is present (audio-only renders rejected) |

Callers compose with the global rule set:

```ts
import { ALL_RULES, lintDocument } from '@stageflip/validation';
import { VIDEO_RULES } from '@stageflip/profiles-video';

const report = lintDocument(rirDoc, { rules: [...ALL_RULES, ...VIDEO_RULES] });
```

## Clip-kind catalog

`VIDEO_CLIP_KINDS` declares the clip `kind` strings expected in video mode.
Implementations are registered by **T-183** in `packages/runtimes/*/src/clips/`;
this catalog is forward-looking intent.

- `hook-moment` — opening attention-grabber
- `product-reveal` — product reveal with optional binding to a data source
- `endslate-logo` — brand end card
- `lower-third` — name / title chyron
- `beat-synced-text` — text keyed to an audio track's beats
- `testimonial-card` — quote card with attribution

Drift between this catalog and the runtime registry surfaces as validation
findings once the `CLIP_RULES` category is extended to mode-aware
resolution (follow-up).

## Tool-bundle allowlist

`VIDEO_TOOL_BUNDLES` names the engine handler bundles the Planner MAY load
when working on a video document. The Planner still budgets tools-per-context
per **I-9** (≤30 tools); this set is the upper bound.

Included (11 bundles):

`read`, `create-mutate`, `timing`, `layout`, `validate`, `clip-animation`,
`element-cm1`, `qc-export-bulk`, `semantic-layout`, `data-source-bindings`,
`fact-check`.

Excluded (and why):

- `slide-cm1` — slide-only composition; no slides in video mode.
- `table-cm1` — table element is not in `VIDEO_ALLOWED_ELEMENT_TYPES`.
- `domain-finance-sales-okr` — slide-deck domain templates, and 27 tools
  alone would blow the I-9 budget.

The allowlist is stringly-typed so `@stageflip/profiles-video` stays a leaf
package — no dependency on `@stageflip/engine`. Drift between these names
and the engine's registered bundles is caught by `BundleLoader` at runtime.

## How consumers read the profile

Mode-aware consumers import the single descriptor and branch on its fields:

```ts
import { videoProfile } from '@stageflip/profiles-video';

function isElementValidForMode(type: ElementType): boolean {
  return videoProfile.allowedElementTypes.has(type);
}

function planBundlesForVideo(): string[] {
  return [...videoProfile.toolBundles];
}
```

The same pattern will back the forthcoming `slideProfile` and
`displayProfile` (Phase 8 and Phase 9 respectively), at which point
mode-aware code can switch on `document.content.mode` to pick the right
profile instead of hard-coding.

## Package shape

```
packages/profiles/video/
├── package.json
├── src/
│   ├── index.ts        # videoProfile + re-exports
│   ├── catalog.ts      # VIDEO_CLIP_KINDS, VIDEO_TOOL_BUNDLES
│   ├── rules.ts        # VIDEO_RULES + individual rule exports
│   └── profile.test.ts # 100% coverage on rules + descriptor
└── tsconfig.json
```

## Quality gates

The package joins the standard StageFlip gate set:

- `pnpm typecheck` — TS strict with `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes`.
- `pnpm lint` — Biome, clean.
- `pnpm test` — Vitest; coverage ≥85% on changed files (currently 100%).
- Root gates still apply: `check-licenses`, `check-remotion-imports`,
  `check-determinism`, `check-skill-drift`, `skills-sync:check`,
  `gen:tool-skills:check`.

## Related

- Mode overview: `skills/stageflip/modes/stageflip-video/SKILL.md`
  (placeholder until T-189).
- Captions pipeline (T-184): `skills/stageflip/concepts/captions/SKILL.md`.
- Schema `VideoContent`: `skills/stageflip/concepts/schema/SKILL.md`.
- Clip-animation tool bundle: `skills/stageflip/tools/clip-animation/SKILL.md`.
- Owning task: T-180 (this doc).
