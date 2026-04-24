# ADR-004: Preset System

**Date**: 2026-04-25
**Ratified**: 2026-04-25
**Status**: **Accepted**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

Phase 13 introduces a premium clip library drawn from the compass canon of iconic motion-graphic overlays (CNN, BBC, F1, MrBeast, Hormozi, Stranger Things, NHC hurricane cone, and ~45 others). The library is one of the three strategic bets for the phase; see session discussion 2026-04-24.

A clip already has typed parameters (e.g., `lowerThird` takes `name`, `title`, `accentColor`, `position`). What the compass doc adds is **taste rules** on top of those parameters — specific token values, animation curves, and composition conventions that encode what "CNN lower-third" or "Hormozi caption" actually mean. Shipping these as one-off clips would duplicate implementation per preset; shipping them as parameter presets only would lose the rule layer (e.g., "CNN uses red-block-wipe for text change, never crossfade").

The forces at play:
- **Taste as a first-class artifact.** Preset rules must be readable by agents so semantic tools route correctly. Scattering them across commit messages or implementation files defeats the skill-tree invariant (§5).
- **Font licensing.** Bespoke broadcaster fonts (CNN Sans, BBC Reith, Premier Sans, Formula1 Display, Netflix Sans) cannot be redistributed. Presets must ship with license-cleared fallbacks and a BYO slot.
- **Parity fidelity.** "Premium" must mean PSNR-locked — the CNN preset renders bit-identically every build. Without a parity fixture per preset, the library is cosmetic.
- **Three-agent workflow.** Implementer / Reviewer disputes on "is this CNN enough?" must resolve mechanically, not by taste argument.

---

## Options Considered

### Preset representation

1. **One SKILL.md per preset** with YAML frontmatter + compass-distilled body.
   - *Pros*: Agent-readable; fits the skill tree; `check-skill-drift` covers it.
   - *Cons*: Scales to ~50 files; requires a loader.

2. **Single JSON catalog** with all presets keyed by id.
   - *Pros*: One file; easy programmatic access.
   - *Cons*: Unreadable by agents at scale; loses the "skills as source of truth" discipline.

3. **Presets in code** (TypeScript modules).
   - *Pros*: Typed by construction.
   - *Cons*: Taste rules become code comments; reviewer can't compare to compass doc cleanly.

### Font-license policy

1. **Ship bespoke fonts.** Rejected — broadcaster fonts are proprietary.
2. **BYO-only** — the preset references the bespoke name; customers bring their own license.
   - *Pros*: Zero licensing risk for us.
   - *Cons*: OSS / prospect users see a broken preset.
3. **BYO + license-cleared fallback** — preset declares both.
   - *Pros*: Always renders; upgradeable by licensed customers.
   - *Cons*: Fallback quality is a design exercise per cluster.

### Parity-fixture authority

1. **Implementer sets the golden frame.**
2. **Reviewer signs off on the golden frame.**
3. **User (product owner) signs off per cluster batch.**

---

## Decisions

### D1. Preset = SKILL.md file with frontmatter + body

Presets live at `skills/stageflip/presets/{cluster}/{preset-id}.md`. The frontmatter is machine-readable and drives the preset loader at `packages/schema/src/presets/`. The body is the compass-distilled rule set (tokens, typography, animation, rules, acceptance).

Required frontmatter fields:

```yaml
id: <slug>
cluster: <news|sports|weather|titles|data|captions|ctas|ar>
clipKind: <canonical clip kind>
source: <path or URL into the compass canon>
status: <stub|substantive>
preferredFont:
  family: <string>
  license: <ofl|proprietary-byo|public-domain>
fallbackFont:
  family: <string>
  weight: <number>
  license: <ofl|apache-2.0|mit|…>
permissions: []    # if the preset composes an interactive clip
signOff:
  parityFixture: <pending-user-review|signed:YYYY-MM-DD|na>
  typeDesign: <pending-cluster-batch|signed:YYYY-MM-DD|na>
```

The body follows a fixed section order: Visual tokens → Typography → Animation → Rules → Acceptance (parity) → References.

### D2. Co-located cluster skills

Each cluster ships a `SKILL.md` **co-located with its presets**:

```
skills/stageflip/presets/news/SKILL.md          ← cluster skill
skills/stageflip/presets/news/cnn-classic.md    ← preset
skills/stageflip/presets/news/bbc-reith-dark.md ← preset
…
```

The cluster skill declares: when to invoke, what presets exist, what semantic tools the cluster exposes, cluster-wide conventions from the compass (e.g., "red = urgent, never neutral update"), and escalation rules.

No separate `clusters/` directory. Co-location makes the cluster glob cleanly and reduces top-level sprawl.

### D3. Font-license registry

A font-license registry lives at `packages/schema/src/presets/font-registry.ts`. It enumerates every font referenced across presets, its license, and (for proprietary-byo entries) the approved license-cleared fallback. `check-licenses` is extended to validate that every preset's `fallbackFont.license` is in the whitelist from ADR-001 §D4.

### D4. Type-design consultant — one batch per cluster

Clusters A (news), B (sports), D (titles), F (captions), and G (CTAs) contain presets that cite bespoke fonts. For each of those clusters, a single batch review by the type-design-consultant agent (see `skills/stageflip/agents/type-design-consultant/SKILL.md`) approves every fallback choice in the cluster. Preset PRs in those clusters must link to the batch review; PRs without a link fail `check-preset-integrity`.

Clusters C (weather), E (data), and H (AR) do not cite bespoke fonts at a cluster-wide level; individual presets in those clusters that reference bespoke type escalate to a one-off review.

### D5. Parity-fixture sign-off — user, per cluster

Every preset ships a parity fixture (reference frame) before its PR merges. Fixtures are **auto-generated** by the first clean render of the preset's canonical configuration and reviewed for sign-off.

Sign-off authority: the product owner (human user), per cluster batch. A cluster is eligible to merge when its full preset set has signed-off fixtures. This supersedes the normal Reviewer-approves pattern for fixtures specifically.

Regeneration of a signed-off fixture (because the preset's rules change) requires a minor ADR amendment citing the trigger.

### D6. New CI gate: `check-preset-integrity`

`scripts/check-preset-integrity.ts` validates:

1. Every preset has valid frontmatter.
2. Every preset's `clipKind` exists in the clip registry.
3. Every preset referencing a bespoke font has `fallbackFont` populated.
4. Every preset in an interactive clip has a non-empty `staticFallback` (handoff to ADR-003 §D2).
5. Every preset in Clusters A/B/D/F/G has `signOff.typeDesign` populated.
6. Every preset has `signOff.parityFixture` populated before cluster merge.
7. Every preset's `source` resolves to a real anchor in the compass file.

Gate fails block the PR.

### D7. Compass interpretation disputes escalate to user

When Implementer and Reviewer disagree on whether a preset matches its compass source and reference-frame parity does not resolve the dispute, escalate per CLAUDE.md §6 (amended; see the §6 patch in this phase). The product owner approves or routes.

---

## Consequences

### Immediate (Phase α of Phase 13)

- `packages/schema/src/presets/` lands with the loader, validator, and font registry (T-304).
- `check-preset-integrity` gate green on main before any preset PRs (T-308).
- `skills/stageflip/presets/` directory structure scaffolded with the 8 cluster skills and 50 preset stubs (T-315–T-382 per the plan patch).

### Ongoing

- Every new preset → new skill file + parity fixture + (if bespoke font) inclusion in the cluster's batch review.
- Every preset change that affects the rendered frame → regenerate the fixture + re-sign-off.
- Changes to bespoke-font fallback recommendations → new batch review + mass PR across the cluster's presets.

### Risks

- **Fallback quality.** A weak fallback makes the preset feel like a knock-off. Mitigation: type-design-consultant agent with explicit quality thresholds; escalate if no adequate fallback exists.
- **Parity-fixture scale.** 50 presets × multiple sizes × multiple variations is low-thousands of golden frames. Mitigation: auto-generation pipeline; user sign-off at cluster granularity, not per fixture.
- **Skill drift.** 50 new files in the tree. Mitigation: extended `check-skill-drift` covers presets.

---

## References

- ADR-001 §D4 (dependency license whitelist — applied to fonts)
- ADR-003 (Interactive runtime tier — defines `staticFallback` which presets may reference)
- ADR-005 (Frontier clip catalogue — interactive presets intersect both ADRs)
- CLAUDE.md §5 (Skills as source of truth) and §6 (Escalation, amended in Phase 13 scaffold)
- Compass canon: file authored 2026-04-24, committed under `docs/` (Phase 13 scaffold)
- Phase 13 task block: T-302 (this ADR), T-304 (preset schema primitive), T-307 (font registry), T-308 (`check-preset-integrity`), T-314–T-379 (cluster build-out), T-380–T-382 (parity + type-design closures)

---

## Ratification Signoff

- [x] Product owner (Mario Tiedemann) — ADR decisions ratified 2026-04-25
- [x] Product owner — parity-fixture sign-off authority (D5) accepted 2026-04-25
- [ ] Engineering — preset schema + loader + registry green (deferred to T-304 implementation)
- [ ] Engineering — `check-preset-integrity` gate green on main (deferred to T-308 implementation)
