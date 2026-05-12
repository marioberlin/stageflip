// packages/audience-join-shared/vitest.config.ts
// Pure helpers — Node environment is sufficient. Inherits coverage
// thresholds from the workspace base config (CLAUDE.md §8: ≥85%).

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'node',
  },
});
