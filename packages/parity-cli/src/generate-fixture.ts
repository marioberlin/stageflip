// packages/parity-cli/src/generate-fixture.ts
// Production-renderer binding for the parity-fixture generator (T-359a).
//
// `scripts/generate-preset-parity-fixture.ts` ships a `bindProductionRenderer`
// hook (T-359a D-T359a-3) that accepts a `FixtureRenderer` impl. This module
// builds that impl by composing:
//
//   1. A `clipKindResolver` that maps a preset's `clipKind` (e.g. `bigNumber`)
//      to a concrete render plan: runtime id + clip name + a per-variant
//      props builder. v1 wires the `bigNumber → animated-value` binding
//      documented in `skills/stageflip/presets/data/f1-sector-purple-green.md`
//      (T-359a D-T359a-4). The formal clipKind dispatcher is a future task.
//
//   2. A `renderFrame` callback that builds an `RIRDocument` from the
//      resolver's plan and hands it to a `PrimeRenderFn` (the puppeteer/CDP
//      pipeline already used by `stageflip-parity prime`).
//
// The renderer is Node-only — it imports from `@stageflip/rir`,
// `@stageflip/runtimes-frame-runtime-bridge`, and (lazily) puppeteer-side
// machinery. `packages/parity-cli` is already a Node-only package; no new
// browser-bundle exposure (T-359a D-T359a-9, browser-bundle hazard memo).
//
// Follow-up: T-359b runs this prod-bound generator on T-359
// (`f1-sector-purple-green`) to flip its `signOff.parityFixture` from
// `pending-user-review` → `signed:<date>`, closing the carve-out from
// T-359a D-T359a-6. See `docs/ops/parity-fixture-signoff.md`
// §"Pending follow-up tasks".

import { type RIRDocument, rirDocumentSchema } from '@stageflip/rir';

import type { PrimeRenderFn } from './prime.js';

// ---------- types ----------

/** A preset description sufficient for the generator script's render call. */
export interface PresetForRender {
  readonly frontmatter: {
    readonly id: string;
    readonly cluster: string;
    readonly clipKind: string;
  };
}

/** Composition the renderer targets. Mirrors `DEFAULT_COMPOSITION` in the script. */
export interface FixtureComposition {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
}

/** Args to the generator-script-side `FixtureRenderer.render`. */
export interface FixtureRenderArgs {
  readonly preset: PresetForRender;
  readonly composition: FixtureComposition;
  readonly frame: number;
  readonly variant?: string;
}

/**
 * Concrete render plan a `clipKindResolver` returns. The resolver maps a
 * preset's `clipKind` (semantic, frontmatter-level) to a runtime + clip-kind
 * pair the renderer can mount, plus a function that builds props from the
 * declared variant name (D-T359a-1 + D-T359a-4).
 */
export interface ClipKindBinding {
  /** Runtime id (matches `ClipRuntime.id` — e.g. `'frame-runtime'`). */
  readonly runtimeId: string;
  /** Clip kind within that runtime (matches `ClipDefinition.kind`). */
  readonly clipName: string;
  /**
   * Build the props object for this clip given the variant name (or undefined
   * for single-variant invocations). Pure — no I/O. The returned object is
   * placed directly into the RIR clip element's `params`.
   */
  buildProps(variant: string | undefined): Record<string, unknown>;
}

/**
 * Resolver hook the generator uses to find the render plan for a preset's
 * `clipKind`. Returns `undefined` for unknown clipKinds; the renderer
 * surfaces this as a clean `RenderUnavailableError` (D-T359a-4 / AC #10).
 *
 * v1 ships a tiny built-in resolver covering `bigNumber` only; cluster
 * owners add entries as their first preset reaches sign-off. The dispatcher
 * (which would auto-derive the map from the registry) is a future task.
 */
export type ClipKindResolver = (clipKind: string) => ClipKindBinding | undefined;

/** Marker error mirroring the script's `RenderUnavailableError`. Re-thrown by the binding. */
export class GenerateFixtureUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerateFixtureUnavailableError';
  }
}

// ---------- v1 clipKind → component resolver ----------

/**
 * Default v1 clipKind → component map (T-359a D-T359a-4). Intentionally
 * small: only `bigNumber` is wired today (the binding documented in T-359's
 * preset). Cluster owners extend this map as their cluster's first preset
 * reaches sign-off — the convention is one entry per concrete React clip,
 * NOT per semantic alias.
 *
 * The `bigNumber → animated-value` binding mirrors the prose contract in
 * `skills/stageflip/presets/data/f1-sector-purple-green.md` § Rules ("Bound
 * primitive: `animated-value` from `@stageflip/runtimes-frame-runtime-bridge`").
 *
 * Variant → state-prop-color comes from the same preset doc:
 *   - sessionBest → '#6F2E9E' (purple)
 *   - personalBest → '#00B54A' (green)
 *   - neutral → '#F0C800' (yellow)
 *
 * Single-variant invocations (no `variant`) default to neutral so the
 * resolver is total over the variant axis.
 */
export const F1_SECTOR_STATE_COLORS: Readonly<Record<string, string>> = {
  sessionBest: '#6F2E9E',
  personalBest: '#00B54A',
  neutral: '#F0C800',
};

const DEFAULT_BIG_NUMBER_VALUE = 21.412;
const DEFAULT_BIG_NUMBER_FONT_SIZE = 360;

const bigNumberBinding: ClipKindBinding = {
  runtimeId: 'frame-runtime',
  clipName: 'animated-value',
  buildProps(variant) {
    const color = variant !== undefined ? F1_SECTOR_STATE_COLORS[variant] : undefined;
    return {
      value: DEFAULT_BIG_NUMBER_VALUE,
      decimals: 3,
      fontSize: DEFAULT_BIG_NUMBER_FONT_SIZE,
      fontWeight: 700,
      ...(color !== undefined ? { color } : {}),
    };
  },
};

/** v1 default resolver — `bigNumber → animated-value`. */
export const DEFAULT_CLIP_KIND_RESOLVER: ClipKindResolver = (clipKind) => {
  if (clipKind === 'bigNumber') return bigNumberBinding;
  return undefined;
};

// ---------- RIRDocument builder ----------

/**
 * Build a minimal renderable `RIRDocument` for `(preset, binding, props)`.
 * Mirrors `manifestToDocument` in `@stageflip/testing` but sources the clip
 * shape from the resolver rather than a fixture manifest. Exported for tests.
 */
export function buildPresetDocument(args: {
  preset: PresetForRender;
  composition: FixtureComposition;
  binding: ClipKindBinding;
  props: Record<string, unknown>;
  variant?: string;
}): RIRDocument {
  const elementId = 'preset-clip-0';
  const variantSlug = args.variant !== undefined ? `-${args.variant}` : '';
  const documentId = `preset-${args.preset.frontmatter.id}${variantSlug}`;
  const doc: RIRDocument = {
    id: documentId,
    width: args.composition.width,
    height: args.composition.height,
    frameRate: args.composition.fps,
    durationFrames: args.composition.durationInFrames,
    mode: 'slide',
    elements: [
      {
        id: elementId,
        type: 'clip',
        transform: {
          x: 0,
          y: 0,
          width: args.composition.width,
          height: args.composition.height,
          rotation: 0,
          opacity: 1,
        },
        timing: {
          startFrame: 0,
          endFrame: args.composition.durationInFrames,
          durationFrames: args.composition.durationInFrames,
        },
        zIndex: 0,
        visible: true,
        locked: false,
        stacking: 'auto',
        animations: [],
        content: {
          type: 'clip',
          runtime: args.binding.runtimeId,
          clipName: args.binding.clipName,
          params: args.props,
        },
      },
    ],
    stackingMap: { [elementId]: 'auto' },
    fontRequirements: [],
    meta: {
      sourceDocId: `preset-source-${args.preset.frontmatter.id}${variantSlug}`,
      sourceVersion: 1,
      compilerVersion: 'preset-fixture-0.0.0',
      digest: documentId,
    },
  };
  // Validate before returning so a drift between this builder and
  // `rirDocumentSchema` surfaces here, not at puppeteer mount time.
  return rirDocumentSchema.parse(doc);
}

// ---------- FixtureRenderer composition ----------

/**
 * The generator-script-side `FixtureRenderer.render` signature. Duplicated
 * here so this module doesn't take a build-time dep on the script (the
 * script lives outside the package's `exports` surface). Structural typing
 * keeps the two in sync — a drift would surface at the bin's
 * `bindProductionRenderer` call site at typecheck time.
 */
export interface FixtureRendererLike {
  render(args: FixtureRenderArgs): Promise<Uint8Array> | Uint8Array;
}

/**
 * Build a `FixtureRenderer`-shaped object from a clipKind resolver and a
 * `PrimeRenderFn` (puppeteer-backed in production; a stub in tests). The
 * resolver maps the preset's `clipKind` to a render plan; the render fn
 * actually mounts the resulting RIRDocument and snapshots the frame.
 *
 * On unknown `clipKind`, throws {@link GenerateFixtureUnavailableError} so
 * the generator script's CLI catches it as a render-unavailable failure
 * (the script's `RenderUnavailableError` instanceof check is name-based via
 * the {@link toGeneratorRenderUnavailable} adapter at the bin layer).
 */
export function createGenerateFixtureRenderer(args: {
  resolver: ClipKindResolver;
  render: PrimeRenderFn;
}): FixtureRendererLike {
  return {
    async render(renderArgs) {
      const binding = args.resolver(renderArgs.preset.frontmatter.clipKind);
      if (binding === undefined) {
        throw new GenerateFixtureUnavailableError(
          `no component bound for clipKind '${renderArgs.preset.frontmatter.clipKind}'`,
        );
      }
      const props = binding.buildProps(renderArgs.variant);
      const doc = buildPresetDocument({
        preset: renderArgs.preset,
        composition: renderArgs.composition,
        binding,
        props,
        ...(renderArgs.variant !== undefined ? { variant: renderArgs.variant } : {}),
      });
      return args.render(doc, renderArgs.frame);
    },
  };
}
