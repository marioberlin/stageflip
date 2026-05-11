// packages/music-yue/src/descriptor.test.ts
// Coverage for `yueDescriptor` — schema round-trip via T-418's
// `parseAdapterDescriptor`, capability validator round-trip via T-419's
// `validateMusicGenCapability`, and the per-AC field invariants from
// docs/tasks/T-433.md AC #3 + AC #4 (attribution posture).

import { describe, expect, it } from 'vitest';

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import {
  type MusicGenCapabilityDescriptor,
  validateMusicGenCapability,
} from '@stageflip/asset-gen-contract';

import {
  YUE_ATTRIBUTION,
  YUE_GENRES,
  YUE_MAX_DURATION_S,
  YUE_SAMPLE_RATE_HZ,
  yueDescriptor,
  yueMusicGenCapability,
} from './descriptor.js';

describe('yueDescriptor — adapter descriptor envelope', () => {
  it('passes parseAdapterDescriptor (T-418 schema)', () => {
    const parsed = parseAdapterDescriptor(yueDescriptor);
    expect(parsed.id).toBe('yue');
    expect(parsed.modality.kind).toBe('music-gen');
    expect(parsed.license.kind).toBe('apache-2.0');
    expect(parsed.sandbox.kind).toBe('in-process');
  });

  it('uses kebab-case id', () => {
    expect(yueDescriptor.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares costPerCall.usd === 0 (free at the model level)', () => {
    expect(yueDescriptor.costPerCall?.usd).toBe(0);
  });

  it('declares latencyMs.{p50,p95} < 10s (fast tier)', () => {
    expect(yueDescriptor.latencyMs?.p50).toBeLessThan(10_000);
    expect(yueDescriptor.latencyMs?.p95).toBeLessThan(10_000);
  });

  it('does NOT set sourceGrounded or requiresResearchProvider', () => {
    expect(yueDescriptor.sourceGrounded).toBeUndefined();
    expect(yueDescriptor.requiresResearchProvider).toBeUndefined();
  });

  it('carries catalog-summary fields maxDurationSec + sampleRateHz (read by T-424 generator)', () => {
    const cap = yueDescriptor.capability as Record<string, unknown>;
    expect(cap.maxDurationSec).toBe(YUE_MAX_DURATION_S);
    expect(cap.sampleRateHz).toBe(YUE_SAMPLE_RATE_HZ);
  });

  it('carries differentiator-surface fields supportsStructure + qualityHint', () => {
    const cap = yueDescriptor.capability as Record<string, unknown>;
    expect(cap.supportsStructure).toBe(true);
    expect(cap.qualityHint).toBe('high');
  });
});

describe('yueMusicGenCapability — strict MusicGenCapabilityDescriptor subset', () => {
  it('passes validateMusicGenCapability (T-419 schema)', () => {
    const result = validateMusicGenCapability(yueMusicGenCapability as Record<string, unknown>);
    expect(result.ok).toBe(true);
  });

  it('declares the 8 YuE canonical genres', () => {
    expect(yueMusicGenCapability.genres).toHaveLength(8);
    expect(YUE_GENRES).toHaveLength(8);
    for (const expected of [
      'electronic',
      'pop',
      'rock',
      'classical',
      'hip-hop',
      'jazz',
      'ambient',
      'folk',
    ]) {
      expect(yueMusicGenCapability.genres).toContain(expected);
    }
  });

  it('declares maxDurationS = 300 (full-song generation)', () => {
    expect(yueMusicGenCapability.maxDurationS).toBe(YUE_MAX_DURATION_S);
    expect(yueMusicGenCapability.maxDurationS).toBe(300);
  });

  it('declares wav and mp3 as the only output formats', () => {
    expect(yueMusicGenCapability.outputFormats).toEqual(['wav', 'mp3']);
  });

  it('declares outputLicense = attribution-required (Apache 2.0 attribution clause)', () => {
    expect(yueMusicGenCapability.outputLicense).toBe('attribution-required');
  });

  it('rejects an arbitrary mutation that would fail validateMusicGenCapability', () => {
    const bogus: MusicGenCapabilityDescriptor = {
      ...yueMusicGenCapability,
      genres: [],
    };
    const result = validateMusicGenCapability(bogus as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe('yueDescriptor — passes T-422 license whitelist (apache-2.0 ∈ music-gen whitelist)', () => {
  it('declares license.kind = apache-2.0', () => {
    expect(yueDescriptor.license.kind).toBe('apache-2.0');
  });
});

describe('YUE_ATTRIBUTION — Apache 2.0 attribution string', () => {
  it('is a non-empty string', () => {
    expect(typeof YUE_ATTRIBUTION).toBe('string');
    expect(YUE_ATTRIBUTION.length).toBeGreaterThan(0);
  });

  it('contains the model name and the license name', () => {
    expect(YUE_ATTRIBUTION).toContain('YuE');
    expect(YUE_ATTRIBUTION).toContain('Apache 2.0');
  });

  it('exact canonical form (frozen — production wire-up T-433a must not drift)', () => {
    expect(YUE_ATTRIBUTION).toBe('Generated with YuE (Apache 2.0)');
  });
});
