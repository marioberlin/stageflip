// packages/runtimes/interactive/src/clips/shader/index.ts
// Subpath module for `@stageflip/runtimes-interactive/clips/shader`. Importing
// this module has the SIDE EFFECT of registering `shaderClipFactory` with
// `interactiveClipRegistry` for `family: 'shader'` (T-383 D-T383-9).
// `componentRefSchema.module` references resolve here at deploy time:
//
//   `@stageflip/runtimes-interactive/clips/shader#ShaderClip`
//
// Re-importing throws `InteractiveClipFamilyAlreadyRegisteredError` per the
// registry contract (AC #7). Tests that need a fresh registration call
// `interactiveClipRegistry.unregister('shader')` first.

import { interactiveClipRegistry } from '../../registry.js';
import { shaderClipFactory } from './factory.js';

// Side-effect: register on import. Production consumers (renderer-cdp,
// browser live-preview) import this module to make the family resolvable.
interactiveClipRegistry.register('shader', shaderClipFactory);

// Re-exports — typed surface for direct programmatic use (the React component
// name in `componentRef.module` is `ShaderClip`, an alias for the host).
export {
  ShaderClipFactoryBuilder,
  shaderClipFactory,
  type ShaderClipFactoryOptions,
  type ShaderMountFailureReason,
} from './factory.js';
export { ShaderClipHost as ShaderClip } from '@stageflip/runtimes-shader';
export {
  defaultShaderUniforms,
  type UniformContext,
  type UniformUpdater,
} from './uniforms.js';
export type { ShaderClipProps, UniformValue } from './props.js';
