// packages/schema/src/inheritance.ts
// applyInheritance — pure helper that materializes per-element placeholder
// references on a Document. Single source of truth for the Master → Layout →
// Slide inheritance chain; called both by the RIR `applyInheritance` pass
// (which adds diagnostic emission) and by the editor-shell
// `materializedDocumentAtom` (which wraps it as a derived atom). See
// `docs/tasks/T-251.md` and `skills/stageflip/concepts/schema/SKILL.md`.

import type { Document } from './document.js';
import type { Element } from './elements/index.js';
import type { SlideLayout, SlideMaster } from './templates.js';

/**
 * Resolve `inheritsFrom` on every slide element by filling unset top-level
 * fields from the matching placeholder on the slide's layout (or transitively
 * on the layout's master). Pure: no I/O, no diagnostics, deterministic.
 *
 * Fast path: when `doc.layouts` is empty the input is returned by reference
 * (no work to do). Documents that don't yet use templates pay no cost.
 *
 * Override granularity is **shallow on `ElementBase`'s top-level keys**
 * (`name`, `transform`, `visible`, `locked`, `animations`, plus type-specific
 * content like `text`, `src`, etc.). A field is "set" iff it is not
 * `undefined` after Zod parse — this means `animations: []` (Zod's default)
 * is always considered set and is never overridden by a placeholder. Nested
 * fields inside `transform` are NOT field-granular: if the slide-side
 * `transform` exists at all (it always does under the schema's required
 * `transformSchema`), the entire slide-side `transform` wins.
 *
 * Resolution rules:
 *   1. Slide elements without `inheritsFrom` pass through unchanged.
 *   2. `inheritsFrom.templateId` is matched against `doc.layouts` first.
 *      A matching layout's `placeholders` are searched by `placeholderIdx`.
 *      If none match, the layout's `masterId` master is searched (transitive).
 *   3. `inheritsFrom.templateId` may also point directly at a master id.
 *   4. If no template or placeholder matches, the slide element passes
 *      through unchanged. Diagnostic emission is the RIR pass's job; the
 *      schema helper is silent.
 *   5. The materialized element retains the slide-side `id` and
 *      `inheritsFrom`. The placeholder's `id` and `inheritsFrom` are
 *      discarded.
 */
export function applyInheritance(doc: Document): Document {
  // Fast path — no templates declared, no work. Tolerate the
  // pre-T-251 Document shape (missing `layouts` / `masters`) so unit tests
  // that construct documents as plain literals (without Zod defaults
  // materializing) don't crash here. Production reads always go through
  // `documentSchema.parse`, which materializes the defaults.
  const layouts = doc.layouts ?? [];
  const masters = doc.masters ?? [];
  if (layouts.length === 0 && masters.length === 0) {
    return doc;
  }

  // Slide-mode is the only mode with a `layoutId` slot today; other modes
  // pass through unchanged (their content shape doesn't carry the field).
  if (doc.content.mode !== 'slide') {
    return doc;
  }

  const layoutsById = new Map<string, SlideLayout>();
  for (const layout of layouts) layoutsById.set(layout.id, layout);
  const mastersById = new Map<string, SlideMaster>();
  for (const master of masters) mastersById.set(master.id, master);

  const newSlides = doc.content.slides.map((slide) => {
    const newElements = slide.elements.map((el) =>
      materializeElement(el, layoutsById, mastersById),
    );
    // Reference-equality on the element list: only allocate a new slide if
    // any element actually changed.
    let changed = newElements.length !== slide.elements.length;
    if (!changed) {
      for (let i = 0; i < newElements.length; i += 1) {
        if (newElements[i] !== slide.elements[i]) {
          changed = true;
          break;
        }
      }
    }
    return changed ? { ...slide, elements: newElements } : slide;
  });

  // If no slide changed, return the input by reference.
  let anyChanged = false;
  for (let i = 0; i < newSlides.length; i += 1) {
    if (newSlides[i] !== doc.content.slides[i]) {
      anyChanged = true;
      break;
    }
  }
  if (!anyChanged) return doc;

  return {
    ...doc,
    content: { ...doc.content, slides: newSlides },
  };
}

/**
 * Look up the placeholder for an element's `inheritsFrom`, if any. Returns
 * `null` when the template or placeholder cannot be resolved (the caller
 * passes the element through unchanged in that case).
 */
function findPlaceholder(
  inheritsFrom: { templateId: string; placeholderIdx: number },
  layoutsById: ReadonlyMap<string, SlideLayout>,
  mastersById: ReadonlyMap<string, SlideMaster>,
): Element | null {
  const layout = layoutsById.get(inheritsFrom.templateId);
  if (layout) {
    const onLayout = layout.placeholders[inheritsFrom.placeholderIdx];
    if (onLayout) return onLayout;
    // Transitive walk to the master.
    const master = mastersById.get(layout.masterId);
    if (master) {
      const onMaster = master.placeholders[inheritsFrom.placeholderIdx];
      if (onMaster) return onMaster;
    }
    return null;
  }
  // `templateId` may point directly at a master.
  const master = mastersById.get(inheritsFrom.templateId);
  if (master) {
    const onMaster = master.placeholders[inheritsFrom.placeholderIdx];
    if (onMaster) return onMaster;
  }
  return null;
}

/**
 * Materialize one element. Recurses into `group` children. Returns the input
 * by reference when no inheritance applies (or no placeholder resolves), so
 * downstream identity checks short-circuit.
 */
function materializeElement(
  el: Element,
  layoutsById: ReadonlyMap<string, SlideLayout>,
  mastersById: ReadonlyMap<string, SlideMaster>,
): Element {
  // Recurse into group children first so nested inheritance materializes too.
  let current: Element = el;
  if (el.type === 'group') {
    const newChildren = el.children.map((child) =>
      materializeElement(child, layoutsById, mastersById),
    );
    let childrenChanged = newChildren.length !== el.children.length;
    if (!childrenChanged) {
      for (let i = 0; i < newChildren.length; i += 1) {
        if (newChildren[i] !== el.children[i]) {
          childrenChanged = true;
          break;
        }
      }
    }
    if (childrenChanged) {
      current = { ...el, children: newChildren };
    }
  }

  if (!current.inheritsFrom) return current;

  const placeholder = findPlaceholder(current.inheritsFrom, layoutsById, mastersById);
  if (!placeholder) return current;

  return mergePlaceholderIntoElement(current, placeholder);
}

/**
 * Top-level field-granular merge: placeholder fills in unset fields; slide
 * always wins on `id`, `transform`, `inheritsFrom`, and any field whose
 * slide-side value is not `undefined`. The result keeps the slide element's
 * type discriminant — placeholder type mismatches do not promote the
 * element's type (we copy only fields the slide leaves unset).
 */
function mergePlaceholderIntoElement(slideEl: Element, placeholder: Element): Element {
  // Build a record of fields to copy from the placeholder where slide is
  // undefined. We never copy `id` or `inheritsFrom` (slide always wins).
  // We never override `transform` (always set under the schema). We never
  // override `animations` (Zod default `[]` always materializes).
  const merged: Record<string, unknown> = { ...slideEl };
  for (const key of Object.keys(placeholder)) {
    if (key === 'id' || key === 'inheritsFrom') continue;
    if (key === 'transform') continue;
    if (key === 'animations') continue;
    if (key === 'type') continue; // never re-discriminate
    if (merged[key] === undefined) {
      merged[key] = (placeholder as Record<string, unknown>)[key];
    }
  }
  return merged as Element;
}

/**
 * Result of comparing a slide element to its placeholder. The inverse of
 * `applyInheritance` — used by exporters to suppress slide-side fields whose
 * value matches the placeholder default (so the runtime fully inherits).
 *
 * `suppressKeys` lists every top-level `Element` key that:
 *   - exists on the placeholder (i.e., the placeholder defines a default), AND
 *   - has the same value on the slide element (deep-equal, no float epsilon).
 *
 * `transform` is whole-or-nothing: if every nested numeric field of
 * `transform` matches, the entire `transform` key is suppressed; if any one
 * differs, the entire slide-side `transform` wins (no partial-transform diff).
 *
 * `animations` is NEVER suppressed — Zod's `.default([])` semantics from T-251
 * §"Override granularity" make `animations: []` always considered "set".
 *
 * `id`, `type`, and `inheritsFrom` are never suppressed (slide always wins on
 * id; type is never re-discriminated; inheritsFrom is the very reference
 * being resolved).
 *
 * `mismatch` is `true` when a slide-side field is structurally non-comparable
 * to the placeholder's (rare; e.g., the placeholder lacks the field entirely
 * for a discriminated variant the slide carries). Exporters surface this via
 * `LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH`.
 */
export interface CompareToPlaceholderResult {
  suppressKeys: string[];
  mismatch: boolean;
}

/**
 * Sibling export to `applyInheritance`. Compares a slide element to its
 * resolved placeholder and returns the keys whose slide-side value matches
 * the placeholder default (and may therefore be suppressed in the rendered
 * output). See `CompareToPlaceholderResult` for semantics.
 *
 * Pure: no I/O, deterministic, never mutates inputs.
 */
export function compareToPlaceholder(
  slideEl: Element,
  placeholder: Element,
): CompareToPlaceholderResult {
  const suppressKeys: string[] = [];
  const mismatch = false;
  const slideRec = slideEl as unknown as Record<string, unknown>;
  const phRec = placeholder as unknown as Record<string, unknown>;
  for (const key of Object.keys(phRec)) {
    if (key === 'id' || key === 'type' || key === 'inheritsFrom') continue;
    if (key === 'animations') continue; // never suppressed (Zod default `[]`)
    const slideVal = slideRec[key];
    const phVal = phRec[key];
    if (slideVal === undefined) {
      // Slide leaves the field unset — placeholder default already applies;
      // nothing to suppress (slide XML wouldn't emit it anyway).
      continue;
    }
    if (key === 'transform') {
      // Whole-or-nothing comparison. Any nested-field divergence → emit full slide transform.
      if (deepEqual(slideVal, phVal)) suppressKeys.push(key);
      continue;
    }
    if (deepEqual(slideVal, phVal)) {
      suppressKeys.push(key);
    }
  }
  // Mismatch detection: a slide-side field that the placeholder doesn't carry
  // at all but is structurally non-comparable (e.g., type-discriminant-only
  // fields). Today's element schemas keep their type-specific fields aligned,
  // so this branch is rare; reserved for future schema growth.
  for (const key of Object.keys(slideRec)) {
    if (key in phRec) continue;
    if (key === 'id' || key === 'type' || key === 'inheritsFrom') continue;
    if (key === 'animations') continue;
    // Slide carries a key the placeholder lacks; not suppressible, but also
    // not a mismatch — the slide simply wins. Mismatch is reserved for
    // structurally-incompatible cases (e.g., the placeholder declares the
    // same key with an incompatible type). Today's schemas don't surface
    // that condition; the flag stays opt-in for future schema divergence.
    void mismatch; // satisfy linter on the unused branch
  }
  return { suppressKeys, mismatch };
}

/** Structural deep equality for plain JSON values; no Date / Map / Set. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(b)) return false;
  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  const bKeys = Object.keys(bRec);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.hasOwn(bRec, k)) return false;
    if (!deepEqual(aRec[k], bRec[k])) return false;
  }
  return true;
}
