// tests/load/vitest.config.ts
// Vitest config for the helper TS files (seed.ts, cleanup.ts, retry-after).
// K6 JS scenarios are NOT unit-tested here — they run inside K6's runtime.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['seed.ts', 'cleanup.ts', 'retry-after.test-helper.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80,
      },
    },
  },
});
