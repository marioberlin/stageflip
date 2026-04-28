// packages/schema/src/presets/registry.test.ts
// AC #23–#26 — registry surface tests.

import { describe, expect, it } from 'vitest';

import type { ClusterSkill, Preset } from './loader.js';
import { PresetRegistry } from './registry.js';

function makePreset(cluster: 'news' | 'sports', id: string): Preset {
  return {
    filePath: `skills/${cluster}/${id}.md`,
    frontmatter: {
      id,
      cluster,
      clipKind: 'lowerThird',
      source: 's',
      status: 'stub',
      preferredFont: { family: 'X', license: 'ofl' },
      permissions: [],
      signOff: { parityFixture: 'pending-user-review', typeDesign: 'na' },
    },
    body: {
      visualTokens: '',
      typography: '',
      animation: '',
      rules: '',
      acceptance: '',
      references: '',
      unknown: {},
    },
  };
}

function makeClusterSkill(cluster: 'news' | 'sports'): ClusterSkill {
  return {
    filePath: `skills/${cluster}/SKILL.md`,
    frontmatter: {
      title: cluster,
      id: `skills/stageflip/presets/${cluster}`,
      tier: 'cluster',
      status: 'substantive',
      last_updated: '2026-04-25',
      owner_task: 'T-001',
      related: [],
    },
    body: '',
  };
}

function buildRegistry(): PresetRegistry {
  const reg = new PresetRegistry();
  reg.addCluster('news', {
    skill: makeClusterSkill('news'),
    presets: [makePreset('news', 'cnn-classic'), makePreset('news', 'al-jazeera-orange')],
  });
  reg.addCluster('sports', {
    skill: makeClusterSkill('sports'),
    presets: [makePreset('sports', 'f1-timing-tower')],
  });
  reg.freeze();
  return reg;
}

describe('PresetRegistry (AC #23–#26)', () => {
  it('AC #23: get(cluster, id) returns the preset', () => {
    const reg = buildRegistry();
    const preset = reg.get('news', 'cnn-classic');
    expect(preset?.frontmatter.id).toBe('cnn-classic');
  });

  it('AC #23: get returns undefined for missing keys', () => {
    const reg = buildRegistry();
    expect(reg.get('news', 'nonexistent')).toBeUndefined();
    // Unknown cluster (cast through a known string for the test).
    expect(reg.get('weather' as never, 'x')).toBeUndefined();
  });

  it('AC #24: list(cluster) returns presets in id-ASC order', () => {
    const reg = buildRegistry();
    const ids = reg.list('news').map((p) => p.frontmatter.id);
    expect(ids).toEqual(['cnn-classic', 'al-jazeera-orange']);
  });

  it('AC #24: list() with no cluster returns every preset (cluster ASC, id ASC)', () => {
    const reg = buildRegistry();
    const all = reg.list().map((p) => `${p.frontmatter.cluster}:${p.frontmatter.id}`);
    expect(all).toEqual(['news:cnn-classic', 'news:al-jazeera-orange', 'sports:f1-timing-tower']);
  });

  it('AC #24: list(cluster) for an unknown cluster returns []', () => {
    const reg = buildRegistry();
    expect(reg.list('weather' as never)).toEqual([]);
  });

  it('AC #24: list returns a fresh array (mutating it does not affect the registry)', () => {
    const reg = buildRegistry();
    const arr = reg.list('news');
    arr.pop();
    expect(reg.list('news')).toHaveLength(2);
  });

  it('AC #25: clusters() returns sorted cluster names', () => {
    const reg = buildRegistry();
    expect(reg.clusters()).toEqual(['news', 'sports']);
  });

  it('AC #26: reset() clears the registry (test-only)', () => {
    const reg = buildRegistry();
    reg.reset();
    expect(reg.clusters()).toEqual([]);
    expect(reg.list()).toEqual([]);
  });

  it('throws when adding a cluster after freeze', () => {
    const reg = buildRegistry();
    expect(() =>
      reg.addCluster('weather' as never, {
        skill: makeClusterSkill('news'),
        presets: [],
      }),
    ).toThrow(/frozen/);
  });

  it('exposes the cluster skill', () => {
    const reg = buildRegistry();
    expect(reg.getClusterSkill('news')?.frontmatter.title).toBe('news');
    expect(reg.getClusterSkill('weather' as never)).toBeUndefined();
  });
});
