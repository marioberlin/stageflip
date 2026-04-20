# StageFlip

AI-native motion platform. One engine, three products:

- **StageFlip.Slide** — presentations (PPTX / PDF / video walkthrough)
- **StageFlip.Video** — video ads and social video (MP4 / MOV / WebM)
- **StageFlip.Display** — HTML5 display ads (IAB / GDN compliant)

Five surfaces backed by one core: **web editors**, **CLI**, **Claude plugin**, **MCP server**, **public REST API**.

## Status

**Phase 0 (Bootstrap) complete** — awaiting human ratification. Phase 1 (Schema + RIR + Determinism) is the next batch.

What works today:

- 51-member pnpm + Turborepo workspace on Node 22 / TypeScript 5.6 strict
- Every hard quality gate that can run pre-Phase-1 is wired:
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e`, `pnpm check-licenses`, `pnpm check-remotion-imports`, `pnpm check-skill-drift`
- GitHub Actions enforces all of the above on every PR (`.github/workflows/ci.yml`); weekly `pnpm audit` + license recheck (`.github/workflows/audit.yml`)
- 57 `SKILL.md` files (17 substantive concepts + 40 placeholders)
- 13 per-phase PR templates
- Changesets for publishable packages; BSL 1.1 license (converts to Apache 2.0 on 2030-05-18 per [ADR-001](docs/decisions/ADR-001-initial-stack.md))

Not yet wired (owned by later tasks): `check-determinism` (T-028), size-limit budgets (T-049+), parity harness (T-100+), Vercel previews (T-017 deferred).

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
