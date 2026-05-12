// packages/audience-slido/src/descriptor.test.ts
// Unit tests for the Slido vendor adapter descriptor (T-479).

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import { audienceCapabilityDescriptorSchema } from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_SLIDO_SUPPORTED_CLIP_KINDS,
  audienceSlidoCapability,
  audienceSlidoDescriptor,
} from './descriptor.js';

describe('audienceSlidoDescriptor', () => {
  it('passes parseAdapterDescriptor envelope validation', () => {
    expect(() => parseAdapterDescriptor(audienceSlidoDescriptor)).not.toThrow();
  });

  it('declares id "audience-slido"', () => {
    expect(audienceSlidoDescriptor.id).toBe('audience-slido');
  });

  it('declares modality.kind "audience-backend"', () => {
    expect(audienceSlidoDescriptor.modality.kind).toBe('audience-backend');
  });

  it('declares license.kind "proprietary-byo" (SaaS; tenant supplies API credentials)', () => {
    expect(audienceSlidoDescriptor.license.kind).toBe('proprietary-byo');
  });

  it('declares sandbox.kind "remote-service" (Slido hosted API)', () => {
    expect(audienceSlidoDescriptor.sandbox.kind).toBe('remote-service');
  });
});

describe('audienceSlidoCapability', () => {
  it('passes audienceCapabilityDescriptorSchema strict validation', () => {
    expect(() => audienceCapabilityDescriptorSchema.parse(audienceSlidoCapability)).not.toThrow();
  });

  it('supports exactly 8 non-motion-native clip kinds per ADR-009 §D8 matrix', () => {
    expect(audienceSlidoCapability.supportedClipKinds).toHaveLength(8);
  });

  it('omits all three motion-native clip kinds (vendor cannot reach per ADR-010 §D7)', () => {
    expect(audienceSlidoCapability.supportedClipKinds).not.toContain('heatmap');
    expect(audienceSlidoCapability.supportedClipKinds).not.toContain('reaction-stream');
    expect(audienceSlidoCapability.supportedClipKinds).not.toContain('audience-ai-prompt');
  });

  it('declares supportsMotionNative false', () => {
    expect(audienceSlidoCapability.supportsMotionNative).toBe(false);
  });

  it('declares maxConcurrentVoters: 5000 (Slido enterprise plan)', () => {
    expect(audienceSlidoCapability.maxConcurrentVoters).toBe(5000);
  });

  it('declares snapshotCadenceHz: 5 (lower than native 30 Hz; vendor push frequency)', () => {
    expect(audienceSlidoCapability.snapshotCadenceHz).toBe(5);
  });
});

describe('AUDIENCE_SLIDO_SUPPORTED_CLIP_KINDS', () => {
  it('contains all 8 expected discriminants', () => {
    expect([...AUDIENCE_SLIDO_SUPPORTED_CLIP_KINDS]).toEqual([
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
