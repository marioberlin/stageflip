// packages/export-pptx/src/parts/template-elements.test.ts
// T-472 — Tests for the template-tier element dispatcher. Asserts that
// the eleven `audience-*` element types now route to the per-kind
// audience-clip SVG emitter (no longer the
// `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` stub) and that non-audience
// unsupported types still raise the loss flag.

import type { LossFlag } from '@stageflip/loss-flags';
import type { Element, LivePollMultipleChoiceClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import type { SlideEmitContext } from '../elements/shared.js';
import { renderTemplateElements } from './template-elements.js';

function makeCtx(): SlideEmitContext {
  const flags: LossFlag[] = [];
  return {
    slideId: 's1',
    oocxmlPath: 'ppt/slideLayouts/slideLayout1.xml',
    flags,
    registerImageRel: () => 'rId-stub',
    emitMode: 'template',
  };
}

const TRANSFORM = { x: 10, y: 20, width: 800, height: 600, rotation: 0, opacity: 1 } as const;

const livePollMc: LivePollMultipleChoiceClipElement = {
  id: 'el-aud',
  transform: TRANSFORM,
  visible: true,
  locked: false,
  animations: [],
  type: 'live-poll-multiple-choice',
  permissions: ['audience-network'],
  props: { question: 'Q?', options: ['A', 'B'] },
};

describe('renderTemplateElements — audience-clip routing (T-472)', () => {
  it('renders audience-clip elements via the SVG export-frame emitter', () => {
    const ctx = makeCtx();
    const out = renderTemplateElements([livePollMc as Element], ctx);
    expect(out.length).toBe(1);
    expect(out[0]).toBeDefined();
    expect(out[0]).toContain('<p:sp>');
    expect(out[0]).toContain('<![CDATA[<svg');
  });

  it('does NOT raise LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT for audience-clip elements', () => {
    const ctx = makeCtx();
    renderTemplateElements([livePollMc as Element], ctx);
    const codes = ctx.flags.map((f) => f.code);
    expect(codes).not.toContain('LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT');
  });

  it('still raises LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT for non-audience unsupported types', () => {
    const ctx = makeCtx();
    const tableEl: Element = {
      id: 'el-tbl',
      transform: TRANSFORM,
      visible: true,
      locked: false,
      animations: [],
      type: 'table',
      rows: 1,
      columns: 1,
      cells: [],
    };
    renderTemplateElements([tableEl], ctx);
    const codes = ctx.flags.map((f) => f.code);
    expect(codes).toContain('LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT');
  });
});
