// packages/renderer-cdp/vitest.config.ts
// Scope vitest discovery to src/ so the vendored @hyperframes/engine tests
// under vendor/ do not get picked up. Vendor integrity lives in
// src/vendor-integrity.test.ts; the engine's own suite is out-of-scope here
// (kept upstream-verbatim per T-080).

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
