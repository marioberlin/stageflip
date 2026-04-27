// packages/export-google-slides/vitest.config.ts
// Plain Node Vitest config; mirrors @stageflip/import-google-slides.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'node',
  },
});
