// packages/design-system/src/types.ts
// Public types for the 8-step theme learning pipeline (T-249).

import type { LossFlag } from '@stageflip/loss-flags';
import type {
  AssetRef,
  ColorValue,
  ComponentDefinition,
  Document,
  ShapeKind,
  ThemePalette,
  ThemeTokens,
} from '@stageflip/schema';

/**
 * Storage primitive — implementations live elsewhere
 * (e.g. `@stageflip/storage-firebase`). Mirrors `AssetStorage` from
 * `@stageflip/import-pptx/src/assets/types.ts`.
 */
export interface AssetStorage {
  put(
    content: Uint8Array,
    opts: { contentType: string; contentHash: string },
  ): Promise<{ id: string }>;
}

/** Resolves a font family name to bytes. Used by step 6. */
export interface FontFetcher {
  fetch(input: {
    family: string;
    weights: number[];
    italics: boolean[];
  }): Promise<FontFetchResult[]>;
}

export interface FontFetchResult {
  family: string;
  weight: number;
  italic: boolean;
  bytes: Uint8Array;
  /** 'font/woff2' | 'font/ttf' | 'font/otf'. */
  contentType: string;
}

/** Typography token: a (family, size, weight, italic) tuple plus optional line-height. */
export interface TypographyToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  lineHeight?: number;
}

/** Learned theme — superset of the canonical `Theme`. */
export interface LearnedTheme {
  tokens: ThemeTokens;
  palette: ThemePalette;
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  fontAssets: Record<string, AssetRef>;
  source: {
    /** ISO-8601 timestamp; supplied by the caller for deterministic output. */
    learnedAt: string;
    step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    documentId: string;
  };
}

/** Component library — id → definition. */
export type ComponentLibrary = Record<string, ComponentDefinition>;

/** Per-step diagnostic — discriminated union (one variant per step). */
export type StepDiagnostic =
  | { step: 1; kind: 'color'; clusterCount: number; distinctColors: number }
  | { step: 2; kind: 'typography'; familyCount: number; sizeVariance: number }
  | { step: 3; kind: 'spacing'; histogram: Record<number, number> }
  | { step: 4; kind: 'shape-language'; histogram: Record<ShapeKind, number>; coverage: number }
  | {
      step: 5;
      kind: 'components';
      recurringCount: number;
      perComponentInstanceCount: Record<string, number>;
    }
  | { step: 6; kind: 'fonts'; fetched: number; failed: number }
  | { step: 7; kind: 'naming'; ambiguousClusters: number }
  | { step: 8; kind: 'writeback'; literalsReplaced: number; literalsKept: number };

/** Public input options. */
export interface LearnThemeOptions {
  /** Document to learn from (post-applyInheritance, post-resolveAssets). */
  doc: Document;
  /** Resolves a font family name to bytes. Required when running step 6. */
  fontFetcher?: FontFetcher;
  /** Asset storage for uploading fetched font bytes. Required if `fontFetcher` is set. */
  storage?: AssetStorage;
  /** Stop after step N (1-8). Default 8 (full pipeline). */
  stopAfterStep?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** k-means seed for color clustering. Default 42. */
  kMeansSeed?: number;
  /** Color cluster count target. Default 8. */
  kMeansTargetClusters?: number;
  /**
   * ISO-8601 timestamp written to `LearnedTheme.source.learnedAt`. Supply
   * for byte-deterministic output. Default `'1970-01-01T00:00:00.000Z'`.
   */
  modifiedAt?: string;
}

/** Public result. */
export interface LearnThemeResult {
  theme: LearnedTheme;
  document: Document;
  componentLibrary: ComponentLibrary;
  lossFlags: LossFlag[];
  stepDiagnostics: StepDiagnostic[];
}

/** Loss-flag codes emitted by the design-system pipeline. */
export type DesignSystemLossFlagCode =
  | 'LF-DESIGN-SYSTEM-FONT-FETCH-FAILED'
  | 'LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER'
  | 'LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED';

/** Internal: hex literal extracted from a document. */
export interface HexSample {
  hex: string;
  /** Where it came from — used for writeback location matching. */
  origin: ColorOrigin;
}

export type ColorOrigin =
  | { kind: 'shape-fill'; slideId: string; elementId: string }
  | { kind: 'shape-stroke'; slideId: string; elementId: string }
  | { kind: 'text-color'; slideId: string; elementId: string }
  | { kind: 'text-run-color'; slideId: string; elementId: string; runIndex: number }
  | { kind: 'slide-background'; slideId: string }
  | { kind: 'table-cell-fill'; slideId: string; elementId: string; row: number; col: number };

/** A clustered palette entry. */
export interface PaletteCluster {
  /** Stable cluster id — assigned in step 1, named in step 7. */
  id: string;
  /** Centroid hex (#rrggbb). */
  centroid: string;
  /** Number of elements that contributed to this cluster. */
  weight: number;
  /** Lab-space centroid for ΔE matching during writeback. */
  lab: { L: number; a: number; b: number };
}

/** Internal: type sample. */
export interface TypographySample {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  lineHeight?: number;
  /** Element-coverage weight. */
  weight: number;
  origins: ReadonlyArray<{ slideId: string; elementId: string; runIndex?: number }>;
}

/** Internal: a typography cluster (groups by family+size; weight aggregated). */
export interface TypographyCluster {
  id: string;
  token: TypographyToken;
  weight: number;
}

/** Internal: spacing sample (sibling-edge gap on a slide). */
export interface SpacingSample {
  px: number;
  slideId: string;
}

export type ColorValueLike = ColorValue;

/** Pipeline state threaded between steps. */
export interface PipelineState {
  doc: Document;
  opts: Required<
    Pick<LearnThemeOptions, 'kMeansSeed' | 'kMeansTargetClusters' | 'stopAfterStep' | 'modifiedAt'>
  > & {
    fontFetcher?: FontFetcher;
    storage?: AssetStorage;
  };
  /** Step 1 output. */
  paletteClusters: PaletteCluster[];
  /** Step 1 output. */
  hexSamples: HexSample[];
  /** Step 2 output. */
  typographyClusters: TypographyCluster[];
  /** Step 2 output. */
  typographySamples: TypographySample[];
  /** Step 3 output. */
  spacingTokens: Record<string, number>;
  /** Step 4 output. */
  shapeLanguage: { histogram: Record<ShapeKind, number>; coverage: number };
  /** Step 5 output. */
  componentLibrary: ComponentLibrary;
  /** Step 6 output. */
  fontAssets: Record<string, AssetRef>;
  /** Step 7 output: cluster id → semantic name. */
  paletteNames: Record<string, string>;
  /** Step 7 output: cluster id → semantic name. */
  typographyNames: Record<string, string>;
  /** Loss flags accumulated. */
  lossFlags: LossFlag[];
  /** Per-step diagnostics. */
  stepDiagnostics: StepDiagnostic[];
}
