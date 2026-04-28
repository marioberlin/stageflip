// packages/runtimes/blender/vitest.config.ts
// T-265 — coverage thresholds per AC #28 (≥85% on the package). `index.ts`
// is a pure barrel; exclude it so its 0% on re-export-only doesn't drag
// the aggregate down.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.test.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
