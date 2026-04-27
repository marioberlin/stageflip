// packages/export-google-slides/test-helpers/replay-batch.ts
// Synthesize an `ApiPresentation` (T-244's import shape) from the
// exporter's recorded `batchUpdates[]` log. Used by `roundtrip.test.ts` to
// pin the export → re-import round-trip without live HTTP.
//
// Coverage: the subset of request types the planner actually emits today —
// createShape, createImage, createTable, duplicateObject, insertText,
// updatePageElementTransform, deleteObject, groupObjects,
// updateShapeProperties (no-op for our planner per the m3 fix). Other
// request types pass through unchanged.
//
// Not covered (gap pinned in roundtrip.test.ts header):
//   - replaceAllText / updateTextStyle full state simulation. The replay
//     doesn't track style edits because the importer (T-244) only surfaces
//     plain text content from `textElements[].textRun.content`.
//   - Per-cell text in tables. Emitted but not threaded into the synthesized
//     `pageElements[].table` shape (the importer's table parsing is
//     exercised separately).
//
// The replay is INTENTIONALLY simple: it cares about element IDENTITY
// (object ids), TYPE (shape vs image vs table vs group), and BBOX. That's
// enough to pin AC #26's structural-equality predicate for every fixture.

import type { BatchUpdateRequest } from '../src/api/types.js';

/**
 * Loose ApiPresentation shape compatible with both our local
 * `api/types.ts#ApiPresentation` AND `@stageflip/import-google-slides`'s
 * (it's a structural superset). Returned as the loose type so callers
 * can pass directly to `parseGoogleSlides({ presentation: ... })`.
 */
type ReplayApiPresentation = {
  presentationId?: string;
  pageSize?: {
    width: { magnitude: number; unit: 'EMU' };
    height: { magnitude: number; unit: 'EMU' };
  };
  slides?: Array<{
    objectId?: string;
    pageType?: 'SLIDE' | 'LAYOUT' | 'MASTER' | 'NOTES' | 'NOTES_MASTER';
    pageElements?: PageElementBuilder[];
  }>;
};

interface PageElementBuilder {
  objectId: string;
  size?: { width?: { magnitude?: number }; height?: { magnitude?: number } };
  transform?: { translateX?: number; translateY?: number; unit?: 'EMU' | 'PT' };
  shape?: {
    shapeType?: string;
    text?: { textElements?: Array<{ textRun?: { content?: string } }> };
  };
  image?: { contentUrl?: string };
  table?: { rows?: number; columns?: number };
  elementGroup?: { children?: PageElementBuilder[] };
  /** When non-empty, pageObjectId of the slide this element belongs to. */
  pageObjectId?: string;
}

/**
 * Replay batchUpdate request logs into an ApiPresentation snapshot.
 *
 * - Slides default to whatever objectIds the requests reference. The
 *   caller passes `seedSlides` to pre-allocate slide pages whose objectIds
 *   are known (matches the orchestrator's per-slide objectId map).
 * - For each create-style request, the synthesized element is appended to
 *   the slide indicated by `elementProperties.pageObjectId`.
 * - For each duplicateObject, the source's `pageElements[]` row is cloned
 *   under the new objectId.
 * - For each insertText into an existing element, the synthesized element's
 *   `shape.text` is updated.
 * - For each deleteObject, the element row is removed from its slide.
 *
 * Returns an `ApiPresentation` shaped per `import-google-slides`'s
 * read API.
 */
export function replayBatchUpdates(
  presentationId: string,
  seedSlides: string[],
  batches: Array<{ requests: BatchUpdateRequest[] }>,
  options?: {
    /** Pre-existing slide elements (e.g. from a canned presentations.get). */
    existingPageElements?: Record<string, PageElementBuilder[]>;
    /** Page-size override (default 16:9 = 9144000 × 5143500 EMU). */
    pageSize?: { width: number; height: number };
  },
): ReplayApiPresentation {
  const pageSize = options?.pageSize ?? { width: 9_144_000, height: 5_143_500 };
  // Map: slide objectId → ordered element-builder list.
  const elementsBySlide = new Map<string, PageElementBuilder[]>();
  for (const sid of seedSlides) {
    elementsBySlide.set(sid, []);
  }
  if (options?.existingPageElements !== undefined) {
    for (const [sid, els] of Object.entries(options.existingPageElements)) {
      const list = elementsBySlide.get(sid) ?? [];
      list.push(...els);
      elementsBySlide.set(sid, list);
    }
  }
  // Map: element objectId → owning slide (for delete + insertText).
  const ownerOf = new Map<string, string>();
  for (const [sid, list] of elementsBySlide) {
    for (const e of list) ownerOf.set(e.objectId, sid);
  }

  function findElement(objectId: string): PageElementBuilder | undefined {
    const sid = ownerOf.get(objectId);
    if (sid === undefined) return undefined;
    const list = elementsBySlide.get(sid);
    return list?.find((e) => e.objectId === objectId);
  }

  for (const batch of batches) {
    for (const req of batch.requests) {
      if ('createShape' in req) {
        const r = req.createShape;
        const sid = r.elementProperties.pageObjectId;
        const el: PageElementBuilder = {
          objectId: r.objectId,
          shape: { shapeType: r.shapeType },
          pageObjectId: sid,
        };
        if (r.elementProperties.size !== undefined) {
          el.size = {
            width: { magnitude: r.elementProperties.size.width.magnitude },
            height: { magnitude: r.elementProperties.size.height.magnitude },
          };
        }
        if (r.elementProperties.transform !== undefined) {
          const tf: PageElementBuilder['transform'] = {};
          if (r.elementProperties.transform.translateX !== undefined) {
            tf.translateX = r.elementProperties.transform.translateX;
          }
          if (r.elementProperties.transform.translateY !== undefined) {
            tf.translateY = r.elementProperties.transform.translateY;
          }
          tf.unit = r.elementProperties.transform.unit;
          el.transform = tf;
        }
        const list = elementsBySlide.get(sid) ?? [];
        list.push(el);
        elementsBySlide.set(sid, list);
        ownerOf.set(r.objectId, sid);
      } else if ('createImage' in req) {
        const r = req.createImage;
        const sid = r.elementProperties.pageObjectId;
        const el: PageElementBuilder = {
          objectId: r.objectId,
          image: { contentUrl: r.url },
          pageObjectId: sid,
        };
        if (r.elementProperties.size !== undefined) {
          el.size = {
            width: { magnitude: r.elementProperties.size.width.magnitude },
            height: { magnitude: r.elementProperties.size.height.magnitude },
          };
        }
        if (r.elementProperties.transform !== undefined) {
          const tf: PageElementBuilder['transform'] = {};
          if (r.elementProperties.transform.translateX !== undefined) {
            tf.translateX = r.elementProperties.transform.translateX;
          }
          if (r.elementProperties.transform.translateY !== undefined) {
            tf.translateY = r.elementProperties.transform.translateY;
          }
          tf.unit = r.elementProperties.transform.unit;
          el.transform = tf;
        }
        const list = elementsBySlide.get(sid) ?? [];
        list.push(el);
        elementsBySlide.set(sid, list);
        ownerOf.set(r.objectId, sid);
      } else if ('createTable' in req) {
        const r = req.createTable;
        const sid = r.elementProperties.pageObjectId;
        const el: PageElementBuilder = {
          objectId: r.objectId,
          table: { rows: r.rows, columns: r.columns },
          pageObjectId: sid,
        };
        if (r.elementProperties.size !== undefined) {
          el.size = {
            width: { magnitude: r.elementProperties.size.width.magnitude },
            height: { magnitude: r.elementProperties.size.height.magnitude },
          };
        }
        if (r.elementProperties.transform !== undefined) {
          const tf: PageElementBuilder['transform'] = {};
          if (r.elementProperties.transform.translateX !== undefined) {
            tf.translateX = r.elementProperties.transform.translateX;
          }
          if (r.elementProperties.transform.translateY !== undefined) {
            tf.translateY = r.elementProperties.transform.translateY;
          }
          tf.unit = r.elementProperties.transform.unit;
          el.transform = tf;
        }
        const list = elementsBySlide.get(sid) ?? [];
        list.push(el);
        elementsBySlide.set(sid, list);
        ownerOf.set(r.objectId, sid);
      } else if ('duplicateObject' in req) {
        const r = req.duplicateObject;
        const src = findElement(r.objectId);
        if (src === undefined) continue;
        const newId = r.objectIds?.[r.objectId] ?? `${r.objectId}_dup`;
        // Deep-clone via JSON; the builder is plain JSON-able data.
        const clone = JSON.parse(JSON.stringify(src)) as PageElementBuilder;
        clone.objectId = newId;
        const sid = clone.pageObjectId ?? ownerOf.get(r.objectId);
        if (sid === undefined) continue;
        const list = elementsBySlide.get(sid) ?? [];
        list.push(clone);
        elementsBySlide.set(sid, list);
        ownerOf.set(newId, sid);
      } else if ('insertText' in req) {
        const r = req.insertText;
        const el = findElement(r.objectId);
        if (el === undefined) continue;
        if (el.shape === undefined) el.shape = {};
        el.shape.text = {
          textElements: [{ textRun: { content: r.text } }],
        };
      } else if ('deleteObject' in req) {
        const r = req.deleteObject;
        const sid = ownerOf.get(r.objectId);
        if (sid === undefined) continue;
        const list = elementsBySlide.get(sid) ?? [];
        const idx = list.findIndex((e) => e.objectId === r.objectId);
        if (idx >= 0) list.splice(idx, 1);
        ownerOf.delete(r.objectId);
      } else if ('updatePageElementTransform' in req) {
        const r = req.updatePageElementTransform;
        const el = findElement(r.objectId);
        if (el === undefined) continue;
        if (r.applyMode === 'ABSOLUTE') {
          const tf: PageElementBuilder['transform'] = {};
          if (r.transform.translateX !== undefined) tf.translateX = r.transform.translateX;
          if (r.transform.translateY !== undefined) tf.translateY = r.transform.translateY;
          tf.unit = r.transform.unit;
          el.transform = tf;
        } else {
          // RELATIVE: layer onto existing transform (additive translates).
          const tf = el.transform ?? {};
          if (r.transform.translateX !== undefined) {
            tf.translateX = (tf.translateX ?? 0) + r.transform.translateX;
          }
          if (r.transform.translateY !== undefined) {
            tf.translateY = (tf.translateY ?? 0) + r.transform.translateY;
          }
          tf.unit = r.transform.unit;
          el.transform = tf;
        }
      }
      // updateShapeProperties / updateTextStyle / mergeTableCells: no-op
      // for replay (importer doesn't surface these as distinct element
      // types).
    }
  }

  const slides = Array.from(elementsBySlide.entries()).map(([objectId, els]) => ({
    objectId,
    pageType: 'SLIDE' as const,
    pageElements: els.map((e) => {
      // Strip our internal `pageObjectId` field — not part of T-244's
      // ApiPageElement shape.
      const { pageObjectId: _omit, ...rest } = e;
      void _omit;
      return rest;
    }),
  }));

  return {
    presentationId,
    pageSize: {
      width: { magnitude: pageSize.width, unit: 'EMU' },
      height: { magnitude: pageSize.height, unit: 'EMU' },
    },
    slides,
  };
}
