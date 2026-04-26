// packages/import-pptx/src/elements/text.ts
// Convert <p:txBody> (or the text-body inside a <p:sp>) into a schema-typed
// TextElement. Runs (`<a:r>`) carry per-segment style; we collapse them to
// schema's `runs[]` shape and concatenate the plain text.

import type { TextElement, TextRun } from '@stageflip/schema';
import type { OrderedXmlNode } from '../opc.js';
import { attr, attrNumber, children, firstChild, textContent } from './shared.js';

/** Build a TextElement from a `<p:txBody>` and the surrounding nv/sp props. */
export function buildText(args: {
  txBody: OrderedXmlNode;
  id: string;
  name?: string;
  transform: TextElement['transform'];
}): TextElement {
  const paragraphs = children(args.txBody, 'a:p');
  const runs: TextRun[] = [];
  const plainParts: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (p === undefined) continue;
    for (const r of children(p, 'a:r')) {
      const tNode = firstChild(r, 'a:t');
      const text = tNode === undefined ? '' : (textContent(tNode) ?? '');
      if (text === '') continue;
      const rPr = firstChild(r, 'a:rPr');
      const run: TextRun = { text };
      const weight = attrNumber(rPr, 'b') === 1 ? 700 : undefined;
      if (weight !== undefined) run.weight = weight;
      const italicAttr = attr(rPr, 'i');
      if (italicAttr === '1') run.italic = true;
      const underlineAttr = attr(rPr, 'u');
      if (underlineAttr !== undefined && underlineAttr !== 'none') run.underline = true;
      runs.push(run);
      plainParts.push(text);
    }
    // `<a:br>` between paragraphs as a single newline.
    if (i !== paragraphs.length - 1) plainParts.push('\n');
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
