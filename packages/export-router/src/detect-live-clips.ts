// packages/export-router/src/detect-live-clips.ts
// Pure walker over a Document — collects every `interactive-clip` element it
// finds, recursively descending into `group.children`. Deterministic order:
// content order, then in-element order, then in-children order.
//
// BROWSER-SAFE: pure functions over typed input; no I/O.

import type { Document, Element } from '@stageflip/schema';
import type { OmittedLiveClip } from './types.js';

/**
 * Walk a Document and return every `interactive-clip` element found,
 * including those nested inside `group.children`. Order is deterministic
 * (content order; the walker does not allocate when no live clips are
 * present).
 *
 * The Document content shape is mode-discriminated:
 *  - `'slide'` mode: `content.slides[].elements[]`
 *  - `'video'` mode: `content.tracks[].elements[]`
 *  - `'display'` mode: `content.elements[]`
 */
export function detectLiveClips(document: Document): ReadonlyArray<OmittedLiveClip> {
  const out: OmittedLiveClip[] = [];
  const content = document.content;

  if (content.mode === 'slide') {
    for (const slide of content.slides) {
      collectFromElements(slide.elements, out);
    }
  } else if (content.mode === 'video') {
    for (const track of content.tracks) {
      collectFromElements(track.elements, out);
    }
  } else {
    // 'display' mode
    collectFromElements(content.elements, out);
  }

  return out;
}

function collectFromElements(elements: ReadonlyArray<Element>, out: OmittedLiveClip[]): void {
  for (const el of elements) {
    if (el.type === 'interactive-clip') {
      out.push({ id: el.id, family: el.family });
      // Note: we intentionally do NOT descend into staticFallback. Only the
      // live mount is being omitted; the fallback is what the exporter will
      // render in its place.
    } else if (el.type === 'group') {
      collectFromElements(el.children, out);
    }
    // All other element types (text, image, video, audio, shape, chart,
    // table, clip, embed, code, blender-clip) are not live — they render via
    // frame-runtime regardless of target.
  }
}
