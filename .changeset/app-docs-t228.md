---
"@stageflip/app-docs": minor
---

T-228: `apps/docs` — Astro Starlight site over `skills/stageflip/**`.

- `scripts/build-skill-pages.ts` prebuild walks the repo's skills tree
  and mirrors every `SKILL.md` into a Starlight content-collection
  file with a minimal `title` / `description` frontmatter. Emits
  `src/generated/sidebar.json` for `astro.config.mjs`.
- `src/lib/sidebar.ts` — pure function that groups skill entries by
  tier into the Starlight sidebar shape. Tier order mirrors the
  reader's mental-model-entry order: concepts → runtimes → modes →
  profiles → tools → workflows → reference → clips. 6 unit tests.
- Hand-written `index.md` (splash landing) + `quickstart.md` (folds
  the three mode quickstarts from user-manual.md §2).
- Build emits 67 pages (2 hand-written + 64 skill SKILLs + 1 404);
  pagefind indexes all 66 content pages.

Hosting lands with T-230 (Firebase). This PR ships the app in a
buildable state; no deploy pipeline.
