// packages/runtimes/interactive/src/clips/web-embed/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/web-embed`.
// Importing this module has TWO SIDE EFFECTS (T-393 D-T393-9 +
// T-394 D-T394-5):
//
//   1. registers `webEmbedClipFactory` with `interactiveClipRegistry`
//      for `family: 'web-embed'`;
//   2. registers the poster-screenshot `StaticFallbackGenerator`
//      (wrapping `defaultWebEmbedStaticFallback`) with
//      `staticFallbackGeneratorRegistry` for `family: 'web-embed'`.
//      The generator emits the
//      `web-embed-clip.static-fallback.rendered` event with integer-
//      length attributes only (D-T394-4 privacy posture; hasPoster
//      boolean + posterSrcLength integer, never the URL string).
//
// `componentRefSchema.module` references resolve here at deploy time:
//
//   `@stageflip/runtimes-interactive/clips/web-embed#WebEmbedClip`
//
// Re-importing throws `InteractiveClipFamilyAlreadyRegisteredError`
// per the registry contract. Tests that need a fresh registration
// call the matching `unregister`/`clear` first.
//
// CONVERGENCE — T-393 (γ-live, second pattern): web-embed has no
// rendered output to converge on. There is no `convergence.test.tsx`
// in this directory; the absent test is documented as out-of-scope
// per D-T393-6.

import { interactiveClipRegistry } from '../../registry.js';
import { staticFallbackGeneratorRegistry } from '../../static-fallback-registry.js';
import { webEmbedClipFactory } from './factory.js';
import { webEmbedStaticFallbackGenerator } from './static-fallback.js';

// Side-effect 1: register the factory (T-393).
interactiveClipRegistry.register('web-embed', webEmbedClipFactory);

// Side-effect 2: register the poster-screenshot generator (T-394).
staticFallbackGeneratorRegistry.register('web-embed', webEmbedStaticFallbackGenerator);

// Re-exports — typed surface for direct programmatic use.
export {
  WebEmbedClipFactoryBuilder,
  webEmbedClipFactory,
  type WebEmbedClipFactoryOptions,
} from './factory.js';
export {
  defaultWebEmbedStaticFallback,
  type DefaultWebEmbedStaticFallbackArgs,
  webEmbedStaticFallbackGenerator,
} from './static-fallback.js';
export type {
  WebEmbedClipMountHandle,
  WebEmbedMessageDropReason,
  WebEmbedMessageEvent,
  WebEmbedMessageHandler,
  WebEmbedMountFailureReason,
} from './types.js';
