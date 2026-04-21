// packages/cdp-host-bundle/vitest.config.ts
// Composition renderer is React; tests need a DOM. happy-dom is
// already a workspace-level devDep.

import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.base';

export default mergeConfig(baseConfig, {
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
