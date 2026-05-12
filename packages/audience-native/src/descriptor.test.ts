// packages/audience-native/src/descriptor.test.ts
// Unit tests for the native audience-backend descriptor (T-478).
// Validates the descriptor passes `parseAdapterDescriptor` (T-418
// envelope) AND the capability passes `validateAudienceCapability`
// (T-452 strict schema).

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import {
  AUDIENCE_CLIP_KINDS,
  audienceCapabilityDescriptorSchema,
} from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import { audienceNativeCapability, audienceNativeDescriptor } from './descriptor.js';

describe('audienceNativeDescriptor', () => {
  it('passes parseAdapterDescriptor envelope validation', () => {
    expect(() => parseAdapterDescriptor(audienceNativeDescriptor)).not.toThrow();
  });

  it('declares id "audience-native"', () => {
    expect(audienceNativeDescriptor.id).toBe('audience-native');
  });

  it('declares modality.kind "audience-backend"', () => {
    expect(audienceNativeDescriptor.modality.kind).toBe('audience-backend');
  });

  it('declares license.kind "mit" (whitelisted for audience-backend modality)', () => {
    expect(audienceNativeDescriptor.license.kind).toBe('mit');
  });

  it('declares sandbox.kind "in-process"', () => {
    expect(audienceNativeDescriptor.sandbox.kind).toBe('in-process');
  });

  it('declares costPerCall.usd === 0 (native is free at the model level)', () => {
    expect(audienceNativeDescriptor.costPerCall).toEqual({ usd: 0 });
  });

  it('declares latencyMs matching the SLA-headroom in T-475', () => {
    expect(audienceNativeDescriptor.latencyMs).toEqual({ p50: 50, p95: 200 });
  });
});

describe('audienceNativeCapability', () => {
  it('passes audienceCapabilityDescriptorSchema strict validation', () => {
    expect(() => audienceCapabilityDescriptorSchema.parse(audienceNativeCapability)).not.toThrow();
  });

  it('supports all 11 AudienceClipKind discriminants (native covers motion-native)', () => {
    expect(audienceNativeCapability.supportedClipKinds).toHaveLength(AUDIENCE_CLIP_KINDS.length);
    for (const kind of AUDIENCE_CLIP_KINDS) {
      expect(audienceNativeCapability.supportedClipKinds).toContain(kind);
    }
  });

  it('declares supportsMotionNative true (ADR-010 §D7 marquee differentiator flag)', () => {
    expect(audienceNativeCapability.supportsMotionNative).toBe(true);
  });

  it('declares maxConcurrentVoters: 1000 (matches ADR-009 §D4 v1 SLA target)', () => {
    expect(audienceNativeCapability.maxConcurrentVoters).toBe(1000);
  });

  it('declares persistenceTier: "durable"', () => {
    expect(audienceNativeCapability.persistenceTier).toBe('durable');
  });

  it('declares voterIdentity: "anonymous"', () => {
    expect(audienceNativeCapability.voterIdentity).toBe('anonymous');
  });

  it('declares supportsStaticFallback: true (export-path requirement)', () => {
    expect(audienceNativeCapability.supportsStaticFallback).toBe(true);
  });

  it('declares maxIngestRateHz: 100 (matches T-453 tenant default)', () => {
    expect(audienceNativeCapability.maxIngestRateHz).toBe(100);
  });

  it('declares snapshotCadenceHz: 30 (ADR-009 §D5 default)', () => {
    expect(audienceNativeCapability.snapshotCadenceHz).toBe(30);
  });
});
