# StageFlip

AI-native motion platform. One engine, three products:

- **StageFlip.Slide** — presentations (PPTX / PDF / video walkthrough)
- **StageFlip.Video** — video ads and social video (MP4 / MOV / WebM)
- **StageFlip.Display** — HTML5 display ads (IAB / GDN compliant)

Five surfaces backed by one core: **web editors**, **CLI**, **Claude plugin**, **MCP server**, **public REST API**.

## Status

**Phase 1 (Schema + RIR + Determinism) ratified 2026-04-20.** Phase 2 (Frame Runtime) is in progress. Firebase storage (T-035–T-039) is deferred to a dedicated infra pass; it does not block Phase 2.

What works today:

- **47 test tasks, 181+ passing cases** across the workspace
- **`@stageflip/schema`** (92 tests): 11 discriminated element types, 3 content modes, animations + timing B1–B5, migration framework, property-based round-trip
- **`@stageflip/rir`** (36 tests): 4 T-030 passes + T-031 timing-flatten/stacking + 9 golden fixtures; deterministic digest
- **`@stageflip/storage`** (23 tests): 3-method contract + dev-grade in-memory adapter with bounded-buffer fan-out
- **`@stageflip/determinism`** (14 tests): runtime shim intercepting 9 non-deterministic APIs + `check-determinism` source-lint gate
- **`@stageflip/skills-core`** (14 tests) + **`@stageflip/skills-sync`**: skill tree parsing, validation, and the first auto-generated reference (schema)
- **CI gates (all green)**: typecheck, lint, test, build, `check-licenses`, `check-remotion-imports`, `check-skill-drift`, `check-determinism`, `skills-sync:check`, Playwright smoke, weekly audit

Still to come: frame-runtime (Phase 2), ClipRuntime contract + live runtimes (Phase 3), CDP export (Phase 4), parity harness (Phase 5), per-mode apps (Phases 6/8/9), agent (Phase 7), MCP + plugin (Phase 10), importers (Phase 11), collab + hardening (Phase 12).

## Quickstart

```sh
# 1. Enable pnpm via corepack (one-time per machine)
corepack enable
corepack prepare pnpm@9.15.0 --activate

# 2. Install and verify everything is green
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm check-licenses && pnpm check-remotion-imports && pnpm check-skill-drift

# 3. (Optional) Download Chromium for Playwright smoke tests
pnpm e2e:install
pnpm e2e
```

If `corepack enable` needs sudo on your machine, see [CONTRIBUTING.md](CONTRIBUTING.md) § Local dev setup.

## Orientation

New to the project? Read these in order:

1. [`CLAUDE.md`](CLAUDE.md) — conventions for AI coding agents working in this repo
2. [`docs/architecture.md`](docs/architecture.md) — system design, invariants, stack choices
3. [`docs/user-manual.md`](docs/user-manual.md) — how StageFlip is meant to be used
4. [`docs/implementation-plan.md`](docs/implementation-plan.md) — 280+ tasks across 12 phases
5. [`docs/dependencies.md`](docs/dependencies.md) — locked versions and the blocked-majors policy
6. [`THIRD_PARTY.md`](THIRD_PARTY.md) — attributions and license posture
7. [`skills/stageflip/concepts/`](skills/stageflip/concepts/) — canonical concept skills (source of truth per CLAUDE.md §5)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local dev setup, the three-agent workflow, and how to run gates before opening a PR.

## License

[BSL 1.1](LICENSE), converting to Apache License 2.0 on **2030-05-18**. See [ADR-001](docs/decisions/ADR-001-initial-stack.md).

## Reference Code

`reference/` is a read-only mirror of prior work studied during architecture design. Gitignored; not shipped. See [`reference/README.md`](reference/README.md) for how to populate it.

**Remotion is deliberately not included.** See [`docs/architecture.md`](docs/architecture.md) § 14 for license posture.
