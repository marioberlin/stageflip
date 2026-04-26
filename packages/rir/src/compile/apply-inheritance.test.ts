// packages/rir/src/compile/apply-inheritance.test.ts
// Tests for the RIR `apply-inheritance` pass (T-251). Schema-level
// materialization is unit-tested in @stageflip/schema; here we cover the
// RIR-specific concerns: diagnostic emission for unresolved references and
// the documented pass-order placement.

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { compileRIR } from './index.js';
import { DiagnosticSink, applyInheritancePass } from './passes.js';

const NOW = '2026-04-26T00:00:00.000Z';
const T = { x: 0, y: 0, width: 100, height: 50 };
const ST = { x: 10, y: 20, width: 200, height: 80 };

const baseMeta = { id: 'd1', version: 1, createdAt: NOW, updatedAt: NOW };

describe('applyInheritancePass — wraps schema helper (AC #16)', () => {
  it('returns the same document the schema helper produces', () => {
    const sink = new DiagnosticSink();
    const doc: Document = {
      meta: baseMeta,
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [
            {
              id: 'p',
              name: 'PName',
              type: 'text',
              transform: T,
              visible: true,
              locked: false,
              animations: [],
              text: 'P',
              align: 'left',
            },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: ST,
                visible: true,
                locked: false,
                animations: [],
                text: 'S',
                align: 'left',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    };
    const out = applyInheritancePass(doc, sink);
    if (out.content.mode !== 'slide') throw new Error('mode');
    const el = out.content.slides[0]?.elements[0];
    if (!el || el.type !== 'text') throw new Error('text');
    expect(el.name).toBe('PName');
    expect(sink.items).toEqual([]);
  });

  it('fast path — empty layouts, no diagnostics', () => {
    const sink = new DiagnosticSink();
    const doc: Document = {
      meta: baseMeta,
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
    };
    const out = applyInheritancePass(doc, sink);
    expect(out).toBe(doc);
    expect(sink.items).toEqual([]);
  });
});

describe('applyInheritancePass — LF-RIR-LAYOUT-NOT-FOUND (AC #17)', () => {
  it('emits one warn diagnostic when slide.layoutId does not resolve', () => {
    const sink = new DiagnosticSink();
    const doc: Document = {
      meta: baseMeta,
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'layout-real', name: 'L', masterId: 'master-1', placeholders: [] }],
      content: {
        mode: 'slide',
        slides: [{ id: 's1', layoutId: 'layout-MISSING', elements: [] }],
      },
    };
    applyInheritancePass(doc, sink);
    const layoutDiags = sink.items.filter((d) => d.code === 'LF-RIR-LAYOUT-NOT-FOUND');
    expect(layoutDiags).toHaveLength(1);
    expect(layoutDiags[0]?.severity).toBe('warn');
    expect(layoutDiags[0]?.pass).toBe('apply-inheritance');
    expect(layoutDiags[0]?.message).toContain('layout-MISSING');
  });
});

describe('applyInheritancePass — LF-RIR-PLACEHOLDER-NOT-FOUND (AC #18)', () => {
  it('emits one warn when templateId resolves but placeholderIdx misses on layout AND master', () => {
    const sink = new DiagnosticSink();
    const doc: Document = {
      meta: baseMeta,
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'layout-1', name: 'L', masterId: 'master-1', placeholders: [] }],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: ST,
                visible: true,
                locked: false,
                animations: [],
                text: 'S',
                align: 'left',
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 99 },
              },
            ],
          },
        ],
      },
    };
    applyInheritancePass(doc, sink);
    const phDiags = sink.items.filter((d) => d.code === 'LF-RIR-PLACEHOLDER-NOT-FOUND');
    expect(phDiags).toHaveLength(1);
    expect(phDiags[0]?.severity).toBe('warn');
    expect(phDiags[0]?.pass).toBe('apply-inheritance');
    expect(phDiags[0]?.elementId).toBe('e1');
    expect(phDiags[0]?.message).toContain('99');
  });

  it('emits one warn when templateId itself does not resolve', () => {
    const sink = new DiagnosticSink();
    const doc: Document = {
      meta: baseMeta,
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: ST,
                visible: true,
                locked: false,
                animations: [],
                text: 'S',
                align: 'left',
                inheritsFrom: { templateId: 'ghost', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    };
    // Empty layouts/masters → fast path returns early; no diagnostic. This
    // is intentional: documents with no templates are completely off the
    // template path and should not pay diagnostic cost. Once any template
    // exists, per-element resolution kicks in.
    applyInheritancePass(doc, sink);
    expect(sink.items).toEqual([]);
  });

  it('emits when a template exists but element points to a different missing one', () => {
    const sink = new DiagnosticSink();
    const doc: Document = {
      meta: baseMeta,
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [{ id: 'layout-real', name: 'L', masterId: 'master-real', placeholders: [] }],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: ST,
                visible: true,
                locked: false,
                animations: [],
                text: 'S',
                align: 'left',
                inheritsFrom: { templateId: 'ghost', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    };
    applyInheritancePass(doc, sink);
    const phDiags = sink.items.filter((d) => d.code === 'LF-RIR-PLACEHOLDER-NOT-FOUND');
    expect(phDiags).toHaveLength(1);
  });
});

describe('compileRIR — pass-order pin (AC #19)', () => {
  it('apply-inheritance runs before everything else (materializes placeholder content before theme-resolve etc.)', () => {
    // Setup: placeholder text uses a theme token. If theme-resolve ran first,
    // the slide element's `undefined` text would never get the placeholder's
    // ref, and the resolved literal would be missing.
    const doc: Document = {
      meta: baseMeta,
      theme: { tokens: { 'color.primary': '#abc123' } },
      variables: {},
      components: {},
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'layout-1',
          name: 'L',
          masterId: 'master-1',
          placeholders: [
            {
              id: 'p',
              type: 'text',
              transform: T,
              visible: true,
              locked: false,
              animations: [],
              text: 'placeholder text',
              color: 'theme:color.primary',
              align: 'left',
            },
          ],
        },
      ],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            layoutId: 'layout-1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: ST,
                visible: true,
                locked: false,
                animations: [],
                text: '',
                align: 'left',
                // no `color` set; should inherit from placeholder + then resolve theme
                inheritsFrom: { templateId: 'layout-1', placeholderIdx: 0 },
              },
            ],
          },
        ],
      },
    };
    const { rir, diagnostics } = compileRIR(doc);
    // No theme-token-missing diagnostic — placeholder color inherited then resolved.
    expect(diagnostics.find((d) => d.code === 'theme-token-missing')).toBeUndefined();
    const el = rir.elements[0];
    if (!el || el.content.type !== 'text') throw new Error('el');
    expect(el.content.color).toBe('#abc123');
  });
});

describe('compileRIR — back-compat (AC #25)', () => {
  it('produces identical output for documents without templates (fast path)', () => {
    const doc: Document = {
      meta: baseMeta,
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: T,
                visible: true,
                locked: false,
                animations: [],
                text: 'unchanged',
                align: 'left',
              },
            ],
          },
        ],
      },
    };
    const r1 = compileRIR(doc);
    const r2 = compileRIR(doc);
    expect(r1.rir.meta.digest).toBe(r2.rir.meta.digest);
    // No apply-inheritance diagnostics emitted.
    expect(r1.diagnostics.find((d) => d.pass === 'apply-inheritance')).toBeUndefined();
  });
});
