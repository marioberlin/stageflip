// apps/audience-join/vitest.config.ts
// Voter-app component tests run under happy-dom. Playwright specs
// (`e2e/**`) are excluded — those run via `pnpm e2e` against a built
// Next.js app.

import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(
  baseConfig,
  defineConfig({
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'react',
    },
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    },
  }),
);
