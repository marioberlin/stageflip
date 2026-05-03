# @stageflip/runtimes-contract

## 0.1.0

### Minor Changes

- 019f79c: FontManager runtime (T-072) — editor-side half. CDP pre-embedding
  stays with Phase 4 (T-084a).

  `@stageflip/runtimes-contract` — `FontRequirement` extended with two
  optional fields matching the workspace fonts concept:
  - `subsets?: readonly string[]` — Unicode subsets (`'latin'`,
    `'cyrillic'`, etc.).
  - `features?: readonly string[]` — OpenType features (`'ss01'`,
    `'tnum'`, etc.).

  Non-breaking — both optional.

  `@stageflip/fonts` — new package:
  - `aggregateFontRequirements(iterable)` — canonical dedup + sort.
    Dedup key is (family (case-insensitive), weight, style); merged
    requirements union their `subsets` / `features`.
  - `formatFontShorthand(req, px?)` — CSS shorthand suitable for
    `document.fonts.check` and `document.fonts.load`.
  - `useFontLoad(requirements, options?)` — React hook returning
    `{ status: 'idle' | 'loading' | 'ready' | 'error', error, loaded }`.
    Blocks consumer render on font readiness; the CDP export path
    handles its own base64 embedding + `document.fonts.check` gate in
    Phase 4.
  - `fontFaceSet` option is the test seam; every test injects a fake.
  - Structural dep key on the `requirements` array so callers passing
    inline literals don't trigger re-render loops.

- 785b44c: Initial ClipRuntime contract + registry (T-060).

  Types: `ClipRuntime`, `ClipDefinition<P>`, `ClipRenderContext<P>`,
  `FontRequirement`, `RuntimeTier = 'live' | 'bake'`,
  `RuntimePrepareContext`.

  Registry: `registerRuntime`, `getRuntime`, `listRuntimes`,
  `unregisterRuntime`, `findClip`, `__clearRuntimeRegistry`.

  Validates on register: non-empty id, duplicate id, unknown tier, and
  clip map keys that disagree with their definition's `kind`. `findClip`
  resolves a globally unique clip kind to the owning runtime; first
  registered wins on tie.

  No concrete runtime code yet — T-061 adds the frame-runtime bridge;
  T-062..T-066 follow.

- 753b22a: T-125b — optional `propsSchema?: ZodType<P>` on `ClipDefinition`. Clips
  that declare one are auto-inspected by the editor's ZodForm; clips that
  omit it surface a "no schema" notice in the inspector. Non-breaking:
  existing runtimes compile and register unchanged. Phase 7 agent tool
  plumbing will consume the same field without a further contract bump.
- 49d4533: T-131a — optional `themeSlots?: Readonly<Record<string, ThemeSlot>>` on
  `ClipDefinition` plus a new `resolveClipDefaultsForTheme(clip, theme, props)`
  helper. A clip declares which of its props pull defaults from the document
  theme; the helper fills any prop whose value is `undefined` with the
  theme's value for that slot, leaving explicit values untouched. Slot
  flavours: `palette` (named role on `Theme.palette`) and `token` (dotted
  path on `Theme.tokens`). Non-breaking: existing runtimes compile and
  register unchanged; clips without `themeSlots` short-circuit by reference.
- 36d0c5d: T-227: make the Phase-10 publish targets shippable via Changesets.
  - Renames the CLI's workspace name from `@stageflip/app-cli` →
    `@stageflip/cli` (the plan's publishable name).
  - Drops `"private": true` from the 11 packages in the publishable
    closure: the three primary targets (`@stageflip/{cli,plugin,mcp-server}`)
    plus their transitive deps (`@stageflip/{engine,llm-abstraction,schema,
skills-core,skills-sync,validation,rir,runtimes-contract}`).
  - Adds `"publishConfig": { "access": "public" }`, `"license":
"BUSL-1.1"`, `"repository"`, and `"homepage"` metadata to each
    publishable package. Primary targets also get a `"description"`
    visible on npmjs.com.
  - Copies the root `LICENSE` into each publishable package dir so
    tarballs carry the license even outside the monorepo.
  - Flips `.changeset/config.json`'s `access` from `"restricted"` to
    `"public"`.
  - Adds `.github/workflows/release.yml` — Changesets-driven: opens a
    "Version Packages" PR when changesets land on main; `pnpm publish`
    fires on merge of that PR iff `NPM_TOKEN` is configured.

  Actual publishing is opt-in via the NPM_TOKEN secret; this PR does
  NOT run `changeset publish`.

### Patch Changes

- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/schema@0.1.0
