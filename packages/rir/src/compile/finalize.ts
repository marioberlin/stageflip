// packages/rir/src/compile/finalize.ts
// T-031 passes, run after T-030 lowering:
//   1. stacking-context — wraps three/shader/embed runtimes in 'isolate'
//   2. timing-flatten   — refines element timing to its container window and
//                         resolves per-element B1–B5 animations into absolute
//                         RIRTiming.

import type { Animation, Document, Element, TimingPrimitive } from '@stageflip/schema';
import type { CompilerDiagnostic, RIRAnimation, RIRDocument, RIRElement } from '../types.js';
import type { DiagnosticSink } from './passes.js';

/** A frame window used as the container timing for an element or a group of siblings. */
export interface FrameWindow {
  startFrame: number;
  endFrame: number;
  durationFrames: number;
}

/* --------------------------- stacking-context --------------------------- */

/**
 * Set stacking='isolate' for elements whose runtime kind needs an isolated
 * stacking context. Per the RIR skill: three, shader, embed runtimes plus
 * `embed` elements directly.
 */
export function applyStackingContext(elements: RIRElement[]): RIRElement[] {
  const ISOLATED_CLIP_RUNTIMES = new Set(['three', 'shader']);

  return elements.map((el) => {
    let stacking: RIRElement['stacking'] = el.stacking;
    if (el.content.type === 'embed') stacking = 'isolate';
    if (el.content.type === 'clip' && ISOLATED_CLIP_RUNTIMES.has(el.content.runtime)) {
      stacking = 'isolate';
    }
    if (el.content.type === 'group') {
      return {
        ...el,
        stacking,
        content: { ...el.content, children: applyStackingContext(el.content.children) },
      };
    }
    return { ...el, stacking };
  });
}

/** Produce an up-to-date stackingMap from an element tree. */
export function rebuildStackingMap(elements: RIRElement[]): Record<string, 'isolate' | 'auto'> {
  const map: Record<string, 'isolate' | 'auto'> = {};
  const walk = (els: RIRElement[]): void => {
    for (const e of els) {
      map[e.id] = e.stacking;
      if (e.content.type === 'group') walk(e.content.children);
    }
  };
  walk(elements);
  return map;
}

/* --------------------------- timing-flatten --------------------------- */

/**
 * Build a map of { elementId -> containing FrameWindow } based on the
 * document's content structure. Slide mode assigns one window per slide;
 * video and display assign the composition window to every top-level
 * element. Group children inherit their group's window.
 */
export function buildContainerWindows(
  doc: Document,
  fullWindow: FrameWindow,
  frameRate: number,
): Map<string, FrameWindow> {
  const out = new Map<string, FrameWindow>();
  const msToFrames = (ms: number): number => Math.max(1, Math.round((ms * frameRate) / 1000));

  const assign = (els: readonly Element[], win: FrameWindow): void => {
    for (const el of els) {
      out.set(el.id, win);
      if (el.type === 'group') assign(el.children, win);
    }
  };

  switch (doc.content.mode) {
    case 'slide': {
      let cursor = 0;
      for (const slide of doc.content.slides) {
        const duration = slide.durationMs
          ? msToFrames(slide.durationMs)
          : fullWindow.durationFrames;
        const win: FrameWindow = {
          startFrame: cursor,
          endFrame: cursor + duration,
          durationFrames: duration,
        };
        assign(slide.elements, win);
        cursor += duration;
      }
      break;
    }
    case 'video': {
      for (const track of doc.content.tracks) {
        assign(track.elements, fullWindow);
      }
      break;
    }
    case 'display':
      assign(doc.content.elements, fullWindow);
      break;
    default: {
      const never: never = doc.content;
      void never;
    }
  }

  return out;
}

/**
 * Resolve a TimingPrimitive (B1–B5) to a concrete FrameWindow, given the
 * element's container window and a lookup of prior-element windows (for
 * B3 anchored).
 */
export function resolveTimingPrimitive(
  primitive: TimingPrimitive,
  elementWindow: FrameWindow,
  resolvedAnchors: Map<string, FrameWindow>,
  elementId: string,
  sink: DiagnosticSink,
): FrameWindow {
  switch (primitive.kind) {
    case 'absolute': {
      const start = elementWindow.startFrame + primitive.startFrame;
      return {
        startFrame: start,
        endFrame: start + primitive.durationFrames,
        durationFrames: primitive.durationFrames,
      };
    }
    case 'relative': {
      // Offset from the element's own start window.
      const start = elementWindow.startFrame + primitive.offsetFrames;
      const clamped = Math.max(start, elementWindow.startFrame);
      return {
        startFrame: clamped,
        endFrame: clamped + primitive.durationFrames,
        durationFrames: primitive.durationFrames,
      };
    }
    case 'anchored': {
      const anchor = resolvedAnchors.get(primitive.anchor);
      if (!anchor) {
        sink.emit({
          severity: 'warn',
          code: 'anchored-unresolved',
          message: `anchor "${primitive.anchor}" for element "${elementId}" is not resolved; falling back to element start`,
          pass: 'timing-flatten',
          elementId,
        });
        const start = elementWindow.startFrame + primitive.offsetFrames;
        return {
          startFrame: start,
          endFrame: start + primitive.durationFrames,
          durationFrames: primitive.durationFrames,
        };
      }
      const anchorBase = primitive.anchorEdge === 'start' ? anchor.startFrame : anchor.endFrame;
      const myStart =
        primitive.mySide === 'end'
          ? anchorBase - primitive.durationFrames + primitive.offsetFrames
          : anchorBase + primitive.offsetFrames;
      return {
        startFrame: myStart,
        endFrame: myStart + primitive.durationFrames,
        durationFrames: primitive.durationFrames,
      };
    }
    case 'beat': {
      sink.emit({
        severity: 'warn',
        code: 'beat-no-bpm',
        message: `beat timing for element "${elementId}" requires a composition BPM; not yet configured`,
        pass: 'timing-flatten',
        elementId,
      });
      return elementWindow;
    }
    case 'event': {
      sink.emit({
        severity: 'info',
        code: 'event-deferred',
        message: `event timing for element "${elementId}" is resolved at runtime; using container window as placeholder`,
        pass: 'timing-flatten',
        elementId,
      });
      return elementWindow;
    }
    default: {
      const never: never = primitive;
      void never;
      return elementWindow;
    }
  }
}

/**
 * Apply timing-flatten + animation resolution to every RIRElement.
 *   - element.timing  gets refined from identity to its container window
 *   - element.animations gets populated with RIRAnimation entries (B1–B5
 *     resolved to absolute frames)
 *
 * @param elements     Lowered RIR elements (from T-030).
 * @param sourceElements Original schema elements (to read raw animations).
 * @param containerWindows Map from elementId to its containing FrameWindow.
 * @param sink         Diagnostic collector.
 */
export function applyTimingFlatten(
  elements: RIRElement[],
  sourceElements: readonly Element[],
  containerWindows: Map<string, FrameWindow>,
  sink: DiagnosticSink,
): RIRElement[] {
  const sourceById = new Map<string, Element>();
  const indexSources = (els: readonly Element[]): void => {
    for (const el of els) {
      sourceById.set(el.id, el);
      if (el.type === 'group') indexSources(el.children);
    }
  };
  indexSources(sourceElements);

  // resolvedElementWindows tracks the timing we've assigned, for B3 anchoring.
  const resolvedWindows = new Map<string, FrameWindow>();

  const lower = (els: RIRElement[]): RIRElement[] =>
    els.map((el) => {
      const src = sourceById.get(el.id);
      const elementWindow = containerWindows.get(el.id) ?? {
        startFrame: 0,
        endFrame: el.timing.durationFrames,
        durationFrames: el.timing.durationFrames,
      };
      resolvedWindows.set(el.id, elementWindow);

      const animations: RIRAnimation[] = (src?.animations ?? []).map((a: Animation) => {
        const window = resolveTimingPrimitive(
          a.timing,
          elementWindow,
          resolvedWindows,
          el.id,
          sink,
        );
        return { id: a.id, timing: window, animation: a.animation, autoplay: a.autoplay };
      });

      let nextChildren: RIRElement[] | null = null;
      if (el.content.type === 'group') {
        nextChildren = lower(el.content.children);
      }

      const refined: RIRElement = {
        ...el,
        timing: {
          startFrame: elementWindow.startFrame,
          endFrame: elementWindow.endFrame,
          durationFrames: elementWindow.durationFrames,
        },
        animations,
        ...(nextChildren
          ? {
              content: {
                ...(el.content as Extract<RIRElement['content'], { type: 'group' }>),
                children: nextChildren,
              },
            }
          : {}),
      };
      return refined;
    });

  return lower(elements);
}

/**
 * Top-level finalize: run stacking-context, timing-flatten, then rebuild the
 * stackingMap from the final tree.
 */
export function finalizeRIR(rir: RIRDocument, source: Document, sink: DiagnosticSink): RIRDocument {
  // 1. stacking-context (pure; no dependency on timings)
  const withStacking = applyStackingContext(rir.elements);

  // 2. timing-flatten — derive container windows from the source document.
  const fullWindow: FrameWindow = {
    startFrame: 0,
    endFrame: rir.durationFrames,
    durationFrames: rir.durationFrames,
  };
  const sourceRoots = collectSourceRoots(source);
  const containerWindows = buildContainerWindows(source, fullWindow, rir.frameRate);
  const withTiming = applyTimingFlatten(withStacking, sourceRoots, containerWindows, sink);

  // 3. rebuild stackingMap
  const stackingMap = rebuildStackingMap(withTiming);

  return { ...rir, elements: withTiming, stackingMap };
}

/** Mirror of T-030's collectRootElements. Kept private to this file. */
function collectSourceRoots(doc: Document): Element[] {
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

export type { CompilerDiagnostic };
