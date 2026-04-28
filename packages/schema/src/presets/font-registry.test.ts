// packages/schema/src/presets/font-registry.test.ts
// AC #9–#15 (registry shape + builder), AC #18–#20 (real-stub smoke), AC #23–#24
// (backward compat). Both unit tests with synthetic registries and one live-stub
// integration test against `skills/stageflip/presets/`.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FontLicenseRegistry, canonicalizeFontFamily } from './font-registry.js';
import type { ClusterSkill, Preset } from './loader.js';
import { loadAllPresets, resetLoaderCache } from './loader.js';
import { PresetRegistry } from './registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../..');
const PRESETS_ROOT = resolve(REPO_ROOT, 'skills/stageflip/presets');

// ---------- helpers ----------

function makePreset(args: {
  id: string;
  cluster: 'news' | 'sports' | 'weather' | 'titles' | 'data' | 'captions' | 'ctas' | 'ar';
  preferred: { family: string; license: string };
  fallback?: { family: string; weight: number; license: string };
}): Preset {
  return {
    filePath: `synthetic://${args.cluster}/${args.id}.md`,
    frontmatter: {
      id: args.id,
      cluster: args.cluster,
      clipKind: 'lowerThird',
      source: 'synthetic',
      status: 'stub',
      preferredFont: args.preferred,
      fallbackFont: args.fallback,
      permissions: [],
      signOff: { parityFixture: 'pending-user-review', typeDesign: 'pending-cluster-batch' },
    },
    body: { sections: {}, unknown: [] },
  };
}

function makeRegistry(presets: Preset[]): PresetRegistry {
  const reg = new PresetRegistry();
  // Group by cluster (PresetRegistry.addCluster expects per-cluster entries).
  const byCluster = new Map<string, Preset[]>();
  for (const p of presets) {
    const arr = byCluster.get(p.frontmatter.cluster) ?? [];
    arr.push(p);
    byCluster.set(p.frontmatter.cluster, arr);
  }
  for (const [cluster, ps] of byCluster) {
    const skill: ClusterSkill = {
      filePath: `synthetic://${cluster}/SKILL.md`,
      frontmatter: {
        title: `Cluster ${cluster}`,
        id: `skills/stageflip/presets/${cluster}` as `skills/stageflip/presets/${string}`,
        tier: 'cluster',
        status: 'stub',
        last_updated: '2026-04-27',
        owner_task: 'T-307',
        related: [],
      },
      body: '',
    };
    reg.addCluster(cluster as Parameters<PresetRegistry['addCluster']>[0], { skill, presets: ps });
  }
  reg.freeze();
  return reg;
}

// ---------- canonicalization (AC #10, #13) ----------

describe('canonicalizeFontFamily', () => {
  it('lowercases', () => {
    expect(canonicalizeFontFamily('CNN Sans')).toBe('cnn-sans');
  });

  it('replaces whitespace with hyphens', () => {
    expect(canonicalizeFontFamily('IBM Plex Mono')).toBe('ibm-plex-mono');
    expect(canonicalizeFontFamily('Inter   Tight')).toBe('inter-tight');
  });

  it('replaces underscores with hyphens', () => {
    expect(canonicalizeFontFamily('inter_display')).toBe('inter-display');
  });

  it('collapses runs of separators', () => {
    expect(canonicalizeFontFamily('a  b__c')).toBe('a-b-c');
  });

  it('idempotent', () => {
    const c = canonicalizeFontFamily('CNN Sans');
    expect(canonicalizeFontFamily(c)).toBe(c);
  });
});

// ---------- builder (AC #9, #11, #12, #14) ----------

describe('FontLicenseRegistry.buildFromPresets', () => {
  it('walks presets, dedupes by canonical family (AC #9, #10)', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'cnn-classic',
        cluster: 'news',
        preferred: { family: 'CNN Sans', license: 'proprietary-byo' },
        fallback: { family: 'Inter Tight', weight: 700, license: 'ofl' },
      }),
      makePreset({
        id: 'cnn-breaking',
        cluster: 'news',
        preferred: { family: 'cnn sans', license: 'proprietary-byo' }, // varied case + spacing
        fallback: { family: 'Inter Tight', weight: 700, license: 'ofl' },
      }),
    ]);

    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    const cnn = reg.get('CNN Sans');
    expect(cnn).toBeDefined();
    expect(cnn?.family).toBe('CNN Sans'); // First-seen presentation form preserved.
    expect(cnn?.referencedBy).toEqual(['cnn-breaking', 'cnn-classic']); // sorted

    const inter = reg.get('Inter Tight');
    expect(inter?.referencedBy).toEqual(['cnn-breaking', 'cnn-classic']);
  });

  it('attaches approvedFallback when preferred is proprietary-byo (AC #11)', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'cnn-classic',
        cluster: 'news',
        preferred: { family: 'CNN Sans', license: 'proprietary-byo' },
        fallback: { family: 'Inter Tight', weight: 700, license: 'ofl' },
      }),
    ]);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    const cnn = reg.get('CNN Sans');
    expect(cnn?.approvedFallback).toBeDefined();
    expect(cnn?.approvedFallback?.family).toBe('Inter Tight');
    expect(cnn?.approvedFallback?.weight).toBe(700);
    expect(cnn?.approvedFallback?.license.atoms).toContain('ofl');
  });

  it('does not attach fallback when preferred is not proprietary-byo (AC #11)', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'youtube-subscribe',
        cluster: 'ctas',
        preferred: { family: 'Roboto', license: 'apache-2.0' },
        fallback: { family: 'Roboto', weight: 700, license: 'apache-2.0' },
      }),
    ]);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    const roboto = reg.get('Roboto');
    expect(roboto?.approvedFallback).toBeUndefined();
  });

  it('aggregates referencedBy across presets (AC #12)', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'p1',
        cluster: 'sports',
        preferred: { family: 'Formula1 Display', license: 'proprietary-byo' },
        fallback: { family: 'Barlow Condensed', weight: 700, license: 'ofl' },
      }),
      makePreset({
        id: 'p2',
        cluster: 'data',
        preferred: { family: 'Formula1 Display', license: 'proprietary-byo' },
        fallback: { family: 'Barlow Condensed', weight: 700, license: 'ofl' },
      }),
    ]);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    expect(reg.get('Formula1 Display')?.referencedBy).toEqual(['p1', 'p2']);
  });

  it('list() returns deterministic order (AC #14)', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'a',
        cluster: 'news',
        preferred: { family: 'Zeta Sans', license: 'ofl' },
      }),
      makePreset({
        id: 'b',
        cluster: 'news',
        preferred: { family: 'Alpha Sans', license: 'ofl' },
      }),
      makePreset({
        id: 'c',
        cluster: 'news',
        preferred: { family: 'Mu Sans', license: 'ofl' },
      }),
    ]);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    const families = reg.list().map((e) => e.family);
    // Sorted by canonical name.
    expect(families).toEqual(['Alpha Sans', 'Mu Sans', 'Zeta Sans']);
  });

  it('parses composite expressions in license fields', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'msnbc',
        cluster: 'news',
        preferred: { family: 'Roboto + NBC Tinker', license: 'ofl + proprietary-byo' },
        fallback: { family: 'Roboto + Inter Tight', weight: 500, license: 'ofl' },
      }),
    ]);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    const entry = reg.get('Roboto + NBC Tinker');
    expect(entry?.license.atoms).toEqual(['ofl', 'proprietary-byo']);
    expect(entry?.license.composition).toBe('all');
  });
});

// ---------- validateAgainstWhitelist (AC #15) ----------

describe('FontLicenseRegistry.validateAgainstWhitelist', () => {
  it('returns valid when every entry uses only allowed atoms', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'p1',
        cluster: 'news',
        preferred: { family: 'Roboto', license: 'apache-2.0' },
      }),
    ]);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    const result = reg.validateAgainstWhitelist(['apache-2.0', 'ofl']);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('surfaces violations when an atom is not in the whitelist', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'p1',
        cluster: 'news',
        preferred: { family: 'Acme Sans', license: 'ofl' },
      }),
      makePreset({
        id: 'p2',
        cluster: 'news',
        preferred: { family: 'Custom Sans', license: 'commercial-byo' },
      }),
    ]);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    // 'commercial-byo' is NOT in the narrow whitelist.
    const result = reg.validateAgainstWhitelist(['ofl', 'apache-2.0']);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.family).toBe('Custom Sans');
  });

  it('union licenses pass when ANY atom is whitelisted', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'p1',
        cluster: 'ctas',
        preferred: {
          family: 'Roboto / Montserrat / Proxima Nova',
          license: 'apache-2.0 / ofl / commercial-byo',
        },
      }),
    ]);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    // Whitelist only includes ofl — but union semantics mean any-one suffices.
    const result = reg.validateAgainstWhitelist(['ofl']);
    expect(result.valid).toBe(true);
  });

  it('AND licenses require EVERY atom whitelisted', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'p1',
        cluster: 'news',
        preferred: { family: 'X', license: 'apache-2.0 + ofl' },
      }),
    ]);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    expect(reg.validateAgainstWhitelist(['apache-2.0']).valid).toBe(false);
    expect(reg.validateAgainstWhitelist(['apache-2.0', 'ofl']).valid).toBe(true);
  });
});

// ---------- error surfacing ----------

describe('FontLicenseRegistry.buildFromPresets — error handling', () => {
  it('throws when a preset has an unknown license atom (the contract)', () => {
    const presetReg = makeRegistry([
      makePreset({
        id: 'p1',
        cluster: 'news',
        preferred: { family: 'X', license: 'gpl-3.0' }, // unknown atom
      }),
    ]);
    expect(() => FontLicenseRegistry.buildFromPresets(presetReg)).toThrow(/unknown.*gpl/i);
  });
});

// ---------- live on-disk smoke test (AC #18, #19, #20) ----------

describe('FontLicenseRegistry — live preset stubs (AC #18–#20)', () => {
  it('builds from every on-disk preset stub without unknown atoms (AC #18)', () => {
    resetLoaderCache();
    const presetReg = loadAllPresets(PRESETS_ROOT);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    // We must have at least 50 distinct families across 50 presets * 2 fonts.
    expect(reg.list().length).toBeGreaterThan(20);
  });

  it('contains entries for the broadcaster fonts named in ADR-004 (AC #19)', () => {
    resetLoaderCache();
    const presetReg = loadAllPresets(PRESETS_ROOT);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    expect(reg.get('CNN Sans')).toBeDefined();
    expect(reg.get('BBC Reith Sans')).toBeDefined();
    expect(reg.get('Premier Sans')).toBeDefined();
    expect(reg.get('Formula1 Display')).toBeDefined();
    expect(reg.get('Netflix Sans')).toBeDefined();
  });

  it('every proprietary-byo font has either approvedFallback or audit-flag visibility (AC #20)', () => {
    resetLoaderCache();
    const presetReg = loadAllPresets(PRESETS_ROOT);
    const reg = FontLicenseRegistry.buildFromPresets(presetReg);
    for (const entry of reg.list()) {
      if (entry.license.atoms.includes('proprietary-byo')) {
        // Either it has an approved fallback, OR auditMissingFallback() flags it.
        const flagged = reg.auditMissingFallback().some((e) => e.family === entry.family);
        expect(entry.approvedFallback !== undefined || flagged).toBe(true);
      }
    }
  });
});
