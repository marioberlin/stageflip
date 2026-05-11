// packages/video-seedance/src/descriptor.test.ts
// Coverage for `seedanceDescriptor` — schema round-trip via T-418's
// `parseAdapterDescriptor`, capability validator round-trip via T-419's
// `validateVideoGenCapability`, and the per-AC field invariants from
// docs/tasks/T-430.md AC #7.

import { describe, expect, it } from 'vitest';

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import {
  type VideoGenCapabilityDescriptor,
  validateVideoGenCapability,
} from '@stageflip/asset-gen-contract';

import {
  SEEDANCE_BASE_URL_ENV_VAR,
  SEEDANCE_FRAME_RATE,
  SEEDANCE_MAX_DURATION_S,
  seedanceDescriptor,
  seedanceVideoGenCapability,
} from './descriptor.js';

describe('seedanceDescriptor — adapter descriptor envelope', () => {
  it('passes parseAdapterDescriptor (T-418 schema)', () => {
    const parsed = parseAdapterDescriptor(seedanceDescriptor);
    expect(parsed.id).toBe('seedance');
    expect(parsed.modality.kind).toBe('video-gen');
    expect(parsed.license.kind).toBe('proprietary-byo');
    expect(parsed.sandbox.kind).toBe('remote-service');
  });

  it('uses kebab-case id', () => {
    expect(seedanceDescriptor.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares sandbox.baseUrlEnvVar = FAL_API_BASE_URL', () => {
    expect(seedanceDescriptor.sandbox).toEqual({
      kind: 'remote-service',
      baseUrlEnvVar: 'FAL_API_BASE_URL',
    });
    expect(SEEDANCE_BASE_URL_ENV_VAR).toBe('FAL_API_BASE_URL');
  });

  it('declares costPerCall.usd === 1.5 (paid; tenant pays fal.ai; enterprise tier)', () => {
    expect(seedanceDescriptor.costPerCall?.usd).toBe(1.5);
  });

  it('declares latencyMs in batch tier (p50=90_000, p95=180_000)', () => {
    expect(seedanceDescriptor.latencyMs?.p50).toBe(90_000);
    expect(seedanceDescriptor.latencyMs?.p95).toBe(180_000);
  });

  it('does NOT set sourceGrounded or requiresResearchProvider', () => {
    expect(seedanceDescriptor.sourceGrounded).toBeUndefined();
    expect(seedanceDescriptor.requiresResearchProvider).toBeUndefined();
  });

  it('carries catalog-summary field maxDurationSec (read by T-424 generator)', () => {
    const cap = seedanceDescriptor.capability as Record<string, unknown>;
    expect(cap.maxDurationSec).toBe(SEEDANCE_MAX_DURATION_S);
  });

  it('carries differentiator-surface fields supportsLipSync + supportsNativeAudio + supportedResolutions', () => {
    const cap = seedanceDescriptor.capability as Record<string, unknown>;
    expect(cap.supportsLipSync).toBe(true);
    expect(cap.supportsNativeAudio).toBe(true);
    expect(cap.supportedResolutions).toEqual(['1080p']);
  });
});

describe('seedanceVideoGenCapability — strict VideoGenCapabilityDescriptor subset', () => {
  it('passes validateVideoGenCapability (T-419 schema)', () => {
    const result = validateVideoGenCapability(
      seedanceVideoGenCapability as unknown as Record<string, unknown>,
    );
    expect(result.ok).toBe(true);
  });

  it('declares mp4 as the only output format', () => {
    expect(seedanceVideoGenCapability.outputFormats).toEqual(['mp4']);
  });

  it('declares 30fps frame rate', () => {
    expect(seedanceVideoGenCapability.frameRates).toEqual([30]);
    expect(SEEDANCE_FRAME_RATE).toBe(30);
  });

  it('declares maxDurationS = 15 (Seedance 2.0 ships 15s output)', () => {
    expect(seedanceVideoGenCapability.maxDurationS).toBe(15);
    expect(SEEDANCE_MAX_DURATION_S).toBe(15);
  });

  it('declares all three standard aspect ratios (16:9, 9:16, 1:1)', () => {
    expect(seedanceVideoGenCapability.aspectRatios).toEqual(['16:9', '9:16', '1:1']);
  });

  it('declares emitsAudio = true (rare; differentiator for routing)', () => {
    expect(seedanceVideoGenCapability.emitsAudio).toBe(true);
  });

  it('declares safetyFilters = [] (none surfaced in v1)', () => {
    expect(seedanceVideoGenCapability.safetyFilters).toEqual([]);
  });

  it('rejects an arbitrary mutation that would fail validateVideoGenCapability', () => {
    const bogus: VideoGenCapabilityDescriptor = {
      ...seedanceVideoGenCapability,
      maxDurationS: -1,
    };
    const result = validateVideoGenCapability(bogus as unknown as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe('seedanceDescriptor — passes T-422 license whitelist (proprietary-byo ∈ video-gen whitelist)', () => {
  it('declares license.kind = proprietary-byo', () => {
    expect(seedanceDescriptor.license.kind).toBe('proprietary-byo');
  });
});
