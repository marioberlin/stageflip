# ADR-001: Initial Stack & License

**Date**: Project initialization
**Ratified**: 2026-04-20
**Status**: **Accepted**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

StageFlip begins as a greenfield codebase. Before any code lands we need to lock foundational decisions that are expensive to change later: the license, the Node LTS target, and the initial dependency versions. This ADR records those decisions and the process by which we arrive at them.

The forces at play:
- **Commercial strategy**: StageFlip is a product intended to be commercial. Licensing affects distribution rights, community trust, and competitive positioning.
- **Agent-executable plan**: all implementation is done by AI coding agents. They need stable, well-documented dependencies to minimize churn.
- **Determinism invariant** (I-2): rendering must be byte-identical across runs. Unstable toolchain versions threaten this.
- **Provenance discipline** (THIRD_PARTY.md): every dep is audited at inclusion; bumps require ADRs.

---

## Options Considered

### License

1. **Apache License 2.0** — fully open-source, permissive.
   - *Pros*: Maximum community adoption; clearest legal posture for third-party contributions; standard for infrastructure; matches Hyperframes (vendored code stays same-license).
   - *Cons*: No commercial moat on the source itself; competitors could fork.

2. **Business Source License 1.1 (BSL 1.1)** — source-available with competitive-use restriction; converts to Apache 2.0 after 4 years.
   - *Pros*: Preserves commercial moat during growth phase; still publishable/readable/modifiable for non-production use; auto-converts to OSS, preventing long-term vendor lock-in perception.
   - *Cons*: Not OSI-approved as "open source"; some orgs have procurement rules against source-available; third-party contributor rights are narrower; vendored Apache-2.0 code (Hyperframes engine) stays under Apache, requiring dual-license documentation.

3. **Proprietary / closed source**.
   - Rejected. Our competitive edge is architectural discipline + agent distribution, not secret algorithms. Closing source costs us community and raises the bar to zero-friction Claude-plugin adoption.

### Node LTS target

1. **Node 20 LTS** — stable, ecosystem-proven.
2. **Node 22 LTS** (active LTS) — current, with native TypeScript support gaining traction, but some deps may still lag.
3. **Latest (24+)** — too aggressive; not all deps support.

### Initial dependency versions

Per `docs/dependencies.md`, floors are set; concrete versions determined by automated `latest-stable` audit at T-001a.

---

## Decisions

### D1. License: **Business Source License 1.1**

- **Licensor**: Mario Tiedemann
- **Licensed Work**: StageFlip
- **Change Date**: 2030-05-18 (4 years from 2026-05-18)
- **Change License**: Apache License, Version 2.0
- **Additional Use Grant**: non-production use, research, and internal evaluation are permitted; production use that offers the Licensed Work to third parties on a hosted or embedded basis in competition with the Licensor's paid version(s) is not permitted before the Change Date.

Rationale for choosing BSL 1.1 over Apache 2.0:

- Protects the business during early-growth phase where a well-funded copycat could be existential
- Does not meaningfully impede community adoption for the target user (individuals and orgs using StageFlip, not forking it)
- Allows Claude plugin distribution with minimal friction (end users aren't building competing products)
- Auto-converts to OSS, resolving long-term perception concerns
- Apache-2.0 vendored code remains under Apache 2.0 within its directory; dual-license documented in `THIRD_PARTY.md`

However, the product owner may choose Apache 2.0 if:
- Community growth / contribution volume is a higher priority than moat
- Enterprise procurement friction would block meaningful customers
- A contributor agreement (CLA) can be put in place to allow later license changes if needed

With D1 ratified, T-008 (writing LICENSE) is unblocked.

### D2. Node LTS: **Node 22 LTS** (active LTS as of Phase 0)

Rationale: sufficient ecosystem support; native TypeScript execution for scripts; performance improvements over Node 20. Bump to Node 24 LTS when it enters active LTS and our deps support.

### D3. Initial dependency versions: **locked by T-001a audit**

See `docs/dependencies.md`. Values pinned at audit time; bumps require new ADRs.

### D4. License whitelist for dependencies

Permitted: MIT, Apache 2.0, BSD-2/3-Clause, ISC, 0BSD, CC0-1.0, Unlicense, BlueOak-1.0.0, Python-2.0, LGPL (dynamic link only, per-package whitelist with ADR).

Forbidden: GPL-2.0, GPL-3.0, AGPL, SSPL, Remotion License, any custom source-available with competitive-use restrictions.

Enforced by `scripts/check-licenses.ts` and CI.

### D5. Remotion is not a dependency

StageFlip does not depend on, vendor, or import Remotion. `@stageflip/frame-runtime` provides the equivalent API via clean-sheet implementation from public documentation. Enforced by `pnpm check-remotion-imports` CI gate.

### D6. Hyperframes engine is vendored under Apache 2.0

Specific parts of `@hyperframes/engine` are vendored into `packages/renderer-cdp/vendor/` with NOTICE preserved. Specific commit pinned at T-080. Modifications documented in file headers and this ADR log when they occur.

---

## Consequences

### Immediate (Phase 0)

- Product owner must ratify D1 before T-008 can complete.
- T-001a runs the version audit and populates `docs/dependencies.md`.
- `LICENSE` file is a placeholder until D1 resolves.

### Ongoing

- Every dependency bump → ADR. No silent version creep.
- Every runtime kind addition (T-060+) → ADR.
- Every vendored code addition → ADR + NOTICE update.
- Quarterly dependency audit re-confirms or revises § 3 of `docs/dependencies.md`.

### Risk if D1 is delayed

- Cannot publish anything (npm, docs site, plugin) until license is finalized.
- Agents can continue implementation in private repo state; public release blocked.

### Risk if D1 lands on BSL

- Some potential contributors may pass due to licensing.
- Dual-license accounting in `THIRD_PARTY.md` becomes a recurring hygiene task.

### Risk if D1 lands on Apache 2.0

- No source-level moat. Differentiation relies on infrastructure (render farm, artifact storage, agent orchestration) and network effects (templates, theme learning, community).

---

## References

- Task: T-008 (LICENSE), T-001a (dependency audit), T-080 (vendor Hyperframes engine)
- Skills: `skills/stageflip/concepts/determinism/SKILL.md` (I-2 enforcement)
- Files: `THIRD_PARTY.md`, `docs/dependencies.md`

---

## Ratification Signoff

- [x] Product owner (Mario Tiedemann) — license choice: **BSL 1.1** (ratified 2026-04-20)
- [x] Product owner — Node LTS target: **Node 22** (ratified 2026-04-20)
- [ ] Engineering lead — dependency audit results (post T-001a)
- [ ] Legal review — license terms (BSL 1.1 change-date + additional use grant)

D1 and D2 ratified. T-008 proceeds; T-001a runs next; legal review of BSL parameters tracked as an open item on the Phase 0 ratification checklist.
