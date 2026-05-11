// packages/tts-kokoro/src/index.ts
// Public surface of `@stageflip/tts-kokoro`. T-426 — first reference
// adapter (Phase 14 β).
//
// The `descriptor` named export is what `scripts/check-asset-licenses.ts`
// (T-422) discovers via dynamic import. `kokoroDescriptor` is the same
// object under its canonical name — host shells (e.g.
// `scripts/sync-skills.ts`) import the canonical name when they
// `registry.register(kokoroDescriptor)`.
//
// Importing this module has NO side effects — adapters-core uses an
// instance-based, per-tenant `AdapterRegistry` (not a global
// singleton), so the host shell owns registration timing.

export {
  KOKORO_MAX_DURATION_S,
  KOKORO_SAMPLE_RATE_HZ,
  KOKORO_VOICES,
  kokoroDescriptor,
  kokoroTtsCapability,
} from './descriptor.js';

// Aliased export for the T-422 discovery walker.
export { kokoroDescriptor as descriptor } from './descriptor.js';

export {
  KokoroTtsProvider,
  NotYetImplementedError,
} from './provider.js';
export type { KokoroProviderMode, KokoroTtsProviderOptions } from './provider.js';

export { generateSilentWavDataUri } from './stub-audio.js';
