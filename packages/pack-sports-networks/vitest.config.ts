// packages/pack-sports-networks/vitest.config.ts
// T-511 — Include tests under `scripts/` alongside the default `src/`
// pattern so `scripts/build-pack.test.ts` runs under `pnpm --filter
// @stageflip/pack-sports-networks test`. Mirrors pack-news-pro layout.

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
