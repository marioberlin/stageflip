// packages/3d-meshy/src/descriptor.test.ts
// Coverage for `meshyDescriptor` — schema round-trip via T-418's
// `parseAdapterDescriptor`, capability validator round-trip via T-419's
// `validateThreeDCapability`, and the per-AC field invariants from
// docs/tasks/T-429.md AC #7.

import { describe, expect, it } from 'vitest';

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import {
  type ThreeDCapabilityDescriptor,
  validateThreeDCapability,
} from '@stageflip/asset-gen-contract';

import {
  MESHY_BASE_URL_ENV_VAR,
  MESHY_MAX_VERTICES,
  meshyDescriptor,
  meshyThreeDCapability,
} from './descriptor.js';

describe('meshyDescriptor — adapter descriptor envelope', () => {
  it('passes parseAdapterDescriptor (T-418 schema)', () => {
    const parsed = parseAdapterDescriptor(meshyDescriptor);
    expect(parsed.id).toBe('meshy');
    expect(parsed.modality.kind).toBe('three-d');
    expect(parsed.license.kind).toBe('proprietary-byo');
    expect(parsed.sandbox.kind).toBe('remote-service');
  });

  it('uses kebab-case id', () => {
    expect(meshyDescriptor.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares sandbox.baseUrlEnvVar = MESHY_API_BASE_URL', () => {
    expect(meshyDescriptor.sandbox).toEqual({
      kind: 'remote-service',
      baseUrlEnvVar: 'MESHY_API_BASE_URL',
    });
    expect(MESHY_BASE_URL_ENV_VAR).toBe('MESHY_API_BASE_URL');
  });

  it('declares costPerCall.usd === 0.2 (paid; tenant pays Meshy)', () => {
    expect(meshyDescriptor.costPerCall?.usd).toBe(0.2);
  });

  it('declares latencyMs in batch tier (p50=60_000, p95=90_000)', () => {
    expect(meshyDescriptor.latencyMs?.p50).toBe(60_000);
    expect(meshyDescriptor.latencyMs?.p95).toBe(90_000);
  });

  it('does NOT set sourceGrounded or requiresResearchProvider', () => {
    expect(meshyDescriptor.sourceGrounded).toBeUndefined();
    expect(meshyDescriptor.requiresResearchProvider).toBeUndefined();
  });

  it('carries catalog-summary fields formats + maxPolyCount (read by T-424 generator)', () => {
    const cap = meshyDescriptor.capability as Record<string, unknown>;
    expect(cap.formats).toEqual(['glb']);
    expect(cap.maxPolyCount).toBe(MESHY_MAX_VERTICES);
  });
});

describe('meshyThreeDCapability — strict ThreeDCapabilityDescriptor subset', () => {
  it('passes validateThreeDCapability (T-419 schema)', () => {
    const result = validateThreeDCapability(
      meshyThreeDCapability as unknown as Record<string, unknown>,
    );
    expect(result.ok).toBe(true);
  });

  it('declares glb as the only output format', () => {
    expect(meshyThreeDCapability.outputFormats).toEqual(['glb']);
  });

  it('declares triangle-soup topology (props + environment; rigging refused)', () => {
    expect(meshyThreeDCapability.topology).toBe('triangle-soup');
  });

  it('declares supportsAutoRigging = false', () => {
    expect(meshyThreeDCapability.supportsAutoRigging).toBe(false);
  });

  it('declares maxVertices = 30_000', () => {
    expect(meshyThreeDCapability.maxVertices).toBe(30_000);
    expect(MESHY_MAX_VERTICES).toBe(30_000);
  });

  it('rejects an arbitrary mutation that would fail validateThreeDCapability', () => {
    const bogus: ThreeDCapabilityDescriptor = {
      ...meshyThreeDCapability,
      maxVertices: -1,
    };
    const result = validateThreeDCapability(bogus as unknown as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe('meshyDescriptor — passes T-422 license whitelist (proprietary-byo ∈ three-d whitelist)', () => {
  it('declares license.kind = proprietary-byo', () => {
    expect(meshyDescriptor.license.kind).toBe('proprietary-byo');
  });
});
