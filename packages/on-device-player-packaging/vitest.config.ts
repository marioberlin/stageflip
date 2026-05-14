// packages/on-device-player-packaging/vitest.config.ts
// Vitest config for the on-device player binary packaging package (T-400).
// Coverage thresholds match house defaults (≥85% changed-code coverage per
// CLAUDE.md).

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.test.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
