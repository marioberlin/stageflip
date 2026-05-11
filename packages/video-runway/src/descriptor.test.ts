// packages/video-runway/src/descriptor.test.ts
// Coverage for `runwayDescriptor` — schema round-trip via T-418's
// `parseAdapterDescriptor`, capability validator round-trip via T-419's
// `validateVideoGenCapability`, and the per-AC field invariants from
// docs/tasks/T-431.md AC #7.

import { describe, expect, it } from 'vitest';

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import {
  type VideoGenCapabilityDescriptor,
  validateVideoGenCapability,
} from '@stageflip/asset-gen-contract';

import {
  RUNWAY_BASE_URL_ENV_VAR,
  RUNWAY_FRAME_RATE,
  RUNWAY_MAX_DURATION_S,
  runwayDescriptor,
  runwayVideoGenCapability,
} from './descriptor.js';

describe('runwayDescriptor — adapter descriptor envelope', () => {
  it('passes parseAdapterDescriptor (T-418 schema)', () => {
    const parsed = parseAdapterDescriptor(runwayDescriptor);
    expect(parsed.id).toBe('runway');
    expect(parsed.modality.kind).toBe('video-gen');
    expect(parsed.license.kind).toBe('proprietary-byo');
    expect(parsed.sandbox.kind).toBe('remote-service');
  });

  it('uses kebab-case id', () => {
    expect(runwayDescriptor.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares sandbox.baseUrlEnvVar = RUNWAY_API_BASE_URL', () => {
    expect(runwayDescriptor.sandbox).toEqual({
      kind: 'remote-service',
      baseUrlEnvVar: 'RUNWAY_API_BASE_URL',
    });
    expect(RUNWAY_BASE_URL_ENV_VAR).toBe('RUNWAY_API_BASE_URL');
  });

  it('declares costPerCall.usd === 2.0 (paid; tenant pays Runway; enterprise tier; production-grade pricing)', () => {
    expect(runwayDescriptor.costPerCall?.usd).toBe(2.0);
  });

  it('declares latencyMs in batch tier (p50=90_000, p95=180_000)', () => {
    expect(runwayDescriptor.latencyMs?.p50).toBe(90_000);
    expect(runwayDescriptor.latencyMs?.p95).toBe(180_000);
  });

  it('does NOT set sourceGrounded or requiresResearchProvider', () => {
    expect(runwayDescriptor.sourceGrounded).toBeUndefined();
    expect(runwayDescriptor.requiresResearchProvider).toBeUndefined();
  });

  it('carries catalog-summary field maxDurationSec (read by T-424 generator)', () => {
    const cap = runwayDescriptor.capability as Record<string, unknown>;
    expect(cap.maxDurationSec).toBe(RUNWAY_MAX_DURATION_S);
  });

  it('carries differentiator-surface fields supportsLipSync=false + supportsNativeAudio=false + supportedResolutions + qualityHint', () => {
    const cap = runwayDescriptor.capability as Record<string, unknown>;
    expect(cap.supportsLipSync).toBe(false);
    expect(cap.supportsNativeAudio).toBe(false);
    expect(cap.supportedResolutions).toEqual(['1080p', '4k']);
    expect(cap.qualityHint).toBe('highest');
  });
});

describe('runwayVideoGenCapability — strict VideoGenCapabilityDescriptor subset', () => {
  it('passes validateVideoGenCapability (T-419 schema)', () => {
    const result = validateVideoGenCapability(
      runwayVideoGenCapability as unknown as Record<string, unknown>,
    );
    expect(result.ok).toBe(true);
  });

  it('declares mp4 as the only output format', () => {
    expect(runwayVideoGenCapability.outputFormats).toEqual(['mp4']);
  });

  it('declares 24fps frame rate (cinematic / film-style; differentiator vs Seedance 30fps)', () => {
    expect(runwayVideoGenCapability.frameRates).toEqual([24]);
    expect(RUNWAY_FRAME_RATE).toBe(24);
  });

  it('declares maxDurationS = 10 (Runway Gen-4 conservative cap)', () => {
    expect(runwayVideoGenCapability.maxDurationS).toBe(10);
    expect(RUNWAY_MAX_DURATION_S).toBe(10);
  });

  it('declares broad aspect-ratio set (16:9 / 9:16 / 1:1 / 4:3 / 3:4)', () => {
    expect(runwayVideoGenCapability.aspectRatios).toEqual(['16:9', '9:16', '1:1', '4:3', '3:4']);
  });

  it('declares emitsAudio = false (THE differentiator — Runway is silent video; audio paired separately)', () => {
    expect(runwayVideoGenCapability.emitsAudio).toBe(false);
  });

  it('declares safetyFilters = [] (none surfaced in v1)', () => {
    expect(runwayVideoGenCapability.safetyFilters).toEqual([]);
  });

  it('rejects an arbitrary mutation that would fail validateVideoGenCapability', () => {
    const bogus: VideoGenCapabilityDescriptor = {
      ...runwayVideoGenCapability,
      maxDurationS: -1,
    };
    const result = validateVideoGenCapability(bogus as unknown as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe('runwayDescriptor — passes T-422 license whitelist (proprietary-byo ∈ video-gen whitelist)', () => {
  it('declares license.kind = proprietary-byo', () => {
    expect(runwayDescriptor.license.kind).toBe('proprietary-byo');
  });
});
