// packages/parity-cli/tsup.config.ts
// `@stageflip/testing` exports raw `.ts` from `src/index.ts` (no
// build step of its own), so Node can't resolve it at runtime from
// parity-cli's compiled dist. Inline it into the bundle via
// `noExternal`. Other workspace deps (`@stageflip/parity`) DO have
// built dists and stay external.

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  noExternal: ['@stageflip/testing'],
});
