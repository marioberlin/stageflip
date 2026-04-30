// packages/runtimes/interactive/src/clips/web-embed/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/web-embed`.
// Importing this module has ONE SIDE EFFECT (T-393 D-T393-9):
//
//   1. registers `webEmbedClipFactory` with `interactiveClipRegistry`
//      for `family: 'web-embed'`.
//
// T-394 will add a second side-effect (registering the
// `webEmbedStaticFallbackGenerator` with `staticFallbackGeneratorRegistry`)
// when the poster-screenshot fallback ships.
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
import { webEmbedClipFactory } from './factory.js';

// Side-effect 1: register the factory (T-393).
interactiveClipRegistry.register('web-embed', webEmbedClipFactory);

// Re-exports — typed surface for direct programmatic use.
export {
  WebEmbedClipFactoryBuilder,
  webEmbedClipFactory,
  type WebEmbedClipFactoryOptions,
} from './factory.js';
export type {
  WebEmbedClipMountHandle,
  WebEmbedMessageDropReason,
  WebEmbedMessageEvent,
  WebEmbedMessageHandler,
  WebEmbedMountFailureReason,
} from './types.js';
