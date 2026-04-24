# StageFlip — Instructions for AI Coding Agents

**Read this file completely before taking any action in this repo.** Every agent working on StageFlip starts here. This is not marketing copy; it is the rulebook.

---

## 1. What You Are Working On

StageFlip is an AI-native motion platform with three products (slide, video, display) sharing one engine. Architecture overview: `docs/architecture.md`. Full implementation plan: `docs/implementation-plan.md`.

**Your job is implementing one task from the plan.** Tasks are identified as `T-XXX`. You work autonomously; a human ratifies only at phase boundaries.

---

## 2. Three-Agent Workflow

Every task flows through three roles. You are always exactly one of:

| Role | Does |
|---|---|
| **Implementer** | Reads task spec + skills → writes code + tests → opens PR |
| **Reviewer** | Reads PR + same skills → approves or requests specific changes |
| **Verifier** | Runs CI + parity harness → reports pass/fail |

**Different agent instances for each role.** The Implementer never reviews their own PR.

---

## 3. Hard Rules — Do Not Violate

### Imports

- **Never** import from `remotion` or `@remotion/*`. CI gate: `pnpm check-remotion-imports`. Zero matches required.
- **Never** add a dependency with a license outside the whitelist in `THIRD_PARTY.md`. CI gate: `pnpm check-licenses`.

### Determinism (in clip + runtime code only)

Inside `packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`, and `packages/renderer-core/src/clips/**`, you may not use:

- `Date.now()`, `new Date()` (without arg), `Date()`
- `performance.now()`
- `Math.random()`
- `fetch()`, `XMLHttpRequest`, `navigator.sendBeacon`
- `setTimeout`, `setInterval` (use frame-scheduled alternatives)
- `requestAnimationFrame`, `cancelAnimationFrame` (the determinism shim overrides these; you shouldn't call them directly)
- `new Worker()`, `SharedWorker`

CI gate: `pnpm check-determinism`. Violations block merge.

If you genuinely need one of these (rare), use `// determinism-safe: <reason>` on the exact line and link the reviewing ADR.

### Code hygiene

- TypeScript strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`. No `@ts-ignore` without a comment explaining why.
- Biome formatting. Run `pnpm lint:fix` before committing.
- No `console.log` outside `scripts/**` or explicitly-scoped debug modules.
- No default exports except Next.js pages.
- No commented-out code.
- No `// TODO` without a linked issue.

### File headers

Every new source file begins with a one-line header naming the file and its purpose:

```typescript
// packages/schema/src/elements/text.ts
// Text element schema — discriminated variant of CanonicalElement.
```

### Tests first

Write tests that match the acceptance criteria before writing implementation. Tests fail first; implementation makes them pass. This is the workflow, not a style preference.

---

## 4. Before You Start a Task

1. Read `docs/architecture.md` (every time? No — but whenever you haven't in a while).
2. Read the task spec in `docs/implementation-plan.md`.
3. Read every SKILL.md file listed in the task's "Context / References".
4. Read every file listed in "Existing files to study".
5. Verify dependency tasks (T-YYY) are merged to `main`.
6. Create a branch: `task/T-XXX-<short-slug>`.

---

## 5. Skills are Source of Truth

Every concept, mode, runtime, tool category, workflow, and reference has a SKILL.md. The skill tree at `skills/stageflip/` is:

- The documentation for humans
- The context for agents
- The content of the Claude plugin

If code and a skill file disagree, one of them is wrong. Fix the truth; never "just update the skill." If you change behavior, update the skill in the same PR.

`pnpm check-skill-drift` enforces this.

---

## 6. Escalation

You are autonomous, not reckless. Escalate to the Orchestrator (post to the task issue) when:

- You're blocked for >2 hours on unclear spec. Do not guess architecture.
- You and the Reviewer disagree after two revision cycles.
- Time exceeds 3× the task's estimate.
- You discover an architectural question not covered by existing skills.
- A license issue appears mid-implementation.
- A task's acceptance criteria conflict with an invariant.
- Implementer and Reviewer disagree on whether a preset matches its compass source and reference-frame parity does not resolve it. Escalate with both candidate frames and both interpretations; Orchestrator approves or routes to the user.
- Type-design consultant returns "no adequate fallback" for a bespoke font referenced by a preset in clusters A/B/D/F/G (see ADR-004 §D4).

Say exactly what's blocking you. Propose options. Wait.

Do not silently descope, do not invent a workaround that violates invariants, do not "just ship it" past Reviewer concerns.

---

## 7. Reference Code

`reference/` is gitignored local-only code for architectural study:

- `reference/slidemotion/` — our predecessor. IP we own. Read freely. Port components during Phase 6 via fresh implementation, not copy-paste.
- `reference/hyperframes/` — Apache 2.0. Read for architecture. Vendor specific parts in `packages/renderer-cdp/vendor/` with NOTICE preserved (Phase 4 only).

**Remotion is not in `reference/`.** Do not download or import Remotion. If you need to understand what Remotion does, read https://remotion.dev/docs and cite the URL in your PR description. Implementation is fresh from public API spec.

---

## 8. Quality Gates (Every PR)

CI runs all of these. All must pass before merge:

```
pnpm typecheck             # TS strict
pnpm lint                  # Biome
pnpm test                  # Vitest, ≥85% coverage on changed code
pnpm check-licenses        # whitelist only
pnpm check-remotion-imports # zero matches
pnpm check-determinism     # ESLint scoped rule
pnpm check-skill-drift     # skills ↔ source
pnpm size-limit            # bundle budgets (if applicable)
pnpm parity                # PSNR + SSIM on fixtures (if rendering touched)
```

Plus: PR template checklist complete, every box checked with reviewer confirmation.

---

## 9. Commit Messages

Conventional Commits:

```
feat(schema): add VideoContent discriminated type (T-022)
fix(frame-runtime): handle frame=0 edge case in interpolate (T-041)
chore(deps): bump vitest to 3.0 (ADR-007)
```

PR titles: `[T-XXX] <short description>`.

Every PR touching a publishable package needs a `.changeset/*.md` file.

---

## 10. Where Things Go

| Adding… | Goes in |
|---|---|
| New agent tool | Handler in `packages/engine/src/handlers/<category>/` + registry update + `skills/stageflip/tools/<category>/SKILL.md` |
| New clip | `packages/runtimes/<runtime-kind>/src/clips/<clip-name>/` + registry + parity fixture + skill update |
| New runtime | `packages/runtimes/<new-kind>/` implementing `@stageflip/runtimes/contract` + skill |
| New element type | `packages/schema/src/elements/<name>.ts` + Zod schema + RIR compiler update + renderer-core dispatcher + skill |
| New export target | `packages/export-<format>/` + profile registration + skill |
| New semantic tool category | Handler bundle in `packages/engine/` + tool-router registration + skill |
| New mode | `packages/profiles/<name>/` + app scaffold in `apps/stageflip-<name>/` + profile skills |
| New keyboard shortcut | Register via `useRegisterShortcuts` in `packages/editor-shell` — never raw `addEventListener('keydown', ...)` |
| Translated UI string | `apps/<app>/src/i18n/catalog.ts` + `t('key')` at use site — never bare string literals |

---

## 11. The Implementer's Checklist (Use Literally)

Before opening a PR:

- [ ] Read all SKILL.md files cited in the task.
- [ ] Tests written first and failing before implementation.
- [ ] Implementation makes tests pass.
- [ ] `pnpm typecheck` green in affected packages.
- [ ] `pnpm lint` green.
- [ ] `pnpm test` green with coverage ≥85% on changed files.
- [ ] `pnpm check-licenses` green.
- [ ] `pnpm check-remotion-imports` green.
- [ ] `pnpm check-determinism` green.
- [ ] `pnpm check-skill-drift` green.
- [ ] Parity harness green if rendering affected.
- [ ] File headers present on every new file.
- [ ] TSDoc comments on every new public function.
- [ ] PR template filled completely — no unchecked boxes.
- [ ] Changeset included if publishable package touched.
- [ ] Branch name `task/T-XXX-<slug>`.

---

## 12. Tone

Be terse. Your outputs are read by other agents and by humans ratifying phases. No marketing language. No "I believe…" / "I think…". State facts, cite skills, ship code.

If you catch yourself writing `// This comprehensively handles edge cases to ensure robust behavior` — delete it. The code either handles them (verified by tests) or doesn't (add more tests).

---

**Start at the task spec in `docs/implementation-plan.md`. Good luck.**
