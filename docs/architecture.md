# StageFlip — Architecture Overview v1.2

**Document status**: canonical reference. Lives at `docs/architecture.md`. Evolves via PR + ADR.
**Last updated**: Project initialization. Review feedback integrated.

---

## 1. Product Thesis

**StageFlip is an AI-native, schema-driven motion platform with a pluggable, deterministic rendering substrate and a frictionless agent authoring surface.**

One engine powers three products that share data, themes, components, and rendering:

| Product | Primary output | Competitors |
|---|---|---|
| **StageFlip.Slide** | Presentations (PPTX, PDF, video walkthrough) | Gamma, Tome, Beautiful.ai, PowerPoint |
| **StageFlip.Video** | Video ads, social video, linear content | Canva Video, Descript, Synthesia, Creatopy |
| **StageFlip.Display** | HTML5 banner ads (IAB/GDN-compliant) | Celtra, Bannerflow, Google Web Designer |

Users work through five surfaces, all backed by the same core: **web editors, CLI, Claude plugin, MCP server, public REST API.**

---

## 2. Engineering Invariants (Non-Negotiable)

Enforced by CI. Violations block merge.

| # | Invariant |
|---|---|
| I-1 | Canonical schema is the single source of truth. Everything round-trips through it. |
| I-2 | Rendering is deterministic. No `Date.now()`, `Math.random()`, `performance.now()`, `requestAnimationFrame`, `setTimeout`, `setInterval`, or render-time `fetch()` in clip/runtime code. |
| I-3 | Agents mutate documents only through typed semantic tools. No raw HTML emission into the document. |
| I-4 | Rendering backends are pluggable. No clip is tied to any specific runtime. |
| I-5 | Every clip, runtime, export target, and import adapter has a parity-harness test (PSNR + SSIM). |
| I-6 | Zero imports of Remotion packages. CI grep gates this. |
| I-7 | All external code is Apache 2.0 / MIT / BSD / ISC / LGPL (dynamic link). CI gates. |
| I-8 | Human-facing and agent-facing knowledge lives in the `skills/` tree. Drift from source is a CI failure. |
| I-9 | No agent context contains more than 30 tool definitions simultaneously. Hierarchical tool-bundle loading is mandatory. |

---

## 3. System Topology

```
                     ┌──────────────────────────────────────────┐
                     │   5 SURFACES — all equivalent, all ACL'd │
                     ├──────────┬──────────┬──────────┬─────────┤
                     │ Web      │ CLI      │ Claude   │ MCP     │ Public
                     │ editors  │          │ plugin   │ server  │ REST API
                     │ (3)      │          │          │         │
                     └────┬─────┴────┬─────┴────┬─────┴────┬────┘
                          │          │          │          │
                          └──────────┴────┬─────┴──────────┘
                                          ▼
                            ┌────────────────────────────┐
                            │   StageFlip API (Hono)     │
                            │   AuthZ / rate-limit / …   │
                            └──────────────┬─────────────┘
                                           │
                         ┌─────────────────┼─────────────────┐
                         ▼                 ▼                 ▼
                ┌────────────────┐ ┌──────────────┐ ┌────────────────┐
                │ Semantic tool  │ │ Storage layer│ │ Agent plane    │
                │ registry       │ │ (contract +  │ │ Planner →      │
                │ (80+ tools     │ │  Firebase    │ │ Executor →     │
                │  over 14       │ │  adapter)    │ │ Validator      │
                │  bundles,      │ │  snapshot +  │ │                │
                │  loaded        │ │  patch +     │ │                │
                │  hierarchically)│ │  delta       │ │                │
                └────────┬───────┘ └──────┬───────┘ └────────┬───────┘
                         │                │                  │
                         └────────────────┼──────────────────┘
                                          ▼
                     ┌───────────────────────────────────────┐
                     │          CANONICAL DOCUMENT           │
                     │     Zod-validated, mode-discriminated │
                     │     slide | video | display content   │
                     └──────────────────┬────────────────────┘
                                        │
                                        ▼
                     ┌───────────────────────────────────────┐
                     │       RIR COMPILER (intermediate)     │
                     │  resolve themes / components /        │
                     │  bindings / variables / timing /      │
                     │  stacking contexts / font preload     │
                     └──────────────────┬────────────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
   ┌──────────────────┐       ┌──────────────────┐      ┌──────────────────┐
   │  EDITOR RUNTIME  │       │  EXPORT DISPATCH │      │ THUMBNAIL RUNTIME│
   │  (live preview)  │       │  (headless)      │      │ (static DOM)     │
   │  frame-runtime + │       │  cdp-backend     │      │ for filmstrips,  │
   │  live GSAP /     │       │  (vendored       │      │ list previews    │
   │  Lottie / Three  │       │   Hyperframes)   │      │                  │
   │  + useMediaSync  │       │  + asset         │      │                  │
   │  + FontManager   │       │    preflight     │      │                  │
   │                  │       │  + bake queue    │      │                  │
   │                  │       │    (Blender…)    │      │                  │
   └──────────────────┘       └────────┬─────────┘      └──────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────────┐
                     │   EXPORT TARGETS (fan-out encoders)   │
                     │  video (h264/h265/vp9/vp8/prores)    │
                     │  png · pdf-raster · pdf-vector       │
                     │  pptx · html5-zip · marp             │
                     └───────────────────────────────────────┘

CROSS-CUTTING (quality + knowledge planes):
┌─────────────┬────────────────┬──────────────────┬─────────────────────┐
│ Determinism │ Pre-render     │ Parity harness   │ Skills tree         │
│ shim + ESLint│ linter (30+)  │ (PSNR + SSIM)    │ (one source of      │
│ (incl. rAF, │                │                  │  truth → docs +     │
│  timers)    │                │                  │  plugin + agent ctx)│
└─────────────┴────────────────┴──────────────────┴─────────────────────┘
```

---

## 4. Technology Stack

**Versions are locked at Phase 0 / T-001a via a `latest-stable` audit.** The values below are minimum floors; the audit picks concrete versions and commits them to `docs/dependencies.md`.

| Layer | Choice | Minimum version floor |
|---|---|---|
| Language | TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | 5.6 |
| Runtime | Node | 20 LTS (target current active LTS at Phase 0) |
| Package manager | pnpm | 9.x |
| Monorepo | Turborepo | 2.x |
| Lint/format | Biome | 1.9 |
| Schema | Zod | 3.23 (Zod 4 requires ADR) |
| UI runtime | React | 19 |
| Editor apps | Next.js (App Router) | 15 |
| Editor state | Jotai | 2 |
| API | Hono | 4 |
| Styling | Tailwind CSS | 4 |
| UI primitives | shadcn/ui (copy-paste, not versioned) | — |
| Browser automation | Puppeteer (via vendored Hyperframes engine) | 23 |
| Image diff | sharp + ssim.js | 0.33 / latest |
| FFmpeg | System install, invoked via child_process | 6 |
| Test runner | Vitest | 2 |
| E2E | Playwright | 1.49 |
| MCP SDK | `@modelcontextprotocol/sdk` | latest at Phase 10 |
| Primary database | Firebase Firestore | SDK v13 |
| Asset storage | Firebase Storage (GCS) | — |
| Presence | Firebase Realtime Database | — |
| Job queue | BullMQ on Upstash Redis | — |
| Analytics sink | BigQuery (streamed from Firestore) | — |
| Auth | Firebase Auth | — |
| CI | GitHub Actions | — |
| Versioning | Changesets | 2 |
| Hosting (apps) | Vercel | — |
| Hosting (API/workers) | Cloud Run + Cloud Functions | — |

See `docs/dependencies.md` for current locked versions and the audit process.

---

## 5. Canonical Data Model

Typed and mode-discriminated.

```ts
CanonicalDocument {
  id, version, mode: 'slide' | 'video' | 'display'
  theme, assets, variables, masters, components
  metadata: { brand, locale, dataBindings, importDiagnostics, … }
  content: SlideContent | VideoContent | DisplayContent   // discriminated
}

SlideContent   { slides[], sections[], transitions[], masters[], presenterNotes[] }
VideoContent   { aspectRatio, fps, durationMs, tracks: { visual, audio, caption, overlay } }
DisplayContent {
  dimensions, maxDurationMs, maxLoops, frames[], clickTags[], fallback,
  budget: {
    totalZipKb,
    externalFontsAllowed: boolean,
    externalFontsKbCap: number,
    assetsInlined: boolean
  }
}
```

**Elements** are the same across modes — 11 discriminated types: `text | image | shape | chart | table | video | svg | embed | group | component_instance | raster_region`.

**Animations** (19 types), **keyframes**, and **timing** (B1–B5 layers) are uniformly defined on `BaseElement`.

**Stacking contexts**: the RIR compiler explicitly assigns `zIndex = arrayIndex * 10` and wraps elements whose runtime is `three`, `shader`, or `embed` in `isolation: isolate` containers. Array order alone is insufficient once mixed runtimes are in play.

---

## 6. Render Intermediate Representation (RIR)

Compiled from `CanonicalDocument`. All indirection resolved:

- Theme color refs → literal hex
- Component instances → inlined trees with slot substitution
- Variables → literal values
- Data bindings → frozen snapshots (or `stale` flag)
- Timing (B1–B5) → absolute frame numbers
- Stacking contexts → explicit z-indexes + isolation wrappers
- Font requirements → aggregated list for preload

RIR is **frozen**, **rebuilt per render**, **never persisted**. It decouples the schema from any rendering backend.

```
CanonicalDocument → RIR → { editor preview, export dispatch, thumbnail }
```

---

## 7. Runtime System (Pluggable)

### 7.1 ClipRuntime Contract

```ts
type RuntimeKind  = 'frame-runtime' | 'css' | 'gsap' | 'lottie' | 'three' | 'shader' | 'blender'
type RuntimeTier  = 'live' | 'bake'

interface ClipRuntime<Props> {
  kind: RuntimeKind
  tier: RuntimeTier
  fontRequirements?: FontRequirement[]        // picked up by FontManager

  // Live-tier methods (tier='live')
  editor?:      LiveEditorInterface<Props>
  export?:      LiveExportInterface<Props>
  thumbnail?:   ThumbnailInterface<Props>

  // Bake-tier methods (tier='bake')
  bake?:        BakeInterface<Props>          // submits job, awaits result
  materialize?: MaterializeInterface<Props>   // injects pre-baked frames at export
}
```

### 7.2 Live runtimes (mount in DOM, seek at 60fps)

| Kind | Purpose |
|---|---|
| `frame-runtime` | StageFlip's React-based frame-driven runtime (replaces Remotion) |
| `css` | Static, no animation — cheapest, used for thumbnails and display banners |
| `gsap` | Timeline-based JS animation; MotionPath, MorphSVG, SplitText |
| `lottie` | Designer-native After Effects exports |
| `three` | WebGL 3D scenes |
| `shader` | WebGL fragment shaders for transitions and backgrounds (all shaders declare `precision highp float;`) |

### 7.3 Bake runtimes (pre-render offline, inject frames)

| Kind | Purpose | Status |
|---|---|---|
| `blender` | Photoreal 3D, simulations | Phase 12 |
| `unreal-mrq` | Game-engine cinematic | Future |
| `aerender` | Legacy AE workflows | Future |

Bake runtimes run on backend workers (GPU). Editor shows cached proxies; export injects baked PNG sequences via frame-lookup (same mechanism as pre-extracted video frames).

---

## 8. Rendering Backends

| Backend | Used for | Implementation |
|---|---|---|
| Editor runtime | Live in-browser preview | React + frame-runtime + live GSAP/Lottie/three mounts + `useMediaSync` for `<video>`/`<audio>` + `FontManager` blocking render on `document.fonts.ready` |
| Export runtime | Headless video/PNG/PDF export | Vendored Hyperframes engine (CDP/BeginFrame + FFmpeg) + asset preflight (all `file://` before capture) + font pre-embedding |
| Thumbnail runtime | Static filmstrips, list previews | CSS-only static DOM projection — no animation runtime |

Export runtime dispatches per-frame to the appropriate runtime. For bake runtimes, the dispatcher runs a **two-pass model**: (1) pre-walk RIR, enqueue all bake jobs, await completion; (2) then capture loop with bake results materialized as injected PNG sequences.

### Determinism shim

Installed before any runtime library imports. Overrides (scoped to the render context):

- `Date.now`, `new Date()`, `Date()` → virtual clock from `FrameClock`
- `performance.now` → same
- `Math.random` → seeded PRNG from `hash(clipId, frame)`
- `requestAnimationFrame` / `cancelAnimationFrame` → enqueued into frame-step queue, fired on `FrameClock.advance()` with deterministic timestamp
- `setTimeout` / `setInterval` → frame-scheduled equivalents
- `fetch` / `XMLHttpRequest` → **throw** (no render-time network I/O)

Emits a `console.warn` in dev and a telemetry event in prod when the shim intercepts a call that passed source lint (catches transitive-dependency drift).

---

## 9. Storage Architecture

### Contract (first, then implementations)

```ts
interface DocumentStore {
  // Snapshot semantics (initial load, periodic checkpoints, exports)
  getSnapshot(id, opts?): Promise<CanonicalDocument | null>
  putSnapshot(id, doc): Promise<void>

  // Delta semantics (for live sync + future CRDT backends)
  applyUpdate(id, update: Uint8Array, origin?): Promise<{ version: number }>
  subscribeUpdates(id, fn): Unsubscribe

  // Patch semantics (for undo + agent mutations)
  applyPatch(id, patch: ChangeSet): Promise<{ version: number }>
  getHistory(id, opts?): Promise<ChangeSet[]>
}
```

Phase 6 Firebase adapter implements snapshot + patch; stubs delta (throws `NotSupportedError`). Phase 12 Yjs adapter implements all three. In-memory test adapter (Phase 1) implements all three to exercise the contract.

### Firestore schema

```
orgs/{orgId}
  ├── members/{userId}                  # { role, joinedAt }
  ├── documents/{docId}                 # CanonicalDocument (< 1 MiB; assets by ref)
  │   ├── changesets/{csId}             # append-only JSON patches
  │   └── renders/{renderId}            # render job state + artifact ref
  ├── themes/{themeId}
  ├── templates/{templateId}
  └── assets/{assetId}                  # metadata only

users/{userId}                          # profile
bakeCache/{inputsHash}                  # content-addressed bake refs
telemetry/{eventId}                     # streamed nightly to BigQuery
```

### Binary storage

```
Firebase Storage
  /orgs/{orgId}/assets/{assetId}/...
  /orgs/{orgId}/renders/{renderId}/...
  /bakes/{hash}/frame-{N}.png
```

### Ephemeral

```
Realtime Database
  /presence/{docId}/{userId}            # cursor, selection, heartbeat

Upstash Redis queues
  stageflip:renders                     # render jobs
  stageflip:bakes                       # Blender bake jobs
```

All access via `@stageflip/storage` contract — no Firestore idioms leak into application code.

---

## 10. Agent Plane

```
User intent
    ↓
Planner agent  → selects tool BUNDLES required for the task (≤3 bundles)
                → emits PlanStep[] (ordered tool calls within those bundles)
    ↓
Executor agent → loads only the tools from active bundles (total ≤30 in context)
                → dispatches each step through tool-router
                → each tool is a pure function (doc → newDoc + result)
                → can call `expand_scope(bundle)` mid-execution if needed
    ↓
Validator agent → programmatic visual diff (PSNR + SSIM) gates quality tier
                → LLM only for qualitative checks (brand voice, aesthetics,
                  claim verification, reading level) — not for every pixel
    ↓
Output (updated doc + artifacts + quality report)
```

**Tool bundles**: 14 bundles × ~5–10 tools each covering ~80 semantic tools (read, create, mutate, timing, layout, validate, clip/animation, element CM1, slide CM1, table CM1, accessibility, QC/export, domain [finance/sales/OKR], data-source, semantic-layout).

**LLM abstraction**: `@stageflip/llm-abstraction` swaps between Anthropic Claude (primary), Google Gemini, OpenAI. Function-calling, streaming, retry, rate-limit.

---

## 11. Skills & Distribution

**Skills tree** (`skills/stageflip/`) is the single source of truth for:

1. Internal architecture documentation
2. Public docs site (MDX renderer over the same tree)
3. Claude plugin context (bundled into `@stageflip/plugin`)
4. Agent execution prompts (Implementer / Reviewer context)
5. In-editor contextual help

Structure: `concepts/ · modes/ · runtimes/ · tools/ · clips/ · workflows/ · reference/`. Each SKILL.md under 250 lines; examples-over-prose; cross-linked; auto-generated where source-derived (clip catalog, tool index, validation rules, schema reference, CLI reference).

**Distribution artifacts**:

| Artifact | What it bundles | Consumer |
|---|---|---|
| `@stageflip/skills` | Skill markdown tree | Docs site, agent context |
| `@stageflip/mcp-server` | MCP wrapper over semantic tools | Claude Code, Cursor, other MCP clients |
| `@stageflip/plugin` | Skills + MCP config + manifest | `claude plugin install stageflip` |
| `@stageflip/cli` | Command-line interface | Humans + CI |

---

## 12. Monorepo Map

```
apps/
  stageflip-slide/    stageflip-video/    stageflip-display/
  api/                cli/                 dev-harness/

packages/
  schema/ rir/ frame-runtime/
  runtimes/{contract, frame-runtime-bridge, css, gsap, lottie, three, shader, blender}
  renderer-core/ renderer-cdp/
  profiles/{contract, slide, video, display}
  agent/ engine/ llm-abstraction/
  determinism/ validation/
  design-system/ editor-shell/ ui-kit/
  storage/ storage-firebase/ storage-postgres/
  import-{pptx, google-slides, hyperframes-html, slidemotion-legacy}
  export-{video, pdf, pptx, html5-zip, marp, loss-flags}
  collab/
  skills-core/ skills-sync/ skills/
  mcp-server/ plugin/
  testing/

skills/stageflip/   # source of truth
tests/fixtures/     # parity decks per mode
```

---

## 13. Quality Gates (CI-Enforced)

Every PR:

1. `pnpm typecheck` (strict)
2. `pnpm lint` (Biome)
3. `pnpm test` + ≥85% coverage on changed code
4. `pnpm check-licenses` (whitelist only)
5. `pnpm check-remotion-imports` (zero matches)
6. `pnpm check-determinism` (scoped ESLint)
7. `pnpm check-skill-drift` (auto-gen'd skills synced)
8. `pnpm size-limit` (bundle budgets)
9. `pnpm parity` (PSNR + SSIM on fixtures, if rendering touched)
10. E2E Playwright (nightly + release)

---

## 14. License Posture

- **StageFlip code**: choice between Apache 2.0 and BSL 1.1 pending — see `docs/decisions/ADR-001-initial-stack.md`.
- **Vendored Hyperframes engine**: Apache 2.0 — `NOTICE` file preserved in `packages/renderer-cdp/vendor/`.
- **Dependencies**: MIT / Apache 2.0 / BSD / ISC / LGPL (dynamic only) — whitelist enforced.
- **Forbidden**: GPL, AGPL, SSPL, Remotion License, any competitive-use restriction.
- **Provenance**: `THIRD_PARTY.md` lists every dep + every studied codebase. PR descriptions cite prior-art reads.

---

## 15. Exit State at First Public Beta

- 3 product apps live (slide, video, display)
- 1 CLI, 1 Claude plugin, 1 MCP server published
- `stageflip doctor` green on macOS + Linux + WSL
- End-to-end prompt → rendered video in <3 min for 30 s ad
- 20+ parity fixtures green across runtimes and export formats
- Zero Remotion imports; Apache 2.0 compliance complete
- Skills tree = docs = plugin; no drift

---

## 16. Changelog

- **v1.2** (this file): review feedback integrated. Added invariant I-9; rAF + timers to determinism shim; storage contract updated to snapshot + patch + delta; RIR compiler adds stacking-contexts and font-requirement aggregation; export pipeline adds asset preflight; parity harness uses PSNR + SSIM; Phase 6 approach changed from copy-and-rip to greenfield-shell-and-port.
- **v1.1**: Firebase storage strategy; five-surface clarification; SlideMotion migration approach.
- **v1.0**: Initial design covering schema, RIR, runtimes, modes, agent, skills.
