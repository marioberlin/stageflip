---
title: Display Profile
id: skills/stageflip/profiles/display
tier: profile
status: substantive
last_updated: 2026-04-24
owner_task: T-200
related:
  - skills/stageflip/modes/stageflip-display/SKILL.md
  - skills/stageflip/concepts/display-budget/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/profiles/video/SKILL.md
---

# Display Profile

`@stageflip/profiles-display` is StageFlip's mode profile for IAB/GDN-compliant
HTML5 display banners (300×250, 728×90, 160×600). It carries everything a
mode-aware consumer needs to know about the display surface in one typed
object — `displayProfile: ProfileDescriptor` — and contributes RIR-level lint
rules to `@stageflip/validation`.

Profiles are intentionally small. They declare *what is valid*; they don't
own implementations. Clip runtimes, engine handlers, export targets, and
editor panels ship elsewhere; this profile points at them by name.

## What a profile contains

```ts
interface ProfileDescriptor {
  readonly mode: Mode;                            // 'display'
  readonly allowedElementTypes: ReadonlySet<ElementType>;
  readonly rules: readonly LintRule[];
  readonly clipKinds: ReadonlySet<string>;
  readonly toolBundles: ReadonlySet<string>;
}
```

Every field is required. An empty set is the correct declaration when a
profile has nothing to contribute to that surface.

## Element-type allowlist

`DISPLAY_ALLOWED_ELEMENT_TYPES` is the subset of `ELEMENT_TYPES` that may
appear in a display document:

- `text`, `image`, `shape`, `group`, `clip`

Explicitly excluded:

- `video`, `audio` — GDN bans audio-by-default; full video inside a 150 KB
  cap is impractical. Video + audio are out of scope for the MVP.
- `chart`, `table`, `code` — slide-oriented authoring types.
- `embed` — iframe / external content is blocked at serve time by IAB/GDN
  CSP.

The `display-element-types-allowed` rule enforces this on the compiled
RIR; anything outside the allowlist emits an `error` finding.

## Canonical IAB dimensions

`DISPLAY_CANONICAL_SIZES` names the three IAB HTML5 sizes StageFlip.Display
targets at Phase 9 exit. Source: IAB New Standard Ad Unit Portfolio (2017).

| Dimensions | IAB label | Typical placement |
|---|---|---|
| 300×250 | Medium Rectangle (MPU) | In-content, highest inventory |
| 728×90 | Leaderboard | Top-of-page horizontal |
| 160×600 | Wide Skyscraper | Sidebar vertical |

Rich-media + expandable sizes (e.g. 970×250 Billboard) ship later and will
be added here, not re-implemented elsewhere.

## IAB / GDN file-size budgets

`DISPLAY_FILE_SIZE_BUDGETS_KB` encodes the floor every produced banner
is gated against:

```ts
interface DisplayFileSizeBudgetsKb {
  iabInitialLoadKb: number;  // 150 — IAB New Standard Ad Unit Portfolio
  gdnInitialLoadKb: number;  // 150 — Google Display Network hard cap
  iabPoliteLoadKb: number;   // 1024 — post-engagement additional data cap
}
```

The per-document `DisplayContent.budget` (schema-level; see
`@stageflip/schema`) carries the *actual* enforcement value and may be
tightened (e.g. 100 KB for tighter networks) without changing this floor.
Enforcement lives at RIR compile, editor preview, export-html5-zip
(T-203), and the IAB/GDN compliance validator image (T-208) — see
`concepts/display-budget/SKILL.md`.

## Lint rules

Five RIR-level rules compose with `@stageflip/validation`'s `ALL_RULES`.
Every rule gates on `doc.mode === 'display'` so composing `DISPLAY_RULES`
with a non-display document is a no-op.

| id | severity | what it checks |
|---|---|---|
| `display-element-types-allowed` | `error` | every element's `type` is in `DISPLAY_ALLOWED_ELEMENT_TYPES` |
| `display-dimensions-recognized` | `warn` | `width/height` matches one of the canonical IAB sizes |
| `display-duration-within-budget` | `error` | composition duration ≤ 30s (GDN / IAB hard cap) |
| `display-frame-rate-within-budget` | `warn` | frame rate ≤ 24 fps (battery + CPU recommendation) |
| `display-has-visible-element` | `error` | at least one element with `visible=true` is present |

Callers compose with the global rule set:

```ts
import { ALL_RULES, lintDocument } from '@stageflip/validation';
import { DISPLAY_RULES } from '@stageflip/profiles-display';

const report = lintDocument(rirDoc, { rules: [...ALL_RULES, ...DISPLAY_RULES] });
```

Click-tag + fallback enforcement live at schema / export-time (T-203,
T-208), not in RIR-level lint, because those fields are consumed upstream
of RIR compilation.

## Clip-kind catalog

`DISPLAY_CLIP_KINDS` declares the clip `kind` strings expected in display
mode. Implementations are registered by **T-202** in
`packages/runtimes/*/src/clips/`; this catalog is forward-looking intent.

- `click-overlay` — invisible hit-target that routes to the banner's `clickTag`
- `countdown` — deadline / sale timer
- `product-carousel` — item rotator bound to a product feed
- `price-reveal` — "before / after" price animation
- `cta-pulse` — call-to-action attention loop

## Tool-bundle allowlist

`DISPLAY_TOOL_BUNDLES` names the engine handler bundles the Planner MAY
load when working on a display document. The Planner still budgets
tools-per-context per **I-9** (≤30 tools); this set is the upper bound.

Included (12 bundles):

`read`, `create-mutate`, `timing`, `layout`, `validate`, `clip-animation`,
`element-cm1`, `qc-export-bulk`, `semantic-layout`, `data-source-bindings`,
`fact-check`, `display-mode`.

`display-mode` is reserved for **T-206** (`optimize_for_file_size` +
`preview_at_sizes`); the Planner tolerates future-declared bundle names
and the `BundleLoader` catches drift between this list and the engine's
registered bundles at runtime. This mirrors how `video-mode` was listed
in `@stageflip/profiles-video` before T-185 registered the bundle.

Excluded (and why):

- `slide-cm1` — slide-only composition; banners are single-surface.
- `table-cm1` — table element is not in `DISPLAY_ALLOWED_ELEMENT_TYPES`.
- `domain-finance-sales-okr` — slide-deck domain templates, 27 tools
  alone would blow the I-9 budget.
- `video-mode` — multi-aspect bouncer is video-specific; banners are
  fixed canonical dimensions, not aspect ratios to bounce between.

The allowlist is stringly-typed so `@stageflip/profiles-display` stays a
leaf package — no dependency on `@stageflip/engine`.

## How consumers read the profile

Mode-aware consumers import the single descriptor and branch on its fields:

```ts
import { displayProfile } from '@stageflip/profiles-display';

function isElementValidForMode(type: ElementType): boolean {
  return displayProfile.allowedElementTypes.has(type);
}

function planBundlesForDisplay(): string[] {
  return [...displayProfile.toolBundles];
}
```

The same pattern backs `videoProfile` (T-180) and will back `slideProfile`
(follow-up), at which point mode-aware code can switch on
`document.content.mode` to pick the right profile instead of hard-coding.

## Package shape

```
packages/profiles/display/
├── package.json
├── src/
│   ├── index.ts        # displayProfile + re-exports
│   ├── catalog.ts      # DISPLAY_CANONICAL_SIZES, DISPLAY_CLIP_KINDS,
│   │                   # DISPLAY_TOOL_BUNDLES, DISPLAY_FILE_SIZE_BUDGETS_KB
│   ├── rules.ts        # DISPLAY_RULES + individual rule exports
│   └── profile.test.ts # 100% coverage on rules + descriptor + budgets
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

- Mode overview: `skills/stageflip/modes/stageflip-display/SKILL.md`
  (placeholder until T-209).
- Display budget concept: `skills/stageflip/concepts/display-budget/SKILL.md`.
- Schema `DisplayContent`: `skills/stageflip/concepts/schema/SKILL.md`.
- Sibling profile: `skills/stageflip/profiles/video/SKILL.md`.
- Owning task: T-200 (this doc).
