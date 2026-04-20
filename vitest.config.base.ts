// vitest.config.base.ts
// Shared Vitest base config. Packages import this and merge with per-package
// overrides via `mergeConfig`. Coverage thresholds match CLAUDE.md §8: 85% line
// coverage on changed code, enforced by CI.

import { defineConfig } from 'vitest/config';

export const coverageThresholds = {
  lines: 85,
  functions: 85,
  statements: 85,
  branches: 80,
} as const;

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/dist/**', '**/node_modules/**', '**/.turbo/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      include: ['src/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.d.ts',
        'src/**/index.ts',
      ],
      thresholds: coverageThresholds,
    },
  },
});
