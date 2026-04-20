# StageFlip

AI-native motion platform. One engine, three products:

- **StageFlip.Slide** — presentations (PPTX / PDF / video walkthrough)
- **StageFlip.Video** — video ads and social video (MP4 / MOV / WebM)
- **StageFlip.Display** — HTML5 display ads (IAB / GDN compliant)

Five surfaces backed by one core: **web editors**, **CLI**, **Claude plugin**, **MCP server**, **public REST API**.

## Status

Project initialized. Phase 0 (Bootstrap) has not started.

## Orientation

New to the project? Read these in order:

1. [`docs/architecture.md`](docs/architecture.md) — system design, invariants, stack choices
2. [`docs/user-manual.md`](docs/user-manual.md) — how StageFlip is meant to be used
3. [`docs/implementation-plan.md`](docs/implementation-plan.md) — 270+ tasks across 12 phases
4. [`CLAUDE.md`](CLAUDE.md) — conventions for AI coding agents working in this repo
5. [`THIRD_PARTY.md`](THIRD_PARTY.md) — attributions and license posture

## Kickoff

Phase 0 Task T-001 starts the monorepo scaffold. See `docs/implementation-plan.md` § Phase 0.

## License

See [`LICENSE`](LICENSE). (Decision pending — tracked in `docs/decisions/ADR-001-initial-stack.md`.)

## Reference Code

`reference/` is a read-only mirror of prior work studied during architecture design:
- `reference/slidemotion/` — our prior iteration (StageFlip's predecessor)
- `reference/hyperframes/` — Apache 2.0, studied for runtime architecture; specific parts vendored in Phase 4

**Remotion is deliberately not included.** See `docs/architecture.md` § 14 for license posture.
