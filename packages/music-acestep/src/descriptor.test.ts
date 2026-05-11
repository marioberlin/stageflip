// packages/music-acestep/src/descriptor.test.ts
// Coverage for `aceStepDescriptor` — schema round-trip via T-418's
// `parseAdapterDescriptor`, capability validator round-trip via T-419's
// `validateMusicGenCapability`, and the per-AC field invariants from
// docs/tasks/T-432.md AC #3.

import { describe, expect, it } from 'vitest';

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import {
  type MusicGenCapabilityDescriptor,
  validateMusicGenCapability,
} from '@stageflip/asset-gen-contract';

import {
  ACE_STEP_GENRES,
  ACE_STEP_MAX_DURATION_S,
  ACE_STEP_SAMPLE_RATE_HZ,
  aceStepDescriptor,
  aceStepMusicGenCapability,
} from './descriptor.js';

describe('aceStepDescriptor — adapter descriptor envelope', () => {
  it('passes parseAdapterDescriptor (T-418 schema)', () => {
    const parsed = parseAdapterDescriptor(aceStepDescriptor);
    expect(parsed.id).toBe('ace-step');
    expect(parsed.modality.kind).toBe('music-gen');
    expect(parsed.license.kind).toBe('mit');
    expect(parsed.sandbox.kind).toBe('in-process');
  });

  it('uses kebab-case id', () => {
    expect(aceStepDescriptor.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares costPerCall.usd === 0 (free at the model level)', () => {
    expect(aceStepDescriptor.costPerCall?.usd).toBe(0);
  });

  it('declares latencyMs.{p50,p95} < 10s (5-min track in <10s on RTX 3090; fast tier)', () => {
    expect(aceStepDescriptor.latencyMs?.p50).toBeLessThan(10_000);
    expect(aceStepDescriptor.latencyMs?.p95).toBeLessThan(10_000);
  });

  it('does NOT set sourceGrounded or requiresResearchProvider', () => {
    expect(aceStepDescriptor.sourceGrounded).toBeUndefined();
    expect(aceStepDescriptor.requiresResearchProvider).toBeUndefined();
  });

  it('carries catalog-summary fields maxDurationSec + sampleRateHz (read by T-424 generator)', () => {
    const cap = aceStepDescriptor.capability as Record<string, unknown>;
    expect(cap.maxDurationSec).toBe(ACE_STEP_MAX_DURATION_S);
    expect(cap.sampleRateHz).toBe(ACE_STEP_SAMPLE_RATE_HZ);
  });

  it('carries differentiator-surface fields supportsStructure + qualityHint', () => {
    const cap = aceStepDescriptor.capability as Record<string, unknown>;
    expect(cap.supportsStructure).toBe(true);
    expect(cap.qualityHint).toBe('high');
  });
});

describe('aceStepMusicGenCapability — strict MusicGenCapabilityDescriptor subset', () => {
  it('passes validateMusicGenCapability (T-419 schema)', () => {
    const result = validateMusicGenCapability(aceStepMusicGenCapability as Record<string, unknown>);
    expect(result.ok).toBe(true);
  });

  it('declares the 8 ACE-Step canonical genres', () => {
    expect(aceStepMusicGenCapability.genres).toHaveLength(8);
    expect(ACE_STEP_GENRES).toHaveLength(8);
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
      expect(aceStepMusicGenCapability.genres).toContain(expected);
    }
  });

  it('declares maxDurationS = 300 (5-minute track)', () => {
    expect(aceStepMusicGenCapability.maxDurationS).toBe(ACE_STEP_MAX_DURATION_S);
    expect(aceStepMusicGenCapability.maxDurationS).toBe(300);
  });

  it('declares wav and mp3 as the only output formats', () => {
    expect(aceStepMusicGenCapability.outputFormats).toEqual(['wav', 'mp3']);
  });

  it('declares outputLicense = permissive (MIT model emits commercially-usable output)', () => {
    expect(aceStepMusicGenCapability.outputLicense).toBe('permissive');
  });

  it('rejects an arbitrary mutation that would fail validateMusicGenCapability', () => {
    const bogus: MusicGenCapabilityDescriptor = {
      ...aceStepMusicGenCapability,
      genres: [],
    };
    const result = validateMusicGenCapability(bogus as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe('aceStepDescriptor — passes T-422 license whitelist (mit ∈ music-gen whitelist)', () => {
  it('declares license.kind = mit', () => {
    expect(aceStepDescriptor.license.kind).toBe('mit');
  });
});
