// packages/rir/src/compile/index.ts
// compileRIR — orchestrates every RIR compile pass into a final RIRDocument:
//   T-030 passes: theme-resolve, variable-resolve, component-expand (stub),
//                 binding-resolve, font-aggregate, lower-tree (zIndex, content)
//   T-031 passes: stacking-context, timing-flatten
//
// The output is deterministic: identical (Document, opts) pairs yield
// byte-identical RIRDocument values. The only wall-clock-like side-input is
// opts.compilerVersion, which callers supply.

import type { Document, Element } from '@stageflip/schema';
import { documentSchema } from '@stageflip/schema';

import type {
  CompileResult,
  CompilerDiagnostic,
  RIRDocument,
  RIRElement,
  RIRElementContent,
  StackingMap,
} from '../types.js';
import { finalizeRIR } from './finalize.js';
import {
  type DataSourceProvider,
  DiagnosticSink,
  aggregateFonts,
  applyInheritancePass,
  expandComponents,
  mapElements,
  resolveBindings,
  resolveThemeRefs,
  resolveVariables,
} from './passes.js';

export interface CompileRIROptions {
  /** Override the compiler version tag written to RIRMeta. */
  compilerVersion?: string;
  /** If true, stop at the first error diagnostic. */
  failFast?: boolean;
  /** Resolver for `ds:<id>` references used by chart elements. */
  dataSourceProvider?: DataSourceProvider;
}

const DEFAULT_COMPILER_VERSION = '0.1.0-t030';

/** Simple FNV-1a 32-bit hash used for RIRMeta.digest. Deterministic. */
function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Derive a composition-wide frameRate/duration from the doc's content. */
function deriveFrameWindow(doc: Document): { frameRate: number; durationFrames: number } {
  const content = doc.content;
  if (content.mode === 'video') {
    return {
      frameRate: content.frameRate,
      durationFrames: Math.max(1, Math.round((content.durationMs * content.frameRate) / 1000)),
    };
  }
  // Slides + display use an implicit 30fps timeline for RIR purposes. Real
  // per-slide / per-banner timing is T-031's scope.
  const frameRate = 30;
  if (content.mode === 'display') {
    return {
      frameRate,
      durationFrames: Math.max(1, Math.round((content.durationMs * frameRate) / 1000)),
    };
  }
  // Slide: fall back to 1s/slide when none declare a duration.
  const msPerSlide = 1000;
  const totalMs = content.slides.reduce((sum, s) => sum + (s.durationMs ?? msPerSlide), 0);
  return {
    frameRate,
    durationFrames: Math.max(1, Math.round((totalMs * frameRate) / 1000)),
  };
}

/** Collect every element (flat) across the document's modes. */
function collectRootElements(doc: Document): Element[] {
  switch (doc.content.mode) {
    case 'slide':
      return doc.content.slides.flatMap((s) => s.elements);
    case 'video':
      return doc.content.tracks.flatMap((t) => t.elements);
    case 'display':
      return doc.content.elements;
    default: {
      const never: never = doc.content;
      void never;
      return [];
    }
  }
}

/**
 * Transform a schema Element into a pre-T-031 RIRElement. Content is cloned
 * with resolved literals; timing is identity; stacking is 'auto'; zIndex is
 * assigned by the caller (it depends on the array-order context).
 */
function elementToRIR(el: Element, zIndex: number, window: { durationFrames: number }): RIRElement {
  const baseTransform = el.transform;
  // Transform defaults may have been stripped on parse; normalize.
  const transform = {
    x: baseTransform.x,
    y: baseTransform.y,
    width: baseTransform.width,
    height: baseTransform.height,
    rotation: baseTransform.rotation ?? 0,
    opacity: baseTransform.opacity ?? 1,
  };

  const base = {
    id: el.id,
    type: el.type,
    transform,
    timing: {
      startFrame: 0,
      endFrame: window.durationFrames,
      durationFrames: window.durationFrames,
    },
    zIndex,
    visible: el.visible ?? true,
    locked: el.locked ?? false,
    stacking: 'auto' as const,
    // T-030 leaves animations empty; T-031 (finalize pass) resolves them
    // after element windows are known.
    animations: [] as RIRElement['animations'],
  };

  const content: RIRElementContent = toRIRContent(el);
  return { ...base, content };
}

/** Lower a canonical element's type-specific fields to an RIRElementContent. */
function toRIRContent(el: Element): RIRElementContent {
  switch (el.type) {
    case 'text':
      return {
        type: 'text',
        text: el.text,
        fontFamily: el.fontFamily ?? 'system-ui',
        fontSize: el.fontSize ?? 16,
        fontWeight: 400,
        color: typeof el.color === 'string' ? el.color : '#000000',
        align: el.align ?? 'left',
        lineHeight: el.lineHeight ?? 1.4,
      };
    case 'image':
      return {
        type: 'image',
        srcUrl: el.src,
        ...(el.alt !== undefined ? { alt: el.alt } : {}),
        fit: el.fit ?? 'cover',
      };
    case 'video':
      return {
        type: 'video',
        srcUrl: el.src,
        ...(el.trim ? { trimStartMs: el.trim.startMs, trimEndMs: el.trim.endMs } : {}),
        muted: el.muted,
        loop: el.loop,
        playbackRate: el.playbackRate,
      };
    case 'audio':
      return {
        type: 'audio',
        srcUrl: el.src,
        ...(el.trim ? { trimStartMs: el.trim.startMs, trimEndMs: el.trim.endMs } : {}),
        loop: el.loop,
        gain: el.mix?.gain ?? 1,
        pan: el.mix?.pan ?? 0,
        fadeInMs: el.mix?.fadeInMs ?? 0,
        fadeOutMs: el.mix?.fadeOutMs ?? 0,
      };
    case 'shape':
      return {
        type: 'shape',
        shape: el.shape,
        ...(el.path ? { path: el.path } : {}),
        ...(el.fill && typeof el.fill === 'string' ? { fill: el.fill } : {}),
        ...(el.stroke
          ? {
              strokeColor: typeof el.stroke.color === 'string' ? el.stroke.color : '#000000',
              strokeWidth: el.stroke.width,
            }
          : {}),
        ...(el.cornerRadius !== undefined ? { cornerRadius: el.cornerRadius } : {}),
      };
    case 'chart':
      return {
        type: 'chart',
        chartKind: el.chartKind,
        // Post-binding-resolve, data should be inline. If a ds: string
        // remains, emit empty data so the renderer draws a placeholder.
        data: typeof el.data === 'string' ? { labels: [], series: [] } : el.data,
        legend: el.legend,
        axes: el.axes,
      };
    case 'table':
      return {
        type: 'table',
        rows: el.rows,
        columns: el.columns,
        headerRow: el.headerRow,
        cells: el.cells,
      };
    case 'clip':
      return {
        type: 'clip',
        runtime: el.runtime,
        clipName: el.clipName,
        params: el.params,
      };
    case 'embed':
      return {
        type: 'embed',
        src: el.src,
        sandbox: el.sandbox,
        allowFullscreen: el.allowFullscreen,
      };
    case 'code':
      return {
        type: 'code',
        code: el.code,
        language: el.language,
        ...(el.theme ? { theme: el.theme } : {}),
        showLineNumbers: el.showLineNumbers,
        wrap: el.wrap,
      };
    case 'group':
      return {
        type: 'group',
        clip: el.clip,
        // Group children are lowered by the caller so we can assign zIndex
        // per-depth; stub with empty here and fix up in compileRIR.
        children: [],
      };
    case 'blender-clip':
      // T-265: BlenderClip is the bake-tier element type. The renderer
      // dispatcher fetches frames by `inputsHash` from the bake cache and
      // composites them as a video; the RIR shape mirrors the existing
      // `clip` lowering with `runtime: 'blender'` + the inputsHash carried
      // through `params` so downstream layers can reach the cache without
      // re-deriving it.
      return {
        type: 'clip',
        runtime: 'blender',
        clipName: el.scene.template,
        params: {
          inputsHash: el.inputsHash,
          scene: el.scene,
          duration: el.duration,
        },
      };
    default: {
      const never: never = el;
      return never;
    }
  }
}

/** Recursively lower elements, assigning zIndex = index * 10 per sibling group. */
function lowerElementTree(
  elements: readonly Element[],
  window: { durationFrames: number },
): RIRElement[] {
  return elements.map((el, i) => {
    const rir = elementToRIR(el, i * 10, window);
    if (el.type === 'group' && rir.content.type === 'group') {
      return {
        ...rir,
        content: {
          ...rir.content,
          children: lowerElementTree(el.children, window),
        },
      };
    }
    return rir;
  });
}

/* --------------------------- Orchestrator --------------------------- */

export function compileRIR(input: unknown, opts: CompileRIROptions = {}): CompileResult {
  const sink = new DiagnosticSink();
  const parsed = documentSchema.parse(input);

  // Pass 0: apply-inheritance — materialize per-element placeholder refs
  // (T-251). Runs FIRST so theme tokens / variables / component bodies on
  // placeholder values resolve through the standard pipeline.
  const doc = applyInheritancePass(parsed, sink);

  // Pass 1: component-expand (currently stub).
  const expanded = expandComponents(doc, sink);

  // Pass 2: variable + theme resolution inside text content. Deep walk.
  const resolvedElements = mapElements(collectRootElements(expanded), (el) => {
    if (el.type === 'text') {
      const interpolated = resolveVariables(
        el.text,
        expanded.variables,
        { elementId: el.id },
        sink,
      );
      const withTheme =
        typeof el.color === 'string' && el.color.startsWith('theme:')
          ? { ...el, color: resolveThemeRefs(el.color, expanded.theme, { elementId: el.id }, sink) }
          : el;
      return { ...withTheme, text: interpolated };
    }
    if (el.type === 'shape' && typeof el.fill === 'string' && el.fill.startsWith('theme:')) {
      return {
        ...el,
        fill: resolveThemeRefs(el.fill, expanded.theme, { elementId: el.id }, sink),
      };
    }
    return el;
  });

  // Pass 3: binding-resolve on chart elements.
  const boundElements = resolveBindings(resolvedElements, opts.dataSourceProvider, sink);

  // Pass 4: font-aggregate.
  const fontRequirements = aggregateFonts(boundElements);

  // Synthesize frame window for the pre-timing-flatten RIR.
  const window = deriveFrameWindow(expanded);

  // Lower elements (assign zIndex, normalize transform defaults, produce content).
  const rirElements = lowerElementTree(boundElements, window);

  // Build the stacking map — every element is 'auto' at this stage.
  const stackingMap: StackingMap = {};
  const walk = (els: RIRElement[]): void => {
    for (const e of els) {
      stackingMap[e.id] = e.stacking;
      if (e.content.type === 'group') walk(e.content.children);
    }
  };
  walk(rirElements);

  if (opts.failFast && sink.errorCount() > 0) {
    return {
      rir: emptyRIR(expanded, window, opts),
      diagnostics: sink.items,
    };
  }

  const preFinal: RIRDocument = {
    id: expanded.meta.id,
    width: 1920,
    height: 1080,
    frameRate: window.frameRate,
    durationFrames: window.durationFrames,
    mode: expanded.content.mode,
    elements: rirElements,
    stackingMap,
    fontRequirements,
    meta: {
      sourceDocId: expanded.meta.id,
      sourceVersion: expanded.meta.version,
      compilerVersion: opts.compilerVersion ?? DEFAULT_COMPILER_VERSION,
      // Digest is computed from the FINAL tree below (after T-031 refinements).
      digest: '00000000',
    },
  };

  // T-031: stacking-context + timing-flatten + animation resolution.
  const finalized = finalizeRIR(preFinal, expanded, sink);

  // Digest over the finalized structure so post-T-031 diffs are stable.
  const digest = hashString(
    JSON.stringify({
      elements: finalized.elements.map((e) => ({
        id: e.id,
        type: e.type,
        zIndex: e.zIndex,
        stacking: e.stacking,
        timing: e.timing,
        animations: e.animations.map((a) => ({ id: a.id, timing: a.timing })),
      })),
      fontRequirements,
      stackingMap: finalized.stackingMap,
      mode: expanded.content.mode,
    }),
  );

  const rir: RIRDocument = { ...finalized, meta: { ...finalized.meta, digest } };
  return { rir, diagnostics: sink.items };
}

function emptyRIR(
  doc: Document,
  window: { frameRate: number; durationFrames: number },
  opts: CompileRIROptions,
): RIRDocument {
  return {
    id: doc.meta.id,
    width: 1920,
    height: 1080,
    frameRate: window.frameRate,
    durationFrames: window.durationFrames,
    mode: doc.content.mode,
    elements: [],
    stackingMap: {},
    fontRequirements: [],
    meta: {
      sourceDocId: doc.meta.id,
      sourceVersion: doc.meta.version,
      compilerVersion: opts.compilerVersion ?? DEFAULT_COMPILER_VERSION,
      digest: '00000000',
    },
  };
}

// Re-export the diagnostic type for convenience.
export type { CompilerDiagnostic };
