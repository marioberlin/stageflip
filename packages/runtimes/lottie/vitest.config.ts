// packages/runtimes/lottie/vitest.config.ts
// Lottie-web creates SVG/canvas DOM; happy-dom is sufficient for lifecycle
// + seek assertions. Tests inject a stub lottie player via `lottieFactory`
// so the real 200 KB lottie-web module isn't pulled into the test runner.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
  },
});
