// packages/export-pptx/src/parts/template-elements.ts
// Render the placeholder elements that live inside a `<p:sldLayout>` or
// `<p:sldMaster>` part. Mirrors `parts/slide.ts:renderElement` but with the
// `emitMode: 'template'` flag set on the context — the element emitters then
// skip slide-side `<p:ph>` resolution (the placeholder IS the template).
//
// Image placeholders are not yet supported at the template tier (round-trip
// closure through `parsePptx` doesn't yet read them either); they fall back
// to LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT semantics — see notes inline.

import type { Element } from '@stageflip/schema';
import { emitGroupElement } from '../elements/group.js';
import { emitShapeElement } from '../elements/shape.js';
import type { SlideEmitContext } from '../elements/shared.js';
import { emitTextElement } from '../elements/text.js';
import { emitLossFlag } from '../loss-flags.js';

/**
 * Dispatch placeholder elements through the existing per-type emitters. The
 * caller is responsible for setting `emitMode: 'template'` on the context.
 */
export function renderTemplateElements(elements: Element[], ctx: SlideEmitContext): string[] {
  const out: string[] = [];
  for (const el of elements) {
    const xml = renderTemplateElement(el, ctx);
    if (xml.length > 0) out.push(xml);
  }
  return out;
}

function renderTemplateElement(el: Element, ctx: SlideEmitContext): string {
  switch (el.type) {
    case 'text':
      return emitTextElement(el, ctx);
    case 'shape':
      return emitShapeElement(el, ctx);
    case 'group':
      return emitGroupElement(el, ctx, (child, c) => renderTemplateElement(child, c));
    case 'image':
    case 'video':
    case 'audio':
    case 'chart':
    case 'table':
    case 'clip':
    case 'embed':
    case 'code':
    case 'blender-clip': {
      // Template-tier image / video / etc. placeholders are uncommon; emit
      // a minimal `<p:sp>` stub so the part stays structurally valid, plus
      // a loss flag so the consumer can surface the gap. Future T-253
      // riders can expand this.
      ctx.flags.push(
        emitLossFlag({
          code: 'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT',
          location: { slideId: ctx.slideId, elementId: el.id, oocxmlPath: ctx.oocxmlPath },
          message: `template placeholder of type "${el.type}" not yet supported by the PPTX writer; emitting empty stub`,
          originalSnippet: el.type,
        }),
      );
      const idAttr = el.id;
      const nameAttr = el.name ?? el.id;
      return `<p:sp><p:nvSpPr><p:cNvPr id="${escapeAttr(idAttr)}" name="${escapeAttr(nameAttr)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr></p:sp>`;
    }
    default: {
      const _exhaustive: never = el;
      return _exhaustive;
    }
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
