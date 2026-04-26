// packages/export-pptx/src/elements/text.ts
// Emit a `TextElement` as `<p:sp>` carrying `<p:txBody>`. The shape body is
// a 1×1 `<a:prstGeom prst="rect"/>` (the import-pptx parser only inspects
// `<p:txBody>` to detect a TextElement and dispatches to `buildText`, so the
// outer geometry is filler). Run-level styling matches the importer: `b="1"`
// for weight ≥ 600, `i="1"` for italic, `u="sng"` for underline.

import { compareToPlaceholder } from '@stageflip/schema';
import type { Element, TextElement, TextRun } from '@stageflip/schema';
import { escapeText } from '../xml/emit.js';
import type { SlideEmitContext } from './shared.js';
import { renderNvPr, renderXfrm, resolveAndFlagInheritsFrom } from './shared.js';

/** Emit a single `<p:sp>` for a TextElement. */
export function emitTextElement(el: TextElement, ctx: SlideEmitContext): string {
  const idAttr = escapeAttr(el.id);
  const nameAttr = escapeAttr(el.name ?? el.id);
  // T-253-rider: try to resolve placeholder reference; suppress matching fields.
  const resolution = resolveAndFlagInheritsFrom(el, ctx);
  const suppress =
    resolution !== null && resolution.kind === 'resolved'
      ? new Set(compareToPlaceholder(el as Element, resolution.placeholder).suppressKeys)
      : new Set<string>();
  const nvPr = renderNvPr(resolution);
  const isPlaceholderRef = resolution !== null && resolution.kind === 'resolved';
  // T-253-rider AC #13: when every override is suppressed, emit only `<p:nvSpPr>`.
  // For text, that means BOTH `transform` and `text` match the placeholder.
  const allSuppressed = isPlaceholderRef && suppress.has('transform') && suppress.has('text');
  if (allSuppressed) {
    return `<p:sp>\
<p:nvSpPr><p:cNvPr id="${idAttr}" name="${nameAttr}"/><p:cNvSpPr/>${nvPr}</p:nvSpPr>\
</p:sp>`;
  }
  // Geometry block — when we have a resolved placeholder reference and the
  // slide-side `transform` matches the placeholder's, omit `<p:spPr>` entirely
  // (the runtime inherits geometry from the placeholder).
  const spPrXml =
    isPlaceholderRef && suppress.has('transform')
      ? ''
      : `<p:spPr>${renderXfrm(el.transform)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>`;
  // Text body — suppressed when the slide-side text matches the placeholder
  // AND we have a resolved placeholder reference (so the runtime inherits).
  const txBody = isPlaceholderRef && suppress.has('text') ? '' : renderTextBody(el);
  return `<p:sp>\
<p:nvSpPr><p:cNvPr id="${idAttr}" name="${nameAttr}"/><p:cNvSpPr/>${nvPr}</p:nvSpPr>\
${spPrXml}\
${txBody}\
</p:sp>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTextBody(el: TextElement): string {
  const runs = el.runs ?? defaultRuns(el);
  const paragraphs: string[] = [];
  // The schema's `text` field carries newline-separated paragraphs with
  // one run per paragraph by default. When `runs[]` is populated we emit
  // a single paragraph carrying every run (round-trip fidelity is
  // run-level, not paragraph-level — see import-pptx text.ts AC).
  if (el.runs !== undefined && el.runs.length > 0) {
    const runXmls = runs.map((r) => renderRun(r));
    paragraphs.push(`<a:p>${runXmls.join('')}</a:p>`);
  } else {
    const lines = el.text.split('\n');
    for (const line of lines) {
      if (line.length === 0) {
        paragraphs.push('<a:p/>');
        continue;
      }
      paragraphs.push(`<a:p>${renderRun({ text: line })}</a:p>`);
    }
    if (paragraphs.length === 0) paragraphs.push('<a:p/>');
  }
  return `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs.join('')}</p:txBody>`;
}

function defaultRuns(el: TextElement): TextRun[] {
  return [{ text: el.text }];
}

function renderRun(run: TextRun): string {
  const attrs: string[] = [];
  if (run.weight !== undefined && run.weight >= 600) attrs.push(' b="1"');
  if (run.italic === true) attrs.push(' i="1"');
  if (run.underline === true) attrs.push(' u="sng"');
  const rPrAttrs = attrs.join('');
  const rPr = rPrAttrs.length > 0 ? `<a:rPr${rPrAttrs}/>` : '';
  return `<a:r>${rPr}<a:t>${escapeText(run.text)}</a:t></a:r>`;
}
