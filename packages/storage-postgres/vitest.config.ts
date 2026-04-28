// packages/storage-postgres/vitest.config.ts
// Coverage thresholds tightened above the workspace baseline for the
// migration-runner per AC #20 (≥90%).

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        // AC #19: adapter ≥85% (workspace default).
        // AC #20: migration-runner ≥90% — pinned per-file below.
        'src/migration-runner.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 80,
        },
      },
    },
  },
});
