// packages/collab/src/binding.ts
// Document <-> Y.Doc shaped binding per ADR-006 §D1. The Y.Doc carries a
// shaped tree (top-level Y.Map keyed `meta`, `theme`, `variables`,
// `components`, `masters`, `layouts`, `content`) so concurrent edits to
// different fields merge automatically. Long-form text (TextElement.text,
// slide.notes) is stored in Y.Text. Element / slide arrays are
// Y.Array<Y.Map>. Single-writer fields (theme tokens, masters, layouts,
// meta.id) are plain JSON inside the parent Y.Map.

import type { Document, Element, Slide } from '@stageflip/schema';
import * as Y from 'yjs';

/** Top-level Y.Map key carrying the root document. */
export const ROOT_KEY = 'document';

/**
 * Recognized top-level keys inside the root Y.Map. The order mirrors
 * `Document` field order.
 */
const TOP_KEYS = [
  'meta',
  'theme',
  'variables',
  'components',
  'masters',
  'layouts',
  'content',
] as const;

/** Sentinel marking a Y.Text-backed string field on an element / slide. */
const Y_TEXT_MARKER = Symbol('yText');

/**
 * Element-level Y.Text fields. TextElement.text is the only one today;
 * adding a long-form text field on another element type (e.g., a future
 * caption variant) extends this map.
 */
const ELEMENT_Y_TEXT_FIELDS: Record<string, readonly string[]> = {
  text: ['text'],
};

/** Slide-level Y.Text fields. Speaker notes are the only one today. */
const SLIDE_Y_TEXT_FIELDS: readonly string[] = ['notes'];

/**
 * Build the shaped Y.Doc from a Document. The Y.Doc must be empty (or have
 * a matching meta.id; AC #7). Throws if the doc has been previously bound
 * with a different meta.id.
 */
export function documentToYDoc(doc: Document, ydoc: Y.Doc = new Y.Doc()): Y.Doc {
  const root = ydoc.getMap(ROOT_KEY);
  // AC #7 — meta.id is immutable post-construction.
  const existingMeta = root.get('meta');
  if (existingMeta !== undefined) {
    const existingId = (existingMeta as Record<string, unknown> | undefined)?.id;
    if (typeof existingId === 'string' && existingId !== doc.meta.id) {
      throw new Error(
        `binding: refusing to rebind Y.Doc with meta.id "${existingId}" to new id "${doc.meta.id}"`,
      );
    }
  }

  ydoc.transact(() => {
    root.set('meta', cloneJson(doc.meta));
    root.set('theme', cloneJson(doc.theme));
    root.set('variables', cloneJson(doc.variables));
    root.set('components', cloneJson(doc.components));
    root.set('masters', cloneJson(doc.masters));
    root.set('layouts', cloneJson(doc.layouts));
    root.set('content', buildContent(doc.content));
  });

  return ydoc;
}

/**
 * Materialize a Document from the Y.Doc. Pure read; no mutation.
 */
export function yDocToDocument(ydoc: Y.Doc): Document {
  const root = ydoc.getMap(ROOT_KEY);
  const out: Record<string, unknown> = {};
  for (const k of TOP_KEYS) {
    if (k === 'content') {
      out[k] = readContent(root.get('content'));
    } else {
      out[k] = cloneJson(root.get(k));
    }
  }
  return out as Document;
}

/**
 * Look up the slide Y.Map for the given slideId. Returns undefined if the
 * slide is absent. Used by command emitters.
 */
export function getSlideMap(ydoc: Y.Doc, slideId: string): Y.Map<unknown> | undefined {
  const slidesArr = getSlidesArray(ydoc);
  if (!slidesArr) return undefined;
  for (let i = 0; i < slidesArr.length; i += 1) {
    const slide = slidesArr.get(i) as Y.Map<unknown>;
    if (slide.get('id') === slideId) return slide;
  }
  return undefined;
}

/** Index of the slide, or -1. */
export function getSlideIndex(ydoc: Y.Doc, slideId: string): number {
  const slidesArr = getSlidesArray(ydoc);
  if (!slidesArr) return -1;
  for (let i = 0; i < slidesArr.length; i += 1) {
    const slide = slidesArr.get(i) as Y.Map<unknown>;
    if (slide.get('id') === slideId) return i;
  }
  return -1;
}

/** Return the `slides` Y.Array if the document is in slide mode. */
export function getSlidesArray(ydoc: Y.Doc): Y.Array<Y.Map<unknown>> | undefined {
  const root = ydoc.getMap(ROOT_KEY);
  const content = root.get('content') as Y.Map<unknown> | undefined;
  if (!content) return undefined;
  const mode = content.get('mode');
  if (mode !== 'slide') return undefined;
  return content.get('slides') as Y.Array<Y.Map<unknown>> | undefined;
}

/**
 * Build a Y.Map from a slide. Exported so command emitters (addSlide) can
 * construct new slides without round-tripping through documentToYDoc.
 */
export function buildSlideMap(slide: Slide): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(slide)) {
    if (key === 'elements') {
      const arr = new Y.Array<Y.Map<unknown>>();
      for (const el of slide.elements) arr.push([buildElementMap(el)]);
      map.set('elements', arr);
    } else if (SLIDE_Y_TEXT_FIELDS.includes(key) && typeof value === 'string') {
      map.set(key, new Y.Text(value));
    } else {
      map.set(key, cloneJson(value));
    }
  }
  return map;
}

/**
 * Build a Y.Map from an element. Exported so command emitters can construct
 * new elements. Recursively descends into group children.
 */
export function buildElementMap(element: Element): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  const elType = element.type;
  const yTextFields = ELEMENT_Y_TEXT_FIELDS[elType] ?? [];
  for (const [key, value] of Object.entries(element)) {
    if (key === 'children' && elType === 'group' && Array.isArray(value)) {
      const arr = new Y.Array<Y.Map<unknown>>();
      for (const child of value as Element[]) arr.push([buildElementMap(child)]);
      map.set('children', arr);
    } else if (yTextFields.includes(key) && typeof value === 'string') {
      map.set(key, new Y.Text(value));
    } else {
      map.set(key, cloneJson(value));
    }
  }
  return map;
}

/** Read a slide Y.Map back to a JSON Slide. */
export function readSlideMap(map: Y.Map<unknown>): Slide {
  const out: Record<string, unknown> = {};
  map.forEach((value, key) => {
    if (key === 'elements' && value instanceof Y.Array) {
      out[key] = value.toArray().map((el) => readElementMap(el as Y.Map<unknown>));
    } else if (SLIDE_Y_TEXT_FIELDS.includes(key) && value instanceof Y.Text) {
      out[key] = value.toString();
    } else {
      out[key] = cloneJson(value);
    }
  });
  return out as Slide;
}

/** Read an element Y.Map back to a JSON Element. */
export function readElementMap(map: Y.Map<unknown>): Element {
  const out: Record<string, unknown> = {};
  const type = map.get('type');
  const yTextFields = typeof type === 'string' ? (ELEMENT_Y_TEXT_FIELDS[type] ?? []) : [];
  map.forEach((value, key) => {
    if (key === 'children' && type === 'group' && value instanceof Y.Array) {
      out[key] = value.toArray().map((el) => readElementMap(el as Y.Map<unknown>));
    } else if (yTextFields.includes(key) && value instanceof Y.Text) {
      out[key] = value.toString();
    } else {
      out[key] = cloneJson(value);
    }
  });
  return out as Element;
}

/** Build the content Y.Map. Mode-aware: slide mode uses Y.Array<Y.Map>. */
function buildContent(content: Document['content']): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  if (content.mode === 'slide') {
    map.set('mode', 'slide');
    const slides = new Y.Array<Y.Map<unknown>>();
    for (const slide of content.slides) slides.push([buildSlideMap(slide)]);
    map.set('slides', slides);
    return map;
  }
  // Non-slide modes (video / display) are stored as plain JSON for now;
  // their CRDT shape is not in scope for T-260.
  for (const [k, v] of Object.entries(content)) map.set(k, cloneJson(v));
  return map;
}

/** Read the content Y.Map back to a Content. */
function readContent(content: unknown): Document['content'] {
  if (!(content instanceof Y.Map)) {
    return cloneJson(content) as Document['content'];
  }
  const mode = content.get('mode');
  if (mode === 'slide') {
    const slidesArr = content.get('slides') as Y.Array<Y.Map<unknown>> | undefined;
    const slides = slidesArr ? slidesArr.toArray().map((m) => readSlideMap(m)) : [];
    return { mode: 'slide', slides } as Document['content'];
  }
  const out: Record<string, unknown> = {};
  content.forEach((value, key) => {
    out[key] = cloneJson(value);
  });
  return out as Document['content'];
}

/**
 * Deep-clone a JSON value, materializing Y.* types to their plain
 * JSON equivalents. Used to read single-writer plain-JSON fields back.
 */
function cloneJson<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Y.Text) return value.toString() as unknown as T;
  if (value instanceof Y.Array) {
    return value.toArray().map((v) => cloneJson(v)) as unknown as T;
  }
  if (value instanceof Y.Map) {
    const out: Record<string, unknown> = {};
    value.forEach((v, k) => {
      out[k] = cloneJson(v);
    });
    return out as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => cloneJson(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = cloneJson(v);
    }
    return out as unknown as T;
  }
  return value;
}

// Marker is exported solely for tests that want to sanity-check field
// classification without re-exporting the whole map.
export const __internal__ = { Y_TEXT_MARKER, ELEMENT_Y_TEXT_FIELDS, SLIDE_Y_TEXT_FIELDS };
