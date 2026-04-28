// packages/schema/src/presets/frontmatter.test.ts
// AC #1–#8 + cluster schema. Security primitive — coverage target ≥95%.

import { describe, expect, it } from 'vitest';

import {
  PRESET_CLUSTERS,
  clusterSkillFrontmatterSchema,
  presetFrontmatterSchema,
} from './frontmatter.js';

const validPreset = {
  id: 'cnn-classic',
  cluster: 'news',
  clipKind: 'lowerThird',
  source: 'docs/compass_artifact.md#cnn',
  status: 'stub',
  preferredFont: { family: 'CNN Sans', license: 'proprietary-byo' },
  fallbackFont: { family: 'Inter Tight', weight: 700, license: 'ofl' },
  permissions: [],
  signOff: { parityFixture: 'pending-user-review', typeDesign: 'pending-cluster-batch' },
} as const;

describe('presetFrontmatterSchema (AC #1–#8)', () => {
  it('AC #1: accepts a complete valid frontmatter record', () => {
    const parsed = presetFrontmatterSchema.parse(validPreset);
    expect(parsed.id).toBe('cnn-classic');
    expect(parsed.cluster).toBe('news');
    expect(parsed.permissions).toEqual([]);
    expect(parsed.fallbackFont?.weight).toBe(700);
  });

  it('AC #2: unknown top-level field rejected by .strict()', () => {
    expect(() => presetFrontmatterSchema.parse({ ...validPreset, clipKnd: 'typo' })).toThrow(
      /clipKnd|Unrecognized/i,
    );
  });

  it('AC #2: unknown nested field in preferredFont rejected', () => {
    expect(() =>
      presetFrontmatterSchema.parse({
        ...validPreset,
        preferredFont: { family: 'X', license: 'ofl', flavor: 'spicy' },
      }),
    ).toThrow();
  });

  it.each(['id', 'cluster', 'clipKind', 'source', 'status', 'preferredFont', 'signOff'] as const)(
    'AC #3: missing required field "%s" throws',
    (field) => {
      const obj: Record<string, unknown> = { ...validPreset };
      delete obj[field];
      expect(() => presetFrontmatterSchema.parse(obj)).toThrow();
    },
  );

  it('AC #4: invalid id format (uppercase) rejected', () => {
    expect(() => presetFrontmatterSchema.parse({ ...validPreset, id: 'CNN_classic' })).toThrow();
  });

  it('AC #4: invalid id format (space) rejected', () => {
    expect(() => presetFrontmatterSchema.parse({ ...validPreset, id: 'cnn classic' })).toThrow();
  });

  it('AC #4: kebab-case id accepted', () => {
    const parsed = presetFrontmatterSchema.parse({ ...validPreset, id: 'al-jazeera-orange' });
    expect(parsed.id).toBe('al-jazeera-orange');
  });

  it('AC #5: only the 8 documented clusters accepted', () => {
    expect(() => presetFrontmatterSchema.parse({ ...validPreset, cluster: 'misc' })).toThrow();
    for (const c of PRESET_CLUSTERS) {
      expect(presetFrontmatterSchema.parse({ ...validPreset, cluster: c }).cluster).toBe(c);
    }
  });

  it('AC #5 (license vocabulary deliberately permissive): composite + extended values accepted', () => {
    // Per T-304 D-T304-3 amendment: T-307 owns the canonical license vocab.
    for (const license of [
      'commercial-byo',
      'platform-byo',
      'na',
      'apache-2.0 + ofl',
      'apache-2.0 / ofl / commercial-byo',
      'license-cleared',
      'license-mixed',
      'ofl-equivalent (custom)',
    ]) {
      expect(() =>
        presetFrontmatterSchema.parse({
          ...validPreset,
          preferredFont: { family: 'X', license },
        }),
      ).not.toThrow();
    }
  });

  it('AC #5 (license still must be non-empty)', () => {
    expect(() =>
      presetFrontmatterSchema.parse({
        ...validPreset,
        preferredFont: { family: 'X', license: '' },
      }),
    ).toThrow();
  });

  it('AC #6: signOff regex accepts canonical values', () => {
    for (const parityFixture of ['pending-user-review', 'signed:2026-04-25', 'na']) {
      for (const typeDesign of ['pending-cluster-batch', 'signed:2026-04-25', 'na']) {
        expect(() =>
          presetFrontmatterSchema.parse({
            ...validPreset,
            signOff: { parityFixture, typeDesign },
          }),
        ).not.toThrow();
      }
    }
  });

  it('AC #6: signOff regex rejects arbitrary strings', () => {
    expect(() =>
      presetFrontmatterSchema.parse({
        ...validPreset,
        signOff: { parityFixture: 'pending-product-owner', typeDesign: 'na' },
      }),
    ).toThrow();
    expect(() =>
      presetFrontmatterSchema.parse({
        ...validPreset,
        signOff: { parityFixture: 'na', typeDesign: 'tba' },
      }),
    ).toThrow();
  });

  it('AC #7: fallbackFont is optional', () => {
    const obj: Record<string, unknown> = { ...validPreset };
    // biome-ignore lint/performance/noDelete: tests must omit a key, not assign undefined.
    delete obj.fallbackFont;
    const parsed = presetFrontmatterSchema.parse(obj);
    expect(parsed.fallbackFont).toBeUndefined();
  });

  it('AC #7: when fallbackFont present, weight must be positive int', () => {
    expect(() =>
      presetFrontmatterSchema.parse({
        ...validPreset,
        fallbackFont: { family: 'X', weight: 0, license: 'ofl' },
      }),
    ).toThrow();
    expect(() =>
      presetFrontmatterSchema.parse({
        ...validPreset,
        fallbackFont: { family: 'X', weight: 1.5, license: 'ofl' },
      }),
    ).toThrow();
  });

  it('AC #8: permissions defaults to [] when omitted', () => {
    const obj: Record<string, unknown> = { ...validPreset };
    // biome-ignore lint/performance/noDelete: tests must omit a key, not assign undefined.
    delete obj.permissions;
    const parsed = presetFrontmatterSchema.parse(obj);
    expect(parsed.permissions).toEqual([]);
  });

  it('AC #8: permissions accepts the documented enum values', () => {
    const parsed = presetFrontmatterSchema.parse({
      ...validPreset,
      permissions: ['network', 'mic', 'camera', 'geolocation'],
    });
    expect(parsed.permissions).toEqual(['network', 'mic', 'camera', 'geolocation']);
  });

  it('AC #8: permissions rejects unknown values', () => {
    expect(() => presetFrontmatterSchema.parse({ ...validPreset, permissions: ['gps'] })).toThrow();
  });
});

const validCluster = {
  title: 'Cluster A — News & breaking',
  id: 'skills/stageflip/presets/news',
  tier: 'cluster',
  status: 'substantive',
  last_updated: '2026-04-25',
  owner_task: 'T-331',
  related: ['skills/stageflip/agents/type-design-consultant/SKILL.md'],
} as const;

describe('clusterSkillFrontmatterSchema', () => {
  it('accepts a valid cluster frontmatter', () => {
    const parsed = clusterSkillFrontmatterSchema.parse(validCluster);
    expect(parsed.tier).toBe('cluster');
    expect(parsed.related).toHaveLength(1);
  });

  it('rejects unknown top-level fields', () => {
    expect(() => clusterSkillFrontmatterSchema.parse({ ...validCluster, owner: 'x' })).toThrow();
  });

  it('rejects non-cluster tier', () => {
    expect(() =>
      clusterSkillFrontmatterSchema.parse({ ...validCluster, tier: 'concept' }),
    ).toThrow();
  });

  it('coerces JS Date last_updated back to YYYY-MM-DD', () => {
    const parsed = clusterSkillFrontmatterSchema.parse({
      ...validCluster,
      last_updated: new Date(Date.UTC(2026, 3, 25)),
    });
    expect(parsed.last_updated).toBe('2026-04-25');
  });

  it('rejects malformed id paths', () => {
    expect(() =>
      clusterSkillFrontmatterSchema.parse({ ...validCluster, id: 'skills/stageflip/news' }),
    ).toThrow();
  });

  it('defaults related to []', () => {
    const obj: Record<string, unknown> = { ...validCluster };
    // biome-ignore lint/performance/noDelete: tests must omit a key, not assign undefined.
    delete obj.related;
    expect(clusterSkillFrontmatterSchema.parse(obj).related).toEqual([]);
  });

  it('rejects malformed owner_task', () => {
    expect(() =>
      clusterSkillFrontmatterSchema.parse({ ...validCluster, owner_task: 'TBD' }),
    ).toThrow();
  });
});
