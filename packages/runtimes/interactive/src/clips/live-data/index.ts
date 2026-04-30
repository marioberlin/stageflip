// packages/runtimes/interactive/src/clips/live-data/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/live-data`.
// Importing this module has ONE SIDE EFFECT (T-391 D-T391-9):
//
//   1. registers `liveDataClipFactory` with `interactiveClipRegistry`
//      for `family: 'live-data'`.
//
// T-392 will add a second side-effect (registering the
// `liveDataStaticFallbackGenerator` with `staticFallbackGeneratorRegistry`)
// when the cached-snapshot fallback ships.
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
import { liveDataClipFactory } from './factory.js';

// Side-effect 1: register the factory (T-391).
interactiveClipRegistry.register('live-data', liveDataClipFactory);

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
  type DataEvent,
  type DataHandler,
  type ErrorEvent,
  type ErrorHandler,
  type LiveDataClipMountHandle,
  type LiveDataMountFailureReason,
  RefreshTriggerError,
} from './types.js';
