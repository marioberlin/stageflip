// packages/runtimes/gsap/vitest.config.ts
// React rendering + gsap timeline seek both need a DOM-like environment.
// happy-dom matches the rest of the workspace.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
  },
});
