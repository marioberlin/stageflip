// packages/export-pptx/src/parts/content-types.ts
// Emit `[Content_Types].xml` — the OPC top-level MIME map. One `<Default>` per
// extension found in the archive, plus one `<Override>` per part with a
// non-default content type (presentation, slides, theme, app/core props).

import { XML_PROLOG, emitElement, emitSelfClosing } from '../xml/emit.js';

/** Defaults reused across every PPTX export — XML and rels parts. */
const ALWAYS_DEFAULT_EXTS: Record<string, string> = {
  rels: 'application/vnd.openxmlformats-package.relationships+xml',
  xml: 'application/xml',
};

/** Image MIME → file extension. Inverse of import-pptx's `EXTENSION_TYPES`. */
const IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/** PPTX-specific content types for parts that do not use the XML default. */
const PRESENTATION_CT =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';
const SLIDE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const THEME_CT = 'application/vnd.openxmlformats-officedocument.theme+xml';
const CORE_PROPS_CT = 'application/vnd.openxmlformats-package.core-properties+xml';
const APP_PROPS_CT = 'application/vnd.openxmlformats-officedocument.extended-properties+xml';

export interface ContentTypesInput {
  /** Number of slides — drives the per-slide override count. */
  slideCount: number;
  /** Distinct file extensions present in `ppt/media/*` (lowercase, no leading dot). */
  mediaExtensions: readonly string[];
}

/**
 * Pick a file extension for a given image MIME. Returns `bin` for unknown
 * types so callers can still surface the asset; the corresponding element
 * is dropped with `LF-PPTX-EXPORT-ASSET-MISSING` upstream.
 */
export function extensionForImageContentType(contentType: string): string {
  return IMAGE_MIME_TO_EXT[contentType] ?? 'bin';
}

/** Build the `[Content_Types].xml` body. */
export function emitContentTypes(input: ContentTypesInput): string {
  const defaultEntries: string[] = [];
  // Insertion order matches the eventual XML attribute order — sorted to keep
  // the output deterministic regardless of caller-provided extension order.
  const allExts = new Set<string>([...Object.keys(ALWAYS_DEFAULT_EXTS), ...input.mediaExtensions]);
  const sortedExts = [...allExts].sort();
  for (const ext of sortedExts) {
    const ct =
      ALWAYS_DEFAULT_EXTS[ext] ??
      Object.entries(IMAGE_MIME_TO_EXT).find(([, e]) => e === ext)?.[0] ??
      'application/octet-stream';
    defaultEntries.push(emitSelfClosing('Default', { Extension: ext, ContentType: ct }));
  }

  const overrideEntries: string[] = [];
  overrideEntries.push(
    emitSelfClosing('Override', {
      PartName: '/ppt/presentation.xml',
      ContentType: PRESENTATION_CT,
    }),
  );
  for (let i = 1; i <= input.slideCount; i++) {
    overrideEntries.push(
      emitSelfClosing('Override', {
        PartName: `/ppt/slides/slide${i}.xml`,
        ContentType: SLIDE_CT,
      }),
    );
  }
  overrideEntries.push(
    emitSelfClosing('Override', {
      PartName: '/ppt/theme/theme1.xml',
      ContentType: THEME_CT,
    }),
  );
  overrideEntries.push(
    emitSelfClosing('Override', {
      PartName: '/docProps/core.xml',
      ContentType: CORE_PROPS_CT,
    }),
  );
  overrideEntries.push(
    emitSelfClosing('Override', {
      PartName: '/docProps/app.xml',
      ContentType: APP_PROPS_CT,
    }),
  );

  const body = emitElement(
    'Types',
    { xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types' },
    [...defaultEntries, ...overrideEntries],
  );
  return `${XML_PROLOG}${body}`;
}
