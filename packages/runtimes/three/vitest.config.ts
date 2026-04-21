// packages/runtimes/three/vitest.config.ts
// React rendering needs a DOM. Three.js's WebGLRenderer requires WebGL,
// which happy-dom lacks — the host bails silently when setup throws, and
// infrastructure tests use a pure non-THREE handle.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
  },
});
