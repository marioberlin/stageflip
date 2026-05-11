// packages/runtimes/audience/src/audience-runtime.test.ts
// T-454 — `audienceRuntime` ClipRuntime contract conformance.
//   - id: 'audience'
//   - tier: 'live'
//   - clips is empty on instantiation
//   - registerAudienceClipDefinition adds entries visible to findClip-like lookups
//   - duplicate-kind rejection
//   - key-mismatch rejection (kind != definition.kind)
//   - integrates with registerRuntime from @stageflip/runtimes-contract

import { __clearRuntimeRegistry, findClip, registerRuntime } from '@stageflip/runtimes-contract';
import { afterEach, describe, expect, it } from 'vitest';

import {
  __clearAudienceClipDefinitions,
  __resetAudienceRuntime,
  audienceRuntime,
  registerAudienceClipDefinition,
} from './audience-runtime.js';

afterEach(() => {
  __resetAudienceRuntime();
  __clearRuntimeRegistry();
});

describe('audienceRuntime — ClipRuntime contract', () => {
  it('declares id and tier per T-454 spec', () => {
    expect(audienceRuntime.id).toBe('audience');
    expect(audienceRuntime.tier).toBe('live');
  });

  it('clips map is empty on instantiation (T-454 ships no clip families)', () => {
    expect(audienceRuntime.clips.size).toBe(0);
  });

  it('registerAudienceClipDefinition adds entries to the clips view', () => {
    const def = {
      kind: 'live-poll-multiple-choice',
      render: () => null,
    };
    registerAudienceClipDefinition('live-poll-multiple-choice', def);
    expect(audienceRuntime.clips.get('live-poll-multiple-choice')).toBe(def);
  });

  it('duplicate-kind registration throws', () => {
    const def = { kind: 'survey', render: () => null };
    registerAudienceClipDefinition('survey', def);
    expect(() => registerAudienceClipDefinition('survey', def)).toThrow(/already registered/);
  });

  it('rejects key/kind mismatch', () => {
    const def = { kind: 'survey', render: () => null };
    expect(() => registerAudienceClipDefinition('heatmap', def)).toThrow(/does not match/);
  });

  it('integrates with @stageflip/runtimes-contract findClip', () => {
    const def = { kind: 'heatmap', render: () => null };
    registerAudienceClipDefinition('heatmap', def);
    registerRuntime(audienceRuntime);
    const resolved = findClip('heatmap');
    expect(resolved).not.toBeNull();
    expect(resolved?.runtime.id).toBe('audience');
    expect(resolved?.clip).toBe(def);
  });

  it('__clearAudienceClipDefinitions empties the clips map', () => {
    const def = { kind: 'survey', render: () => null };
    registerAudienceClipDefinition('survey', def);
    __clearAudienceClipDefinitions();
    expect(audienceRuntime.clips.size).toBe(0);
  });
});
