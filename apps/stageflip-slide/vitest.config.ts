// apps/stageflip-slide/vitest.config.ts
// Walking skeleton has no unit tests yet — everything runs through
// Playwright (`e2e/*.spec.ts`). Tell vitest to ignore the e2e dir so
// the package-level `test` script stays a no-op instead of trying to
// execute Playwright specs as vitest files.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
});
