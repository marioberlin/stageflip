// packages/import-pptx/src/parts/embedded-fonts.ts
// T-243c — read `ppt/presentation.xml`'s `<p:embeddedFontLst>` and emit one
// `ParsedEmbeddedFont` per `<p:embeddedFont>` entry. Each font carries up to
// four faces (regular / bold / italic / boldItalic); each face is a
// `ParsedAssetRef.unresolved` pointing at the in-ZIP byte path. The
// `resolveAssets` post-walk pass uploads the bytes and rewrites refs.
//
// References:
//   ECMA-376 §19.2.1.5 — `<p:embeddedFontLst>` element.
//   ECMA-376 §19.2.1.4 — `<p:embeddedFontDataId>` (the four named face
//                         children share this complex-type definition).

import { emitLossFlag } from '../loss-flags.js';
import { attr, children, firstChild, parseXml, readRels } from '../opc.js';
import type { LossFlag, ParsedAssetRef, ParsedEmbeddedFont } from '../types.js';
import type { ZipEntries } from '../zip.js';

const PRESENTATION_PART = 'ppt/presentation.xml';

const FACE_TAGS = ['regular', 'bold', 'italic', 'boldItalic'] as const;
type FaceKey = (typeof FACE_TAGS)[number];

/** Result of `readEmbeddedFonts`: parsed fonts plus any per-family flags. */
export interface ReadEmbeddedFontsResult {
  fonts: ParsedEmbeddedFont[];
  flags: LossFlag[];
}

/**
 * Walk `<p:embeddedFontLst>/<p:embeddedFont>` in `ppt/presentation.xml`,
 * resolving each face's relId via `presentation.xml.rels`. Returns one
 * `ParsedEmbeddedFont` per source `<p:embeddedFont>` (in document order),
 * plus a `LF-PPTX-UNRESOLVED-FONT` per family — the resolveAssets pass
 * clears the flag once all faces upload successfully.
 *
 * Faces whose relId does not resolve in the rels map are dropped (the face
 * key stays `undefined` on `ParsedEmbeddedFont.faces`); the family's flag
 * already covers the broken-rel case and `resolveAssets` need not look at
 * the missing slot.
 */
export function readEmbeddedFonts(entries: ZipEntries): ReadEmbeddedFontsResult {
  const xml = parseXml(entries, PRESENTATION_PART);
  const presentation = firstChild(xml, 'p:presentation');
  if (presentation === undefined) return { fonts: [], flags: [] };

  const lst = firstChild(presentation, 'p:embeddedFontLst');
  if (lst === undefined) return { fonts: [], flags: [] };

  const rels = readRels(entries, PRESENTATION_PART);
  const fonts: ParsedEmbeddedFont[] = [];
  const flags: LossFlag[] = [];

  for (const entry of children(lst, 'p:embeddedFont')) {
    const fontTag = firstChild(entry, 'p:font');
    const family = attr(fontTag, 'typeface');
    // Per ECMA-376 §19.2.1.5, `<p:font typeface="…">` is required. Skip
    // malformed entries that lack it — the deck is broken in a way the
    // importer can't usefully surface as a font flag (no family name to
    // attribute the flag to).
    if (family === undefined) continue;

    const faces: ParsedEmbeddedFont['faces'] = {};
    for (const face of FACE_TAGS) {
      const faceNode = firstChild(entry, `p:${face}`);
      if (faceNode === undefined) continue;
      const relId = attr(faceNode, 'r:id');
      if (relId === undefined) continue;
      const rel = rels[relId];
      // Drop the face on broken rel — the family-level flag covers the
      // diagnostic and `resolveAssets` skips undefined slots.
      if (rel === undefined) continue;
      // External-ref handling: PPTX font embedding is in-package only per
      // the spec, but be defensive — surface external `r:link` targets as
      // unsupported and drop the face.
      if (rel.targetMode === 'External') continue;
      const ref: ParsedAssetRef = { kind: 'unresolved', oocxmlPath: rel.resolvedTarget };
      assignFace(faces, face, ref);
    }

    const font: ParsedEmbeddedFont = { family, faces };
    const panose = attr(fontTag, 'panose');
    if (panose !== undefined) font.panose = panose;
    fonts.push(font);

    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-UNRESOLVED-FONT',
        location: { oocxmlPath: PRESENTATION_PART },
        message: `embedded font "${family}" bytes deferred to T-243c resolveAssets`,
        originalSnippet: family,
      }),
    );
  }

  return { fonts, flags };
}

function assignFace(faces: ParsedEmbeddedFont['faces'], key: FaceKey, ref: ParsedAssetRef): void {
  faces[key] = ref;
}
