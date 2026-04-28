// services/blender-worker/vitest.config.ts
// T-265 — exclude integration-only `main.ts` from coverage. The pure
// orchestration (`worker.ts`) and the mocked-spawn invoker
// (`blender-invoker.ts`) carry coverage ≥80% per AC #29; `main.ts` is
// BullMQ + GCS wiring exercised by the nightly STAGEFLIP_BLENDER_INTEGRATION
// run, not the per-PR vitest.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.test.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
