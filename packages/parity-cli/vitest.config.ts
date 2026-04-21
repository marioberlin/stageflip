// packages/parity-cli/vitest.config.ts
// CLI lives in Node. No DOM needed.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'node',
  },
});
