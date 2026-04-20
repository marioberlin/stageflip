// packages/testing/vitest.config.ts
// Test config for @stageflip/testing. Extends the root base config; coverage
// is disabled for this package because its purpose is to prove the pipeline
// itself, not to gate on its own coverage.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      enabled: false,
    },
  },
});
