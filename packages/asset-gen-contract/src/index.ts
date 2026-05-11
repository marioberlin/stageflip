// packages/asset-gen-contract/src/index.ts
// Public surface of `@stageflip/asset-gen-contract`. Per ADR-008 §D5 / §D6 /
// §D9 / §D4. Pure interface package — concrete adapters are T-426..T-434.
//
// Ships:
//   - 5 β modality provider interfaces (TTS / video-gen / music-gen / sfx /
//     three-d) + their capability Zod schemas + capability validators that
//     plug into T-418's `CapabilityDescriptorParser`.
//   - 7 source-grounded provider class interfaces (slide-deck / mind-map /
//     table / quiz / flashcard / report / infographic) per ADR-008 §D9.
//   - `TenantVoiceConsentStore` facet interface per ADR-008 §D4 (concrete
//     adapters downstream; mirrors T-411a `TenantSettingsStore` pattern).
//   - `MediaProvenance` + `ResearchSessionRef` placeholders. T-421 will
//     swap these for `@stageflip/schema` imports.

// ----------------------------------------------------------------------------
// MediaProvenance + ResearchSessionRef placeholders
// (TODO(T-421): swap to `@stageflip/schema` imports.)
// ----------------------------------------------------------------------------
export type {
  MediaProvenance,
  MediaProvenanceKind,
  ResearchSessionRef,
  ResearchSource,
  ResearchSourceKind,
  TenantVoiceConsentRef,
} from './provenance-placeholder.js';

// ----------------------------------------------------------------------------
// 5 β modality contracts (ADR-008 §D5 + §D6)
// ----------------------------------------------------------------------------
export {
  TTS_OUTPUT_FORMATS,
  TTS_VOICE_ORIGINS,
  ttsCapabilityDescriptorSchema,
  validateTtsCapability,
} from './tts-provider.js';
export type {
  TTSProvider,
  TtsCall,
  TtsCapabilityDescriptor,
  TtsOutputFormat,
  TtsResult,
  TtsVoice,
  TtsVoiceOrigin,
} from './tts-provider.js';

export {
  VIDEO_GEN_OUTPUT_FORMATS,
  validateVideoGenCapability,
  videoGenCapabilityDescriptorSchema,
} from './video-generation-provider.js';
export type {
  VideoGenCall,
  VideoGenCapabilityDescriptor,
  VideoGenOutputFormat,
  VideoGenResult,
  VideoGenerationProvider,
} from './video-generation-provider.js';

export {
  MUSIC_GEN_OUTPUT_FORMATS,
  MUSIC_GEN_OUTPUT_LICENSES,
  musicGenCapabilityDescriptorSchema,
  validateMusicGenCapability,
} from './music-generation-provider.js';
export type {
  MusicGenCall,
  MusicGenCapabilityDescriptor,
  MusicGenOutputFormat,
  MusicGenOutputLicense,
  MusicGenResult,
  MusicGenerationProvider,
} from './music-generation-provider.js';

export {
  SFX_OUTPUT_FORMATS,
  sfxCapabilityDescriptorSchema,
  validateSfxCapability,
} from './sfx-provider.js';
export type {
  SFXProvider,
  SfxCall,
  SfxCapabilityDescriptor,
  SfxOutputFormat,
  SfxResult,
} from './sfx-provider.js';

export {
  THREE_D_OUTPUT_FORMATS,
  THREE_D_TOPOLOGIES,
  threeDCapabilityDescriptorSchema,
  validateThreeDCapability,
} from './three-d-asset-provider.js';
export type {
  ThreeDAssetProvider,
  ThreeDCall,
  ThreeDCapabilityDescriptor,
  ThreeDOutputFormat,
  ThreeDResult,
  ThreeDTopology,
} from './three-d-asset-provider.js';

// ----------------------------------------------------------------------------
// 7 source-grounded provider class interfaces (ADR-008 §D9)
// ----------------------------------------------------------------------------
export * from './source-grounded/index.js';

// ----------------------------------------------------------------------------
// TenantVoiceConsentStore facet (ADR-008 §D4)
// ----------------------------------------------------------------------------
export {
  TENANT_VOICE_CONSENT_GRANT_BASES,
  tenantVoiceConsentRowSchema,
} from './tenant-voice-consent-store.js';
export type {
  AssertActiveInput,
  CreateTenantVoiceConsentInput,
  TenantVoiceConsentGrantBasis,
  TenantVoiceConsentRow,
  TenantVoiceConsentStore,
} from './tenant-voice-consent-store.js';
