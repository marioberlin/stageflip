// packages/schema/src/templates.test.ts
// Schema tests for SlideMaster + SlideLayout (T-251). Pins:
//  - both schemas are .strict() (extra keys reject)
//  - placeholders default to []
//  - placeholders accept any Element type (TextElement, ImageElement, etc.)
//  - SlideMaster.theme is optional (themeSchema.partial())
//  - SlideLayout.masterId is required (no default; references resolved at
//    RIR-compile time, not at parse time — see AC #3)

import { describe, expect, it } from 'vitest';
import {
  type SlideLayout,
  type SlideMaster,
  slideLayoutSchema,
  slideMasterSchema,
} from './templates.js';

const TRANSFORM = { x: 0, y: 0, width: 100, height: 50 };

describe('slideMasterSchema', () => {
  it('parses a minimum valid master with no placeholders', () => {
    const parsed = slideMasterSchema.parse({ id: 'master-1', name: 'Default Master' });
    expect(parsed.id).toBe('master-1');
    expect(parsed.name).toBe('Default Master');
    expect(parsed.placeholders).toEqual([]);
    expect(parsed.theme).toBeUndefined();
  });

  it('accepts text + image placeholders', () => {
    const parsed = slideMasterSchema.parse({
      id: 'master-1',
      name: 'Default Master',
      placeholders: [
        { id: 'ph-0', type: 'text', transform: TRANSFORM, text: 'Title' },
        { id: 'ph-1', type: 'image', transform: TRANSFORM, src: 'asset:logo' },
      ],
    });
    expect(parsed.placeholders).toHaveLength(2);
    expect(parsed.placeholders[0]?.type).toBe('text');
    expect(parsed.placeholders[1]?.type).toBe('image');
  });

  it('accepts an optional partial theme override', () => {
    const parsed = slideMasterSchema.parse({
      id: 'master-1',
      name: 'Branded Master',
      theme: { tokens: { 'color.primary': '#ff0066' } },
    });
    expect(parsed.theme?.tokens).toEqual({ 'color.primary': '#ff0066' });
  });

  it('rejects an empty name', () => {
    expect(() => slideMasterSchema.parse({ id: 'm', name: '' })).toThrow();
  });

  it('rejects extra keys (.strict)', () => {
    expect(() =>
      slideMasterSchema.parse({ id: 'm', name: 'x', notAField: true } as unknown),
    ).toThrow();
  });
});

describe('slideLayoutSchema', () => {
  it('parses a minimum valid layout with no placeholders', () => {
    const parsed = slideLayoutSchema.parse({
      id: 'layout-1',
      name: 'Title Layout',
      masterId: 'master-1',
    });
    expect(parsed.id).toBe('layout-1');
    expect(parsed.masterId).toBe('master-1');
    expect(parsed.placeholders).toEqual([]);
  });

  it('requires masterId', () => {
    expect(() => slideLayoutSchema.parse({ id: 'layout-1', name: 'Title' } as unknown)).toThrow();
  });

  it('accepts an ImageElement placeholder (AC #6)', () => {
    const parsed = slideLayoutSchema.parse({
      id: 'layout-1',
      name: 'Cover Layout',
      masterId: 'master-1',
      placeholders: [{ id: 'ph-0', type: 'image', transform: TRANSFORM, src: 'asset:hero' }],
    });
    expect(parsed.placeholders[0]?.type).toBe('image');
  });

  it('accepts a ShapeElement placeholder', () => {
    const parsed = slideLayoutSchema.parse({
      id: 'layout-1',
      name: 'Geo Layout',
      masterId: 'master-1',
      placeholders: [{ id: 'ph-0', type: 'shape', transform: TRANSFORM, shape: 'rect' }],
    });
    expect(parsed.placeholders[0]?.type).toBe('shape');
  });

  it('rejects mismatched masterId (AC #3 — no .refine; reference checks belong to the RIR pass)', () => {
    // Spec AC #3: schema does NOT validate that masterId resolves. Parse succeeds
    // even with a clearly stale reference; the RIR pass emits LF-RIR-LAYOUT-NOT-FOUND.
    const parsed = slideLayoutSchema.parse({
      id: 'layout-1',
      name: 'Orphan Layout',
      masterId: 'master-does-not-exist',
    });
    expect(parsed.masterId).toBe('master-does-not-exist');
  });

  it('TS: SlideMaster + SlideLayout types infer correctly', () => {
    const m: SlideMaster = { id: 'm', name: 'M', placeholders: [] };
    const l: SlideLayout = { id: 'l', name: 'L', masterId: 'm', placeholders: [] };
    expect(m.id).toBe('m');
    expect(l.masterId).toBe('m');
  });
});
