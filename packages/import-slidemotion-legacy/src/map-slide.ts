// packages/import-slidemotion-legacy/src/map-slide.ts
// Slide-level mapping: background, duration, element list, notes.

import type { Element, Slide, SlideBackground } from '@stageflip/schema';
import type { LegacySlide } from './legacy-schema.js';
import { mapElement } from './map-elements.js';
import { normalizeHexColor, sanitizeId, toAssetRef, uniqueifyIds } from './sanitize.js';
import type { WarningSink } from './warnings.js';

function mapBackground(
  raw: LegacySlide['background'],
  path: string,
  sink: WarningSink,
): SlideBackground | null {
  if (!raw) return null;
  if (raw.type === 'solid') {
    const color = normalizeHexColor((raw as { color?: unknown }).color);
    if (color === null) {
      sink.add(`${path}/color`, 'invalid-color', String((raw as { color?: unknown }).color));
      return null;
    }
    return { kind: 'color', value: color };
  }
  if (raw.type === 'image') {
    const assetId = (raw as { assetId?: unknown }).assetId;
    if (typeof assetId !== 'string') {
      sink.add(`${path}/assetId`, 'invalid-asset-reference', 'missing assetId');
      return null;
    }
    const ref = toAssetRef(assetId);
    if (ref === null) {
      sink.add(`${path}/assetId`, 'invalid-asset-reference', assetId);
      return null;
    }
    return { kind: 'asset', value: ref };
  }
  // 'gradient' and any other future kind — skip with a warning. The canonical
  // schema's SlideBackground is color-or-asset only today.
  sink.add(path, 'unsupported-background-kind', raw.type);
  return null;
}

/**
 * Map a legacy slide to the canonical `Slide`. Returns the slide + the
 * sanitized id used (so the parent can build a parent-child id map).
 */
export function mapSlide(
  raw: LegacySlide,
  index: number,
  path: string,
  sink: WarningSink,
): { slide: Slide; id: string } {
  const slideId = sanitizeId(raw.id, `slide-${index}`);
  if (slideId !== raw.id) sink.add(`${path}/id`, 'sanitized-id', `${raw.id} → ${slideId}`);

  // Sanitize + dedupe element ids at this slide's scope so siblings are
  // always distinct (the canonical schema doesn't enforce uniqueness but
  // selection-by-id in the editor does).
  const rawIds = raw.elements.map((el, i) => sanitizeId(el.id, `el-${index}-${i}`));
  const uniqueIds = uniqueifyIds(rawIds);

  const dispatchChild = (
    child: (typeof raw.elements)[number],
    childPath: string,
  ): Element | null => {
    const childId = sanitizeId(child.id, 'nested');
    return mapElement(child, childId, childPath, sink, dispatchChild);
  };

  const elements: Element[] = [];
  raw.elements.forEach((el, i) => {
    const id = uniqueIds[i] ?? `el-${index}-${i}`;
    if (id !== el.id) sink.add(`${path}/elements/${i}/id`, 'sanitized-id', `${el.id} → ${id}`);
    const mapped = mapElement(el, id, `${path}/elements/${i}`, sink, dispatchChild);
    if (mapped !== null) elements.push(mapped);
  });

  const slide: Slide = {
    id: slideId,
    elements,
  };
  if (typeof raw.title === 'string' && raw.title.length > 0) slide.title = raw.title;
  if (typeof raw.notes === 'string' && raw.notes.length > 0) slide.notes = raw.notes;

  const bg = mapBackground(raw.background, `${path}/background`, sink);
  if (bg) slide.background = bg;

  if (typeof raw.duration === 'number' && raw.duration > 0) {
    slide.durationMs = Math.round(raw.duration);
  } else if (raw.duration !== undefined) {
    sink.add(`${path}/duration`, 'unsupported-duration-form', JSON.stringify(raw.duration));
  }

  return { slide, id: slideId };
}
