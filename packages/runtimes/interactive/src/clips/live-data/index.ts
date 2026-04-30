// packages/runtimes/interactive/src/clips/live-data/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/live-data`.
// Importing this module has TWO SIDE EFFECTS (T-391 D-T391-9 +
// T-392 D-T392-5):
//
//   1. registers `liveDataClipFactory` with `interactiveClipRegistry`
//      for `family: 'live-data'`;
//   2. registers the cached-snapshot `StaticFallbackGenerator`
//      (wrapping `defaultLiveDataStaticFallback`) with
//      `staticFallbackGeneratorRegistry` for `family: 'live-data'`.
//      The generator emits the
//      `live-data-clip.static-fallback.rendered` event with integer-
//      length attributes only (D-T392-4 privacy posture; hasSnapshot
//      boolean + bodyByteLength integer, never the body).
//
// `componentRefSchema.module` references resolve here at deploy time:
//
//   `@stageflip/runtimes-interactive/clips/live-data#LiveDataClip`
//
// Re-importing throws `InteractiveClipFamilyAlreadyRegisteredError`
// per the registry contract. Tests that need a fresh registration
// call the matching `unregister`/`clear` first.
//
// CONVERGENCE — T-391 (γ-live, second pattern): live-data has no
// rendered output to converge on. There is no `convergence.test.tsx`
// in this directory; the absent test is documented as out-of-scope
// per D-T391-6.

import { interactiveClipRegistry } from '../../registry.js';
import { staticFallbackGeneratorRegistry } from '../../static-fallback-registry.js';
import { liveDataClipFactory } from './factory.js';
import { liveDataStaticFallbackGenerator } from './static-fallback.js';

// Side-effect 1: register the factory (T-391).
interactiveClipRegistry.register('live-data', liveDataClipFactory);

// Side-effect 2: register the cached-snapshot generator (T-392).
staticFallbackGeneratorRegistry.register('live-data', liveDataStaticFallbackGenerator);

// Re-exports — typed surface for direct programmatic use.
export {
  LiveDataClipFactoryBuilder,
  liveDataClipFactory,
  type LiveDataClipFactoryOptions,
} from './factory.js';
export {
  HostFetcherProvider,
  type HostFetcherProviderOptions,
  InMemoryLiveDataProvider,
  type InMemoryLiveDataProviderOptions,
  type Fetcher,
  type LiveDataFetchArgs,
  type LiveDataFetchResult,
  type LiveDataProvider,
  type ScriptedResponse,
} from './live-data-provider.js';
export {
  defaultLiveDataStaticFallback,
  type DefaultLiveDataStaticFallbackArgs,
  liveDataStaticFallbackGenerator,
} from './static-fallback.js';
export {
  type DataEvent,
  type DataHandler,
  type ErrorEvent,
  type ErrorHandler,
  type LiveDataClipMountHandle,
  type LiveDataMountFailureReason,
  RefreshTriggerError,
} from './types.js';
