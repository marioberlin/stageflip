// packages/3d-tripo/src/descriptor.test.ts
// Coverage for `tripoDescriptor` — schema round-trip via T-418's
// `parseAdapterDescriptor`, capability validator round-trip via T-419's
// `validateThreeDCapability`, and the per-AC field invariants from
// docs/tasks/T-428.md AC #7.

import { describe, expect, it } from 'vitest';

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import {
  type ThreeDCapabilityDescriptor,
  validateThreeDCapability,
} from '@stageflip/asset-gen-contract';

import {
  TRIPO_BASE_URL_ENV_VAR,
  TRIPO_MAX_VERTICES,
  tripoDescriptor,
  tripoThreeDCapability,
} from './descriptor.js';

describe('tripoDescriptor — adapter descriptor envelope', () => {
  it('passes parseAdapterDescriptor (T-418 schema)', () => {
    const parsed = parseAdapterDescriptor(tripoDescriptor);
    expect(parsed.id).toBe('tripo');
    expect(parsed.modality.kind).toBe('three-d');
    expect(parsed.license.kind).toBe('proprietary-byo');
    expect(parsed.sandbox.kind).toBe('remote-service');
  });

  it('uses kebab-case id', () => {
    expect(tripoDescriptor.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares sandbox.baseUrlEnvVar = TRIPO_API_BASE_URL', () => {
    expect(tripoDescriptor.sandbox).toEqual({
      kind: 'remote-service',
      baseUrlEnvVar: 'TRIPO_API_BASE_URL',
    });
    expect(TRIPO_BASE_URL_ENV_VAR).toBe('TRIPO_API_BASE_URL');
  });

  it('declares costPerCall.usd === 0.5 (paid; tenant pays Tripo)', () => {
    expect(tripoDescriptor.costPerCall?.usd).toBe(0.5);
  });

  it('declares latencyMs in batch tier (p50=60_000, p95=120_000)', () => {
    expect(tripoDescriptor.latencyMs?.p50).toBe(60_000);
    expect(tripoDescriptor.latencyMs?.p95).toBe(120_000);
  });

  it('does NOT set sourceGrounded or requiresResearchProvider', () => {
    expect(tripoDescriptor.sourceGrounded).toBeUndefined();
    expect(tripoDescriptor.requiresResearchProvider).toBeUndefined();
  });

  it('carries catalog-summary fields formats + maxPolyCount (read by T-424 generator)', () => {
    const cap = tripoDescriptor.capability as Record<string, unknown>;
    expect(cap.formats).toEqual(['glb']);
    expect(cap.maxPolyCount).toBe(TRIPO_MAX_VERTICES);
  });
});

describe('tripoThreeDCapability — strict ThreeDCapabilityDescriptor subset', () => {
  it('passes validateThreeDCapability (T-419 schema)', () => {
    const result = validateThreeDCapability(
      tripoThreeDCapability as unknown as Record<string, unknown>,
    );
    expect(result.ok).toBe(true);
  });

  it('declares glb as the only output format', () => {
    expect(tripoThreeDCapability.outputFormats).toEqual(['glb']);
  });

  it('declares quad-clean topology (rigging-eligible)', () => {
    expect(tripoThreeDCapability.topology).toBe('quad-clean');
  });

  it('declares supportsAutoRigging = true', () => {
    expect(tripoThreeDCapability.supportsAutoRigging).toBe(true);
  });

  it('declares maxVertices = 50_000', () => {
    expect(tripoThreeDCapability.maxVertices).toBe(50_000);
    expect(TRIPO_MAX_VERTICES).toBe(50_000);
  });

  it('rejects an arbitrary mutation that would fail validateThreeDCapability', () => {
    const bogus: ThreeDCapabilityDescriptor = {
      ...tripoThreeDCapability,
      maxVertices: -1,
    };
    const result = validateThreeDCapability(bogus as unknown as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe('tripoDescriptor — passes T-422 license whitelist (proprietary-byo ∈ three-d whitelist)', () => {
  it('declares license.kind = proprietary-byo', () => {
    expect(tripoDescriptor.license.kind).toBe('proprietary-byo');
  });
});
