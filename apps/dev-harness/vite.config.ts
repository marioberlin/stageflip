// apps/dev-harness/vite.config.ts
// Vite configuration for the frame-runtime dev harness.
// The harness is an internal tool — no SSR, no routing, just a single-page
// scrub UI wired against @stageflip/frame-runtime.

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
});
