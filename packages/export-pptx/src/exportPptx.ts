// packages/export-pptx/src/exportPptx.ts
// Top-level driver. Walks the document, dispatches each slide to the slide
// emitter, runs the asset collector, packs the resulting parts into a ZIP
// with deterministic options, and returns `{ bytes, lossFlags }`.

import type { LossFlag } from '@stageflip/loss-flags';
import type { Document, SlideContent } from '@stageflip/schema';
import { collectAssets } from './assets/collect.js';
import { emitLossFlag } from './loss-flags.js';
import { emitContentTypes } from './parts/content-types.js';
import { emitAppProps, emitCoreProps } from './parts/doc-props.js';
import { emitPresentation, emitPresentationRels } from './parts/presentation.js';
import { emitRootRels } from './parts/root-rels.js';
import { emitSlide } from './parts/slide.js';
import { emitTheme } from './parts/theme.js';
import { type ExportPptxOptions, type ExportPptxResult, FROZEN_EPOCH } from './types.js';
import { type EntryMap, packZip } from './zip/pack.js';

/** Default theme — the schema's `themeSchema.parse({})` shape. */
const DEFAULT_THEME = { tokens: {} as Record<string, never> } as const;

/**
 * Convert a `Document` into a `.pptx` byte buffer plus accumulated loss flags.
 * Pure relative to its inputs: same input + same `modifiedAt` ⇒ byte-identical
 * output. When `modifiedAt` is omitted the writer uses a frozen Unix epoch
 * (`new Date('2024-01-01T00:00:00Z')`) so omitting the option does not break
 * byte-determinism.
 *
 * Base writer scope — inheritsFrom / layouts / masters are dropped on output;
 * placeholder-inheritance write-back lands in T-253-rider.
 */
export async function exportPptx(
  doc: Document,
  opts: ExportPptxOptions = {},
): Promise<ExportPptxResult> {
  const modifiedAt = opts.modifiedAt ?? FROZEN_EPOCH;
  const creator = opts.creator ?? 'StageFlip';

  const flags: LossFlag[] = [];

  if (doc.content.mode !== 'slide') {
    // Base writer only emits slide-mode docs. Video/display modes round-trip
    // through other exporters; here we surface as unsupported and return an
    // (intentionally empty) shell so callers can branch on `lossFlags`.
    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT',
        location: {},
        message: `Document.content.mode "${doc.content.mode}" not supported by the PPTX writer`,
        originalSnippet: doc.content.mode,
      }),
    );
  }

  const slides = doc.content.mode === 'slide' ? (doc.content as SlideContent).slides : [];

  // Asset collection — assigns deterministic media paths and fetches bytes.
  const assets = await collectAssets(doc, opts.assets);
  flags.push(...assets.flags);

  // Per-slide emit.
  const slideXmls: string[] = [];
  const slideRels: string[] = [];
  const mediaWrites: Record<string, Uint8Array> = {};
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (slide === undefined) continue;
    const r = emitSlide({
      slide,
      slideIndex: i + 1,
      resolvedAssets: assets.resolved,
      missingAssets: assets.missing,
    });
    slideXmls.push(r.xml);
    slideRels.push(r.relsXml);
    flags.push(...r.flags);
    Object.assign(mediaWrites, r.mediaWrites);
  }

  // Theme-flattened flag — once per export when `Document.theme` is non-default.
  if (isNonDefaultTheme(doc)) {
    flags.push(
      emitLossFlag({
        code: 'LF-PPTX-EXPORT-THEME-FLATTENED',
        location: {},
        message:
          'Document.theme flattened to per-element resolved values; theme part is the Office default',
      }),
    );
  }

  // Pack ZIP entries.
  const entries: EntryMap = {};
  entries['[Content_Types].xml'] = emitContentTypes({
    slideCount: slides.length,
    mediaExtensions: assets.mediaExtensions,
  });
  entries['_rels/.rels'] = emitRootRels();
  entries['ppt/presentation.xml'] = emitPresentation({ slideCount: slides.length });
  entries['ppt/_rels/presentation.xml.rels'] = emitPresentationRels(slides.length);
  entries['ppt/theme/theme1.xml'] = emitTheme();
  entries['docProps/app.xml'] = emitAppProps();
  const corePropsArgs: { creator: string; modifiedAt: Date; title?: string } = {
    creator,
    modifiedAt,
  };
  if (doc.meta.title !== undefined) corePropsArgs.title = doc.meta.title;
  entries['docProps/core.xml'] = emitCoreProps(corePropsArgs);
  for (let i = 0; i < slideXmls.length; i++) {
    entries[`ppt/slides/slide${i + 1}.xml`] = slideXmls[i] ?? '';
    entries[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = slideRels[i] ?? '';
  }
  for (const [path, bytes] of Object.entries(mediaWrites)) {
    entries[path] = bytes;
  }

  const bytes = packZip(entries, modifiedAt);
  return { bytes, lossFlags: flags };
}

function isNonDefaultTheme(doc: Document): boolean {
  // The schema's default-parsed theme is `{ tokens: {} }`. Any populated
  // tokens or palette flips this to non-default.
  const t = doc.theme;
  if (t.palette !== undefined) return true;
  if (Object.keys(t.tokens).length > 0) return true;
  // Reference DEFAULT_THEME so the constant isn't dead-code.
  void DEFAULT_THEME;
  return false;
}
