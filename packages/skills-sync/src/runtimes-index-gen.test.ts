// packages/skills-sync/src/runtimes-index-gen.test.ts
// T-220 — coverage for the runtimes-index generator.

import { describe, expect, it } from 'vitest';

import { generateRuntimesIndexSkill } from './runtimes-index-gen.js';
import type { RuntimesIndexPkg } from './runtimes-index-gen.js';

function pkg(): RuntimesIndexPkg {
  return {
    runtimes: [
      { id: 'css', tier: 'live', clipCount: 2 },
      { id: 'gsap', tier: 'live', clipCount: 1 },
      { id: 'frame-runtime', tier: 'live', clipCount: 42 },
      { id: 'blender', tier: 'bake', clipCount: 0 },
    ],
  };
}

describe('generateRuntimesIndexSkill', () => {
  it('emits stable frontmatter owned by T-220', () => {
    const out = generateRuntimesIndexSkill(pkg());
    expect(out).toContain('id: skills/stageflip/runtimes');
    expect(out).toContain('owner_task: T-220');
    expect(out).toContain('tier: runtime');
    expect(out).toContain('status: auto-generated');
  });

  it('lists every runtime with tier + clip count + link to per-runtime skill', () => {
    const out = generateRuntimesIndexSkill(pkg());
    expect(out).toContain('[`css`](./css/SKILL.md)');
    expect(out).toContain('[`frame-runtime`](./frame-runtime/SKILL.md)');
    expect(out).toContain('[`blender`](./blender/SKILL.md)');
    expect(out).toMatch(/\| live \|/);
    expect(out).toMatch(/\| bake \|/);
  });

  it('groups runtimes by tier with live first', () => {
    const out = generateRuntimesIndexSkill(pkg());
    const liveIdx = out.indexOf('### Live-tier');
    const bakeIdx = out.indexOf('### Bake-tier');
    expect(liveIdx).toBeGreaterThan(0);
    expect(bakeIdx).toBeGreaterThan(liveIdx);
  });

  it('totals clips and runtimes across tiers in the intro', () => {
    const out = generateRuntimesIndexSkill(pkg());
    expect(out).toMatch(/4 runtimes/);
    expect(out).toMatch(/45 clips/);
  });

  it('is idempotent — same input → same output byte-for-byte', () => {
    const p = pkg();
    expect(generateRuntimesIndexSkill(p)).toBe(generateRuntimesIndexSkill(p));
  });

  it('handles no-runtime edge case without crashing', () => {
    const out = generateRuntimesIndexSkill({ runtimes: [] });
    expect(out).toContain('0 runtimes');
  });
});
