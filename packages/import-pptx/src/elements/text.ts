// packages/import-pptx/src/elements/text.ts
// Convert <p:txBody> (or the text-body inside a <p:sp>) into a schema-typed
// TextElement. Runs (`<a:r>`) carry per-segment style; we collapse them to
// schema's `runs[]` shape and concatenate the plain text.

import type { TextElement, TextRun } from '@stageflip/schema';
import { asArray, isRecord, pickAttr, pickAttrNumber, pickRecord } from './shared.js';

/** Build a TextElement from a `<p:txBody>` and the surrounding nv/sp props. */
export function buildText(args: {
  txBody: Record<string, unknown>;
  id: string;
  name?: string;
  transform: TextElement['transform'];
}): TextElement {
  const paragraphs = asArray(args.txBody['a:p']);
  const runs: TextRun[] = [];
  const plainParts: string[] = [];

  for (const p of paragraphs) {
    if (!isRecord(p)) continue;
    for (const r of asArray(p['a:r'])) {
      if (!isRecord(r)) continue;
      const t = r['a:t'];
      const text =
        typeof t === 'string'
          ? t
          : isRecord(t) && typeof t['#text'] === 'string'
            ? (t['#text'] as string)
            : '';
      if (text === '') continue;
      const rPr = pickRecord(r, 'a:rPr');
      const run: TextRun = { text };
      const weight = pickAttrNumber(rPr, 'b') === 1 ? 700 : undefined;
      if (weight !== undefined) run.weight = weight;
      const italicAttr = pickAttr(rPr, 'i');
      if (italicAttr === '1') run.italic = true;
      const underlineAttr = pickAttr(rPr, 'u');
      if (underlineAttr !== undefined && underlineAttr !== 'none') run.underline = true;
      runs.push(run);
      plainParts.push(text);
    }
    // `<a:br>` between paragraphs as a single newline.
    if (paragraphs.indexOf(p) !== paragraphs.length - 1) plainParts.push('\n');
  }

  const text = plainParts.join('');

  const out: TextElement = {
    id: args.id,
    transform: args.transform,
    visible: true,
    locked: false,
    animations: [],
    type: 'text',
    text,
    align: 'left',
  };
  if (args.name !== undefined) out.name = args.name;
  if (runs.length > 0) out.runs = runs;
  return out;
}
