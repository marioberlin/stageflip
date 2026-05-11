// packages/skills-sync/src/asset-providers-gen.test.ts
// T-424 — coverage for the reference/asset-providers generator.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import { describe, expect, it } from 'vitest';

import {
  generateAssetProvidersSkill,
  type AssetProvidersPkg,
} from './asset-providers-gen.js';

function makeDescriptor(overrides: Partial<AdapterDescriptor> & {
  id: string;
  modality: AdapterDescriptor['modality'];
}): AdapterDescriptor {
  const base: AdapterDescriptor = {
    id: overrides.id,
    modality: overrides.modality,
    capability: overrides.capability ?? {},
    license: overrides.license ?? { kind: 'mit' },
    sandbox: overrides.sandbox ?? { kind: 'in-process' },
  };
  if (overrides.costPerCall !== undefined) {
    return { ...base, costPerCall: overrides.costPerCall };
  }
  if (overrides.latencyMs !== undefined) {
    return { ...base, latencyMs: overrides.latencyMs };
  }
  if (overrides.sourceGrounded !== undefined) {
    return { ...base, sourceGrounded: overrides.sourceGrounded };
  }
  if (overrides.requiresResearchProvider !== undefined) {
    return { ...base, requiresResearchProvider: overrides.requiresResearchProvider };
  }
  return base;
}

function pkgWith(adapters: readonly AdapterDescriptor[]): AssetProvidersPkg {
  return { adapters };
}

describe('generateAssetProvidersSkill — frontmatter & shell', () => {
  it('emits stable frontmatter owned by T-424', () => {
    const out = generateAssetProvidersSkill(pkgWith([]));
    expect(out).toContain('id: skills/stageflip/reference/asset-providers');
    expect(out).toContain('owner_task: T-424');
    expect(out).toContain('tier: reference');
    expect(out).toContain('status: auto-generated');
    expect(out).toContain('title: Reference — Asset Providers');
  });

  it('cites the regen + check commands in the body warning', () => {
    const out = generateAssetProvidersSkill(pkgWith([]));
    expect(out).toContain('pnpm skills-sync');
    expect(out).toContain('pnpm skills-sync:check');
    expect(out).toContain('Do NOT edit by hand');
  });

  it('lists related skills in frontmatter', () => {
    const out = generateAssetProvidersSkill(pkgWith([]));
    expect(out).toContain('skills/stageflip/concepts/provider-seam');
    expect(out).toContain('skills/stageflip/tools/asset-generation');
  });
});

describe('generateAssetProvidersSkill — empty state', () => {
  it('says "0 adapters currently registered" when registry empty', () => {
    const out = generateAssetProvidersSkill(pkgWith([]));
    expect(out).toContain('0 adapters currently registered');
  });

  it('mentions T-426..T-434 will populate the catalog', () => {
    const out = generateAssetProvidersSkill(pkgWith([]));
    expect(out).toContain('T-426');
    expect(out).toContain('T-434');
  });

  it('still renders the table headers in the empty state', () => {
    const out = generateAssetProvidersSkill(pkgWith([]));
    expect(out).toContain('| Adapter ID |');
    expect(out).toContain('| Modality |');
    expect(out).toContain('| Capability summary |');
    expect(out).toContain('| License |');
    expect(out).toContain('| Cost tier |');
    expect(out).toContain('| Latency tier |');
    expect(out).toContain('| `requiresResearchProvider` |');
  });
});

describe('generateAssetProvidersSkill — populated state', () => {
  const tts = makeDescriptor({
    id: 'tts-kokoro',
    modality: { kind: 'tts' },
    capability: { voiceCount: 30, sampleRateHz: 24_000 },
    license: { kind: 'apache-2.0' },
    costPerCall: { usd: 0 },
    latencyMs: { p50: 400, p95: 900 },
  });
  const videoGen = makeDescriptor({
    id: 'video-gen-runway',
    modality: { kind: 'video-gen' },
    capability: { aspectRatios: ['16:9', '9:16'], maxDurationSec: 8 },
    license: { kind: 'proprietary-byo' },
    costPerCall: { usd: 0.05 },
    latencyMs: { p50: 30_000, p95: 90_000 },
  });
  const slideDeck = makeDescriptor({
    id: 'slide-deck-acme',
    modality: { kind: 'slide-deck-gen' },
    capability: { maxSlides: 30 },
    license: { kind: 'proprietary-vendored' },
    costPerCall: { usd: 0.30 },
    latencyMs: { p50: 60_000, p95: 240_000 },
    requiresResearchProvider: 'notebooklm-grounded',
    sourceGrounded: true,
  });

  it('emits one row per adapter with all seven columns', () => {
    const out = generateAssetProvidersSkill(pkgWith([tts]));
    expect(out).toContain('`tts-kokoro`');
    expect(out).toContain('tts');
    expect(out).toContain('apache-2.0');
  });

  it('sorts rows by (modality.kind ASC, id ASC)', () => {
    // Insert deliberately-unsorted: slide-deck-gen, tts, video-gen
    const out = generateAssetProvidersSkill(pkgWith([slideDeck, tts, videoGen]));
    const rowOrder = out.indexOf('`slide-deck-acme`');
    const ttsIdx = out.indexOf('`tts-kokoro`');
    const videoIdx = out.indexOf('`video-gen-runway`');
    // alphabetical modality: slide-deck-gen < tts < video-gen
    expect(rowOrder).toBeGreaterThan(0);
    expect(ttsIdx).toBeGreaterThan(rowOrder);
    expect(videoIdx).toBeGreaterThan(ttsIdx);
  });

  it('within a modality, sorts adapters by id ASC', () => {
    const ttsA = makeDescriptor({ id: 'tts-a', modality: { kind: 'tts' } });
    const ttsZ = makeDescriptor({ id: 'tts-z', modality: { kind: 'tts' } });
    const out = generateAssetProvidersSkill(pkgWith([ttsZ, ttsA]));
    expect(out.indexOf('`tts-a`')).toBeLessThan(out.indexOf('`tts-z`'));
  });

  it('includes adapter count in intro', () => {
    const out = generateAssetProvidersSkill(pkgWith([tts, videoGen, slideDeck]));
    expect(out).toContain('3 adapters');
  });

  it('is idempotent — same input → same output byte-for-byte', () => {
    const p = pkgWith([tts, videoGen, slideDeck]);
    expect(generateAssetProvidersSkill(p)).toBe(generateAssetProvidersSkill(p));
  });
});

describe('generateAssetProvidersSkill — cost tier derivation', () => {
  function rowFor(d: AdapterDescriptor): string {
    const out = generateAssetProvidersSkill(pkgWith([d]));
    const lines = out.split('\n');
    const row = lines.find((l) => l.includes(`\`${d.id}\``));
    if (row === undefined) throw new Error(`row for ${d.id} not found`);
    return row;
  }

  it('undefined costPerCall → unspecified', () => {
    const d = makeDescriptor({ id: 'tts-1', modality: { kind: 'tts' } });
    expect(rowFor(d)).toContain('unspecified');
  });

  it('costPerCall.usd === 0 → free', () => {
    const d = makeDescriptor({
      id: 'tts-2',
      modality: { kind: 'tts' },
      costPerCall: { usd: 0 },
    });
    expect(rowFor(d)).toContain('free');
  });

  it('costPerCall.usd <= 0.10 → paid', () => {
    const d = makeDescriptor({
      id: 'tts-3',
      modality: { kind: 'tts' },
      costPerCall: { usd: 0.05 },
    });
    expect(rowFor(d)).toContain('paid');
  });

  it('costPerCall.usd > 0.10 → enterprise', () => {
    const d = makeDescriptor({
      id: 'tts-4',
      modality: { kind: 'tts' },
      costPerCall: { usd: 0.5 },
    });
    expect(rowFor(d)).toContain('enterprise');
  });
});

describe('generateAssetProvidersSkill — latency tier derivation', () => {
  function rowFor(d: AdapterDescriptor): string {
    const out = generateAssetProvidersSkill(pkgWith([d]));
    const lines = out.split('\n');
    const row = lines.find((l) => l.includes(`\`${d.id}\``));
    if (row === undefined) throw new Error(`row for ${d.id} not found`);
    return row;
  }

  it('undefined → unspecified', () => {
    const d = makeDescriptor({ id: 'tts-1', modality: { kind: 'tts' } });
    expect(rowFor(d)).toContain('unspecified');
  });

  it('p95 < 1000 → interactive', () => {
    const d = makeDescriptor({
      id: 'tts-2',
      modality: { kind: 'tts' },
      latencyMs: { p50: 400, p95: 900 },
    });
    expect(rowFor(d)).toContain('interactive');
  });

  it('p95 < 10_000 → fast', () => {
    const d = makeDescriptor({
      id: 'tts-3',
      modality: { kind: 'tts' },
      latencyMs: { p95: 5_000 },
    });
    expect(rowFor(d)).toContain('fast');
  });

  it('p95 < 300_000 → batch', () => {
    const d = makeDescriptor({
      id: 'tts-4',
      modality: { kind: 'tts' },
      latencyMs: { p95: 90_000 },
    });
    expect(rowFor(d)).toContain('batch');
  });

  it('p95 >= 300_000 → async', () => {
    const d = makeDescriptor({
      id: 'tts-5',
      modality: { kind: 'tts' },
      latencyMs: { p95: 600_000 },
    });
    expect(rowFor(d)).toContain('async');
  });

  it('falls back to p50 when p95 absent', () => {
    const d = makeDescriptor({
      id: 'tts-6',
      modality: { kind: 'tts' },
      latencyMs: { p50: 500 },
    });
    expect(rowFor(d)).toContain('interactive');
  });
});

describe('generateAssetProvidersSkill — requiresResearchProvider column', () => {
  function rowFor(d: AdapterDescriptor): string {
    const out = generateAssetProvidersSkill(pkgWith([d]));
    const lines = out.split('\n');
    const row = lines.find((l) => l.includes(`\`${d.id}\``));
    if (row === undefined) throw new Error(`row for ${d.id} not found`);
    return row;
  }

  it('emits "no" when neither field set', () => {
    const d = makeDescriptor({ id: 'a-1', modality: { kind: 'tts' } });
    const row = rowFor(d);
    // last column should end with "no |" (with optional trailing whitespace)
    expect(row.trimEnd().endsWith('no |')).toBe(true);
  });

  it('emits "yes" when sourceGrounded === true', () => {
    const d = makeDescriptor({
      id: 'a-2',
      modality: { kind: 'tts' },
      sourceGrounded: true,
    });
    expect(rowFor(d).trimEnd().endsWith('yes |')).toBe(true);
  });

  it('emits "yes" when requiresResearchProvider non-empty', () => {
    const d = makeDescriptor({
      id: 'a-3',
      modality: { kind: 'tts' },
      requiresResearchProvider: 'notebooklm-grounded',
    });
    expect(rowFor(d).trimEnd().endsWith('yes |')).toBe(true);
  });
});

describe('generateAssetProvidersSkill — capability summary dispatch', () => {
  function rowFor(d: AdapterDescriptor): string {
    const out = generateAssetProvidersSkill(pkgWith([d]));
    const lines = out.split('\n');
    const row = lines.find((l) => l.includes(`\`${d.id}\``));
    if (row === undefined) throw new Error(`row for ${d.id} not found`);
    return row;
  }

  it('TTS: voice count + sample rate', () => {
    const d = makeDescriptor({
      id: 'tts-1',
      modality: { kind: 'tts' },
      capability: { voiceCount: 30, sampleRateHz: 24_000 },
    });
    const row = rowFor(d);
    expect(row).toContain('30');
    expect(row).toContain('24000');
  });

  it('video-gen: aspect ratios + max duration', () => {
    const d = makeDescriptor({
      id: 'vg-1',
      modality: { kind: 'video-gen' },
      capability: { aspectRatios: ['16:9', '9:16'], maxDurationSec: 8 },
    });
    const row = rowFor(d);
    expect(row).toContain('16:9');
    expect(row).toContain('8s');
  });

  it('three-d: emits format hint', () => {
    const d = makeDescriptor({
      id: '3d-1',
      modality: { kind: 'three-d' },
      capability: { formats: ['glb'] },
    });
    expect(rowFor(d)).toContain('glb');
  });

  it('falls back to em dash on malformed/empty capability', () => {
    const d = makeDescriptor({
      id: 'tts-empty',
      modality: { kind: 'tts' },
      capability: {},
    });
    expect(rowFor(d)).toContain('—');
  });

  it('does not throw when capability fields are wrong types', () => {
    const d = makeDescriptor({
      id: 'tts-bad',
      modality: { kind: 'tts' },
      capability: { voiceCount: 'not-a-number', sampleRateHz: null },
    });
    expect(() => rowFor(d)).not.toThrow();
  });

  it('covers every modality kind without throwing', () => {
    const kinds = [
      'tts',
      'video-gen',
      'music-gen',
      'sfx',
      'three-d',
      'slide-deck-gen',
      'mind-map-gen',
      'table-gen',
      'quiz-gen',
      'flashcard-gen',
      'report-gen',
      'infographic-gen',
      'research-session',
      'audience-backend',
      'bundle',
    ] as const;
    for (const kind of kinds) {
      const d = makeDescriptor({
        id: `cov-${kind}`,
        modality: { kind } as AdapterDescriptor['modality'],
        capability: {},
      });
      expect(() => rowFor(d)).not.toThrow();
    }
  });
});
