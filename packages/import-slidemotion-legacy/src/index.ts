// packages/import-slidemotion-legacy/src/index.ts
// Public API: one-way legacy SlideMotion → canonical StageFlip Document.

/**
 * T-130 MVP. The converter is deliberately narrow: the canonical schema is
 * strict, the legacy schema is ~5× larger, and every field in the canonical
 * output must already be valid or the downstream RIR compile / parity step
 * will throw. Rather than build 11 bespoke element mappers with half of
 * them unusable today, the MVP ships:
 *
 *   - Full mapping for `text`, `image`, `shape` (rect / ellipse / line /
 *     polygon / custom-path), and recursive `group` elements.
 *   - Solid-color + image slide backgrounds.
 *   - Slide `title`, `notes`, numeric `durationMs`.
 *   - Document `meta.{id, title, authorId, createdAt, updatedAt}`.
 *
 * Everything else (charts, tables, video, embed, raster-region,
 * component-instance, svg, gradient backgrounds, timing, animations,
 * keyframes, captions, brand, assets, masters, sections, custom
 * compositions) drops through to a structured `Warning` the caller can
 * surface. The downstream editor UI shows "could not import N elements"
 * and points at the warning list.
 *
 * Forward compatibility: every warning carries a JSON-pointer-ish path so a
 * future expansion pass can target the exact place in the legacy doc that
 * needs a new mapper. Adding a new element-kind converter = one case in
 * `map-elements.ts` + tests. The public API signature does not change.
 */

import type { Document, SlideContent } from '@stageflip/schema';
import { SCHEMA_VERSION, documentSchema } from '@stageflip/schema';
import { type LegacyDocument, legacyDocumentSchema } from './legacy-schema.js';
import { mapSlide } from './map-slide.js';
import { normalizeIso, sanitizeId, uniqueifyIds } from './sanitize.js';
import { WarningSink } from './warnings.js';

export type { Warning, WarningReason } from './warnings.js';

/** Sentinel timestamp used when a legacy doc lacks usable `created` / `modified`. */
const SENTINEL_TIMESTAMP = '2000-01-01T00:00:00.000Z';

export interface ImportResult {
  document: Document;
  warnings: ReadonlyArray<import('./warnings.js').Warning>;
}

/**
 * One-way import. Accepts an arbitrary JSON value, validates the minimum
 * shape we need, runs the mappers, and returns a `Document` that passes
 * `documentSchema.parse()`. Throws a `ZodError` if the input fails the
 * permissive legacy-schema gate — the caller should catch this and surface
 * "this file isn't a SlideMotion document" rather than a stack trace.
 */
export function importLegacyDocument(input: unknown): ImportResult {
  const legacy: LegacyDocument = legacyDocumentSchema.parse(input);
  const sink = new WarningSink();

  const docId = sanitizeId(legacy.id, 'imported-doc');
  if (docId !== legacy.id) sink.add('/id', 'sanitized-id', `${legacy.id} → ${docId}`);

  const createdAt = normalizeIso(legacy.created);
  if (createdAt === null) {
    sink.add('/created', 'invalid-timestamp', legacy.created ?? 'missing');
  }
  const updatedAt = normalizeIso(legacy.modified);
  if (updatedAt === null) {
    sink.add('/modified', 'invalid-timestamp', legacy.modified ?? 'missing');
  }

  // Slides: sanitize + uniqueify the slide-id set at document scope so
  // navigation by id in the editor never hits a collision.
  const rawSlideIds = legacy.slides.map((s, i) => sanitizeId(s.id, `slide-${i}`));
  const uniqueSlideIds = uniqueifyIds(rawSlideIds);
  const slides = legacy.slides.map((raw, index) => {
    const overrideId = uniqueSlideIds[index] ?? `slide-${index}`;
    const mapped = mapSlide({ ...raw, id: overrideId }, index, `/slides/${index}`, sink);
    return mapped.slide;
  });

  // Canonical SlideContent requires at least one slide. Zod already enforced
  // this at the input gate, but the map step could theoretically drop slides
  // in a future expansion. Guard here so the failure mode is a clear error
  // rather than a post-parse ZodError.
  if (slides.length === 0) {
    throw new Error('importLegacyDocument: no slides after mapping');
  }
  const content: SlideContent = { mode: 'slide', slides };

  const meta: Document['meta'] = {
    id: docId,
    version: 0,
    createdAt: createdAt ?? SENTINEL_TIMESTAMP,
    updatedAt: updatedAt ?? SENTINEL_TIMESTAMP,
    locale: 'en',
    schemaVersion: SCHEMA_VERSION,
  };
  if (typeof legacy.title === 'string' && legacy.title.length > 0) meta.title = legacy.title;
  if (typeof legacy.author === 'string' && legacy.author.length > 0) {
    const authorId = sanitizeId(legacy.author, '');
    if (authorId.length > 0) meta.authorId = authorId;
    else sink.add('/author', 'sanitized-id', legacy.author);
  }
  if (legacy.subtitle !== undefined) sink.add('/subtitle', 'dropped-field');

  const document: Document = {
    meta,
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content,
  };

  // Final gate — the whole purpose of the converter is that the output is
  // a strict-schema-valid canonical Document. Parse-then-return so callers
  // can rely on that contract.
  const validated = documentSchema.parse(document);
  return { document: validated, warnings: sink.warnings };
}

export { legacyDocumentSchema } from './legacy-schema.js';
export type { LegacyDocument, LegacySlide, LegacyElement } from './legacy-schema.js';
