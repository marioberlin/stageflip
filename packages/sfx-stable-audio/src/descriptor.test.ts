// packages/sfx-stable-audio/src/descriptor.test.ts
// Coverage for `stableAudioDescriptor` — schema round-trip via T-418's
// `parseAdapterDescriptor`, capability validator round-trip via T-419's
// `validateSfxCapability`, and the per-AC field invariants from
// docs/tasks/T-434.md AC #3 + AC #7.

import { describe, expect, it } from 'vitest';

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import { type SfxCapabilityDescriptor, validateSfxCapability } from '@stageflip/asset-gen-contract';

import {
  STABLE_AUDIO_MAX_DURATION_S,
  STABLE_AUDIO_SAMPLE_RATE_HZ,
  stableAudioDescriptor,
  stableAudioSfxCapability,
} from './descriptor.js';

describe('stableAudioDescriptor — adapter descriptor envelope', () => {
  it('passes parseAdapterDescriptor (T-418 schema)', () => {
    const parsed = parseAdapterDescriptor(stableAudioDescriptor);
    expect(parsed.id).toBe('stable-audio-open');
    expect(parsed.modality.kind).toBe('sfx');
    expect(parsed.license.kind).toBe('apache-2.0');
    expect(parsed.sandbox.kind).toBe('in-process');
  });

  it('uses kebab-case id', () => {
    expect(stableAudioDescriptor.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares costPerCall.usd === 0 (free at the model level)', () => {
    expect(stableAudioDescriptor.costPerCall?.usd).toBe(0);
  });

  it('declares latencyMs.{p50,p95} < 10s (short-form SFX on consumer GPU; fast tier)', () => {
    expect(stableAudioDescriptor.latencyMs?.p50).toBeLessThan(10_000);
    expect(stableAudioDescriptor.latencyMs?.p95).toBeLessThan(10_000);
  });

  it('does NOT set sourceGrounded or requiresResearchProvider', () => {
    expect(stableAudioDescriptor.sourceGrounded).toBeUndefined();
    expect(stableAudioDescriptor.requiresResearchProvider).toBeUndefined();
  });

  it('carries catalog-summary fields maxDurationSec + sampleRateHz (read by T-424 generator)', () => {
    const cap = stableAudioDescriptor.capability as Record<string, unknown>;
    expect(cap.maxDurationSec).toBe(STABLE_AUDIO_MAX_DURATION_S);
    expect(cap.sampleRateHz).toBe(STABLE_AUDIO_SAMPLE_RATE_HZ);
  });

  it('carries differentiator-surface fields supportsOneShot + qualityHint', () => {
    const cap = stableAudioDescriptor.capability as Record<string, unknown>;
    expect(cap.supportsOneShot).toBe(true);
    expect(cap.qualityHint).toBe('high');
  });
});

describe('stableAudioSfxCapability — strict SfxCapabilityDescriptor subset', () => {
  it('passes validateSfxCapability (T-419 schema)', () => {
    const result = validateSfxCapability(stableAudioSfxCapability as Record<string, unknown>);
    expect(result.ok).toBe(true);
  });

  it('declares maxDurationS = 30 (short-form SFX)', () => {
    expect(stableAudioSfxCapability.maxDurationS).toBe(STABLE_AUDIO_MAX_DURATION_S);
    expect(stableAudioSfxCapability.maxDurationS).toBe(30);
  });

  it('declares wav and mp3 as the only output formats', () => {
    expect(stableAudioSfxCapability.outputFormats).toEqual(['wav', 'mp3']);
  });

  it('declares supportsLoop = true (ambient loops)', () => {
    expect(stableAudioSfxCapability.supportsLoop).toBe(true);
  });

  it('declares sampleRates = [44100] (CD-quality default)', () => {
    expect(stableAudioSfxCapability.sampleRates).toEqual([44100]);
  });

  it('rejects an arbitrary mutation that would fail validateSfxCapability', () => {
    const bogus: SfxCapabilityDescriptor = {
      ...stableAudioSfxCapability,
      sampleRates: [],
    };
    const result = validateSfxCapability(bogus as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe('stableAudioDescriptor — passes T-422 license whitelist (apache-2.0 ∈ sfx whitelist)', () => {
  it('declares license.kind = apache-2.0', () => {
    expect(stableAudioDescriptor.license.kind).toBe('apache-2.0');
  });
});
