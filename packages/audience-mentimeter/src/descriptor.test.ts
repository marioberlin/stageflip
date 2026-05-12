// packages/audience-mentimeter/src/descriptor.test.ts
// Unit tests for the Mentimeter vendor adapter descriptor (T-479).

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import { audienceCapabilityDescriptorSchema } from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_MENTIMETER_SUPPORTED_CLIP_KINDS,
  audienceMentimeterCapability,
  audienceMentimeterDescriptor,
} from './descriptor.js';

describe('audienceMentimeterDescriptor', () => {
  it('passes parseAdapterDescriptor envelope validation', () => {
    expect(() => parseAdapterDescriptor(audienceMentimeterDescriptor)).not.toThrow();
  });

  it('declares id "audience-mentimeter"', () => {
    expect(audienceMentimeterDescriptor.id).toBe('audience-mentimeter');
  });

  it('declares modality.kind "audience-backend"', () => {
    expect(audienceMentimeterDescriptor.modality.kind).toBe('audience-backend');
  });

  it('declares license.kind "proprietary-byo" (SaaS; tenant supplies API credentials)', () => {
    expect(audienceMentimeterDescriptor.license.kind).toBe('proprietary-byo');
  });

  it('declares sandbox.kind "remote-service" (Mentimeter hosted API)', () => {
    expect(audienceMentimeterDescriptor.sandbox.kind).toBe('remote-service');
  });
});

describe('audienceMentimeterCapability', () => {
  it('passes audienceCapabilityDescriptorSchema strict validation', () => {
    expect(() =>
      audienceCapabilityDescriptorSchema.parse(audienceMentimeterCapability),
    ).not.toThrow();
  });

  it('supports exactly 8 non-motion-native clip kinds per ADR-009 §D8 matrix', () => {
    expect(audienceMentimeterCapability.supportedClipKinds).toHaveLength(8);
  });

  it('omits all three motion-native clip kinds (vendor cannot reach per ADR-010 §D7)', () => {
    expect(audienceMentimeterCapability.supportedClipKinds).not.toContain('heatmap');
    expect(audienceMentimeterCapability.supportedClipKinds).not.toContain('reaction-stream');
    expect(audienceMentimeterCapability.supportedClipKinds).not.toContain('audience-ai-prompt');
  });

  it('declares supportsMotionNative false', () => {
    expect(audienceMentimeterCapability.supportsMotionNative).toBe(false);
  });

  it('declares maxConcurrentVoters: 5000 (Mentimeter enterprise plan)', () => {
    expect(audienceMentimeterCapability.maxConcurrentVoters).toBe(5000);
  });

  it('declares snapshotCadenceHz: 5 (lower than native 30 Hz; vendor push frequency)', () => {
    expect(audienceMentimeterCapability.snapshotCadenceHz).toBe(5);
  });
});

describe('AUDIENCE_MENTIMETER_SUPPORTED_CLIP_KINDS', () => {
  it('contains all 8 expected discriminants', () => {
    expect([...AUDIENCE_MENTIMETER_SUPPORTED_CLIP_KINDS]).toEqual([
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
