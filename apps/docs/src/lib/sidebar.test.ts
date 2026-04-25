// apps/docs/src/lib/sidebar.test.ts
// T-228 — skill-tree → Starlight sidebar config. Pure function so
// the docs app's astro.config.mjs can import a deterministic nav.

import { describe, expect, it } from 'vitest';

import { buildSkillsSidebar } from './sidebar.js';

function entry(
  id: string,
  title: string,
  tier = 'concept',
): {
  id: string;
  title: string;
  tier: string;
} {
  return { id, title, tier };
}

describe('buildSkillsSidebar', () => {
  it('groups skills by tier with predictable ordering', () => {
    const skills = [
      entry('skills/stageflip/concepts/rir', 'RIR', 'concept'),
      entry('skills/stageflip/tools/read', 'Read bundle', 'tools'),
      entry('skills/stageflip/concepts/determinism', 'Determinism', 'concept'),
      entry('skills/stageflip/runtimes/css', 'CSS runtime', 'runtime'),
    ];
    const sidebar = buildSkillsSidebar(skills);

    const labels = sidebar.map((g) => g.label);
    expect(labels).toContain('Concepts');
    expect(labels).toContain('Tools');
    expect(labels).toContain('Runtimes');

    // Concepts group should sort alphabetically inside.
    const concepts = sidebar.find((g) => g.label === 'Concepts');
    expect(concepts?.items.map((i) => i.label)).toEqual(['Determinism', 'RIR']);
  });

  it('maps the 10 known tiers to human-friendly group labels', () => {
    const tiers: Array<{ tier: string; label: string }> = [
      { tier: 'concept', label: 'Concepts' },
      { tier: 'runtime', label: 'Runtimes' },
      { tier: 'mode', label: 'Modes' },
      { tier: 'profile', label: 'Profiles' },
      { tier: 'tools', label: 'Tools' },
      { tier: 'workflow', label: 'Workflows' },
      { tier: 'reference', label: 'Reference' },
      { tier: 'clip', label: 'Clips' },
      { tier: 'cluster', label: 'Preset Clusters' },
      { tier: 'agent', label: 'Agents' },
    ];
    for (const { tier, label } of tiers) {
      const sidebar = buildSkillsSidebar([entry('skills/stageflip/x/y', 'Y', tier)]);
      expect(sidebar[0]?.label).toBe(label);
    }
  });

  it('renders stable slugs under skills/stageflip/…', () => {
    const sidebar = buildSkillsSidebar([entry('skills/stageflip/concepts/rir', 'RIR')]);
    expect(sidebar[0]?.items[0]?.slug).toBe('skills/stageflip/concepts/rir');
  });

  it('omits empty tier groups entirely', () => {
    const sidebar = buildSkillsSidebar([entry('skills/stageflip/concepts/a', 'A', 'concept')]);
    const labels = sidebar.map((g) => g.label);
    expect(labels).toEqual(['Concepts']);
  });

  it('is deterministic — same input → same output', () => {
    const skills = [
      entry('skills/stageflip/concepts/a', 'A'),
      entry('skills/stageflip/tools/b', 'B', 'tools'),
    ];
    expect(buildSkillsSidebar(skills)).toEqual(buildSkillsSidebar(skills));
  });

  it('rejects unknown tiers with a descriptive error', () => {
    expect(() => buildSkillsSidebar([entry('skills/stageflip/x/y', 'Y', 'unknown')])).toThrow(
      /unknown.*tier/i,
    );
  });
});
