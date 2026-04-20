# Contributing to StageFlip

This guide covers local dev setup, the three-agent workflow, and the checks that every PR must pass.

## 1. Local dev setup

### Toolchain

| Tool | Version | How to install |
|---|---|---|
| Node | 22.x LTS | `nvm install 22` / `fnm use` (`.nvmrc` present) |
| pnpm | 9.15.0 | `corepack enable && corepack prepare pnpm@9.15.0 --activate` |
| git | recent | — |

### corepack permissions

`corepack enable` creates a symlink in a system directory. On macOS with Homebrew Node this often needs sudo:

```sh
sudo corepack enable
corepack prepare pnpm@9.15.0 --activate
```

If you cannot sudo, create a user-local shim instead:

```sh
mkdir -p ~/.local/bin
cat > ~/.local/bin/pnpm <<'EOS'
#!/usr/bin/env bash
exec corepack pnpm "$@"
EOS
chmod +x ~/.local/bin/pnpm
export PATH="$HOME/.local/bin:$PATH"   # add to your shell rc file
```

Turbo invokes `pnpm` from `$PATH`; the shim satisfies that without sudo.

### Install and verify

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm check-licenses && pnpm check-remotion-imports && pnpm check-skill-drift
```

For E2E tests:

```sh
pnpm e2e:install   # one-time; downloads Chromium (~150 MB)
pnpm e2e
```

## 2. How work gets done — the three-agent workflow

See `CLAUDE.md` § 2 and `docs/implementation-plan.md` § A for the full story. In short:

| Role | Does |
|---|---|
| Implementer | Writes code + tests; opens PR |
| Reviewer | Checks against cited skills; approves or lists required changes |
| Verifier | Runs CI + parity harness; reports pass/fail |

Different agent instances for each role. Never review your own PR.

## 3. Branch and commit conventions

- **Branches:** `task/T-XXX-<short-slug>`. Closeout PRs without a task ID use `chore/<slug>`.
- **Commits:** Conventional Commits — `feat(schema): …`, `fix(frame-runtime): …`, `chore(deps): …`, `docs(skills): …`.
- **PR titles:** `[T-XXX] <short description>`.
- **File headers:** every new source file begins with a one-line comment naming the file and its purpose (see CLAUDE.md § 3).

## 4. Before opening a PR

Use `.github/pr-templates/phase-{N}.md` for the task's phase and fill it in. At minimum:

```sh
pnpm typecheck
pnpm lint            # or: pnpm exec biome check --write .
pnpm test            # ≥85% coverage on changed files
pnpm build
pnpm check-licenses
pnpm check-remotion-imports
pnpm check-skill-drift
pnpm e2e             # if you touched anything a Playwright test exercises
```

## 5. Changesets — when and how

Every PR that modifies a publishable package needs a changeset. See `.changeset/README.md` for the detailed rules.

```sh
pnpm changeset     # walks you through selecting packages + bump type + summary
```

Apps (`apps/stageflip-slide`, `apps/stageflip-video`, `apps/stageflip-display`, `apps/api`, `apps/dev-harness`) are not published and do not need changesets. `apps/cli` is published (T-227) and does.

## 6. Dependencies

`docs/dependencies.md` is the source of truth. Before bumping **anything**, check § 4 (Audit History) for blocked majors. Major bumps require an ADR; patch/minor bumps within the allowed range are fine with a `chore(deps)` commit and green gates.

`pnpm install --frozen-lockfile` is the CI install mode; use it locally too. Silent `pnpm install` may drift the lockfile in ways CI will reject.

## 7. Workspace layout note

| Path | Owned by | Scaffold state |
|---|---|---|
| `packages/**` | 44 library packages | Full scaffold (tsconfig, tsup build, vitest test) |
| `apps/**` | 6 Next.js / service / CLI apps | Stubs only — Phase 6/8/9/10 own per-app scaffolding |
| `skills/stageflip/**` | 57 `SKILL.md` files | 17 substantive concepts + 40 placeholders |
| `scripts/**` | CI gate scripts | tsx-run TS with node:fs APIs |
| `tests/**` | E2E + parity fixtures | Playwright smoke only; parity fixtures arrive Phase 5 |

Package naming convention:

- Flat top-level: `@stageflip/schema`, `@stageflip/engine`, `@stageflip/skills-core`, …
- Nested under `packages/runtimes/`: `@stageflip/runtimes-<kind>` (e.g. `@stageflip/runtimes-css`)
- Nested under `packages/profiles/`: `@stageflip/profiles-<kind>` (e.g. `@stageflip/profiles-slide`)

Docs sometimes refer to the nested kind with a slash (`@stageflip/runtimes/contract`); that is conceptual shorthand. The actual package name uses a dash.

## 8. Reference codebases

`reference/` is gitignored and local-only. To populate it:

```sh
git clone <url-of-slidemotion-predecessor> reference/slidemotion
git clone https://github.com/heygen-com/hyperframes.git reference/hyperframes
```

Treat `reference/` as read-only for architectural study. Do not copy code out of it; see `CLAUDE.md` § 7 for the rules.

## 9. Getting unstuck

If you're blocked for more than two hours on unclear spec:

- Post on the task issue with exactly what's blocking you, options you considered, and your recommendation.
- Do **not** guess at architectural decisions or invent workarounds that violate invariants.
- See `CLAUDE.md` § 6 for the full escalation contract.
