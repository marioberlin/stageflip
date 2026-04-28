---
title: Phase 12 complete — handover
id: docs/handover-phase12-complete
owner: orchestrator
last_updated: 2026-04-28
supersedes: docs/handover-phase11-complete.md
---

# Handover — Phase 12 complete (2026-04-28)

If you are the next agent: read this top to bottom, then `CLAUDE.md`, then `docs/implementation-plan.md` §Phase 13.

**Phase 12 is closed.** 11 implementations + 1 spec-only-defer (T-267) + 2 dropped (T-268, T-273) + 1 operational follow-up (T-272 restore drill) shipped across 16 PRs from #225 → #244. `main` at `427d03e`. Working tree clean. All gates green per-PR and cumulatively.

**Next work**: Phase 13 — Premium Motion Library & Frontier Runtime (115 tasks across three parallel tracks A/B/C). The three ADRs (T-301/T-302/T-303) were ratified 2026-04-25; they are already on `main` as `ADR-003`, `ADR-004`, `ADR-005`. The Phase α primitives gate (T-304 → T-313) is the immediate next dispatch target. T-304 (preset schema primitive) is the recommended first implementable task.

**Mandatory first action**: spin up the **ratification agent** before dispatching any P13 task. The agent verifies the P12 closeout claim independently against `main`, the implementation plan, and the gate suite. Prompt is in §8.

---

## 1. Where we are

### Phase history

- Phases 0–11: ratified.
- **Phase 12 (Collab + Hardening + Blender)**: complete. 14 plan rows resolved as 11 implemented + 1 spec-only-defer + 2 dropped. Cumulative session was 2026-04-27 → 2026-04-28.

### Cumulative Phase 12 ledger — what shipped

| Layer | Tasks | Status | PR |
|---|---|---|---|
| Collab CRDT (Yjs sync) | T-260 | ✅ | [#231](https://github.com/marioberlin/stageflip/pull/231) |
| Presence (RTDB) | T-261 | ✅ | [#233](https://github.com/marioberlin/stageflip/pull/233) |
| Auth + org tenancy | T-262 | ✅ | [#235](https://github.com/marioberlin/stageflip/pull/235) |
| Rate limiting (token bucket) | T-263 | ✅ | [#236](https://github.com/marioberlin/stageflip/pull/236) |
| Observability (OTel + Sentry) | T-264 | ✅ | [#237](https://github.com/marioberlin/stageflip/pull/237) |
| Blender bake-tier ClipRuntime | T-265 | ✅ | [#243](https://github.com/marioberlin/stageflip/pull/243) |
| Render-farm adapter | T-266 | ✅ | [#244](https://github.com/marioberlin/stageflip/pull/244) |
| Stripe billing | **T-267** | ⏸ Spec-only (deferred to final phase) | [#234](https://github.com/marioberlin/stageflip/pull/234) (spec only) |
| Security review + pentest | ~~T-268~~ | DROPPED 2026-04-28 | n/a |
| K6 load testing | T-269 | ✅ | [#241](https://github.com/marioberlin/stageflip/pull/241) |
| Postgres adapter (Supabase) | T-270 | ✅ | [#242](https://github.com/marioberlin/stageflip/pull/242) |
| EU Firestore region | T-271 | ✅ | [#239](https://github.com/marioberlin/stageflip/pull/239) |
| Backup + PITR | T-272 | ✅ (drill PENDING — see §"Operational follow-ups") | [#240](https://github.com/marioberlin/stageflip/pull/240) |
| BigQuery telemetry export | ~~T-273~~ | DROPPED 2026-04-28 | n/a |

### P12 PR sequence (16 PRs, chronological)

| PR | Task | Notes |
|---|---|---|
| #225 | (handover) | P11 closeout merged at session start. |
| #230 | T-260 spec + ADR-006 | Authored after first T-260 Implementer correctly escalated "no spec, no ADR". |
| #231 | T-260 | Implementer + Reviewer + 1-pass fix-pass (slide-reorder Y.Text identity, dead branch, AC #29 doc). |
| #232 | T-261 spec | RTDB presence; ADR-006 §D5 already locked architecture. |
| #233 | T-261 | Implementer + Reviewer (clean APPROVE). |
| #234 | T-262/T-263/T-264 specs | Bundle PR for the 3 first-wave specs. |
| #235 | T-262 | Auth + tenancy; Reviewer M1 doc fix (revoke cache claim overstated); APPROVED. |
| #236 | T-263 | Rate limit; Reviewer M1 fix (atomicity tradeoff surfaced in skill). |
| #237 | T-264 | OTel + Sentry; Reviewer APPROVE clean. |
| #238 | T-265/T-266/T-267/T-269/T-270/T-271/T-272 specs + plan amendment | Bundle PR for the second-wave specs; plan rows for T-268 + T-273 marked DROPPED. |
| #239 | T-271 | EU region routing; Reviewer APPROVE clean. |
| #240 | T-272 | Backup + PITR; Reviewer M1 doc fix (CLI typo); APPROVED. Drill PENDING. |
| #241 | T-269 | K6 load; Reviewer caught real AC #1 metric drift (substantive, not a rename); fix-pass added custom Trend; APPROVED. |
| #242 | T-270 | Postgres adapter; Reviewer APPROVE clean. |
| #243 | T-265 | Blender bake-tier; Reviewer caught **B1 broken Dockerfile + B2 missing CI workflow** the gates couldn't see; fix-pass added blender-worker.yml + Docker COPYs + 4 minor fixes; APPROVED. |
| #244 | T-266 | Render-farm adapter; Reviewer APPROVE clean. |

**Total: 16 PRs in 2 calendar days, 5 fix-pass cycles, 2 spec-bundle PRs, 1 plan-amendment PR.**

### Workspace test counts (cumulative P12)

| Package | At P11 close | At P12 close | Δ |
|---|---|---|---|
| `@stageflip/collab` | 0 (new) | 56 | +56 (T-260) |
| `@stageflip/presence` | 0 (new) | 39 | +39 (T-261) |
| `@stageflip/auth-schema` | 0 (new) | included in 104 | new (T-262) |
| `@stageflip/auth-middleware` | 0 (new) | included in 104 | new (T-262) |
| `@stageflip/auth-client` | 0 (new) | included in 104 | new (T-262) |
| `firebase/functions` | 0 (new pkg) | 50+ | new (T-262 + T-265 + T-272) |
| `@stageflip/rate-limit` | 0 (new) | 47 | +47 (T-263) |
| `@stageflip/observability` | 0 (new) | 60 | +60 (T-264) |
| `@stageflip/runtimes/blender` | 0 (new) | 61 (covering inputs-hash + queue + fetch + submit) | new (T-265) |
| `services/blender-worker` | 0 (new svc) | 20 (TS) + 9 (pytest) | new (T-265) |
| `@stageflip/render-farm` | 0 (new) | 59 | +59 (T-266) |
| `@stageflip/storage-postgres` | 0 (new) | 61 unit + 5 integration (env-gated) | new (T-270) |
| `tests/load` | 0 (new) | 26 (helpers) | new (T-269) |

**No regressions on any pre-existing package.** All workspace gates remain green at HEAD.

### Phase 12 exit-criteria check

Plan quote (paraphrased from §Phase 12): *"Collab + hardening + bake tier; storage delta methods (T-025) finally exercised in prod; auth + tenancy + rate-limit; observability foundation; Blender bake runtime; secondary storage adapter to prove portability; EU residency + backup; pentest + load."*

- ✅ **Collab CRDT shipped** — T-260; Yjs binding + storage-contract-as-transport (ADR-006); ChangeSet + Yjs dual emission per command.
- ✅ **Presence shipped** — T-261; RTDB plane; cursor debounce 50ms; idle/away thresholds; stable-color helper.
- ✅ **Auth + tenancy shipped** — T-262; Firebase Auth; four-role hierarchy; multi-org per user; JWT custom claims; org-scoped API keys (scrypt-hashed).
- ✅ **Rate limiting shipped** — T-263; token bucket; three tiers (user/org/apiKey) with hierarchical enforcement; HTTP middleware + engine helper.
- ✅ **Observability shipped** — T-264; OTel SDK + Sentry + pino with trace correlation; sourcemap-upload script.
- ✅ **Bake tier (Blender) shipped** — T-265; `@stageflip/runtimes/blender` + `services/blender-worker`; Docker + GPU/CPU dual-path; deterministic Cycles config; inputsHash content-addressed cache.
- ✅ **Render-farm adapter shipped** — T-266; vendor-agnostic contract; InMemory + K8s stub; vendor evaluation doc (CoreWeave/Paperspace/GKE).
- ⏸ **Stripe billing** — T-267 spec ratified; implementation deferred to final phase per user direction.
- ✅ **Storage abstraction validated** — T-270; `@stageflip/storage-postgres` (Supabase target) implements the contract; FOR UPDATE row lock for transactional version-mismatch; LISTEN/NOTIFY for `subscribeUpdates`.
- ✅ **EU residency shipped** — T-271; two Firestore databases (`(default)` US, `eu-west` EU); region routing in storage adapter; org.region immutability guard; manual migration runbook.
- ✅ **Backup + PITR shipped** — T-272; daily Firestore + Storage exports; daily verification function with Sentry alerts; restore runbook + drill placeholder.
- ✅ **Load testing shipped** — T-269; K6 scenarios (collab-sync custom Trend / render-submit / api-mixed); CI smoke + ops full-load.
- ❌ **Pentest** — T-268 DROPPED. Vendor procurement is operational/business; revisit post-prod-launch.
- ❌ **BigQuery export** — T-273 DROPPED. Premature; OTel + pino can be wired later without architectural disruption.

---

## 2. Architecture that landed (Phase 12 additions)

### Package + service graph

```
packages/
  collab                       — Yjs binding + provider + client + commands + snapshot (T-260)
  presence                     — RTDB adapter + InMemoryPresenceAdapter + PresenceClient (T-261)
  auth-schema                  — User/Org/Membership/ApiKey/Role types + role-hierarchy primitive (T-262)
  auth-middleware              — resolvePrincipal + requireAuth + requireRole + apiKey verify with scrypt cache (T-262)
  auth-client                  — useCurrentUser / useCurrentOrg / useRole / switchOrg React hooks (T-262)
  rate-limit                   — Token-bucket limiter + HTTP middleware + 429 wire shape (T-263)
  observability                — OTel SDK + Sentry + pino logger with trace correlation (T-264)
  runtimes/blender             — BlenderClipRuntime + inputsHash + submit/fetch + BullMQ queue (T-265)
  render-farm                  — RenderFarmAdapter contract + InMemory + K8s stub + selector (T-266)
  storage-postgres             — PostgresStorageAdapter (snapshot + update + patch tiers) — Supabase target (T-270)
  storage-firebase             — +region-router for EU/US (T-271)

services/
  blender-worker (TS + Python) — BullMQ consumer + Blender CLI invoker; idempotent on manifest.json (T-265)
                              — emits state markers parseable by render-farm adapter (T-266)

firebase/
  functions/                   — NEW package; auth Cloud Functions (T-262); bake submit (T-265); backup + verify + restore (T-272)
  firestore.rules              — extended with apiKeys deny-by-default + role gating (T-262)
  firestore-eu.rules           — byte-equal mirror for eu-west database (T-271)
  firebase.json                — multi-database config (default + eu-west) (T-271)

tests/load                     — K6 scenarios + helpers + CI smoke + ops full-load runbook (T-269)
.github/workflows/             — +load-smoke.yml (T-269), +blender-worker.yml (T-265 fix-pass)

scripts/
  backup-restore.ts            — interactive CLI for restore runbook (T-272)
  migrate-org-region.ts        — planning aid for EU/US migration (T-271)
  sentry-upload-sourcemaps.ts  — CI build-step helper (T-264)

skills/stageflip/concepts/
  collab/SKILL.md              — updated with §"Reorder caveat" (Y.Text identity loss across slide reorder); ADR-006 cross-link
  rate-limits/SKILL.md         — token-bucket + atomicity tradeoff documented
  observability/SKILL.md       — load-testing + backup/restore cross-links
  auth/SKILL.md                — region routing + JWT claims + scrypt rationale
  runtimes/SKILL.md            — three-tier model (frame-deterministic / interactive / bake) + render-farm adapter
  clip-elements/SKILL.md       — BlenderClip element catalogue
  storage-contract/SKILL.md    — three-tier contract; adapter list (InMemory / Firebase / Postgres)
```

### Hand-rolled / wrap-around patterns

- **`@upstash/ratelimit` not used** (T-263) — package depends on a `RedisLike` interface (`get` + `set` with `px`); production wires `@upstash/redis`, tests use in-memory fake. CAS-free atomicity, documented over-credit-by-one window. Ratifies the inject-the-client pattern from auth-middleware (T-262).
- **`bcrypt` swapped for `node:crypto.scrypt`** (T-262) — built-in, no native addon, no licensing risk; OWASP-aligned N=16384 r=8 p=1.
- **Sentry default integrations OFF** (T-264) — `defaultIntegrations: false`, `tracesSampleRate: 0` so OTel owns HTTP spans; documented in skill.
- **OTel JS 2.x API**: `Resource` removed → `resourceFromAttributes`; `ReadableSpan.parentSpanContext` not `parentSpanId`. Adopted in T-264.

### Connected-components + shaped-CRDT primitives

- **Shaped Y.Doc binding** (ADR-006 §D1, T-260): top-level Y.Map mirrors Document; slides + elements are Y.Array<Y.Map>; long-form text (TextElement.text, slide.notes) is Y.Text; theme/masters/layouts single-writer plain JSON.
- **Origin-filtered Yjs provider** (T-260 AC #12): `PROVIDER_ORIGIN` symbol; observer early-returns on origin match; the echo-loop trap is closed by construction. **Reviewer-flagged landmine** that all future Yjs adapters must replicate.
- **Token-bucket multi-bucket consume** (T-263 AC #7): on rejection across multiple buckets, returns the LONGEST retry duration, not min. `Math.ceil(retryAfterMs/1000)` for both header and body, consistent.
- **inputsHash content-addressed cache** (T-265): SHA-256 over canonicalized sorted-key JSON of `{scene, duration}`; field-order independent; type-sensitive (no number↔string coercion). The cache key is the whole game; wrong = duplicate bakes / cache poisoning.
- **Markers advisory, exit code authoritative** (T-266): kernel exit code is unforgeable; stdout markers are best-effort hints. K8s adapter (when implemented) follows the same principle (pod state from K8s API, logs are advisory).

### Worker-state-marker contract (T-265 + T-266)

`services/blender-worker/src/main.ts` emits stdout markers in a parseable format the render-farm adapter consumes:

- `STAGEFLIP_RENDER_FARM_STARTED` on entry.
- `STAGEFLIP_RENDER_FARM_FINISHED status=succeeded|failed` on exit.

Process exit code is authoritative; markers are advisory (so a worker emitting `failed` and exiting 0 is recorded as succeeded — kernel doesn't lie).

---

## 3. Architectural decisions ratified this phase

### From this phase

1. **ADR-006 (collab CRDT transport)** — eight decisions: shaped Y.Doc binding (D1), storage contract as transport (D2; no y-websocket), ChangeSet + Yjs dual emission (D3), server-driven snapshot cadence (D4), RTDB-only presence (D5), `@stageflip/collab` package (D6), determinism out-of-scope (D7), reconnect-with-backoff (D8). Ratified via merge to main as `d32aea5` on 2026-04-27.

2. **Auth/SKILL.md is the architecture spec** (T-262) — the existing skill at `skills/stageflip/concepts/auth/SKILL.md` already locked Firebase Auth + four-role hierarchy + multi-org per user + JWT custom claims + org-scoped API keys + Firestore security rules. T-262 implemented against this; **no new ADR was needed**. Per CLAUDE.md §5, the skill IS the source of truth.

3. **Storage contract proven portable** (T-270) — `PostgresStorageAdapter` passes the same contract suite as `InMemoryStorageAdapter` and `FirebaseStorageAdapter` (with documented duplication of the suite — extraction as shared fixture is future work). Categorically different backends (document store vs relational) confirms the abstraction holds.

4. **Render-farm adapter pattern** (T-266) — `RenderFarmAdapter` contract + selector pattern. Vendor choice (CoreWeave / Paperspace / GKE) deferred per user direction 2026-04-28; ships InMemory + K8s stub + vendor evaluation doc. Adapter contract is the lock-in point; vendor implementation is plug-in.

5. **Markers advisory, exit code authoritative** (T-266 D-T266-5) — the worker → render-farm-adapter state-transition contract. Kernel signals over self-report. Future K8s / CoreWeave adapters follow this principle.

6. **Drops** (2026-04-28):
   - **T-268 (security pentest)** — vendor procurement decision, not orchestrator. T-264 ships the telemetry; revisit post-prod-launch.
   - **T-273 (BigQuery export)** — premature; T-264 just shipped, no telemetry flowing yet. T-267 reconciliation pivots to Firestore aggregates instead.

### Carried forward (still load-bearing)

- ADR-003 / ADR-004 / ADR-005 (interactive runtime tier / preset system / frontier clip catalogue) — ratified 2026-04-25, gate P13 entry.
- The `references/` tier convention (PR #213) — applied this phase: T-265 added `services/blender-worker/templates/README.md` that documents schemas without binaries; not strictly a `references/` directory but follows the same "earn its place" rule.
- Hand-rolled Google API clients pattern (P11 precedent) — applies to any future Google API consumer.

---

## 4. Memory updates this session

The auto-memory system gained ONE update + held five existing entries:

### Updated

- **`feedback_subagent_shared_worktree.md`** — added a new clause: **writing new files in the shared tree while a background agent runs**. Even if the file is on a topic the agent isn't touching (e.g., drafting `T-261.md` while a T-260 fix-pass runs), the file lands on whatever branch the agent has switched HEAD to. If the agent does `git add .` (instead of a specific file list), the new file gets bundled into their commit and PR. Rule: **park doc/spec drafts at `/tmp/<name>.staged` outside the working tree until the background agent returns; then move them in.** Witnessed P12-T-261 spec drafted while T-260 fix-pass running; caught before contamination by `git status --short` showing the untracked file on the wrong branch.

### Held (still load-bearing)

- `feedback_phase_closeout_timing.md` — reapplied: this handover is being written **at P13 start, not P12 end**, per the rule.
- `project_handover_phase9_closeout.md` — reapplied: §5 below carries the "Remaining-phases risk" section.
- `feedback_subagent_worktree_bash.md` — reapplied: every Implementer this phase used non-worktree subagents (Bash available).
- `feedback_biome_format_before_commit.md` — reapplied: no biome-format CI regressions this session.

### Lessons worth capturing for next session (defer to next agent's discretion)

1. **Reviewers can catch CI-blind issues.** T-265 Reviewer caught a broken Dockerfile (B1) AND a missing CI workflow (B2 — AC #31 unsatisfied) that the existing gate suite couldn't detect because the gates didn't exercise the Docker build. Lesson: when a task ships a service with Docker build, the Reviewer must verify the build CI workflow EXISTS and is correctly wired, regardless of whether the package gates pass. Worth a memory entry if the pattern repeats.
2. **Implementer self-reports can misrepresent fix-pass scope.** T-269 Implementer documented a "metric rename" (`ws_msgs_received_duration_p95` → `ws_connecting`) that was actually a substantive AC drift (handshake duration ≠ fan-out latency). Reviewer caught it. Pattern: when an Implementer's deviation note says "rename" or "name correction", verify the new name measures the same thing.
3. **Duplicate-detect helper for spec drafting.** Specs were drafted in /tmp during T-260 fix-pass (per rule); same pattern recurred for T-262/T-263/T-264 (parked in /tmp during T-261 Implementer run) and T-265–T-272 (parked during T-271 / T-272 / T-269 / T-270 Implementer runs). The pattern is: Orchestrator drafts specs while one Implementer runs in background; commits the batch when it returns. Worked reliably 3+ times this phase. Could be promoted from "memory note" to standard workflow if it keeps working.

---

## 5. Remaining-phases risk (post-P12)

Per `project_handover_phase9_closeout.md`, every closeout handover must include this section. With P12 closed:

**Risk order (highest first): P13 > P14 > P15 > P16.**

(P16 is the Marketplace + Publishing phase that surfaced in the plan during P12 implementation — 65 tasks; was not in the P11 closeout's remaining-phases list. P16 risk is moderate but bounded.)

### P13 — Premium Motion Library & Frontier Runtime (highest risk)

- **115 tasks across three parallel tracks** (A: frontier runtime, B: preset library, C: supporting plumbing). The largest phase by task count.
- ADRs ratified 2026-04-25 (ADR-003/004/005) — gate is open.
- **Type-design consultant agent** batch-reviews Clusters A/B/D/F/G fallback fonts; preset PRs in those clusters link to the batch. Coordination overhead is non-trivial.
- **Parity fixtures ship per cluster batch with product-owner sign-off** (not Reviewer-only). New approval surface.
- Per the P11 closeout handover (§5): the recommended mitigation was "do not start P13 until P12's T-262 (auth) + T-263 (rate limiting) + T-264 (observability) ship." **All three have shipped this phase.** The mitigation is satisfied; P13 is now unblocked structurally.
- **Highest cumulative risk** because of task count + frontier scope (shaders, 3D, voice, AI clips). Multi-month phase.

### P14 — Asset Generation (Adapter-Pattern Foundation + Per-Modality Build-out)

- 35 tasks. Adapter-pattern foundation (`@stageflip/asset-gen`) + per-modality build-outs (image, video, audio, font, 3D).
- **Provider non-determinism** is the central risk. Asset cache must be content-addressed; provider-call layer must be replayable.
- T-265's `inputsHash` precedent (content-addressed cache) is directly transferable.
- Bounded by adapter pattern.

### P15 — Live Audience (Native Primitives + Vendor Bridges)

- 40 tasks. Real-time low-latency rendering + vendor bridges (OBS, Vimeo, vMix, Restream).
- WebRTC + WebSocket plumbing + per-vendor SDK quirks. Less bounded than P14.

### P16 — Marketplace + Publishing (newly visible)

- 65 tasks. Bundle foundation + publishing tooling + first-party launch packs + marketplace + lock-in.
- Risk: bundle-versioning correctness (semver across multi-package bundles) + marketplace abuse vectors (auth + rate-limit + spam).
- T-262 (auth) + T-263 (rate-limit) ship now; provides foundation. Marketplace abuse is the real risk; consider security review here instead of T-268.

### Concrete sequencing recommendation

1. **Now**: ratify P12 closeout (§8 prompt below).
2. **Next**: dispatch T-304 (preset schema primitive) — first implementable task in P13 Phase α. T-301/T-302/T-303 are already on `main` (the three ADRs).
3. **After T-304**: Phase α primitives (T-305 → T-313) sequentially or in safe parallel pairs (only T-307 and T-308 are genuinely independent).
4. **After Phase α**: tracks β and γ run in parallel — but per `feedback_subagent_shared_worktree.md`, do NOT run two background Implementers concurrently in the same worktree. Sequence within the main thread; use `git worktree add` if you genuinely need concurrent agent work.

### T-267 deferred — landing slot

Per user direction (2026-04-28), T-267 implementation lands in "the final phase". The plan has P16 as the final phase before launch; T-267 likely lands during or just after P16's marketplace tasks (when billable usage actually begins).

### T-272 restore drill — outstanding

Operational follow-up. Documented in `docs/ops/restore-drill-2026-04.md` as PENDING. Gated on:

1. Staging Firebase project provisioned + bucket lifecycle policy in place.
2. 24h backup window elapsed.
3. Operator-led drill execution.

Should be done before prod launch, regardless of phase.

---

## 6. Memory health check (per `consolidate-memory` skill)

Current memory entries — all checked against current state:

- **`feedback_phase_closeout_timing.md`** — still load-bearing. Reapplied this session: P12 closeout handover written **at this point** (P13 start), not at the last P12 PR.
- **`project_handover_phase9_closeout.md`** — still load-bearing. Reapplied: §5 above is in the canonical position with P16 newly added.
- **`feedback_subagent_worktree_bash.md`** — still load-bearing. Reapplied: every P12 Implementer used non-worktree subagents.
- **`feedback_subagent_shared_worktree.md`** — UPDATED this session (see §4). Reapplied: parked spec drafts in /tmp 3+ times during P12 dispatch.
- **`feedback_biome_format_before_commit.md`** — still load-bearing. Reapplied (implicitly): no biome CI regressions this session.

No stale entries. No obvious duplicates. `MEMORY.md` index under 200 lines.

---

## 7. References/ tier seeds — for future expansion (carried forward)

Per PR #213's adoption status section, future skills earn a `references/` tier when complexity warrants:

- `skills/stageflip/concepts/auth/references/` — JWT claim shape catalogue; bcrypt-vs-scrypt rationale; multi-region migration playbook.
- `skills/stageflip/concepts/collab/references/` — Y.Doc binding patterns per element type; reorder-caveat playbook (T-260 + T-261 era).
- `skills/stageflip/concepts/rate-limits/references/` — atomicity-tradeoff playbook (when to wrap with Lua); per-tier capacity tuning rubric.
- `skills/stageflip/concepts/observability/references/` — sampling decision matrix; Sentry vs OTel HTTP coexistence.
- `skills/stageflip/concepts/runtimes/references/` — bake-tier vs interactive-tier vs frame-deterministic decision tree; inputsHash canonicalization rules.
- `skills/stageflip/concepts/storage-contract/references/` — adapter-test-suite extraction guidance (future work referenced in T-270).

Add incrementally per the convention's "earn its place" rule.

---

## 8. How to pick up — explicit next-action prompts

### Step 1: Verify session-end state

```
git log --oneline main -7
# Expected:
#   427d03e [T-266] @stageflip/render-farm — adapter contract + in-memory + K8s stub (#244)
#   3112c98 [T-265] @stageflip/runtimes/blender + services/blender-worker — bake tier (#243)
#   6f51dc4 [T-270] @stageflip/storage-postgres — Postgres StorageAdapter (Supabase / pg) (#242)
#   f1dade1 [T-269] tests/load — K6 load testing scenarios + CI smoke (#241)
#   5b15dfe [T-272] firebase/functions/backup — daily backups + verification + restore runbook (#240)
#   de13cf8 [T-271] @stageflip/storage-firebase + auth-schema — EU Firestore region routing (#239)
#   12bad13 docs(plan, tasks): P12 second-wave specs + drop T-268 / T-273 (#238)

git status
# Expected: clean tree on main (or on docs/handover-phase12-complete if this handover hasn't been merged yet).

pnpm typecheck && pnpm lint && pnpm test
# Expected: all green at HEAD.
```

### Step 2: Spin up the **ratification agent** (mandatory before any P13 dispatch)

Use `Agent` with `subagent_type: pr-review-toolkit:code-reviewer`. Prompt:

```
You are the **Phase 12 closeout ratification agent** for StageFlip. Your job: independently verify the P12 closeout claim made in `docs/handover-phase12-complete.md` against the actual state of `main`. You are NOT reviewing a single PR — you are auditing a phase boundary.

## Required reading (in this order)

1. `/Users/mario/projects/stageflip/CLAUDE.md` — hard rules and the three-agent workflow.
2. `/Users/mario/projects/stageflip/docs/handover-phase12-complete.md` — the closeout claim. Specifically §1 (cumulative ledger), §2 (architecture), §3 (decisions ratified), §5 (remaining-phases risk).
3. `/Users/mario/projects/stageflip/docs/implementation-plan.md` §Phase 12 — the original task list. Cross-check that every task ID in P12 is either marked merged in the handover, explicitly DROPPED with rationale, or explicitly DEFERRED with rationale.
4. `git log --oneline main` since `docs/handover-phase11-complete` (commit c095ceb). Cross-check every claimed PR (#225 → #244) actually merged.

## What to verify

- **Task completeness**: every P12 task ID in `docs/implementation-plan.md` § Phase 12 is accounted for (merged, dropped, or deferred with documented rationale).
- **Architecture claims**: §2 of the handover claims specific files / patterns landed (e.g., `packages/collab/`, `packages/auth-schema/`, `packages/render-farm/`, `services/blender-worker/`, `firebase/firestore-eu.rules`, `tests/load/`). Verify each by `ls`/grep on `main`.
- **Test counts**: §1's workspace test-count delta table. Spot-check 2–3 packages by running `pnpm --filter <pkg> test` and comparing.
- **All gates green at HEAD**: `pnpm typecheck && pnpm lint && pnpm test && pnpm check-licenses && pnpm check-remotion-imports && pnpm check-determinism && pnpm check-skill-drift && pnpm size-limit`.
- **No regressions on pre-P12 packages**: pick 2–3 packages that existed before P12 (e.g., `@stageflip/frame-runtime`, `@stageflip/import-pptx`, `@stageflip/storage`); their test counts should not have decreased.
- **ADR-006**: verify the ADR file exists, status is "Accepted" (not "Proposed"), and is cited from the collab skill.
- **Drops**: T-268 and T-273 are marked DROPPED in `docs/implementation-plan.md` with rationale.
- **Deferred**: T-267 spec exists at `docs/tasks/T-267.md` with `status: spec-only` frontmatter.
- **Memory health**: §6's claims about each memory entry remaining load-bearing. Spot-check by reading the actual files at `/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/`.
- **Risk ordering**: §5's claim that P13 > P14 > P15 > P16 in risk. Sanity-check against the implementation plan; flag any obvious mis-ordering.

## Reporting

Return a focused ratification using severity bands (blocker / major / minor). End with one of:

- **RATIFY** — closeout claim holds; P13 dispatch unblocked.
- **HOLD** — list specific gaps the Orchestrator must address before P13 dispatch.

Be terse. State facts. Cite file:line / commit / PR# for every finding. If you RATIFY, briefly state which checks you spot-verified.

Working directory: `/Users/mario/projects/stageflip`.
```

### Step 3: After ratification — merge this handover doc

Once the ratification agent returns RATIFY, this handover doc itself needs to be on `main`. Open a PR:

```bash
git checkout docs/handover-phase12-complete  # branch the handover lives on
gh pr create --title "docs(handover): Phase 12 complete — supersedes phase11-complete" \
  --body "..."
```

CI should be near-trivial (docs-only, no changeset). Merge once green.

### Step 4: Author T-304 spec, then dispatch first P13 task

P13 Phase α primitives gate begins with **T-304** (preset schema primitive). Same convention as P11/P12: the plan row is one line — a Implementer dispatching against just that will escalate "no spec".

**Author `docs/tasks/T-304.md` first** mirroring the structure used in T-260/T-261/T-262/etc. (frontmatter + Goal + Dependencies + Out-of-scope + Architectural decisions + Files to create/modify + ACs + References + Skill updates + Quality gates + PR template + Escalation triggers + Notes for Orchestrator). ADR-004 (preset system) is the architecture reference; T-304 implements against it.

After T-304 spec merges, dispatch the Implementer with `subagent_type: general-purpose`. Prompt template:

```
You are the **Implementer** agent for StageFlip task **T-304** — `packages/schema/src/presets/` preset schema primitive (loader + validator + frontmatter parser). Phase 13, first dispatch (T-301/T-302/T-303 are the three ADRs already merged).

## Required reading

1. `/Users/mario/projects/stageflip/CLAUDE.md` — hard rules and the three-agent workflow.
2. `/Users/mario/projects/stageflip/docs/decisions/ADR-004-preset-system.md` — **THE source of truth** for preset schema. Read end-to-end before any code.
3. `/Users/mario/projects/stageflip/docs/decisions/ADR-003-interactive-runtime-tier.md` — context for `liveMount` / `staticFallback`.
4. `/Users/mario/projects/stageflip/docs/decisions/ADR-005-frontier-clip-catalogue.md` — context for what presets reference.
5. `/Users/mario/projects/stageflip/docs/tasks/T-304.md` — the task spec.
6. `/Users/mario/projects/stageflip/packages/schema/src/elements/index.ts` — Element union; preset bodies reference these.

## Branch + workflow

- Working directory: `/Users/mario/projects/stageflip`
- Branch: `task/T-304-preset-schema-primitive`
- Non-worktree subagent — share working tree with main thread.

## Hard rules (CLAUDE.md §3)

- TS strict, no `any`, file headers on new files, no commented-out code, no `console.log`.
- Tests-first: failing tests before implementation.
- Conventional Commits per spec.

## Quality gates (must pass before pushing)

```
pnpm typecheck
pnpm lint
pnpm test
pnpm check-licenses
pnpm check-remotion-imports
pnpm check-determinism
pnpm check-skill-drift
pnpm size-limit
```

## PR

- Title: `[T-304] @stageflip/schema/presets — preset schema primitive`
- Changeset if @stageflip/schema is touched.
- PR body: list each AC and where it's satisfied.

## Reporting

When done, push branch, confirm CI green via `gh pr checks <pr>`, return terse summary listing each AC + the file:section satisfying it.

If T-304.md spec doesn't exist OR an AC conflicts with an invariant, STOP and escalate per CLAUDE.md §6.

Be terse.
```

### Step 5: Continue P13 dispatch loop

After T-304 merges, dispatch T-305 → T-313 (Phase α primitives) sequentially. The plan suggests these are independent but per memory rule, sequential dispatch is safer than parallel.

After Phase α completes, tracks β (preset library) and γ (frontier runtime) can run in parallel. Use `git worktree add` if you need genuine parallelism; otherwise sequence in the main thread.

### Step 6: Phase 13 closeout

When P13 is complete: **do not write the closeout handover yet** (per `feedback_phase_closeout_timing.md`). Write `docs/handover-phase13-complete.md` at **Phase 14 start**, mirroring the structure of this doc.

---

## 9. Pointers for the next agent

- **Working tree**: `/Users/mario/projects/stageflip`. Currently on branch `docs/handover-phase12-complete` with this file as the only addition. Push → PR → merge after ratification.
- **`main` HEAD**: `427d03e`. All gates green per most-recent CI runs.
- **Memory location**: `/Users/mario/.claude/projects/-Users-mario-projects-stageflip/memory/`. Index in `MEMORY.md`.
- **Open PRs**: none from this session. All 16 P12 PRs merged.
- **Open work**: T-272 restore drill (operational, not blocked on code), T-267 implementation (deferred to final phase).
- **Previously open Reviewer comments**: none unresolved.
- **No escalations in flight.**

End of handover.
