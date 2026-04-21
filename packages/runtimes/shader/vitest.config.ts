// packages/runtimes/shader/vitest.config.ts
// React rendering in tests; happy-dom does NOT provide WebGL contexts, so
// the host code exposes a `glContextFactory` seam that tests fill with a
// stub. Actual GL output is verified in the dev harness / parity fixtures
// (T-067), not here.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
  },
});
