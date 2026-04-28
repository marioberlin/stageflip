// scripts/vitest.config.ts
// Vitest config for the workspace `scripts/` directory. Excludes the entry
// scripts that perform side effects on import (none currently — every file
// gates its `process.exit` call behind an `import.meta.url === ...` check).

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['*.test.ts'],
    exclude: ['**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['backup-restore.ts', 'check-preset-integrity.ts'],
      exclude: ['*.test.ts', '*.config.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
        // T-308 AC #18 — script-specific 85% floor on changed code.
        'check-preset-integrity.ts': {
          lines: 85,
          functions: 85,
          statements: 85,
          branches: 85,
        },
      },
    },
  },
});
