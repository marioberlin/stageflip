// packages/export-html5-zip/src/provenance-walk.test.ts
// T-439 — provenance-walk unit tests: classifyAiKind + extractAiDisclosures.

import type { MediaProvenance } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { type AiElementInput, classifyAiKind, extractAiDisclosures } from './provenance-walk.js';

function ttsProvenance(overrides: Partial<MediaProvenance> = {}): MediaProvenance {
  return {
    kind: 'tts',
    provider: 'tts-kokoro',
    model: 'kokoro-82m',
    prompt: 'hello world',
    cacheKey: 'sha256-tts-abc',
    voiceProvider: 'kokoro',
    voiceId: 'af-bella',
    ...overrides,
  };
}

describe('classifyAiKind', () => {
  it('returns true for each AI-generated kind', () => {
    for (const kind of [
      'tts',
      'video-gen',
      'music-gen',
      'sfx',
      'three-d',
      'image-gen',
      'asset-gen-pending',
    ] as const) {
      expect(classifyAiKind(kind)).toBe(true);
    }
  });

  it('returns false for imported', () => {
    expect(classifyAiKind('imported')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(classifyAiKind(undefined)).toBe(false);
  });

  it('returns false for unknown kinds (defensive)', () => {
    expect(classifyAiKind('mystery-kind' as never)).toBe(false);
  });
});

describe('extractAiDisclosures', () => {
  it('returns an empty disclosure record for an empty input', () => {
    const out = extractAiDisclosures([], { badgeEnabled: true });
    expect(out.elements).toEqual([]);
    expect(out.disclosure.ftc).toBe('requires-tenant-config');
    expect(out.disclosure.euAiAct).toBe('requires-tenant-config');
  });

  it('extracts a single TTS element with all provenance fields copied', () => {
    const inputs: readonly AiElementInput[] = [{ elementId: 'el-1', provenance: ttsProvenance() }];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.elements).toHaveLength(1);
    expect(out.elements[0]).toEqual({
      elementId: 'el-1',
      provider: 'tts-kokoro',
      modality: 'tts',
      cacheKey: 'sha256-tts-abc',
      prompt: 'hello world',
    });
  });

  it('filters out imported / no-provenance elements', () => {
    const inputs: readonly AiElementInput[] = [
      { elementId: 'el-imported', provenance: { kind: 'imported' } },
      { elementId: 'el-no-prov' },
      { elementId: 'el-tts', provenance: ttsProvenance() },
    ];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.elements).toHaveLength(1);
    expect(out.elements[0]?.elementId).toBe('el-tts');
  });

  it('preserves input order across multiple AI elements', () => {
    const inputs: readonly AiElementInput[] = [
      { elementId: 'b', provenance: ttsProvenance() },
      { elementId: 'a', provenance: { kind: 'image-gen', provider: 'image-flux', model: 'flux-1' } },
      { elementId: 'c', provenance: { kind: 'video-gen', provider: 'video-seedance', model: 'seedance-1' } },
    ];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.elements.map((e) => e.elementId)).toEqual(['b', 'a', 'c']);
  });

  it('omits prompt / cacheKey when absent on the provenance', () => {
    const inputs: readonly AiElementInput[] = [
      {
        elementId: 'el-1',
        provenance: { kind: 'three-d', provider: 'three-d-tripo', model: 'tripo-1' },
      },
    ];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.elements[0]).toEqual({
      elementId: 'el-1',
      provider: 'three-d-tripo',
      modality: 'three-d',
    });
  });

  it('uses literal "unknown" for provider when provenance.provider is absent', () => {
    const inputs: readonly AiElementInput[] = [{ elementId: 'el-1', provenance: { kind: 'tts' } }];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.elements[0]?.provider).toBe('unknown');
  });

  it('flags ftc = compliant when badge enabled AND at least one row has provider', () => {
    const inputs: readonly AiElementInput[] = [{ elementId: 'el-1', provenance: ttsProvenance() }];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.disclosure.ftc).toBe('compliant');
  });

  it('flags ftc = requires-tenant-config when badge disabled', () => {
    const inputs: readonly AiElementInput[] = [{ elementId: 'el-1', provenance: ttsProvenance() }];
    const out = extractAiDisclosures(inputs, { badgeEnabled: false });
    expect(out.disclosure.ftc).toBe('requires-tenant-config');
  });

  it('flags ftc = requires-tenant-config when no row has provider', () => {
    const inputs: readonly AiElementInput[] = [
      { elementId: 'el-1', provenance: { kind: 'image-gen' } },
    ];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.disclosure.ftc).toBe('requires-tenant-config');
  });

  it('flags euAiAct = compliant when badge enabled AND ≥1 row has provider + model', () => {
    const inputs: readonly AiElementInput[] = [{ elementId: 'el-1', provenance: ttsProvenance() }];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.disclosure.euAiAct).toBe('compliant');
  });

  it('flags euAiAct = requires-tenant-config when no row has model', () => {
    const inputs: readonly AiElementInput[] = [
      { elementId: 'el-1', provenance: { kind: 'tts', provider: 'tts-kokoro' } },
    ];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.disclosure.euAiAct).toBe('requires-tenant-config');
  });

  it('flags euAiAct = requires-tenant-config when badge disabled even with full provenance', () => {
    const inputs: readonly AiElementInput[] = [{ elementId: 'el-1', provenance: ttsProvenance() }];
    const out = extractAiDisclosures(inputs, { badgeEnabled: false });
    expect(out.disclosure.euAiAct).toBe('requires-tenant-config');
  });

  it('treats asset-gen-pending as AI (T-438 non-terminal kind)', () => {
    const inputs: readonly AiElementInput[] = [
      {
        elementId: 'el-pending',
        provenance: {
          kind: 'asset-gen-pending',
          provider: 'tts-kokoro',
          model: 'kokoro-82m',
          placeholderId: 'p-1',
          cacheKey: 'sha256-pending',
        },
      },
    ];
    const out = extractAiDisclosures(inputs, { badgeEnabled: true });
    expect(out.elements).toHaveLength(1);
    expect(out.elements[0]?.modality).toBe('asset-gen-pending');
  });
});
