// packages/tts-fish-speech/src/voice-consent.ts
// `assertVoiceConsentIfNeeded` — adapter-side helper that wraps the
// T-419 `TenantVoiceConsentStore.assertActive` call. Per ADR-008 §D4
// the §D4 obligation is per-call (no per-session caching); the
// provider invokes this on EVERY cloned-voice synthesize() call.
//
// Two failure modes — both surface as `VoiceConsentRequiredError` so
// the orchestrator (downstream) can map to the §D11
// `LF-VOICE-CONSENT-MISSING` failure class via a single instanceof
// check:
//
//   1. The orchestrator did not wire a `TenantVoiceConsentStore` at
//      all. Cloned-voice calls fail-closed with a message naming the
//      missing prerequisite.
//   2. The store returned no active row for the
//      `(tenantId, voiceProvider, voiceId)` triple. We re-wrap the
//      store's error so the downstream mapping does not depend on
//      which concrete store implementation is in play.
//
// Library-voice calls (`isClonedVoice === false`) bypass consent
// entirely — per ADR-008 §D4 D-VOICE-CONSENT-2 only cloned voices
// trigger the §D4 obligation. The provider passes `isClonedVoice`
// based on whether the requested `voiceId` is in the static
// `FISH_SPEECH_LIBRARY_VOICES` list.

import type { TenantVoiceConsentStore } from '@stageflip/asset-gen-contract';

/**
 * Thrown by `FishSpeechTtsProvider.synthesize()` (and by
 * `assertVoiceConsentIfNeeded` directly) when a cloned voice is
 * requested without an active `TenantVoiceConsentStore` row. The
 * orchestrator maps this to `LF-VOICE-CONSENT-MISSING` per ADR-008
 * §D11.
 */
export class VoiceConsentRequiredError extends Error {
  override readonly name = 'VoiceConsentRequiredError';
}

/** Input shape `assertVoiceConsentIfNeeded` consumes. */
export interface AssertVoiceConsentIfNeededInput {
  /**
   * The `TenantVoiceConsentStore` instance the orchestrator wired in.
   * `undefined` when the orchestrator has not configured a store —
   * cloned-voice calls then fail-closed with
   * `VoiceConsentRequiredError` (the adapter never silently bypasses
   * consent).
   */
  readonly store: TenantVoiceConsentStore | undefined;
  /** Tenant the synthesize() call is scoped to. */
  readonly tenantId: string;
  /** Voice-provider id (`'fish-speech'` for this adapter). */
  readonly voiceProvider: 'fish-speech';
  /** Voice id the call requests. */
  readonly voiceId: string;
  /**
   * Whether the requested voice is a cloned voice (true) or a
   * library voice (false). The provider derives this by checking
   * whether `voiceId` appears in `FISH_SPEECH_LIBRARY_VOICES`.
   */
  readonly isClonedVoice: boolean;
}

/**
 * Per-call active-consent check for the Fish Speech adapter. Returns
 * void on success (library-voice bypass OR cloned-voice with active
 * consent row); throws `VoiceConsentRequiredError` on failure.
 *
 * Calling pattern: `await assertVoiceConsentIfNeeded({...})` — the
 * function is async because the underlying `TenantVoiceConsentStore`
 * methods are async.
 */
export async function assertVoiceConsentIfNeeded(
  input: AssertVoiceConsentIfNeededInput,
): Promise<void> {
  if (!input.isClonedVoice) {
    return;
  }
  if (input.store === undefined) {
    throw new VoiceConsentRequiredError(
      `FishSpeechTtsProvider.synthesize: cloned voice "${input.voiceId}" requires a TenantVoiceConsentStore wired into the provider; the orchestrator must construct the provider with { voiceConsentStore } before invoking cloned voices.`,
    );
  }
  try {
    await input.store.assertActive({
      tenantId: input.tenantId,
      voiceProvider: input.voiceProvider,
      voiceId: input.voiceId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new VoiceConsentRequiredError(
      `FishSpeechTtsProvider.synthesize: voice consent missing for (${input.tenantId}, ${input.voiceProvider}, ${input.voiceId}): ${message}`,
    );
  }
}
