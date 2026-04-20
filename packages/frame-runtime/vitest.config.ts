// packages/frame-runtime/vitest.config.ts
// frame-runtime tests need a DOM-like environment because they exercise
// React rendering via @testing-library/react. happy-dom is lighter than
// jsdom and covers our needs. Coverage thresholds inherit from the root
// base config (see ../../vitest.config.base.ts).

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
  },
});
