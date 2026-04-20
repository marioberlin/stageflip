# StageFlip — Dependency Lock & Audit Process

This document is the **source of truth** for dependency versions. Every value below is picked deliberately; bumps require a dedicated PR with ADR.

**Status**: Pending Phase 0 / T-001a audit. Values below are **minimum floors** until the audit runs.

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
| Node | 20 LTS | _pending_ | Target current active LTS; bump to 22 / 24 as they become active |
| pnpm | 9.x | _pending_ | — |

### Core tooling

| Package | Floor | Locked | Notes |
|---|---|---|---|
| typescript | 5.6 | _pending_ | No TS 6 without ADR |
| biome | 1.9 | _pending_ | — |
| turbo | 2.x | _pending_ | — |
| vitest | 2.x | _pending_ | — |
| @vitest/coverage-v8 | matches vitest | _pending_ | — |
| @playwright/test | 1.49 | _pending_ | — |
| @changesets/cli | 2.x | _pending_ | — |
| tsup | 8.x | _pending_ | — |
| size-limit + preset-big-lib | 11.x | _pending_ | — |
| license-checker | 25.x | _pending_ | — |

### Schema + runtime libraries

| Package | Floor | Locked | Notes |
|---|---|---|---|
| zod | 3.23 | _pending_ | Zod 4 requires ADR (breaking changes) |
| react | 19 | _pending_ | — |
| react-dom | 19 | _pending_ | — |
| next | 15 | _pending_ | — |
| jotai | 2.x | _pending_ | — |
| hono | 4.x | _pending_ | — |
| tailwindcss | 4.x | _pending_ | v4 has different config; migration documented in skill |
| @fontsource/* | latest | _pending_ | Version independently; keep in sync |

### Media / rendering

| Package | Floor | Locked | Notes |
|---|---|---|---|
| sharp | 0.33 | _pending_ | — |
| ssim.js | latest | _pending_ | For T-100 parity harness |
| puppeteer | 23.x | _pending_ | Coordinated with vendored Hyperframes engine version |
| fluent-ffmpeg | latest | _pending_ | System FFmpeg required; `doctor` validates |
| culori | latest | _pending_ | For interpolateColors (T-042) |
| flubber | latest | _pending_ | For interpolatePath (T-052) |
| gsap | 3.x | _pending_ | Business Green license procured; track GreenSock terms |
| lottie-web | latest | _pending_ | — |
| three | latest | _pending_ | — |

### Infrastructure

| Package | Floor | Locked | Notes |
|---|---|---|---|
| firebase-admin | 13.x | _pending_ | — |
| firebase | 11.x | _pending_ | Client SDK |
| @modelcontextprotocol/sdk | latest | _pending_ | Track closely; ecosystem evolving |
| @anthropic-ai/sdk | latest | _pending_ | Primary LLM provider |
| @google/generative-ai | latest | _pending_ | Gemini fallback |
| openai | latest | _pending_ | Second fallback |
| bullmq | latest | _pending_ | Queue |
| @upstash/redis | latest | _pending_ | Queue backing |

### Utilities

| Package | Floor | Locked | Notes |
|---|---|---|---|
| nanoid | latest | _pending_ | IDs |
| fast-json-patch | latest | _pending_ | Undo/redo |
| fast-check | latest | _pending_ | Property-based tests |
| jszip | latest | _pending_ | PPTX + HTML5 ZIP |
| jspdf | latest | _pending_ | Vector PDF |
| gray-matter | latest | _pending_ | Skill frontmatter |
| remark | latest | _pending_ | Skill link parsing |
| ts-morph | latest | _pending_ | Skill generator AST |

### Import pipelines

| Package | Floor | Locked | Notes |
|---|---|---|---|
| linkedom | latest | _pending_ | Server-side DOM |
| xml2js or fast-xml-parser | latest | _pending_ | PPTX parsing |
| googleapis | latest | _pending_ | Google Slides import |

---

## 4. Audit History

### Audit 0 — Pending (T-001a)

Date: _pending_
Node: _pending_
Rationale: _pending_
ADR: ADR-001

Concrete versions will populate this table after T-001a runs.

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
