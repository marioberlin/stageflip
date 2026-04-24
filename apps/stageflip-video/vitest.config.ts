// apps/stageflip-video/vitest.config.ts
// Unit + component tests under happy-dom. Mirrors the slide-app setup
// including the esbuild JSX automatic override (tsconfig uses
// `jsx: 'preserve'` for Next but vitest needs runtime JSX compilation).

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
      exclude: ['node_modules/**', '.next/**'],
    },
  }),
);
