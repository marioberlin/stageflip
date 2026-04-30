// packages/variant-gen/vitest.config.ts
// Variant-gen runs under plain Node — pure transformation, no DOM.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'node',
  },
});
