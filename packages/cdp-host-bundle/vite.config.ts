// packages/cdp-host-bundle/vite.config.ts
// Browser-side build. Emits a single IIFE JS file to dist/browser/bundle.js
// that includes React, ReactDOM, frame-runtime, runtimes-contract,
// runtimes-css, and the composition renderer. Consumed by
// `@stageflip/renderer-cdp`'s `runtimeBundleHostHtml` builder.
//
// Workspace deps (@stageflip/*) are intentionally bundled — the
// whole point is a single-file IIFE the browser can load without
// any module resolution. Node built-ins are externalised defensively
// (none should leak into the browser entry, but belt-and-braces).

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/browser',
    emptyOutDir: true,
    lib: {
      entry: 'src/browser/entry.tsx',
      name: 'StageflipHostBundle',
      formats: ['iife'],
      fileName: () => 'bundle.js',
    },
    rollupOptions: {
      external: ['node:fs', 'node:path', 'fs', 'path'],
    },
    minify: 'esbuild',
    sourcemap: false,
    target: 'es2020',
  },
});
