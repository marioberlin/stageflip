// packages/runtimes/css/vitest.config.ts
// React rendering in tests requires a DOM-like environment; happy-dom matches
// the rest of the workspace's test-infra posture (see Audit 1 addendum in
// docs/dependencies.md).

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
  },
});
