# ADR-002: Phase 0 Toolchain Ratification

**Date**: 2026-04-20
**Ratified**: 2026-04-20
**Status**: **Accepted**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

ADR-001 locked the license (BSL 1.1) and the Node LTS target (Node 22) and set up the dependency-audit process. It did **not** explicitly ratify the specific *tools* chosen in `docs/architecture.md` § 4 — package manager, monorepo orchestrator, test runners, E2E, linter/formatter. Those choices were made in the architecture doc and materialized by T-001 through T-016. This ADR closes that loop so the log tells a complete Phase 0 story and future deviations require their own ADRs rather than slipping in through "well, the architecture doc says…".

Scope: only tools installed during Phase 0. Runtime libraries (Zod, React, etc.) are governed by `docs/dependencies.md` and individual feature ADRs (e.g. ADR for a Zod 4 bump).

## Options Considered & Decisions

### D1. Package manager → **pnpm 9.x**

**Alternatives**: npm 10, Yarn 4 (Berry), Bun.

**Why pnpm**:
- Workspace-native; no need for Lerna/Nx-on-top.
- Content-addressable store → fast installs + minimal disk use across the 51 workspaces.
- Strict peer-dep handling that matches the "no silent dep drift" discipline in ADR-001 §D.
- Excellent `--frozen-lockfile` story; CI fails on drift without extra tooling.

**Not Yarn Berry**: Plug'n'Play adds a significant friction layer with tsup, tsx, Playwright that pnpm's node_modules layout does not.
**Not Bun**: immature for long-term deterministic CI at the time of Phase 0.

Install path via Corepack; pinned to 9.15.0 in root `packageManager` and `.nvmrc`-adjacent tooling.

### D2. Monorepo orchestrator → **Turborepo 2.x**

**Alternatives**: Nx, Moon, Lerna (deprecated), Bazel.

**Why Turborepo**:
- Fits one-config-per-task model cleanly; no plugin ecosystem to adopt.
- Works well with pnpm workspace out of the box.
- Remote cache is optional but available when CI run times demand it.
- `tasks` config (v2 schema) is declarative and easy for reviewers to audit.

**Not Nx**: heavier; its plugin-per-framework model is overkill for our few tool kinds.
**Not Bazel**: massive buy-in cost; no pragmatic TypeScript + Vite + Next.js story at our scale.

### D3. Unit test runner → **Vitest 2.x**

**Alternatives**: Jest, Node's built-in test runner, Mocha.

**Why Vitest**:
- ESM-native; no Babel dance to run TS-as-ESM.
- Same matchers API as Jest; migration from Jest projects is painless.
- Built-in coverage via v8; fast re-runs via Vite HMR.
- First-class support for `vitest.workspace.ts` matching our monorepo shape.
- Property-based testing via `fast-check` integrates cleanly (needed by T-048).

Coverage thresholds: 85% lines/functions/statements, 80% branches (T-004).

### D4. E2E runner → **Playwright 1.x**

**Alternatives**: Cypress, Puppeteer + Jest, Selenium.

**Why Playwright**:
- Multi-browser from one API (Chromium, Firefox, WebKit). We ship Chromium in Phase 0; the other engines are a one-line addition.
- Trace viewer and screenshot-on-failure built in.
- Deterministic auto-waiting; less flake than Cypress's retry model.
- CI-friendly container images; `playwright install --with-deps` works unattended.

**Not Cypress**: weaker multi-browser; licensing + dashboard coupling pushes us toward a vendor.
**Not Puppeteer**: is a driver, not a test framework. We use Puppeteer elsewhere (vendored CDP engine, Phase 4) but not as the test runner.

### D5. Linter + formatter → **Biome 1.9.x**

**Alternatives**: ESLint + Prettier, oxc, dprint.

**Why Biome**:
- One tool, one config. Former ESLint + Prettier setup means two config files, two parsers, two plugin ecosystems.
- Fast (Rust). At our 50+ workspace scale, linter speed matters.
- Ships an `organizeImports` rule; replaces eslint-plugin-import for our needs.
- Biome 2.x exists (major bump) but the 1.9 schema is stable; a future ADR will ratify any bump.

**Determinism gate caveat** (T-028, Phase 1): Biome does not have a "scoped API-forbidden" rule that covers our invariant I-2 needs. We will use a narrow custom ESLint plugin *only* for the `check-determinism` gate, scoped to the runtime/clip directories. That doesn't reopen the Biome decision for general-purpose linting.

### D6. TS bundler → **tsup 8.x**

**Alternatives**: esbuild directly, Rollup, tsc (emit-only), Parcel.

**Why tsup**:
- Thin wrapper on esbuild + rollup-plugin-dts; gets us ESM + CJS + `.d.ts` from one CLI invocation.
- Zero config for the common case; per-package CLI args in `package.json scripts` stay readable.
- Handles CJS interop well (gray-matter is CJS; tsup's ESM output imports it correctly).

### D7. Versioning → **Changesets 2.x**

**Alternatives**: semantic-release, manual SemVer, Lerna version.

**Why Changesets**:
- Per-PR changeset files are reviewable at PR time; versioning is not mystery meat that happens in CI.
- Workspace-aware; understands pnpm graph and bumps dependants correctly.
- `access: restricted` is a first-class config, matching our BSL posture.

### D8. CI → **GitHub Actions**

**Alternatives**: CircleCI, Buildkite, self-hosted Jenkins.

**Why GitHub Actions**:
- Free minutes for public repos; billed per-minute for private.
- Native `pnpm/action-setup` + `actions/setup-node` integration; no extra CI-side tooling.
- Artifacts and logs accessible in the PR UI without extra dashboards.
- Dependabot ships as a first-party feature.

---

## Consequences

- Phase 0 toolchain is **ratified**. Deviations require a new ADR and must not slip in through "well, the architecture doc says…".
- Each tool is pinned to a specific version in `docs/dependencies.md` (Audit 0, 2026-04-20). Bumping pinned majors still requires a dedicated ADR per ADR-001.
- Adding a *new* tool category (e.g. a dedicated API-contract linter) is an ADR; adding a *new tool under an existing category* (a single new Biome plugin, a new Vitest reporter) is not.
- ADR log now covers both license + Node (ADR-001) and the full Phase 0 toolchain (this ADR). Phase 1+ can reference these without re-litigating them.

## Ratification Signoff

- [x] Product owner — ratified 2026-04-20 alongside the Phase 0 closeout review
- [x] Engineering — toolchain validated through green `pnpm install && pnpm build && pnpm test` plus every A.6 gate that belongs to Phase 0

## References

- ADR-001 — license + Node LTS + dep whitelist
- `docs/architecture.md` § 4 (stack) and § 13 (quality gates)
- `docs/dependencies.md` §§ 3–4 (pinned versions + Audit 0)
- `CLAUDE.md` §§ 3, 8 (hard rules + quality gates)
- T-001 through T-016 (the tasks that materialized this ADR)
