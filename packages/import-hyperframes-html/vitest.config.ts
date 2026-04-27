// packages/import-hyperframes-html/vitest.config.ts
// Hyperframes HTML importer/exporter — Node-only, no DOM. Coverage targets
// per T-247 AC #35: 85% workspace floor; 90% on parseHyperframes/exportHyperframes.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 80,
      },
    },
  },
});
