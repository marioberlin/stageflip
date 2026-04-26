// packages/import-google-slides/vitest.config.ts
// Plain Node Vitest config; matches the import-pptx setup. No DOM, no JSDOM.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'node',
  },
});
