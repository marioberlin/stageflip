// packages/editor-shell/vitest.config.ts
// editor-shell tests need a DOM-like environment because ShortcutRegistry
// wires a `keydown` listener to `window` and is exercised via
// @testing-library/react. happy-dom is lighter than jsdom. Coverage
// thresholds inherit from the root base config.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
  },
});
