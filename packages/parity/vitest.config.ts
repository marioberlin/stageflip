// packages/parity/vitest.config.ts
// Parity comparators run under plain Node — PSNR is pure arithmetic, SSIM
// is delegated to `ssim.js`, PNG decode goes through `sharp`. No DOM.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'node',
  },
});
