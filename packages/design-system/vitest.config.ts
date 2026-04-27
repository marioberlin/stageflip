// packages/design-system/vitest.config.ts
// Per T-249 AC #32: ≥85% on changed files; ≥90% on entry + 8 step files. The
// step-level threshold is enforced by per-file overrides in CI; the package
// global threshold matches base (85%).

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
