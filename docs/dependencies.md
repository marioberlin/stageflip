# StageFlip — Dependency Lock & Audit Process

This document is the **source of truth** for dependency versions. Every value below is picked deliberately; bumps require a dedicated PR with ADR.

**Status**: Phase 0 / T-001a audit complete on 2026-04-20. Locked versions recorded in §3 and §4.

---

## 1. Audit Process (T-001a)

Run at the start of Phase 0 and quarterly thereafter. The audit:

1. For each entry in § 3 below, query the npm registry for the `latest-stable` version compatible with our target Node.
2. For each, check the upstream changelog for breaking changes since the listed floor.
3. Pin a specific version (not a range) in root `package.json`'s `devDependencies` / `resolutions`.
4. Run `pnpm install && pnpm build && pnpm test`. All gates green.
5. Commit with message `chore(deps): initial dependency lock (ADR-001)` referencing this doc.
6. Record the audit date and chosen versions in § 4 (History).

Bumps between quarterly audits require:
- A dedicated PR per major bump
- A new ADR (why, migration notes, parity harness runs)
- Green CI across all quality gates

---

## 2. Security & Patch Strategy

- `pnpm audit` runs in CI weekly. High-severity CVEs block merge.
- Patch bumps (x.y.Z) may be auto-applied by Renovate/Dependabot with green CI.
- Minor bumps (x.Y.0) require human review.
- Major bumps (X.0.0) require ADR.

---

## 3. Minimum Version Floors

These are floors — actual locked versions determined by audit. Bumping the floor requires ADR.

### Runtime

| Package | Floor | Locked | Notes |
|---|---|---|---|
| Node | 20 LTS | **22.17.1** | ADR-001 D2 pins Node 22 LTS; bump to 24 when deps support |
| pnpm | 9.x | **9.15.0** | Provisioned via Corepack; pinned in root `packageManager` field |

### Core tooling

| Package | Floor | Locked | Notes |
|---|---|---|---|
| typescript | 5.6 | **5.6.3** | TS 6.0.3 available but blocked — requires ADR per this doc |
| @biomejs/biome | 1.9 | **1.9.4** | Biome 2.x available but blocked — biome.json schema pinned to 1.9.4 |
| turbo | 2.x | **2.9.6** | Installed at T-001; audited here |
| vitest | 2.x | **2.1.9** | Vitest 4.x available but blocked — major bump requires ADR |
| @vitest/coverage-v8 | matches vitest | **2.1.9** | — |
| @playwright/test | 1.49 | **1.59.1** | — |
| @changesets/cli | 2.x | **2.31.0** | — |
| tsup | 8.x | **8.5.1** | — |
| size-limit | 11.x | **11.2.0** | 12.x available but blocked — major bump requires ADR |
| @size-limit/preset-big-lib | 11.x | **11.2.0** | matches size-limit |
| license-checker | 25.x | **25.0.1** | — |
| tsx | — | **4.21.0** | TypeScript runner for `scripts/` gates (T-010, T-014) |
| @types/node | 22.x | **22.19.17** | Types for Node 22 API; used by `scripts/` + packages that touch `node:fs`/`node:path` (e.g. `@stageflip/skills-core`). Pinned at root. |
| @types/react | matches React | **19.2.14** | Types for React 19; devDep of packages that render (`@stageflip/frame-runtime`). |
| @types/react-dom | matches react-dom | **19.2.3** | Types for `react-dom`; paired with `@types/react`. |
| @testing-library/react | 16.x | **16.3.2** | React component testing; used by `@stageflip/frame-runtime` (T-040+). |
| happy-dom | 20.x | **20.9.0** | Fast DOM test environment for Vitest; selected over jsdom for render tests. |

### Schema + runtime libraries

| Package | Floor | Locked | Notes |
|---|---|---|---|
| zod | 3.23 | **3.25.76** | Zod 4.3.6 available but blocked per floor note — requires ADR |
| react | 19 | **19.2.5** | — |
| react-dom | 19 | **19.2.5** | — |
| next | 15 | **15.5.15** | Next 16 available but blocked — requires ADR |
| jotai | 2.x | **2.19.1** | — |
| hono | 4.x | **4.12.14** | — |
| tailwindcss | 4.x | **4.2.2** | v4 has different config; migration documented in skill |
| @fontsource/* | latest | _per-package_ | Versioned independently; pin at package install time |

### Media / rendering

| Package | Floor | Locked | Notes |
|---|---|---|---|
| sharp | 0.33 | **0.34.5** | 0.x stable line — minor bumps on 0.34 accepted |
| ssim.js | latest | **3.5.0** | For T-100 parity harness |
| puppeteer | 23.x | **23.11.1** | Puppeteer 24 available but blocked — coordinated with vendored Hyperframes engine version (Phase 4) |
| fluent-ffmpeg | latest | **2.1.3** | System FFmpeg required; `doctor` validates |
| culori | latest | **4.0.2** | For interpolateColors (T-042) |
| flubber | latest | **0.4.2** | For interpolatePath (T-052) |
| gsap | 3.x | **3.15.0** | Business Green license procured; track GreenSock terms |
| lottie-web | latest | **5.13.0** | — |
| three | latest | **0.184.0** | — |

### Infrastructure

| Package | Floor | Locked | Notes |
|---|---|---|---|
| firebase-admin | 13.x | **13.8.0** | — |
| firebase | 11.x | **11.10.0** | Firebase 12 available but blocked — major bump requires ADR |
| @modelcontextprotocol/sdk | latest | **1.29.0** | Track closely; ecosystem evolving |
| @anthropic-ai/sdk | latest | **0.90.0** | Primary LLM provider |
| @google/generative-ai | latest | **0.24.1** | Gemini fallback |
| openai | latest | **6.34.0** | Second fallback |
| bullmq | latest | **5.75.2** | Queue |
| @upstash/redis | latest | **1.37.0** | Queue backing |

### Utilities

| Package | Floor | Locked | Notes |
|---|---|---|---|
| nanoid | latest | **5.1.9** | IDs |
| fast-json-patch | latest | **3.1.1** | Undo/redo |
| fast-check | latest | **4.7.0** | Property-based tests |
| jszip | latest | **3.10.1** | PPTX + HTML5 ZIP |
| jspdf | latest | **4.2.1** | Vector PDF |
| gray-matter | latest | **4.0.3** | Skill frontmatter |
| remark | latest | **15.0.1** | Skill link parsing |
| ts-morph | latest | **28.0.0** | Skill generator AST |

### Import pipelines

| Package | Floor | Locked | Notes |
|---|---|---|---|
| linkedom | latest | **0.18.12** | Server-side DOM |
| fast-xml-parser | latest | **5.7.1** | Chosen over xml2js (faster, maintained) |
| googleapis | latest | **171.4.0** | Google Slides import |

---

## 4. Audit History

### Audit 0 — 2026-04-20 (T-001a)

- **Date**: 2026-04-20
- **Node**: 22.17.1 (local), floor `>=22.0.0` encoded in root `package.json` `engines`
- **pnpm**: 9.15.0 via Corepack
- **ADR**: ADR-001
- **Method**: `npm view <pkg> version` for each entry in §3; when `latest` exceeds the floor major, re-query with the floor-constrained range.

**Majors blocked (would require follow-up ADR to bump)**:
- typescript 6.0.3 → pinned 5.6.3 (floor prohibits TS 6 without ADR)
- @biomejs/biome 2.4.12 → pinned 1.9.4 (biome.json v1.9 schema)
- vitest 4.1.4 → pinned 2.1.9
- @vitest/coverage-v8 4.1.4 → pinned 2.1.9
- zod 4.3.6 → pinned 3.25.76 (floor prohibits Zod 4 without ADR)
- next 16.2.4 → pinned 15.5.15
- firebase 12.12.0 → pinned 11.10.0
- puppeteer 24.42.0 → pinned 23.11.1 (coordinated with vendored Hyperframes engine, Phase 4)
- size-limit 12.1.0 → pinned 11.2.0

**Installed at root** (tooling shared across workspace):
typescript, @biomejs/biome, turbo, vitest, @vitest/coverage-v8, @playwright/test, @changesets/cli, tsup, size-limit, @size-limit/preset-big-lib, license-checker, tsx, @types/node.

**Recorded but not installed**: runtime/library deps (react, zod, sharp, etc.) are pinned in §3 but installed into individual packages when those packages receive their proper scaffold (T-011 onward).

**Follow-ups**:
- Engineering-lead signoff box on ADR-001 Ratification Signoff can now be checked.
- Blocked majors should be re-evaluated at the next quarterly audit (2026-07-20).
- `@fontsource/*` and other per-package deps are versioned when their host package is scaffolded.

### Audit 1 addendum — 2026-04-20 (T-040 / Phase 2 kickoff backfill)

Backfill-only pass. Phase 2 (frame-runtime) introduces a set of test-infra
deps that were not enumerated in §3 at T-001a time; recorded here for
audit-history consistency rather than re-running the full `npm view` sweep.

**Added to §3**:
- `@types/react` → pinned **19.2.14** (matches React 19 floor)
- `@types/react-dom` → pinned **19.2.3**
- `@testing-library/react` → pinned **16.3.2** (React component testing)
- `happy-dom` → pinned **20.9.0** (DOM env for Vitest; chosen over jsdom)

**Installed at**: `@stageflip/frame-runtime` devDependencies. Not hoisted to
root — per-package install matches the rule from Audit 0.

**Not a policy change**: next quarterly audit (2026-07-20) re-queries these
alongside everything else.

---

## 5. Vendored Code Pinning

Vendored code (not via npm) is pinned by commit hash, not version number.

| Artifact | Commit | Date | ADR |
|---|---|---|---|
| `@hyperframes/engine` in `packages/renderer-cdp/vendor/` | _pending (T-080)_ | _pending_ | ADR-TBD |

Upgrading vendored code is always an ADR.

---

## 6. Forbidden / Not Used

| Package | Why |
|---|---|
| `remotion`, `@remotion/*` | License prohibits competing products. Our `@stageflip/frame-runtime` replaces. |
| `@ffmpeg/ffmpeg` (WASM) | ~2–5× slower than native; adds 30 MB bundle. System FFmpeg via `doctor` instead. |
| Any package under GPL / AGPL / SSPL / custom source-available with competitive use restrictions | License contamination risk |

---

## 7. LLM Provider Policy

`@stageflip/llm-abstraction` provides a stable internal interface. Under the hood:

- **Primary**: Anthropic Claude (most recent model family appropriate to task)
- **Fallback 1**: Google Gemini
- **Fallback 2**: OpenAI GPT

SDK versions can bump more aggressively than general deps — new models matter. Minor bumps per task (no ADR); major SDK changes still require ADR.

When building AI-dependent features, default to the latest and most capable Claude model unless task characteristics say otherwise (e.g., cost-optimized paths may prefer Haiku).
