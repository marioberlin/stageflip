---
title: Phase 10 complete — handover
id: docs/handover-phase10-complete
owner: orchestrator
last_updated: 2026-04-25
supersedes: docs/handover-phase9-complete.md
---

# Handover — Phase 10 complete (2026-04-25)

If you are the next agent: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md` §Phase 11. Phase 10 shipped 12 PRs across T-220 → T-231, all merged to `main` at `e40ee8c`, all gates green.

Next work: **Phase 11 — Importers** (T-235+ per the plan). Phase 13 is structurally parallel (ADRs ratified 2026-04-25; α primitives unblocked) but **P11 takes capacity priority** — Implementer agents picking up Phase 13 α-tasks should confirm with the Orchestrator that P11 is not blocked.

---

## 1. Where we are

All 12 in-scope Phase 10 tasks merged. Run order:

| PR | Task | Title |
|---|---|---|
| #150 | T-220 | `@stageflip/skills-sync` — generator set (clips catalog + tools index + runtimes index + validation rules + live-runtime manifest) |
| #151 | T-221 | Skills review pass against the four non-negotiables (one-screen, examples-over-prose, cross-linked, single-source-of-truth) |
| #152 | T-222 | `@stageflip/mcp-server` — MCP adapter over the semantic-tool registry |
| #153 | T-223 | MCP auth flow — OAuth → JWT → local config |
| #154 | T-224 | `@stageflip/plugin` — Claude-plugin bundler + Google AuthProvider |
| #155 | T-225 | `apps/cli` — `stageflip` CLI surface from user-manual §4 |
| #156 | T-226 | Auto-gen `reference/cli/SKILL.md` from the CLI command registry |
| #157 | T-227 | npm publish `@stageflip/{cli,plugin,mcp-server}` via Changesets |
| #158 | T-228 | `apps/docs` — Astro Starlight over `skills/stageflip/**` |
| #159 | T-229 | `apps/api` — Firebase Admin SDK + auth middleware + MCP session mint |
| #160 | T-230 | Firebase hosting + Firestore + Storage rules |
| #161 | T-231 | Cloud Run — API service + render-worker job deployment |

### Totals

- **12 merged PRs** for Phase 10. `main` at `e40ee8c`. All gates green per-PR and cumulatively.
- **Three new publishable npm packages**: `@stageflip/cli`, `@stageflip/plugin`, `@stageflip/mcp-server`. First-ever public npm releases for the project. BSL 1.1 license posture preserved.
- **Two new apps**: `apps/api` (Firebase Admin SDK + MCP session minting; deployed to Cloud Run), `apps/docs` (Astro Starlight over the skills tree; deployed to Firebase Hosting).
- **One new render service**: `apps/render-worker` packaged as a Cloud Run job behind the API.
- **Skills tree**: now machine-generated where appropriate (T-220 + T-226). Manual SKILL.md files gated by `check-skill-drift`.

### Phase 10 exit-criteria check

Plan quote: *"`claude plugin install stageflip` installs + connects + usable."*

- ✅ **Plugin installable**: T-224 ships `@stageflip/plugin` to npm; `claude plugin install stageflip` works against the public registry as of T-227's first release.
- ✅ **Plugin connects**: MCP adapter (T-222) + auth (T-223) handle the install-time handshake; the Google AuthProvider in T-224 mints session credentials.
- ✅ **Plugin usable**: skills bundled by `@stageflip/plugin`; semantic tools wired through MCP; CLI (T-225) is the local entry point. Smoke-tested in CI.
- ✅ **API + worker deployed**: Cloud Run hosts the API (T-229) and render-worker (T-231); Firebase rules (T-230) gate Firestore + Storage; auth middleware lives in `apps/api`.
- ✅ **Docs site live**: `apps/docs` builds on Firebase Hosting from `skills/stageflip/**` via Starlight (T-228). Auto-rebuilds on skill changes.

---

## 2. Architecture that landed

### Package + app graph (Phase 10 additions)

```
@stageflip/skills-sync          ┐
@stageflip/mcp-server           │  → npm public (T-227)
@stageflip/plugin               │
@stageflip/cli                  ┘

apps/api          ──→  Cloud Run service (T-229 + T-231)
apps/render-worker──→  Cloud Run job     (T-231)
apps/docs         ──→  Firebase Hosting  (T-228 + T-230)

Firebase
 ├─ Firestore rules    (T-230)
 ├─ Storage rules      (T-230)
 ├─ Hosting            (T-230)
 └─ Admin SDK auth     (T-229)
```

### Distribution surface

For the first time, StageFlip is consumable by external users:

- **`claude plugin install stageflip`** mints a session via the Google AuthProvider, downloads the plugin manifest, and registers the MCP server.
- **`stageflip` CLI** wraps the user-manual §4 surface (init / build / preview / publish / agent-exec / etc.) over the same auth.
- **`apps/docs`** at the public hosting URL renders every SKILL.md as a navigable doc site.

### Auth flow (T-223 + T-229)

OAuth 2.0 → JWT minted by `apps/api` (Firebase Admin SDK) → JWT cached in `~/.config/stageflip/credentials.json` → presented by CLI / plugin / MCP server. Session expiry handled; refresh path lives in `@stageflip/mcp-server`.

### Cloud Run topology (T-231)

- `apps/api`: HTTP service, public ingress, JWT-validated. Holds the agent-exec orchestrator + Firestore writes + Storage uploads.
- `apps/render-worker`: Cloud Run job (not service), invoked by the API for long-running render work. GPU not yet wired (deferred to Phase 12 bake-tier).
- Both behind the same VPC connector for Firestore / Storage access.

---

## 3. Follow-ups / known issues

Carry-forward punch list — none block Phase 11:

- **GPU on render-worker**: T-231 ships CPU-only Cloud Run jobs. Phase 12's Blender bake-tier (T-265) will need GPU; today's render-worker is enough for the puppeteer-based renderer-cdp path but not for high-end bake.
- **Streaming agent events**: still buffered. SSE / `ReadableStream` carry-forward from Phase 7. Worth picking up early in P11 if importers benefit from progress events.
- **Captions ±100 ms gate** — unchanged carry from Phase 8. Methodology is complete (deterministic packing + SHA-256 cache); frame-by-frame CI measurement still deferred.
- **T-188 video goldens** — unchanged carry from Phase 8. Phase 11 has no rendering work that depends on these.
- **Display parity fixtures** — five T-202 clips still without parity manifests. Phase 9 carry; un-touched in Phase 10.
- **IAB polite-load enforcement** — `iabPoliteLoadKb: 1024` exposed but not enforced; Phase 9 carry.
- **Image-optimizer plug-in (sharp licensing)** — Phase 9 carry; revisit when an importer needs raster optimization.
- **Skills-sync drift cadence**: T-220 generators run on `pnpm gen:skills`; consider wiring a CI check that fails if generators are stale (currently a manual step before commit).
- **`apps/docs` link health**: docs site builds but cross-references between SKILL.md files aren't link-checked. Worth a CI pass.
- **MCP session refresh edge case**: T-223's refresh path works against expired JWTs but not against revoked-by-server tokens. Low impact today; revisit when multi-tenant MCP sessions land in P12.
- **Plugin telemetry**: zero metrics on plugin activation / usage today. Worth scoping in P12 alongside the broader observability work.

---

## 4. Remaining-phases risk (per memory: include difficulty assessment)

After Phase 10, three phases remain in the plan: **P11 (Importers)**, **P12 (Collab + Hardening + Blender)**, **P13 (Premium Library + Frontier)**.

Difficulty ranking (orchestrator estimate, propagating the v1.16 assessment with Phase 10 removed and Phase 13 added):

**P11 > P12 > P13**

- **P11 (Importers)** is the hardest remaining phase. Importers touch four hostile surfaces: PPTX (zip + XML quirks per generator), Google Slides (live API + auth), SlideMotion legacy (our predecessor; lossy compatibility), Hyperframes HTML (partial Apache 2.0 codebase we vendored selectively in Phase 4). Each importer needs a converter, validator, and parity fixture. Format edge cases dominate; agent guesses cost time.
- **P12 (Collab + Hardening + Blender)** is the second-hardest. CRDT (Yjs) is well-trodden but the storage delta methods (T-025) finally get exercised in production and any latent bugs surface there. Auth, billing, security review, GPU render farm, EU GDPR region, BigQuery export — each is a meaningful integration. Manageable because each piece is self-contained.
- **P13 (Premium Library + Frontier)** is the largest by task count (115) but the most parallelizable. ADRs are ratified; the gap clips and preset stubs are well-specified. Most work is craft: distill compass canon, render to parity. Risk is breadth, not depth — security review for the frontier tier is the one calendar-time bottleneck.

P11 first; P13 picks up the slack when P11 has Implementers spinning on PPTX edge cases.

---

## 5. Phase-13 status (running parallel)

Phase 13 was scaffolded on 2026-04-24 (`plan/P13-scaffold` branch + 4 PRs). All three ADRs ratified 2026-04-25:

- ADR-003 (Interactive Runtime Tier) — accepted
- ADR-004 (Preset System) — accepted
- ADR-005 (Frontier Clip Catalogue) — accepted

When the four scaffold PRs (#162 / #163 / #164 / #165) merge to `main`, Phase 13 α primitives (T-304 / T-305 / T-306) are unblocked. **They should not be picked up until P11 has steady Implementer flow.** The Orchestrator schedules accordingly.

Preset count: **50** (Cluster B = 9 with `espn-bottomline-flipper` added at T-339a).

---

## 6. Ratification

Phase 10 ratification per CLAUDE.md §2 + memory:phase_closeout_timing happens **at Phase 11 start**, not at Phase 10 end. Steps:

1. First Phase 11 PR (T-235 or whichever lands first) includes a one-line plan-changelog entry promoting Phase 10 status from "all merged" to "✅ Ratified 2026-04-25" (or whatever the date is when P11 starts).
2. The Phase 10 row in `docs/implementation-plan.md` gets the ✅ Ratified banner.
3. This handover file's `last_updated` stays as 2026-04-25; no need to amend on ratification — the plan-banner is the canonical ratification record.

---

## 7. References

- Phase 9 handover: `docs/handover-phase9-complete.md` (immediate predecessor)
- ADRs ratified this cycle: `docs/decisions/ADR-003-*`, `ADR-004-*`, `ADR-005-*`
- Plan: `docs/implementation-plan.md` v1.18 — Phase 11 starts at T-235
- Architecture: `docs/architecture.md` (unchanged this phase)
- Memory: `phase_closeout_timing.md`, `handover_phase9_closeout.md`
