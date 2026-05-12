// packages/audience-vevox/src/descriptor.test.ts
// Unit tests for the Vevox vendor adapter descriptor (T-479).

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import { audienceCapabilityDescriptorSchema } from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_VEVOX_SUPPORTED_CLIP_KINDS,
  audienceVevoxCapability,
  audienceVevoxDescriptor,
} from './descriptor.js';

describe('audienceVevoxDescriptor', () => {
  it('passes parseAdapterDescriptor envelope validation', () => {
    expect(() => parseAdapterDescriptor(audienceVevoxDescriptor)).not.toThrow();
  });

  it('declares id "audience-vevox"', () => {
    expect(audienceVevoxDescriptor.id).toBe('audience-vevox');
  });

  it('declares modality.kind "audience-backend"', () => {
    expect(audienceVevoxDescriptor.modality.kind).toBe('audience-backend');
  });

  it('declares license.kind "proprietary-byo" (SaaS; tenant supplies API credentials)', () => {
    expect(audienceVevoxDescriptor.license.kind).toBe('proprietary-byo');
  });

  it('declares sandbox.kind "remote-service" (Vevox hosted API)', () => {
    expect(audienceVevoxDescriptor.sandbox.kind).toBe('remote-service');
  });
});

describe('audienceVevoxCapability', () => {
  it('passes audienceCapabilityDescriptorSchema strict validation', () => {
    expect(() => audienceCapabilityDescriptorSchema.parse(audienceVevoxCapability)).not.toThrow();
  });

  it('supports exactly 7 non-motion-native clip kinds (Vevox drops leaderboard per ADR-009 §D8)', () => {
    expect(audienceVevoxCapability.supportedClipKinds).toHaveLength(7);
  });

  it('omits leaderboard (Vevox does not support standalone leaderboard per ADR-009 §D8)', () => {
    expect(audienceVevoxCapability.supportedClipKinds).not.toContain('leaderboard');
  });

  it('omits all three motion-native clip kinds (vendor cannot reach per ADR-010 §D7)', () => {
    expect(audienceVevoxCapability.supportedClipKinds).not.toContain('heatmap');
    expect(audienceVevoxCapability.supportedClipKinds).not.toContain('reaction-stream');
    expect(audienceVevoxCapability.supportedClipKinds).not.toContain('audience-ai-prompt');
  });

  it('declares supportsMotionNative false', () => {
    expect(audienceVevoxCapability.supportsMotionNative).toBe(false);
  });

  it('declares maxConcurrentVoters: 5000 (Vevox enterprise plan)', () => {
    expect(audienceVevoxCapability.maxConcurrentVoters).toBe(5000);
  });

  it('declares snapshotCadenceHz: 5 (lower than native 30 Hz; vendor push frequency)', () => {
    expect(audienceVevoxCapability.snapshotCadenceHz).toBe(5);
  });
});

describe('AUDIENCE_VEVOX_SUPPORTED_CLIP_KINDS', () => {
  it('contains all 7 expected discriminants (leaderboard omitted)', () => {
    expect([...AUDIENCE_VEVOX_SUPPORTED_CLIP_KINDS]).toEqual([
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'word-cloud',
      'survey',
    ]);
  });
});
