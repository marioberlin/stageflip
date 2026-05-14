// packages/on-device-player-packaging/tsup.config.ts
// Build config for `@stageflip/on-device-player-packaging` (T-400). ESM +
// CJS, dts on, clean on each build. Workspace deps stay external.

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
