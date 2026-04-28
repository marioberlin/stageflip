// packages/schema/src/presets/loader.test.ts
// AC #13–#22 + AC #30, #37 (live presets).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PresetParseError, PresetRegistryLoadError, PresetValidationError } from './errors.js';
import { loadAllPresets, loadCluster, loadPreset, resetLoaderCache } from './loader.js';

const VALID_PRESET = `---
id: cnn-classic
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#cnn
status: stub
preferredFont:
  family: CNN Sans
  license: proprietary-byo
fallbackFont:
  family: Inter Tight
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# CNN Classic — lower third

## Visual tokens
- white banner
`;

const VALID_CLUSTER_SKILL = `---
title: Cluster A — News & breaking
id: skills/stageflip/presets/news
tier: cluster
status: substantive
last_updated: 2026-04-25
owner_task: T-331
related: []
---

# Cluster A
`;

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 't304-loader-'));
  resetLoaderCache();
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('loadPreset (AC #13–#16)', () => {
  it('AC #13: reads, parses, and validates a preset; returns Preset object', () => {
    const filePath = join(workDir, 'cnn-classic.md');
    writeFileSync(filePath, VALID_PRESET);
    const preset = loadPreset(filePath);
    expect(preset.frontmatter.id).toBe('cnn-classic');
    expect(preset.frontmatter.cluster).toBe('news');
    expect(preset.body.visualTokens).toBe('- white banner');
    expect(preset.filePath).toBe(filePath);
  });

  it('AC #14: ENOENT for non-existent files (NOT wrapped)', () => {
    try {
      loadPreset(join(workDir, 'missing.md'));
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
      expect(err).not.toBeInstanceOf(PresetValidationError);
      expect(err).not.toBeInstanceOf(PresetParseError);
    }
  });

  it('AC #15: PresetParseError when frontmatter delimiter is missing', () => {
    const filePath = join(workDir, 'no-fm.md');
    writeFileSync(filePath, '# title only\n');
    expect(() => loadPreset(filePath)).toThrow(PresetParseError);
  });

  it('AC #15: PresetParseError when YAML is malformed', () => {
    const filePath = join(workDir, 'bad-yaml.md');
    writeFileSync(filePath, '---\nid: x\n  bad: indent\n  : missing-key\n---\n');
    expect(() => loadPreset(filePath)).toThrow(PresetParseError);
  });

  it('AC #16: PresetValidationError carries filePath and zodIssues', () => {
    const filePath = join(workDir, 'invalid.md');
    writeFileSync(
      filePath,
      `---
id: BAD-CASE
cluster: news
clipKind: lowerThird
source: x
status: stub
preferredFont: { family: x, license: ofl }
signOff: { parityFixture: pending-user-review, typeDesign: na }
---
`,
    );
    try {
      loadPreset(filePath);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PresetValidationError);
      const verr = err as PresetValidationError;
      expect(verr.filePath).toBe(filePath);
      expect(verr.zodIssues.length).toBeGreaterThan(0);
      expect(verr.field).toBe('id');
    }
  });
});

describe('loadCluster (AC #17–#19)', () => {
  it('AC #17: reads SKILL.md + all preset .md, returns { skill, presets }', () => {
    writeFileSync(join(workDir, 'SKILL.md'), VALID_CLUSTER_SKILL);
    writeFileSync(join(workDir, 'cnn-classic.md'), VALID_PRESET);
    writeFileSync(
      join(workDir, 'fox.md'),
      VALID_PRESET.replace('cnn-classic', 'fox-news-alert').replace('lowerThird', 'breakingBanner'),
    );
    const result = loadCluster(workDir);
    expect(result.skill.frontmatter.tier).toBe('cluster');
    expect(result.presets).toHaveLength(2);
    // Sorted by id.
    expect(result.presets.map((p) => p.frontmatter.id)).toEqual(['cnn-classic', 'fox-news-alert']);
  });

  it('AC #18: skips files that are not .md', () => {
    writeFileSync(join(workDir, 'SKILL.md'), VALID_CLUSTER_SKILL);
    writeFileSync(join(workDir, 'cnn-classic.md'), VALID_PRESET);
    writeFileSync(join(workDir, 'README.txt'), 'irrelevant');
    writeFileSync(join(workDir, '.DS_Store'), 'noise');
    const result = loadCluster(workDir);
    expect(result.presets).toHaveLength(1);
  });

  it('AC #18: skips subdirectories', () => {
    writeFileSync(join(workDir, 'SKILL.md'), VALID_CLUSTER_SKILL);
    writeFileSync(join(workDir, 'cnn-classic.md'), VALID_PRESET);
    mkdirSync(join(workDir, 'sub'));
    writeFileSync(join(workDir, 'sub', 'nested.md'), VALID_PRESET);
    const result = loadCluster(workDir);
    expect(result.presets).toHaveLength(1);
  });

  it('AC #19: throws when SKILL.md is missing', () => {
    writeFileSync(join(workDir, 'cnn-classic.md'), VALID_PRESET);
    expect(() => loadCluster(workDir)).toThrow(/ENOENT/);
  });
});

describe('loadAllPresets (AC #20–#22)', () => {
  function setupTwoClusters(): void {
    mkdirSync(join(workDir, 'news'));
    writeFileSync(join(workDir, 'news', 'SKILL.md'), VALID_CLUSTER_SKILL);
    writeFileSync(join(workDir, 'news', 'cnn-classic.md'), VALID_PRESET);
    mkdirSync(join(workDir, 'sports'));
    writeFileSync(
      join(workDir, 'sports', 'SKILL.md'),
      VALID_CLUSTER_SKILL.replace('Cluster A — News & breaking', 'Cluster B — Sports')
        .replace('skills/stageflip/presets/news', 'skills/stageflip/presets/sports')
        .replace('T-331', 'T-340'),
    );
    writeFileSync(
      join(workDir, 'sports', 'f1-timing.md'),
      VALID_PRESET.replace('cnn-classic', 'f1-timing-tower')
        .replace('cluster: news', 'cluster: sports')
        .replace('lowerThird', 'timingTower'),
    );
  }

  it('AC #20: walks rootPath/*/, builds a registry', () => {
    setupTwoClusters();
    const registry = loadAllPresets(workDir);
    expect(registry.clusters()).toEqual(['news', 'sports']);
    expect(registry.list()).toHaveLength(2);
    expect(registry.get('news', 'cnn-classic')?.frontmatter.clipKind).toBe('lowerThird');
  });

  it('AC #21: aggregates errors across multiple bad presets', () => {
    mkdirSync(join(workDir, 'news'));
    writeFileSync(join(workDir, 'news', 'SKILL.md'), VALID_CLUSTER_SKILL);
    // Three bad presets, each broken differently.
    writeFileSync(
      join(workDir, 'news', 'a.md'),
      VALID_PRESET.replace('cluster: news', 'cluster: misc'),
    );
    writeFileSync(join(workDir, 'news', 'b.md'), 'no frontmatter at all\n');
    writeFileSync(
      join(workDir, 'news', 'c.md'),
      VALID_PRESET.replace('id: cnn-classic', 'id: BAD'),
    );
    try {
      loadAllPresets(workDir);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PresetRegistryLoadError);
      const rerr = err as PresetRegistryLoadError;
      expect(rerr.issues).toHaveLength(3);
      const filenames = rerr.issues.map((i) => i.filePath.split('/').pop()).sort();
      expect(filenames).toEqual(['a.md', 'b.md', 'c.md']);
    }
  });

  it('AC #22: memoized — second call returns same registry by reference', () => {
    setupTwoClusters();
    const first = loadAllPresets(workDir);
    const second = loadAllPresets(workDir);
    expect(second).toBe(first);
  });

  it('AC #22: resetLoaderCache clears memoization', () => {
    setupTwoClusters();
    const first = loadAllPresets(workDir);
    resetLoaderCache();
    const second = loadAllPresets(workDir);
    expect(second).not.toBe(first);
    expect(second.clusters()).toEqual(first.clusters());
  });

  it('skips non-cluster top-level entries (files, unknown subdirs)', () => {
    setupTwoClusters();
    writeFileSync(join(workDir, 'top-level.md'), 'noise');
    const registry = loadAllPresets(workDir);
    expect(registry.clusters()).toEqual(['news', 'sports']);
  });

  it('aggregates a cluster-skill error too (not only preset errors)', () => {
    mkdirSync(join(workDir, 'news'));
    writeFileSync(
      join(workDir, 'news', 'SKILL.md'),
      // tier is wrong → cluster-skill validation fails.
      VALID_CLUSTER_SKILL.replace('tier: cluster', 'tier: concept'),
    );
    writeFileSync(join(workDir, 'news', 'cnn-classic.md'), VALID_PRESET);
    try {
      loadAllPresets(workDir);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PresetRegistryLoadError);
      const rerr = err as PresetRegistryLoadError;
      expect(rerr.issues.some((i) => i.filePath.endsWith('SKILL.md'))).toBe(true);
    }
  });

  it('throws PresetRegistryLoadError for missing root directory', () => {
    expect(() => loadAllPresets(join(workDir, 'does-not-exist'))).toThrow(PresetRegistryLoadError);
  });
});

describe('AC #30: output canonicality / determinism', () => {
  it('produces the same JSON.stringify across 100 invocations', () => {
    mkdirSync(join(workDir, 'news'));
    writeFileSync(join(workDir, 'news', 'SKILL.md'), VALID_CLUSTER_SKILL);
    writeFileSync(join(workDir, 'news', 'cnn-classic.md'), VALID_PRESET);

    let firstSerialized: string | null = null;
    for (let i = 0; i < 100; i += 1) {
      resetLoaderCache();
      const registry = loadAllPresets(workDir);
      const serialized = JSON.stringify(registry.list());
      if (firstSerialized === null) firstSerialized = serialized;
      expect(serialized).toBe(firstSerialized);
    }
  });
});

describe('AC #37: smoke test against on-disk presets', () => {
  it('loads skills/stageflip/presets without errors', () => {
    // Vitest cwd is the package directory; resolve to the workspace root.
    resetLoaderCache();
    const repoRoot = join(__dirname, '..', '..', '..', '..');
    const registry = loadAllPresets(join(repoRoot, 'skills', 'stageflip', 'presets'));
    expect(registry.clusters().length).toBeGreaterThan(0);
    // Sanity: every preset has a non-empty id and a non-empty cluster.
    for (const preset of registry.list()) {
      expect(preset.frontmatter.id.length).toBeGreaterThan(0);
      expect(preset.frontmatter.cluster.length).toBeGreaterThan(0);
    }
    // We expect 50+ stubs across 8 clusters per ADR-004.
    expect(registry.list().length).toBeGreaterThanOrEqual(40);
  });
});
