// apps/docs/astro.config.mjs
// T-228 — Astro + Starlight config. Sidebar is loaded from a
// JSON manifest produced by `scripts/build-skill-pages.ts` at
// prebuild time; keeps this config hot-reload-friendly and
// free of filesystem walks.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const sidebarManifestUrl = new URL('./src/generated/sidebar.json', import.meta.url);
let skillsSidebar = [];
try {
  skillsSidebar = JSON.parse(readFileSync(fileURLToPath(sidebarManifestUrl), 'utf8'));
} catch {
  // Manifest hasn't been generated yet (e.g. first install). The
  // prebuild script will produce it before `astro dev` or `astro build`.
}

// biome-ignore lint/style/noDefaultExport: Astro config contract.
export default defineConfig({
  site: 'https://docs.stageflip.dev',
  integrations: [
    starlight({
      title: 'StageFlip docs',
      description: 'AI-native motion platform — slides, video, display.',
      sidebar: [
        { label: 'Quickstart', slug: 'quickstart' },
        ...skillsSidebar,
      ],
    }),
  ],
});
