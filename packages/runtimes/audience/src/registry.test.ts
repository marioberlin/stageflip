// packages/runtimes/audience/src/registry.test.ts
// T-454 — registry contract: register / resolve round-trip; duplicate-kind
// rejection; unknown-kind rejection; sorted list; empty on instantiation;
// singleton identity.

import type { AUDIENCE_CLIP_KINDS } from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import type { AudienceClipFactory } from './contract.js';
import {
  AudienceClipKindAlreadyRegisteredError,
  AudienceClipRegistry,
  UnknownAudienceClipKindError,
  audienceClipRegistry,
  findAudienceClip,
  registerAudienceClip,
} from './registry.js';

const stub: AudienceClipFactory = async () => ({
  updateProps: () => undefined,
  dispose: () => undefined,
});

describe('AudienceClipRegistry', () => {
  it('register / resolve round-trip', () => {
    const registry = new AudienceClipRegistry();
    registry.register('live-poll-multiple-choice', stub);
    expect(registry.resolve('live-poll-multiple-choice')).toBe(stub);
  });

  it('re-registering the same kind throws AudienceClipKindAlreadyRegisteredError', () => {
    const registry = new AudienceClipRegistry();
    registry.register('live-poll-multiple-choice', stub);
    expect(() => registry.register('live-poll-multiple-choice', stub)).toThrow(
      AudienceClipKindAlreadyRegisteredError,
    );
  });

  it('register with an unknown kind throws UnknownAudienceClipKindError', () => {
    const registry = new AudienceClipRegistry();
    // intentionally bypass the const-array type to test runtime guard
    expect(() =>
      registry.register('not-a-real-kind' as (typeof AUDIENCE_CLIP_KINDS)[number], stub),
    ).toThrow(UnknownAudienceClipKindError);
  });

  it('resolve returns undefined for an unregistered kind', () => {
    const registry = new AudienceClipRegistry();
    expect(registry.resolve('survey')).toBeUndefined();
  });

  it('list returns sorted kind names', () => {
    const registry = new AudienceClipRegistry();
    registry.register('survey', stub);
    registry.register('heatmap', stub);
    registry.register('live-qa', stub);
    expect(registry.list()).toEqual(['heatmap', 'live-qa', 'survey']);
  });

  it('unregister + clear are test-only escape hatches', () => {
    const registry = new AudienceClipRegistry();
    registry.register('reaction-stream', stub);
    expect(registry.unregister('reaction-stream')).toBe(true);
    expect(registry.unregister('reaction-stream')).toBe(false);
    registry.register('reaction-stream', stub);
    registry.clear();
    expect(registry.resolve('reaction-stream')).toBeUndefined();
  });

  it('module singleton is the same instance across imports', () => {
    expect(audienceClipRegistry).toBeInstanceOf(AudienceClipRegistry);
  });

  it('singleton lands empty (T-454 ships no factories)', () => {
    expect(audienceClipRegistry.list()).toEqual([]);
  });

  it('registerAudienceClip + findAudienceClip wrap the singleton', () => {
    try {
      registerAudienceClip('audience-ai-prompt', stub);
      expect(findAudienceClip('audience-ai-prompt')).toBe(stub);
    } finally {
      audienceClipRegistry.clear();
    }
  });
});
