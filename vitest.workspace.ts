// vitest.workspace.ts
// Vitest workspace discovery. Each glob matches a directory whose `vitest.config.ts`
// (or `package.json` with a `test` script) owns its suite. Keep in sync with
// pnpm-workspace.yaml and architecture §12.

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
  'packages/runtimes/*',
  'packages/profiles/*',
  'apps/*',
  'scripts',
]);
