// packages/rasterize/vitest.config.ts
// rasterize is a small Node-only package: PNG decode + crop + encode via
// pngjs, no DOM. Coverage threshold raised to 90% per T-245 AC #25.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
