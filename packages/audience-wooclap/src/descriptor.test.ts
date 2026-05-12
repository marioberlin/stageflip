// packages/audience-wooclap/src/descriptor.test.ts
// Unit tests for the Wooclap vendor adapter descriptor (T-479).

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import { audienceCapabilityDescriptorSchema } from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_WOOCLAP_SUPPORTED_CLIP_KINDS,
  audienceWooclapCapability,
  audienceWooclapDescriptor,
} from './descriptor.js';

describe('audienceWooclapDescriptor', () => {
  it('passes parseAdapterDescriptor envelope validation', () => {
    expect(() => parseAdapterDescriptor(audienceWooclapDescriptor)).not.toThrow();
  });

  it('declares id "audience-wooclap"', () => {
    expect(audienceWooclapDescriptor.id).toBe('audience-wooclap');
  });

  it('declares modality.kind "audience-backend"', () => {
    expect(audienceWooclapDescriptor.modality.kind).toBe('audience-backend');
  });

  it('declares license.kind "proprietary-byo" (SaaS; tenant supplies API credentials)', () => {
    expect(audienceWooclapDescriptor.license.kind).toBe('proprietary-byo');
  });

  it('declares sandbox.kind "remote-service" (Wooclap hosted API)', () => {
    expect(audienceWooclapDescriptor.sandbox.kind).toBe('remote-service');
  });
});

describe('audienceWooclapCapability', () => {
  it('passes audienceCapabilityDescriptorSchema strict validation', () => {
    expect(() => audienceCapabilityDescriptorSchema.parse(audienceWooclapCapability)).not.toThrow();
  });

  it('supports exactly 8 non-motion-native clip kinds per ADR-009 §D8 matrix', () => {
    expect(audienceWooclapCapability.supportedClipKinds).toHaveLength(8);
  });

  it('omits all three motion-native clip kinds (vendor cannot reach per ADR-010 §D7)', () => {
    expect(audienceWooclapCapability.supportedClipKinds).not.toContain('heatmap');
    expect(audienceWooclapCapability.supportedClipKinds).not.toContain('reaction-stream');
    expect(audienceWooclapCapability.supportedClipKinds).not.toContain('audience-ai-prompt');
  });

  it('declares supportsMotionNative false', () => {
    expect(audienceWooclapCapability.supportsMotionNative).toBe(false);
  });

  it('declares maxConcurrentVoters: 5000 (Wooclap enterprise plan)', () => {
    expect(audienceWooclapCapability.maxConcurrentVoters).toBe(5000);
  });

  it('declares snapshotCadenceHz: 5 (lower than native 30 Hz; vendor push frequency)', () => {
    expect(audienceWooclapCapability.snapshotCadenceHz).toBe(5);
  });
});

describe('AUDIENCE_WOOCLAP_SUPPORTED_CLIP_KINDS', () => {
  it('contains all 8 expected discriminants', () => {
    expect([...AUDIENCE_WOOCLAP_SUPPORTED_CLIP_KINDS]).toEqual([
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'leaderboard',
      'word-cloud',
      'survey',
    ]);
  });
});
