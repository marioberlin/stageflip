// packages/import-pptx/src/parsePptx.ts
// Public entry point. Pure (Uint8Array) -> CanonicalSlideTree. The function
// is deterministic: same buffer in, same tree out, same loss-flag ids.

import { readRels } from './opc.js';
import { readPresentation } from './parts/presentation.js';
import { parseSlidePart } from './parts/slide.js';
import type { CanonicalSlideTree, LossFlag, ParsedSlide } from './types.js';
import { unpackPptx } from './zip.js';

/**
 * Parse a `.pptx` byte buffer into a `CanonicalSlideTree`. Throws
 * `PptxParseError` with a typed `code` on any structural failure.
 *
 * This function is intentionally synchronous in spirit (no async I/O) but
 * returns a Promise so future asset-bytes work in T-243 can stream without
 * breaking the public surface.
 */
export async function parsePptx(buffer: Uint8Array): Promise<CanonicalSlideTree> {
  const entries = unpackPptx(buffer);
  const presentation = readPresentation(entries);

  const flags: LossFlag[] = [];
  const slides: ParsedSlide[] = [];
  const layouts: Record<string, ParsedSlide> = {};
  const masters: Record<string, ParsedSlide> = {};

  // Slides — visit each in declaration order. Each slide may transitively
  // reference one layout, which references one master; we collect those into
  // the dictionaries.
  for (let i = 0; i < presentation.slides.length; i++) {
    const ref = presentation.slides[i];
    if (ref === undefined) continue;
    const slideId = `slide_${i + 1}`;
    const { slide, flags: slideFlags } = parseSlidePart(entries, ref.oocxmlPath, slideId);
    slides.push(slide);
    flags.push(...slideFlags);

    const slideRels = readRels(entries, ref.oocxmlPath);
    for (const rel of Object.values(slideRels)) {
      if (!rel.type.includes('/relationships/slideLayout')) continue;
      const layoutId = `layout_${rel.resolvedTarget}`;
      if (layouts[layoutId] !== undefined) continue;
      const { slide: layout, flags: layoutFlags } = parseSlidePart(
        entries,
        rel.resolvedTarget,
        layoutId,
      );
      layouts[layoutId] = layout;
      flags.push(...layoutFlags);

      const layoutRels = readRels(entries, rel.resolvedTarget);
      for (const lr of Object.values(layoutRels)) {
        if (!lr.type.includes('/relationships/slideMaster')) continue;
        const masterId = `master_${lr.resolvedTarget}`;
        if (masters[masterId] !== undefined) continue;
        const { slide: master, flags: masterFlags } = parseSlidePart(
          entries,
          lr.resolvedTarget,
          masterId,
        );
        masters[masterId] = master;
        flags.push(...masterFlags);
      }
    }
  }

  return { slides, layouts, masters, lossFlags: flags };
}
