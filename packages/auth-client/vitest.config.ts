// packages/auth-client/vitest.config.ts
// React hooks + RTL need a DOM-like environment.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
  },
});
