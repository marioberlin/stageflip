// packages/runtimes/frame-runtime-bridge/vitest.config.ts
// Bridge tests render frame-runtime React components; happy-dom is the same
// environment frame-runtime's own suite uses.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
  },
});
