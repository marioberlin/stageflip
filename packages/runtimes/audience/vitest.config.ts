// packages/runtimes/audience/vitest.config.ts
// T-454 — audience runtime test config. ≥85 % line / function / statement
// coverage on every module per CLAUDE.md §8. The barrel and contract-only
// type module sit out of the coverage walk per house convention.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.test.ts', 'src/**/__*.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
