// packages/tts-fish-speech/src/voice-consent.test.ts
// Coverage for `assertVoiceConsentIfNeeded` — the helper wrapping the
// T-419 `TenantVoiceConsentStore.assertActive` call. Per
// docs/tasks/T-427.md AC #5 + #8.

import { describe, expect, it } from 'vitest';

import type {
  AssertActiveInput,
  TenantVoiceConsentRow,
  TenantVoiceConsentStore,
} from '@stageflip/asset-gen-contract';

import { VoiceConsentRequiredError, assertVoiceConsentIfNeeded } from './voice-consent.js';

/**
 * Tiny inline `TenantVoiceConsentStore` test fake. Resolves
 * `assertActive` for any triple in `granted`; throws otherwise. Other
 * methods throw on use — the provider only calls `assertActive`.
 */
function makeStore(granted: readonly { tenantId: string; voiceId: string }[]): TenantVoiceConsentStore {
  const set = new Set(granted.map((g) => `${g.tenantId}|${g.voiceId}`));
  return {
    async get(): Promise<TenantVoiceConsentRow | undefined> {
      throw new Error('not used in T-427 tests');
    },
    async listForTenant(): Promise<readonly TenantVoiceConsentRow[]> {
      throw new Error('not used in T-427 tests');
    },
    async assertActive(input: AssertActiveInput): Promise<TenantVoiceConsentRow> {
      const key = `${input.tenantId}|${input.voiceId}`;
      if (!set.has(key)) {
        throw new Error(
          `no active consent row for (${input.tenantId}, ${input.voiceProvider}, ${input.voiceId})`,
        );
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
      throw new Error('not used in T-427 tests');
    },
    async revoke(): Promise<void> {
      throw new Error('not used in T-427 tests');
    },
  };
}

describe('assertVoiceConsentIfNeeded — library voices bypass consent', () => {
  it('returns immediately when isClonedVoice = false (store undefined)', async () => {
    await expect(
      assertVoiceConsentIfNeeded({
        store: undefined,
        tenantId: 'tenant-1',
        voiceProvider: 'fish-speech',
        voiceId: 'fs_en_default',
        isClonedVoice: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('returns immediately when isClonedVoice = false (store present)', async () => {
    const store = makeStore([]);
    await expect(
      assertVoiceConsentIfNeeded({
        store,
        tenantId: 'tenant-1',
        voiceProvider: 'fish-speech',
        voiceId: 'fs_en_default',
        isClonedVoice: false,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('assertVoiceConsentIfNeeded — cloned voices require consent', () => {
  it('throws VoiceConsentRequiredError when store is undefined (fail-closed default)', async () => {
    await expect(
      assertVoiceConsentIfNeeded({
        store: undefined,
        tenantId: 'tenant-1',
        voiceProvider: 'fish-speech',
        voiceId: 'cloned-voice-1',
        isClonedVoice: true,
      }),
    ).rejects.toBeInstanceOf(VoiceConsentRequiredError);
  });

  it('error message names the missing prerequisite when store is undefined', async () => {
    await expect(
      assertVoiceConsentIfNeeded({
        store: undefined,
        tenantId: 'tenant-1',
        voiceProvider: 'fish-speech',
        voiceId: 'cloned-voice-1',
        isClonedVoice: true,
      }),
    ).rejects.toThrow(/TenantVoiceConsentStore/);
  });

  it('throws VoiceConsentRequiredError when the store has no active row', async () => {
    const store = makeStore([]); // no grants
    await expect(
      assertVoiceConsentIfNeeded({
        store,
        tenantId: 'tenant-1',
        voiceProvider: 'fish-speech',
        voiceId: 'cloned-voice-1',
        isClonedVoice: true,
      }),
    ).rejects.toBeInstanceOf(VoiceConsentRequiredError);
  });

  it('preserves the underlying store error message via re-wrap', async () => {
    const store = makeStore([]);
    await expect(
      assertVoiceConsentIfNeeded({
        store,
        tenantId: 'tenant-1',
        voiceProvider: 'fish-speech',
        voiceId: 'cloned-voice-1',
        isClonedVoice: true,
      }),
    ).rejects.toThrow(/no active consent row/);
  });

  it('returns void when the store resolves (consent granted)', async () => {
    const store = makeStore([{ tenantId: 'tenant-1', voiceId: 'cloned-voice-1' }]);
    await expect(
      assertVoiceConsentIfNeeded({
        store,
        tenantId: 'tenant-1',
        voiceProvider: 'fish-speech',
        voiceId: 'cloned-voice-1',
        isClonedVoice: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('only matches the exact (tenantId, voiceId) — different tenant denied', async () => {
    const store = makeStore([{ tenantId: 'tenant-A', voiceId: 'cloned-voice-1' }]);
    await expect(
      assertVoiceConsentIfNeeded({
        store,
        tenantId: 'tenant-B',
        voiceProvider: 'fish-speech',
        voiceId: 'cloned-voice-1',
        isClonedVoice: true,
      }),
    ).rejects.toBeInstanceOf(VoiceConsentRequiredError);
  });
});

describe('VoiceConsentRequiredError', () => {
  it('extends Error and has name = "VoiceConsentRequiredError"', () => {
    const err = new VoiceConsentRequiredError('foo');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('VoiceConsentRequiredError');
    expect(err.message).toBe('foo');
  });
});
