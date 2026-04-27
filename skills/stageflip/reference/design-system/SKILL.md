---
title: Reference — @stageflip/design-system
id: skills/stageflip/reference/design-system
tier: reference
status: substantive
last_updated: 2026-04-27
owner_task: T-249
related:
  - skills/stageflip/workflows/learn-theme
  - skills/stageflip/concepts/design-system-learning
  - skills/stageflip/concepts/loss-flags
---

# Reference — `@stageflip/design-system`

Theme-learning library. Walks a parsed `Document`, extracts a
`LearnedTheme`, returns a mutated document with `theme:foo.bar` refs.

## Public surface

```ts
import {
  learnTheme,
  emitLossFlag,
  CODE_DEFAULTS,
  buildCssUrl,
  parseGoogleFontsCss,
  resolveGoogleFontUrls,
  StubFontFetcher,
} from '@stageflip/design-system';
import type {
  AssetStorage,
  ComponentLibrary,
  DesignSystemLossFlagCode,
  EmitLossFlagInput,
  FontFetchResult,
  FontFetcher,
  GoogleFontFaceUrl,
  GoogleFontsClientOptions,
  LearnThemeOptions,
  LearnThemeResult,
  LearnedTheme,
  StepDiagnostic,
  StubFontFetcherOptions,
  TypographyToken,
} from '@stageflip/design-system';
```

## `learnTheme(opts)`

```ts
interface LearnThemeOptions {
  doc: Document;
  fontFetcher?: FontFetcher;
  storage?: AssetStorage;
  stopAfterStep?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  kMeansSeed?: number;          // default 42
  kMeansTargetClusters?: number; // default 8
  modifiedAt?: string;          // ISO-8601; default frozen epoch
}
```

**MUTATES `opts.doc`** — callers needing the original preserved must
`structuredClone(doc)` before invoking.

```ts
interface LearnThemeResult {
  theme: LearnedTheme;
  document: Document;       // = opts.doc, mutated
  componentLibrary: ComponentLibrary;
  lossFlags: LossFlag[];
  stepDiagnostics: StepDiagnostic[];
}
```

## `LearnedTheme`

```ts
interface LearnedTheme {
  tokens: ThemeTokens;
  palette: ThemePalette;
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  fontAssets: Record<string, AssetRef>;
  source: {
    learnedAt: string;       // ISO-8601 = opts.modifiedAt
    step: 1|2|3|4|5|6|7|8;   // last step that ran
    documentId: string;
  };
}

interface TypographyToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  lineHeight?: number;
}
```

## `StepDiagnostic`

Discriminated union — one variant per step:

```ts
type StepDiagnostic =
  | { step: 1; kind: 'color';          clusterCount: number; distinctColors: number }
  | { step: 2; kind: 'typography';     familyCount: number; sizeVariance: number }
  | { step: 3; kind: 'spacing';        histogram: Record<number, number> }
  | { step: 4; kind: 'shape-language'; histogram: Record<ShapeKind, number>; coverage: number }
  | { step: 5; kind: 'components';     recurringCount: number; perComponentInstanceCount: Record<string, number> }
  | { step: 6; kind: 'fonts';          fetched: number; failed: number }
  | { step: 7; kind: 'naming';         ambiguousClusters: number }
  | { step: 8; kind: 'writeback';      literalsReplaced: number; literalsKept: number };
```

## `FontFetcher`

```ts
interface FontFetcher {
  fetch(input: { family: string; weights: number[]; italics: boolean[] }):
    Promise<FontFetchResult[]>;
}

interface FontFetchResult {
  family: string;
  weight: number;
  italic: boolean;
  bytes: Uint8Array;
  contentType: string;       // 'font/woff2' | 'font/ttf' | 'font/otf'
}
```

A `StubFontFetcher` for tests is exported:

```ts
new StubFontFetcher({
  bytesByFamily: { Roboto: new Uint8Array([...]) },
  failFamilies: ['BadFont'],   // throw on these
});
```

## `AssetStorage`

```ts
interface AssetStorage {
  put(content: Uint8Array, opts: { contentType: string; contentHash: string }):
    Promise<{ id: string }>;
}
```

Mirror of `@stageflip/import-pptx`'s `AssetStorage`. Wire any
implementation that satisfies the contract; `@stageflip/storage-firebase`
ships a Firebase-backed one for production.

## Google Fonts client

Hand-rolled minimal client (no `googleapis` dep, per T-244 precedent).

```ts
buildCssUrl(family, { weights, italics }, base?): string
parseGoogleFontsCss(css, family): GoogleFontFaceUrl[]
resolveGoogleFontUrls(family, variants, opts): Promise<GoogleFontFaceUrl[]>
```

The CSS endpoint is `https://fonts.googleapis.com/css2`. The client sends
a modern desktop-Safari User-Agent so the response includes woff2 URLs
(default UA returns TTF).

## Loss flags

```ts
type DesignSystemLossFlagCode =
  | 'LF-DESIGN-SYSTEM-FONT-FETCH-FAILED'
  | 'LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER'
  | 'LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED';

const CODE_DEFAULTS: Record<DesignSystemLossFlagCode,
  { severity: LossFlagSeverity; category: LossFlagCategory }>;
```

`emitLossFlag(input)` is the design-system-flavored wrapper around
`@stageflip/loss-flags`'s generic emitter — auto-fills
`source: 'design-system'`, looks up per-code defaults.

## Determinism contract

- Identical input + opts → identical output.
- `kMeansSeed` is the only randomness source.
- `modifiedAt` (default frozen epoch) populates `LearnedTheme.source.learnedAt`.
- `determinism.test.ts` enforces source-level grep on `src/**`.

## Out of scope

- AI-assisted token naming.
- Custom non-Google-Fonts sources.
- Font glyph subsetting.
- Editor UI for the learned theme.
- Animation extraction.

## Schema dependency

Depends on `@stageflip/schema`'s narrowed `componentDefinitionSchema.body`
shape (T-249 schema patch): `{ slots: SlotDefinition[]; layout: LayoutDescriptor }`.

## Related

- Workflow: `workflows/learn-theme/SKILL.md`
- Concept: `concepts/design-system-learning/SKILL.md`
- Schema: `concepts/schema/SKILL.md`
- Task: T-249
