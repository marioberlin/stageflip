// packages/export-pptx/src/exportPptx.ts
// Top-level driver. Walks the document, dispatches each slide to the slide
// emitter, runs the asset collector, packs the resulting parts into a ZIP
// with deterministic options, and returns `{ bytes, lossFlags }`.

import type { LossFlag } from '@stageflip/loss-flags';
import type { Document, SlideContent, SlideLayout, SlideMaster } from '@stageflip/schema';
import { collectAssets } from './assets/collect.js';
import { emitLossFlag } from './loss-flags.js';
import { emitContentTypes } from './parts/content-types.js';
import { emitAppProps, emitCoreProps } from './parts/doc-props.js';
import { emitPresentation, emitPresentationRels } from './parts/presentation.js';
import { emitRootRels } from './parts/root-rels.js';
import { emitSlideLayout } from './parts/slide-layout.js';
import { emitSlideMaster } from './parts/slide-master.js';
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
 * T-253-rider: `Document.layouts` / `Document.masters` are emitted as
 * `<p:sldLayout>` / `<p:sldMaster>` parts; per-element `inheritsFrom`
 * resolves to a `<p:nvSpPr><p:nvPr><p:ph .../></p:nvPr></p:nvSpPr>` reference
 * with override suppression mirroring `compareToPlaceholder` (the inverse of
 * `applyInheritance`).
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
  const layouts: SlideLayout[] = doc.layouts ?? [];
  const masters: SlideMaster[] = doc.masters ?? [];

  // T-253-rider: index layouts/masters for fast `inheritsFrom` resolution and
  // for slide-layout rel allocation. The maps are passed into per-slide emit.
  const layoutsById = new Map<string, SlideLayout>();
  for (const l of layouts) layoutsById.set(l.id, l);
  const mastersById = new Map<string, SlideMaster>();
  for (const m of masters) mastersById.set(m.id, m);
  const layoutIndexById = new Map<string, number>();
  for (let i = 0; i < layouts.length; i++) {
    const l = layouts[i];
    if (l !== undefined) layoutIndexById.set(l.id, i + 1);
  }

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
    const slideLayoutIdx =
      slide.layoutId !== undefined ? layoutIndexById.get(slide.layoutId) : undefined;
    const slideInput: Parameters<typeof emitSlide>[0] = {
      slide,
      slideIndex: i + 1,
      resolvedAssets: assets.resolved,
      missingAssets: assets.missing,
      layoutsById,
      mastersById,
    };
    if (slideLayoutIdx !== undefined) slideInput.layoutIndex = slideLayoutIdx;
    const r = emitSlide(slideInput);
    slideXmls.push(r.xml);
    slideRels.push(r.relsXml);
    flags.push(...r.flags);
    Object.assign(mediaWrites, r.mediaWrites);
  }

  // T-253-rider: emit slideLayout / slideMaster parts.
  const layoutXmls: string[] = [];
  const layoutRels: string[] = [];
  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i];
    if (layout === undefined) continue;
    // Resolve master index for this layout's masterId (1-based). When the
    // layout's masterId doesn't match any deck master, point at master 1
    // (the deck's default) — Office requires every layout to reference a
    // master. In a clean deck every layout's masterId resolves; this fallback
    // is a defensive degradation only.
    const masterIdx = (function findMasterIdx() {
      for (let j = 0; j < masters.length; j++) {
        if (masters[j]?.id === layout.masterId) return j + 1;
      }
      return 1;
    })();
    const r = emitSlideLayout({
      layout,
      layoutIndex: i + 1,
      masterIndex: masterIdx,
      layoutsById,
      mastersById,
    });
    layoutXmls.push(r.xml);
    layoutRels.push(r.relsXml);
    flags.push(...r.flags);
  }
  const masterXmls: string[] = [];
  const masterRelsXmls: string[] = [];
  for (let i = 0; i < masters.length; i++) {
    const master = masters[i];
    if (master === undefined) continue;
    const ownedLayouts: { layout: SlideLayout; layoutIndex: number }[] = [];
    for (let j = 0; j < layouts.length; j++) {
      const layout = layouts[j];
      if (layout === undefined) continue;
      if (layout.masterId === master.id) {
        ownedLayouts.push({ layout, layoutIndex: j + 1 });
      }
    }
    const r = emitSlideMaster({
      master,
      masterIndex: i + 1,
      ownedLayouts,
      layoutsById,
      mastersById,
    });
    masterXmls.push(r.xml);
    masterRelsXmls.push(r.relsXml);
    flags.push(...r.flags);
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
    layoutCount: layouts.length,
    masterCount: masters.length,
  });
  entries['_rels/.rels'] = emitRootRels();
  entries['ppt/presentation.xml'] = emitPresentation({
    slideCount: slides.length,
    masterCount: masters.length,
  });
  entries['ppt/_rels/presentation.xml.rels'] = emitPresentationRels(slides.length, masters.length);
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
  for (let i = 0; i < layoutXmls.length; i++) {
    entries[`ppt/slideLayouts/slideLayout${i + 1}.xml`] = layoutXmls[i] ?? '';
    entries[`ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`] = layoutRels[i] ?? '';
  }
  for (let i = 0; i < masterXmls.length; i++) {
    entries[`ppt/slideMasters/slideMaster${i + 1}.xml`] = masterXmls[i] ?? '';
    entries[`ppt/slideMasters/_rels/slideMaster${i + 1}.xml.rels`] = masterRelsXmls[i] ?? '';
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
