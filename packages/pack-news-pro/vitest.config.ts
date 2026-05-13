// packages/pack-news-pro/vitest.config.ts
// T-506 — Include tests under `scripts/` alongside the default `src/`
// pattern so `scripts/build-pack.test.ts` runs under `pnpm --filter
// @stageflip/pack-news-pro test`.

import { mergeConfig } from 'vitest/config';

import baseConfig, { coverageThresholds } from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      include: ['src/**', 'scripts/**'],
      exclude: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'src/**/index.ts'],
      thresholds: coverageThresholds,
    },
  },
});
