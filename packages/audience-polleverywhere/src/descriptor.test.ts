// packages/audience-polleverywhere/src/descriptor.test.ts
// Unit tests for the PollEverywhere vendor adapter descriptor (T-479).

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import { audienceCapabilityDescriptorSchema } from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_POLLEVERYWHERE_SUPPORTED_CLIP_KINDS,
  audiencePollEverywhereCapability,
  audiencePollEverywhereDescriptor,
} from './descriptor.js';

describe('audiencePollEverywhereDescriptor', () => {
  it('passes parseAdapterDescriptor envelope validation', () => {
    expect(() => parseAdapterDescriptor(audiencePollEverywhereDescriptor)).not.toThrow();
  });

  it('declares id "audience-polleverywhere"', () => {
    expect(audiencePollEverywhereDescriptor.id).toBe('audience-polleverywhere');
  });

  it('declares modality.kind "audience-backend"', () => {
    expect(audiencePollEverywhereDescriptor.modality.kind).toBe('audience-backend');
  });

  it('declares license.kind "proprietary-byo" (SaaS; tenant supplies API credentials)', () => {
    expect(audiencePollEverywhereDescriptor.license.kind).toBe('proprietary-byo');
  });

  it('declares sandbox.kind "remote-service" (PollEverywhere hosted API)', () => {
    expect(audiencePollEverywhereDescriptor.sandbox.kind).toBe('remote-service');
  });
});

describe('audiencePollEverywhereCapability', () => {
  it('passes audienceCapabilityDescriptorSchema strict validation', () => {
    expect(() =>
      audienceCapabilityDescriptorSchema.parse(audiencePollEverywhereCapability),
    ).not.toThrow();
  });

  it('supports exactly 8 non-motion-native clip kinds per ADR-009 §D8 matrix', () => {
    expect(audiencePollEverywhereCapability.supportedClipKinds).toHaveLength(8);
  });

  it('omits all three motion-native clip kinds (vendor cannot reach per ADR-010 §D7)', () => {
    expect(audiencePollEverywhereCapability.supportedClipKinds).not.toContain('heatmap');
    expect(audiencePollEverywhereCapability.supportedClipKinds).not.toContain('reaction-stream');
    expect(audiencePollEverywhereCapability.supportedClipKinds).not.toContain('audience-ai-prompt');
  });

  it('declares supportsMotionNative false', () => {
    expect(audiencePollEverywhereCapability.supportsMotionNative).toBe(false);
  });

  it('declares maxConcurrentVoters: 5000 (PollEverywhere enterprise plan)', () => {
    expect(audiencePollEverywhereCapability.maxConcurrentVoters).toBe(5000);
  });

  it('declares snapshotCadenceHz: 5 (lower than native 30 Hz; vendor push frequency)', () => {
    expect(audiencePollEverywhereCapability.snapshotCadenceHz).toBe(5);
  });
});

describe('AUDIENCE_POLLEVERYWHERE_SUPPORTED_CLIP_KINDS', () => {
  it('contains all 8 expected discriminants', () => {
    expect([...AUDIENCE_POLLEVERYWHERE_SUPPORTED_CLIP_KINDS]).toEqual([
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
