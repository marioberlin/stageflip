// apps/stageflip-slide/vitest.config.ts
// Unit + component tests run under happy-dom with @testing-library/react.
// Playwright specs (`e2e/**`) are excluded — those run via the app's
// `e2e` script, which builds the app and drives a real browser.
//
// `jsx: 'automatic'` in the esbuild override is required because the
// app's tsconfig uses `jsx: 'preserve'` for Next.js; vitest/vite would
// otherwise emit the preserved JSX AST into runtime files with no
// React.createElement available.

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
