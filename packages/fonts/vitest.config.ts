// packages/fonts/vitest.config.ts
// useFontLoad renders under a real DOM; happy-dom supplies enough.
// Tests inject the FontFaceSet via `fontFaceSet` option so happy-dom's
// partial `document.fonts` stub is never actually exercised.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
  },
});
