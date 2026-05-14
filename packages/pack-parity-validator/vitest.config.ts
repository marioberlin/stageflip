// packages/pack-parity-validator/vitest.config.ts
// Pack-parity validation runs under plain Node — pure-JS PSNR/SSIM
// arithmetic over decoded PNG buffers. No DOM.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'node',
  },
});
