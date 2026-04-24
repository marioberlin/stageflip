// packages/skills-sync/src/clips-catalog-gen.test.ts
// T-220 — coverage for the clips-catalog generator. Uses a synthetic
// `ClipsCatalogPkg` so tests are hermetic; `scripts/sync-skills.ts`
// wires the real runtime registry (via `LIVE_RUNTIME_MANIFEST`).

import { describe, expect, it } from 'vitest';

import { buildClipsCatalogGroups, generateClipsCatalogSkill } from './clips-catalog-gen.js';
import type { ClipsCatalogPkg } from './clips-catalog-gen.js';

function pkg(): ClipsCatalogPkg {
  return {
    runtimes: [
      { id: 'css', tier: 'live', clips: ['solid-background', 'gradient-background'] },
      { id: 'frame-runtime', tier: 'live', clips: ['counter', 'click-overlay'] },
      { id: 'blender', tier: 'bake', clips: [] },
    ],
  };
}

describe('buildClipsCatalogGroups', () => {
  it('groups clips by runtime preserving runtime insertion order', () => {
    const groups = buildClipsCatalogGroups(pkg());
    expect(groups.map((g) => g.runtimeId)).toEqual(['css', 'frame-runtime', 'blender']);
  });

  it('sorts clips alphabetically within a runtime for deterministic output', () => {
    const groups = buildClipsCatalogGroups(pkg());
    expect(groups.find((g) => g.runtimeId === 'css')?.clips).toEqual([
      'gradient-background',
      'solid-background',
    ]);
  });
});

describe('generateClipsCatalogSkill', () => {
  it('renders a stable frontmatter block pointing at T-220', () => {
    const out = generateClipsCatalogSkill(pkg());
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('id: skills/stageflip/clips/catalog');
    expect(out).toContain('owner_task: T-220');
    expect(out).toContain('status: auto-generated');
    expect(out).toContain('tier: clip');
  });

  it('renders every runtime heading and clip row', () => {
    const out = generateClipsCatalogSkill(pkg());
    expect(out).toContain('### css (live)');
    expect(out).toContain('### frame-runtime (live)');
    expect(out).toContain('### blender (bake)');
    expect(out).toContain('`solid-background`');
    expect(out).toContain('`gradient-background`');
    expect(out).toContain('`click-overlay`');
  });

  it('surfaces the empty-runtime case rather than omitting it', () => {
    const out = generateClipsCatalogSkill(pkg());
    expect(out).toMatch(/### blender \(bake\)[\s\S]*?No clips registered/);
  });

  it('is idempotent — same input → same output byte-for-byte', () => {
    const p = pkg();
    expect(generateClipsCatalogSkill(p)).toBe(generateClipsCatalogSkill(p));
  });

  it('totals clips across runtimes in the intro', () => {
    const out = generateClipsCatalogSkill(pkg());
    expect(out).toMatch(/4 clips across 3 runtimes/);
  });
});
