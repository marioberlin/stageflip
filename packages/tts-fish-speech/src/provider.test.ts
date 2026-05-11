// packages/tts-fish-speech/src/provider.test.ts
// Coverage for `FishSpeechTtsProvider` — stub-mode happy path,
// validation errors, production-mode NotYetImplementedError,
// determinism, and the §D4 voice-consent enforcement (the
// differentiator vs T-426 Kokoro). Per docs/tasks/T-427.md AC #8.

import { describe, expect, it } from 'vitest';

import type {
  AssertActiveInput,
  TenantVoiceConsentRow,
  TenantVoiceConsentStore,
  TtsCall,
} from '@stageflip/asset-gen-contract';

import { fishSpeechDescriptor } from './descriptor.js';
import { FishSpeechTtsProvider, NotYetImplementedError } from './provider.js';
import { VoiceConsentRequiredError } from './voice-consent.js';

const baseCall: TtsCall = {
  tenantId: 'tenant-1',
  voiceId: 'fs_en_default',
  text: 'Hello world from the Fish Speech stub adapter.',
  outputFormat: 'wav',
  sampleRate: 22050,
};

function makeStore(
  granted: readonly { tenantId: string; voiceId: string }[],
): TenantVoiceConsentStore {
  const set = new Set(granted.map((g) => `${g.tenantId}|${g.voiceId}`));
  return {
    async get(): Promise<TenantVoiceConsentRow | undefined> {
      throw new Error('not used');
    },
    async listForTenant(): Promise<readonly TenantVoiceConsentRow[]> {
      throw new Error('not used');
    },
    async assertActive(input: AssertActiveInput): Promise<TenantVoiceConsentRow> {
      const key = `${input.tenantId}|${input.voiceId}`;
      if (!set.has(key)) {
        throw new Error(`no active consent row for ${key}`);
      }
      return {
        id: 'fake-row-id',
        tenantId: input.tenantId,
        voiceProvider: input.voiceProvider,
        voiceId: input.voiceId,
        grantedBy: 'fake-admin',
        grantedAt: '2026-05-11T00:00:00.000Z',
        grantBasis: 'self',
      };
    },
    async create(): Promise<TenantVoiceConsentRow> {
      throw new Error('not used');
    },
    async revoke(): Promise<void> {
      throw new Error('not used');
    },
  };
}

describe('FishSpeechTtsProvider — construction', () => {
  it('defaults to stub mode', () => {
    const p = new FishSpeechTtsProvider();
    expect(p.mode).toBe('stub');
  });

  it('passes through descriptor fields (id / modality / license / sandbox / cost / latency)', () => {
    const p = new FishSpeechTtsProvider();
    expect(p.id).toBe(fishSpeechDescriptor.id);
    expect(p.modality.kind).toBe('tts');
    expect(p.license).toEqual(fishSpeechDescriptor.license);
    expect(p.sandbox).toEqual(fishSpeechDescriptor.sandbox);
    expect(p.costPerCall).toEqual(fishSpeechDescriptor.costPerCall);
    expect(p.latencyMs).toEqual(fishSpeechDescriptor.latencyMs);
  });

  it('exposes a strict TtsCapabilityDescriptor (no catalog-summary leakage)', () => {
    const p = new FishSpeechTtsProvider();
    expect(p.capability.voices).toHaveLength(8);
    expect(p.capability.outputFormats).toEqual(['wav']);
    expect(p.capability.sampleRates).toEqual([22050]);
    expect(p.capability.supportsVoiceClone).toBe(true);
    expect(p.capability.emitsWordTimestamps).toBe(false);
    // Catalog-summary fields are NOT on the strict capability surface.
    expect((p.capability as Record<string, unknown>).voiceCount).toBeUndefined();
  });
});

describe('FishSpeechTtsProvider.synthesize — library voices (no consent needed)', () => {
  it('returns a TtsResult with a data:audio/wav;base64 url', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    const result = await p.synthesize(baseCall);
    expect(result.url.startsWith('data:audio/wav;base64,')).toBe(true);
  });

  it('returns a cacheKey shaped <modality>/<64-hex>', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    const result = await p.synthesize(baseCall);
    expect(result.cacheKey).toMatch(/^tts\/[0-9a-f]{64}$/);
  });

  it('returns durationS in [0.5, 60]', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    const result = await p.synthesize(baseCall);
    expect(result.durationS).toBeGreaterThanOrEqual(0.5);
    expect(result.durationS).toBeLessThanOrEqual(60);
  });

  it('clamps a very-short prompt to MIN_DURATION_S = 0.5', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    const result = await p.synthesize({ ...baseCall, text: 'Hi' });
    expect(result.durationS).toBe(0.5);
  });

  it('clamps an oversized prompt to MAX_DURATION_S = 60', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    const result = await p.synthesize({ ...baseCall, text: 'x'.repeat(2000) });
    expect(result.durationS).toBe(60);
  });

  it('is deterministic — identical input → identical cacheKey + url', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    const a = await p.synthesize(baseCall);
    const b = await p.synthesize(baseCall);
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.url).toBe(b.url);
    expect(a.durationS).toBe(b.durationS);
  });

  it('produces different cacheKeys for different prompts', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    const a = await p.synthesize(baseCall);
    const b = await p.synthesize({ ...baseCall, text: 'A different prompt entirely.' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different voiceIds', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    const a = await p.synthesize(baseCall);
    const b = await p.synthesize({ ...baseCall, voiceId: 'fs_zh_default' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different seeds', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    const a = await p.synthesize({ ...baseCall, seed: 1 });
    const b = await p.synthesize({ ...baseCall, seed: 2 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('library voice synthesizes WITHOUT a consent store wired (consent bypass for library voices)', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' }); // no voiceConsentStore
    await expect(p.synthesize(baseCall)).resolves.toBeDefined();
  });
});

describe('FishSpeechTtsProvider.synthesize — cloned voices (consent enforced)', () => {
  const clonedCall: TtsCall = { ...baseCall, voiceId: 'cloned-voice-1' };

  it('throws VoiceConsentRequiredError when no consent store is wired', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    await expect(p.synthesize(clonedCall)).rejects.toBeInstanceOf(VoiceConsentRequiredError);
  });

  it('throws VoiceConsentRequiredError when the store denies (no active row)', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub', voiceConsentStore: makeStore([]) });
    await expect(p.synthesize(clonedCall)).rejects.toBeInstanceOf(VoiceConsentRequiredError);
  });

  it('synthesizes when the store grants the (tenantId, voiceId) pair', async () => {
    const store = makeStore([{ tenantId: 'tenant-1', voiceId: 'cloned-voice-1' }]);
    const p = new FishSpeechTtsProvider({ mode: 'stub', voiceConsentStore: store });
    const result = await p.synthesize(clonedCall);
    expect(result.url.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(result.cacheKey).toMatch(/^tts\/[0-9a-f]{64}$/);
  });

  it('throws when the store grants a DIFFERENT tenant', async () => {
    const store = makeStore([{ tenantId: 'tenant-OTHER', voiceId: 'cloned-voice-1' }]);
    const p = new FishSpeechTtsProvider({ mode: 'stub', voiceConsentStore: store });
    await expect(p.synthesize(clonedCall)).rejects.toBeInstanceOf(VoiceConsentRequiredError);
  });

  it('cloned-voice cache key differs from a hypothetical library-voice cache key for the same id (clone fingerprint)', async () => {
    // Library voice (no fingerprint) at fs_en_default.
    const pLib = new FishSpeechTtsProvider({ mode: 'stub' });
    const libResult = await pLib.synthesize({ ...baseCall, voiceId: 'fs_en_default' });

    // Cloned voice with the SAME id-shape but distinct slug, with consent.
    const store = makeStore([{ tenantId: 'tenant-1', voiceId: 'fs_en_default_clone' }]);
    const pClone = new FishSpeechTtsProvider({ mode: 'stub', voiceConsentStore: store });
    const cloneResult = await pClone.synthesize({
      ...baseCall,
      voiceId: 'fs_en_default_clone',
    });

    expect(cloneResult.cacheKey).not.toBe(libResult.cacheKey);
  });

  it('determinism holds for cloned voices too — same input → same cacheKey + url', async () => {
    const store = makeStore([{ tenantId: 'tenant-1', voiceId: 'cloned-voice-1' }]);
    const p = new FishSpeechTtsProvider({ mode: 'stub', voiceConsentStore: store });
    const a = await p.synthesize(clonedCall);
    const b = await p.synthesize(clonedCall);
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.url).toBe(b.url);
  });
});

describe('FishSpeechTtsProvider.synthesize — input validation', () => {
  it('throws on non-wav outputFormat (library voice)', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    await expect(p.synthesize({ ...baseCall, outputFormat: 'mp3' })).rejects.toThrow(
      /unsupported outputFormat "mp3"/,
    );
  });

  it('throws on non-22050 sampleRate (library voice)', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' });
    await expect(p.synthesize({ ...baseCall, sampleRate: 44100 })).rejects.toThrow(
      /unsupported sampleRate 44100/,
    );
  });

  it('cloned-voice consent fires BEFORE format / sample-rate validation (defensive ordering)', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'stub' }); // no store
    await expect(
      p.synthesize({
        ...baseCall,
        voiceId: 'cloned-voice-1',
        outputFormat: 'mp3', // would otherwise throw on format
      }),
    ).rejects.toBeInstanceOf(VoiceConsentRequiredError);
  });

  it('validation errors fire BEFORE production-mode NotYetImplementedError (defensive ordering)', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'production' });
    await expect(p.synthesize({ ...baseCall, outputFormat: 'mp3' })).rejects.toThrow(
      /unsupported outputFormat/,
    );
  });
});

describe('FishSpeechTtsProvider.synthesize — production mode', () => {
  it('throws NotYetImplementedError with the deferral note (library voice)', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'production' });
    await expect(p.synthesize(baseCall)).rejects.toBeInstanceOf(NotYetImplementedError);
    await expect(p.synthesize(baseCall)).rejects.toThrow(/T-427a/);
  });

  it('throws VoiceConsentRequiredError before NotYetImplementedError for cloned voices (consent supersedes mode)', async () => {
    const p = new FishSpeechTtsProvider({ mode: 'production' }); // no store
    await expect(p.synthesize({ ...baseCall, voiceId: 'cloned-voice-X' })).rejects.toBeInstanceOf(
      VoiceConsentRequiredError,
    );
  });
});

describe('NotYetImplementedError', () => {
  it('extends Error and has name = "NotYetImplementedError"', () => {
    const err = new NotYetImplementedError('foo');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NotYetImplementedError');
    expect(err.message).toBe('foo');
  });
});

describe('barrel — side-effect-free import', () => {
  it('importing the module multiple times does not throw + descriptor is stable', async () => {
    const m1 = await import('./descriptor.js');
    const m2 = await import('./descriptor.js');
    expect(m1.fishSpeechDescriptor).toBe(m2.fishSpeechDescriptor);
  });
});
