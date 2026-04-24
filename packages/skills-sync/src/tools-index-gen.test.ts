// packages/skills-sync/src/tools-index-gen.test.ts
// T-220 — coverage for the tools-index generator.

import { describe, expect, it } from 'vitest';

import { generateToolsIndexSkill } from './tools-index-gen.js';
import type { ToolsIndexPkg } from './tools-index-gen.js';

function pkg(): ToolsIndexPkg {
  return {
    bundles: [
      { name: 'read', description: 'Read-only inspection.', toolCount: 5 },
      { name: 'create-mutate', description: 'Add, update, delete elements.', toolCount: 7 },
      { name: 'video-mode', description: 'Video-mode tools.', toolCount: 1 },
      { name: 'display-mode', description: 'Display-mode tools.', toolCount: 2 },
    ],
  };
}

describe('generateToolsIndexSkill', () => {
  it('emits stable frontmatter owned by T-220', () => {
    const out = generateToolsIndexSkill(pkg());
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('id: skills/stageflip/tools');
    expect(out).toContain('owner_task: T-220');
    expect(out).toContain('tier: tools');
    expect(out).toContain('status: auto-generated');
  });

  it('lists every bundle with a link to its per-bundle SKILL.md', () => {
    const out = generateToolsIndexSkill(pkg());
    expect(out).toContain('[`read`](./read/SKILL.md)');
    expect(out).toContain('[`create-mutate`](./create-mutate/SKILL.md)');
    expect(out).toContain('[`video-mode`](./video-mode/SKILL.md)');
    expect(out).toContain('[`display-mode`](./display-mode/SKILL.md)');
  });

  it('reports totals — bundles and tools', () => {
    const out = generateToolsIndexSkill(pkg());
    expect(out).toContain('4 bundles');
    expect(out).toContain('15 tools');
  });

  it('preserves bundle order from the registry (catalog order)', () => {
    const out = generateToolsIndexSkill(pkg());
    const rows = out.split('\n').filter((l) => l.startsWith('| ['));
    expect(rows[0]).toContain('read');
    expect(rows[1]).toContain('create-mutate');
    expect(rows[2]).toContain('video-mode');
    expect(rows[3]).toContain('display-mode');
  });

  it('is idempotent — same input → same output byte-for-byte', () => {
    const p = pkg();
    expect(generateToolsIndexSkill(p)).toBe(generateToolsIndexSkill(p));
  });
});
