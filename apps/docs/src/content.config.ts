// apps/docs/src/content.config.ts
// T-228 — Astro 5 content-collection config. Starlight requires an
// explicit `docs` collection when auto-generation is deprecated.

import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
