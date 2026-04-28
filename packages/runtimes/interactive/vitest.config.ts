// packages/runtimes/interactive/vitest.config.ts
// T-306 — coverage thresholds per AC #27/#28/#29.
//   - permission-shim.ts ≥ 90%
//   - mount-harness.ts   ≥ 85%
//   - registry.ts        ≥ 95%
// happy-dom for the React 19 root API + getUserMedia mocking. `index.ts` is
// a barrel; exclude per house convention. Contract-tests barrel is also a
// barrel (re-exports + a `describe` factory) — exclude.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/index.ts',
        'src/contract-tests/index.ts',
        'src/contract-tests/fixtures.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
        'src/permission-shim.ts': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'src/registry.ts': {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
      },
    },
  },
});
