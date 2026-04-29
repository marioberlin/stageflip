// packages/runtimes/interactive/src/clips/three-scene/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/three-scene`.
// Importing this module has the SIDE EFFECT of registering
// `threeSceneClipFactory` with `interactiveClipRegistry` for `family:
// 'three-scene'` (T-384 D-T384-10). `componentRefSchema.module` references
// resolve here at deploy time:
//
//   `@stageflip/runtimes-interactive/clips/three-scene#ThreeSceneClip`
//
// Re-importing throws `InteractiveClipFamilyAlreadyRegisteredError` per the
// registry contract (AC #7). Tests that need a fresh registration call
// `interactiveClipRegistry.unregister('three-scene')` first.

import { ThreeClipHost } from '@stageflip/runtimes-three';

import { interactiveClipRegistry } from '../../registry.js';
import { threeSceneClipFactory } from './factory.js';

// Side-effect: register on import. Production consumers (renderer-cdp,
// browser live-preview) import this module to make the family resolvable.
interactiveClipRegistry.register('three-scene', threeSceneClipFactory);

// Re-exports — typed surface for direct programmatic use. The React
// component name in `componentRef.module` is `ThreeSceneClip`, an alias
// for the host that the runtime mounts internally.
export {
  ThreeSceneClipFactoryBuilder,
  threeSceneClipFactory,
  type ThreeSceneClipFactoryOptions,
  type ThreeSceneMountFailureReason,
} from './factory.js';
export { createSeededPRNG, type SeededPRNG } from './prng.js';
export { installRAFShim, type RAFShimHandle } from './raf-shim.js';
export {
  resolveSetupRef,
  type SetupImporter,
  type SetupModule,
} from './setup-resolver.js';
export { ThreeClipHost as ThreeSceneClip };
