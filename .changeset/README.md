# Changesets — StageFlip conventions

We use [changesets](https://github.com/changesets/changesets) to version and
publish packages in this monorepo. Every PR that modifies a publishable package
**must** include a changeset file.

## When a changeset is required

Required:

- Any change to `packages/**` that is externally observable (API change, bugfix,
  new feature, behavior change).
- Any runtime-dep bump within a package (even patch).

Not required:

- Changes confined to `apps/**` that are not published (Next.js web apps,
  `dev-harness`, internal `api` service).
- Changes to `docs/`, `skills/stageflip/` content that is not auto-generated,
  `.github/`, scripts that aren't shipped.
- Changes to test fixtures or parity goldens.

If a package has `"private": true` in its `package.json`, Changesets ignores it
automatically.

## How to add a changeset

```sh
corepack pnpm changeset
```

Walk through the prompts:

1. **Which packages have changed?** Select every package whose external surface
   changed. Do not select transitive-only deps.
2. **Bump type**:
   - `patch` — bug fix, doc clarification, no API change
   - `minor` — additive API surface, new feature, new option
   - `major` — breaking change; coordinate with ADR
3. **Summary** — one line. Link the task ID (e.g., `T-041`) and the PR if you
   already have a number. Write for release notes, not for reviewers.

Commit the generated `.changeset/<slug>.md` alongside your code.

## Release flow

Changesets are consumed at release time by:

```sh
corepack pnpm changeset version   # consumes all pending changesets, bumps versions, writes CHANGELOG.md
corepack pnpm -r build
corepack pnpm changeset publish   # publishes to npm using `access: restricted` (private by default)
```

Release orchestration lives in T-227 (Phase 10). Until then, `changeset version`
and `publish` are manual.

## Policy notes

- **`access: restricted`** is the default because StageFlip ships under BSL 1.1
  (ADR-001). Packages that should be public must set `"access": "public"` in
  their `package.json` `publishConfig`, and that decision should be made
  consciously per-package.
- **`baseBranch: main`** — changesets are always diffed against `main`.
- **`updateInternalDependencies: "patch"`** — when workspace packages depend on
  each other and the dependee bumps, the dependant gets a patch bump unless a
  larger bump was explicitly selected.
- **Major bumps** require an ADR linked from the changeset summary.

## References

- [Changesets docs](https://github.com/changesets/changesets)
- StageFlip release task: T-227 (Phase 10)
- License posture: [`LICENSE`](../LICENSE), [`docs/decisions/ADR-001-initial-stack.md`](../docs/decisions/ADR-001-initial-stack.md)
