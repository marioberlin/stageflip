# StageFlip — User Manual v1.0

User-facing installation and usage guide. This manual lives in the repo and renders to the public docs site (mdx over the same content).

---

## 1. Installation

StageFlip meets you where you are. Pick the surface(s) that fit your workflow.

### 1.1 Claude plugin (conversational — recommended for most users)

```bash
$ claude plugin install stageflip
✓ Installed skills: stageflip, stageflip-slide, stageflip-video, stageflip-display
✓ Registered MCP server: stageflip-api
→ Connect your account: https://stageflip.com/auth/claude
```

Open the URL, authorize. Claude now has access to StageFlip skills (`/stageflip`, `/stageflip-slide`, `/stageflip-video`, `/stageflip-display`) and can invoke StageFlip tools directly in chat.

### 1.2 CLI (scripting, CI/CD, power users)

```bash
# macOS / Linux
$ brew install stageflip

# or via npm
$ pnpm add -g @stageflip/cli

# verify environment
$ stageflip doctor
✓ Node 22.x
✓ pnpm 9.x
✓ FFmpeg 6.x at /opt/homebrew/bin/ffmpeg
✓ Chrome (bundled)
✓ Network reachable
✓ All system checks passed.

$ stageflip login
→ Opening browser for auth…
✓ Logged in as you@example.com (org: acme-corp)
```

### 1.3 Web editor

- `https://app.stageflip.com/slide` — presentations
- `https://app.stageflip.com/video` — video
- `https://app.stageflip.com/display` — display ads

Sign in. Click **New** to create a document. The editor supports the same tools as the CLI and plugin; changes sync in real time across sessions.

### 1.4 MCP server (for AI tools beyond Claude)

For Cursor, Continue, Zed, or any MCP-capable client:

```jsonc
// ~/.config/{client}/mcp-servers.json
{
  "stageflip": {
    "url": "https://api.stageflip.com/mcp",
    "auth": "stageflip-api-key-from-dashboard"
  }
}
```

Generate an API key at `https://stageflip.com/account/api-keys`.

### 1.5 Self-hosted (enterprise)

```bash
$ git clone https://github.com/<org>/stageflip
$ cd stageflip
$ pnpm install && pnpm build
$ cp .env.example .env              # configure Firebase project, LLM provider, etc.
$ pnpm docker:up
```

Three apps on `:3001` / `:3002` / `:3003`; API on `:3000`; render worker on `:4000`. Point your Claude plugin at your instance by setting `STAGEFLIP_API_URL` before install.

---

## 2. Quickstarts

### 2.1 StageFlip.Slide — make a deck from a prompt

**From Claude**:

```
You: /stageflip-slide create a 10-slide Series A pitch for a B2B observability SaaS

Claude: Creating deck…
  ✓ Plan: 10 slides covering [problem, market, product, traction, team, ask]
  ✓ Drafting content with Executor
  ✓ Validating (quality tier: A)

Preview: https://app.stageflip.com/slide/edit/deck_abc123
Ready to export? I can produce PPTX, PDF, or video walkthrough.
```

**From CLI**:

```bash
$ stageflip new my-deck --mode=slide \
    --from-prompt="10-slide Series A pitch for B2B observability SaaS"

$ stageflip render my-deck --format=pptx
✓ ./my-deck/my-deck.pptx (2.4 MB)
```

### 2.2 StageFlip.Video — make a video ad

```bash
$ stageflip new coffee-ad --mode=video \
    --aspect=9:16 --duration=30s \
    --from-prompt="Ad for sustainable coffee brand, urban young audience, warm tone"

→ Planning scenes…
→ Hook moment @ 00:00–00:03
→ Product reveal @ 00:10–00:18
→ CTA @ 00:26–00:30
→ Auto-captioning voiceover (Whisper)…
✓ Created ./coffee-ad

$ stageflip render coffee-ad --format=video --bounce=9:16,1:1,16:9
→ Rendering 3 aspect-ratio variants in parallel…
✓ coffee-ad.9x16.mp4   (18.3 MB)
✓ coffee-ad.1x1.mp4    (16.8 MB)
✓ coffee-ad.16x9.mp4   (17.9 MB)
```

### 2.3 StageFlip.Display — make a banner suite

```bash
$ stageflip new saas-banner --mode=display \
    --size=300x250 \
    --from-prompt="Banner for SaaS trial, CTA 'Start Free Trial', blue brand"

$ stageflip render saas-banner \
    --format=html5-zip \
    --sizes=300x250,728x90,160x600,320x50

→ Rendering 4 banner sizes…
→ File-size budget: 150 KB each
✓ saas-banner.300x250.zip  (84 KB)
✓ saas-banner.728x90.zip   (71 KB)
✓ saas-banner.160x600.zip  (92 KB)
✓ saas-banner.320x50.zip   (62 KB)
✓ Fallback PNGs generated

$ stageflip lint saas-banner
✓ IAB compliance: pass
✓ GDN compliance: pass (≤30 s runtime, ≤3 loops)
✓ No autoplay audio
✓ All file sizes within budget
```

---

## 3. Concepts (Short Reference)

| Concept | What it is |
|---|---|
| **Document** | Typed canonical object with one of three content modes: slide, video, display |
| **Element** | An atom on the canvas: text, image, shape, chart, table, video, svg, embed, group, component instance, raster region |
| **Clip** | A reusable visual component with typed props and a runtime (frame-runtime, GSAP, Lottie, etc.) |
| **Theme** | Palette + typography + spacing tokens. Swap a theme to re-skin a document |
| **Master** | Reusable slide/scene/banner layout with designated slots |
| **Variable** | Typed document-level parameter (string/number/color/enum). Drives parametric templates |
| **Transition** | Between-slide/scene animation: cut, fade, slide, push, dissolve, or shader-based |
| **Timing (B1)** | When an element mounts on the timeline |
| **Keyframes (B3)** | Per-property tween curves within an element |
| **Animation (B4)** | Entrance/exit preset: fade_in, slide_in_left, bounce_in, etc. |
| **Runtime** | The engine that animates a clip (frame-runtime, GSAP, Lottie, Three, shader, CSS, Blender) |
| **Parity test** | Automated render comparison ensuring editor preview matches final export |
| **Preset** | A ratified composition recipe (palette + geometry + canon) selectable from a cluster — invoked via a `compose_*` agent tool |
| **Cluster** | A domain group of presets (broadcast / sports / weather / titles / data / captions / CTAs / AR overlays). 8 clusters, 50 presets on `main` |

### 3.1 Preset clusters

StageFlip ships 50 ratified presets across 8 clusters. Each cluster (with the exception of titles) exposes a `compose_*` agent-tool surface for invocation from Claude / MCP.

| Cluster | Domain | Presets | Compose tools | Reference |
|---|---|---:|---|---|
| **A** | News & broadcast | 8 | `cluster-a-compose` | `skills/stageflip/presets/news/SKILL.md` |
| **B** | Sports | 9 | `cluster-b-compose` | `skills/stageflip/presets/sports/SKILL.md` |
| **C** | Weather | 6 | `cluster-c-compose` | `skills/stageflip/presets/weather/SKILL.md` |
| **D** | Titles & main-on-end | 6 | (none — titles ship as-is) | `skills/stageflip/presets/titles/SKILL.md` |
| **E** | Data & finance | 6 | `cluster-e-compose` | `skills/stageflip/presets/data/SKILL.md` |
| **F** | Captions & subtitles | 6 | `cluster-f-compose` | `skills/stageflip/presets/captions/SKILL.md` |
| **G** | CTAs / social | 5 | `cluster-g-compose` | `skills/stageflip/presets/ctas/SKILL.md` |
| **H** | AR & environmental overlays | 4 | `cluster-h-compose` | `skills/stageflip/presets/ar/SKILL.md` |

Cluster D is the deliberate exception: titles are picked verbatim rather than composed. All other clusters ship a `compose_*` handler bundle registered in `CANONICAL_BUNDLES`.

Cluster H presets render via static-fallback in v1; live-mount of the underlying `ThreeSceneClip` is gated on Track A finale (T-397..T-405) and the tenant-level frontier-enablement toggle (T-411).

---

## 4. CLI Reference

```
stageflip <command> [options]

Documents
  new <name>                             Create a new document
    --mode=<slide|video|display>
    --aspect=<16:9|9:16|1:1|4:5|…>       (video)
    --size=<WxH>                          (display)
    --duration=<ms or e.g. 30s>
    --from-prompt="<string>"
    --from-template=<template-id>
    --from-pptx=<path>                    (imports PPTX into slide mode)
    --from-google-slides=<url>            (imports via OAuth)

  list [--mode=…] [--org=…]               List documents accessible to you
  info <name>                             Show doc metadata + loss flags + quality tier
  rename <name> <new-name>
  delete <name>                           Soft-delete; recoverable for 30 days

Editing
  preview <name>                          Open in web editor
  export <name> --format=<fmt> [opts]     Alias: render
  render  <name> --format=<fmt> [opts]
    --codec=<h264|h265|vp9|vp8|prores>    (video)
    --crf=<int>
    --bounce=<a,b,c>                      multi-aspect-ratio render
    --sizes=<a,b,c>                       multi-size display render
    --out=<path>                          default: ./<name>/<name>.<ext>

Validation
  lint <name>                             Pre-render static validation
  validate <name>                         Parity + brand + accessibility; returns tier A/B/F
  loss-flags <name> --target=<fmt>        What won't round-trip through target format

Templates + themes
  theme list
  theme learn <source-path>               Run 8-step theme-learning pipeline
  template save <name> [--public]         Save current doc as a template
  template use <template-id>

Bulk / parametric
  bulk-render <template-id> <csv>         Render a variant per CSV row
    --out-dir=<path>
    --concurrency=<N>                     default: 4
  variables list <name>
  variables set <name> <key>=<value>

Import / export
  import <file>                           Auto-detect: pptx, gslides, html, lottie, afx
  export-schema <name>                    Dump canonical JSON to stdout

Account + config
  login [--org=<org>]
  logout
  doctor                                  Environment diagnostics
  whoami
  config get <key>
  config set <key>=<value>
  api-key create [--scope=…]

Skills
  skills list                             List installed skill files
  skills search <query>                   Full-text search skill tree
  skills open <name>                      Print skill body

Developer
  parity run [<fixture>]                  Run parity harness locally
  parity update-expected <fixture>        Re-bake reference frames
  runtimes list
  clips list [--runtime=…] [--mode=…]
```

---

## 5. Using StageFlip with Claude

Installed skills become slash commands. Progressive disclosure: Claude loads only what the task needs.

| Command | Loads |
|---|---|
| `/stageflip` | Master overview, when to use each mode |
| `/stageflip-slide` | Slide mode conventions + clips + tools |
| `/stageflip-video` | Video mode conventions + clips + tools |
| `/stageflip-display` | Display mode conventions + clips + tools |

Claude can autonomously pull subskills (`concepts/determinism`, `runtimes/gsap`, `workflows/bulk-render-with-variables`) when a task needs them.

**Example flows**:

```
You: /stageflip-slide create a 10-slide deck on RAG architectures for engineering audience
Claude: [runs create_document, add_slides, apply_template, rewrite_text, validate]
        Done. Quality tier A. Preview at …

You: /stageflip-video turn slide 3 of deck_abc into a 10s teaser video in 9:16
Claude: [runs export_slide_as_video_seed, bounce_to_aspect_ratios, render]
        Done: coffee-teaser.9x16.mp4

You: /stageflip-display make 5 banner variants with these headlines: [list]
Claude: [runs bulk_render_with_variables]
        Rendered 5 variants across 3 sizes = 15 banners. ZIP: …
```

### 5.1 Cluster compose tools

Each cluster (except D) exposes one or more `compose_*` tools that materialize a preset into the document with cluster-canonical defaults. Claude picks a tool from the cluster matching the user's brief and parameterizes it with the brief's content. Examples:

| Tool | Bundle | Outcome |
|---|---|---|
| `compose_news_lower_third` | `cluster-a-compose` | Add a CNN-style lowerThird with the brief's headline |
| `compose_score_bug` | `cluster-b-compose` | Add a sports scorebug parameterized by team / score / period |
| `compose_weather_panel` | `cluster-c-compose` | Add a forecast panel (TWC / BBC / NHC variants) |
| `compose_finance_ticker` | `cluster-e-compose` | Add a Bloomberg-style ticker bound to a data source |
| `compose_caption_band` | `cluster-f-compose` | Add a caption track with cluster-F preset styling |
| `compose_cta_sticker` | `cluster-g-compose` | Add a follow / subscribe / link CTA |
| `compose_ar_overlay` | `cluster-h-compose` | Add an AR overlay (sky-sports / hawkeye / olympic / nba variants) |

Full enumeration is auto-generated under `skills/stageflip/tools/cluster-{a,b,c,e,f,g,h}-compose/SKILL.md`. The orchestrator reads these on plugin install; Claude routes user briefs to the matching tool by cluster intent.

### 5.2 Semantic-layout tools (cross-cluster)

Beyond cluster-compose tools, StageFlip ships a small set of **semantic-layout** tools that are domain-agnostic and operate on the document model directly:

| Tool | Outcome |
|---|---|
| `arrange_grid` | Lay elements out on a grid (rows × cols); auto-resolves overlaps |
| `arrange_stack` | Stack elements vertically or horizontally with consistent gutters |
| `arrange_align` | Align elements on an axis (left/right/center/top/bottom/baseline) |
| `arrange_distribute` | Distribute spacing evenly between elements on an axis |
| `arrange_reveal` | Staggered headline → body → media reveal (T-407); use when the brief says "intro slide", "title card", or "hero reveal" |

`arrange_reveal` is the newest addition; see `docs/tasks/T-407.md`.

### 5.3 Asset-generation tools (Phase 14)

The `asset-generation` handler bundle (T-423) exposes the Provider Seam (ADR-007) for agent use. Three tools cover the day-to-day asset-gen surface:

| Tool | Outcome |
|---|---|
| `generate_asset` | Generate an audio / image / video / 3D / music / SFX asset via a routed adapter; returns the cached asset URL, `MediaProvenance`, `costIncurred`, and `budgetRemaining` |
| `list_asset_providers` | Enumerate the adapters the tenant is permitted to use, filtered by license posture and per-modality capability |
| `query_asset_cache` | Look up cached assets by content-addressed `cacheKey` (ADR-008 §D1) |

Full enumeration is auto-generated under `skills/stageflip/tools/asset-generation/SKILL.md`. Adapter catalogue (per-vendor capability / license / cost / latency) is auto-generated under `skills/stageflip/reference/asset-providers/SKILL.md`.

### 5.4 Streaming agent events (T-442)

Agent execution streams `ExecutorEvent`s over SSE / `ReadableStream`. Long-running generations (asset-gen, multi-step planning) emit incremental progress, partial outputs, and tool-call boundaries. The editor and CLI both subscribe to the stream for progressive UI; see `skills/stageflip/concepts/streaming-agent-events/SKILL.md`.

---

## 6. Common Workflows

### 6.1 Import an existing PPTX and enhance with AI

```bash
$ stageflip import ~/Downloads/old-deck.pptx
✓ Imported as deck_xyz (22 slides, 3 loss flags: embedded fonts, macro, SmartArt → rasterized)

$ stageflip info deck_xyz
  Loss flags:
    - 2 slides used embedded fonts; substituted with Inter
    - 1 slide contained SmartArt; rasterized as image
    - 1 slide contained VBA macro; dropped

# Apply the theme learned from your brand book
$ stageflip theme learn ~/brand-book.pptx --name=acme-theme
$ stageflip theme apply deck_xyz --theme=acme-theme

# From Claude:
#   /stageflip-slide rewrite deck_xyz for a CFO audience
```

### 6.2 Parametric template for sales outreach

```bash
# Save an ad as a template with two variables: {headline, product_shot}
$ stageflip template save coffee-ad --public=false

# Render 100 variants from a CSV
$ stageflip bulk-render coffee-ad prospects.csv --out-dir=./renders
→ Rendering 100 documents (4 in parallel)…
✓ 100 MP4s in ./renders/
```

### 6.3 Collaborative editing

Open the web editor. Share the document URL. Other users with access see each other's cursors and selections in real time. Undo works per user; conflicts resolve via CRDT (Yjs).

### 6.4 Async asset generation with optimistic placeholders (T-438)

Image / video / 3D / music generation can take seconds-to-minutes. The agent returns a **placeholder element** immediately — a lightweight stand-in (typed mediaKind, dimensions, transient `cacheKey`) — so the document model is editable while the adapter runs. When generation completes, the SSE stream emits a swap event and the placeholder progressively upgrades to the real asset.

The placeholder respects layout, transitions, and parity; rendering the document with a still-pending placeholder is safe (the placeholder ships its own deterministic render path). See `skills/stageflip/concepts/optimistic-placeholders/SKILL.md`.

---

## 7. Design System (Abyssal Clarity)

StageFlip ships with **Abyssal Clarity** — a dark, bioluminescent design system. Document themes override tokens; the UI-kit follows the system.

Full token reference: `skills/stageflip/concepts/theme-system/SKILL.md`.

---

## 8. Export & Round-Trip Fidelity

| Target | Fidelity level | Typical loss flags |
|---|---|---|
| Video (MP4/MOV/WebM) | Lossless from canonical | None |
| PNG (2× DPI) | Single-frame snapshot | Animations flattened |
| PDF vector | High for text+shapes | Video, 3D, shaders → raster fallback |
| PDF raster | Pixel-exact | Larger file size |
| PPTX | Medium-high | Advanced animations, custom shaders, 3D → simplified or rasterized |
| HTML5 ZIP | Full within IAB spec | Runtime must stay in allowed set |
| Marp MD | Text + structure only | Complex visuals dropped |

Before exporting, `stageflip loss-flags <doc> --target=pptx` shows exactly what won't round-trip. The web editor surfaces this as a pre-export modal.

### 8.1 Static vs live routing (`@stageflip/export-router`, T-408)

Targets fall into two render modes:

| Render mode | Targets | Pipeline |
|---|---|---|
| **Static** | MP4 / MOV / WebM / PNG / PDF / PPTX / Marp MD | CDP host bakes frames; deterministic |
| **Live** | HTML5 ZIP / display-interactive | Live runtime hosts in browser; preserves interactivity |

`@stageflip/export-router` is the single decision layer: given a document and a target format, it routes to the static or live pipeline. Cluster H (AR overlays) renders static-fallback in v1 even when the underlying clip is `live`-capable; live-mount of `ThreeSceneClip` is gated on Track A finale (T-397..T-405) plus the tenant frontier-enablement toggle (T-411).

### 8.2 Export-parity CI gate (T-409)

Every preset × export-target combination is verified by the `Gate - preset × export parity` CI job on every push to `main` or any PR touching `packages/runtimes/**`, `packages/export-*/**`, `packages/parity-cli/**`, or any `presets/**` markdown. The gate runs the cross-product matrix and asserts that the routing decision recorded in each preset's parity fixture matches `@stageflip/export-router`'s live decision.

A preset that ships a parity fixture inconsistent with the router is rejected at PR time, not at user-render time.

### 8.3 Provenance-aware exports (Phase 14)

Every Phase 14 AI-generated asset carries a `MediaProvenance` payload (ADR-008 §D2). Exporters surface this provenance per format so downstream platforms can comply with FTC AI-content disclosure rules and the EU AI Act:

| Exporter | Marker | Task |
|---|---|---|
| Display IAB HTML5 ZIP | Auto-marks AI-generated frames per FTC + EU AI Act; embeds `data-ai-content` attribute on affected elements | T-439 |
| Video MP4 / MOV / WebM | Opt-in watermark + `ai-content.json` sidecar bundled with the export ZIP | T-440 |
| PPTX | `<a:extLst>` extension under each AI-generated picture / video; preserved through round-trip | T-441 |

The PPTX extension survives PowerPoint round-trip; the video sidecar is a sibling file (the MP4 itself remains a vanilla container). Display exports always carry the marker. Video and PPTX provenance can be toggled per export profile.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `stageflip doctor` says FFmpeg missing | Install: `brew install ffmpeg` or apt equivalent |
| `stageflip render` hangs | Check `~/.stageflip/logs/render-*.log`; increase `--timeout` |
| Parity mismatch between preview and export | Run `stageflip parity run <fixture>`; if PSNR/SSIM low, file bug with fixture |
| Claude plugin tools missing in chat | `claude plugin list`; reinstall if `stageflip` absent |
| Auth error after `stageflip login` | `stageflip logout && stageflip login`; check org membership |
| Exports fail with determinism error | Clip likely uses `Math.random()` or `Date.now()`; update clip or file bug |
| Display banner over file-size budget | Run `stageflip optimize <doc>`; or remove heavy runtimes (Three, shader) |
| Font rendering looks wrong in export | Check `stageflip info <doc>` for missing fonts; embed locally via asset upload |
| Preset renders blank or near-blank | Likely a structural-extension regression (CLAUDE.md §13). Check `docs/handover-cluster-d-regression.md` for the historical case and `pnpm tsx scripts/check-preset-integrity.ts` for the non-blank-pixel invariant |

---

## 10. Getting Help

| Resource | Where |
|---|---|
| Docs | https://stageflip.com/docs |
| Skill tree | `stageflip skills list` and https://stageflip.com/docs/skills |
| Discord | https://stageflip.com/discord |
| GitHub Issues | https://github.com/<org>/stageflip/issues |
| Status page | https://status.stageflip.com |
| Security | security@stageflip.com (GPG key on site) |

### 10.1 GA-readiness audit (`pnpm check-ga-readiness`, T-410)

For maintainers and self-hosters: `pnpm check-ga-readiness` walks the repo, verifies a 35-criterion checklist (8 categories) spanning cluster ratification, CI gates, documentation, frontier runtime, enterprise admin, Phase 13 closeout, and **Phase 14 — AI asset generation** (Category 8, added by T-447). It emits `docs/ga-readiness-report.md` with PASS / FAIL / WARN per criterion.

This is a **manual phase-boundary audit**, not a CI gate. Run it at phase boundaries to surface the GA punch list. Exit code is 0 when all criteria are PASS / WARN / N/A; non-zero when any criterion FAILs.

---

## 11. Versioning & Compatibility

StageFlip uses semver across packages. Breaking changes to the canonical schema bump the schema `version` field; the `parseDocument` function runs registered migrations automatically. Exports remain compatible across minor versions.

The Claude plugin (`@stageflip/plugin`) pins to a compatible API version. When the plugin's pin falls outside the server's supported range, `claude plugin upgrade stageflip` prompts.

---

## 12. Roadmap

Published at https://stageflip.com/roadmap. Highlights:

- **Near term**: Blender bake runtime (photoreal 3D); Three.js editor preview parity
- **Mid term**: Unreal Movie Render Queue runtime; advanced variable bindings (live data); real-time cursors in the Video timeline
- **Long term**: On-device render previews (WebGPU); enterprise SSO/SCIM; custom runtime SDK for third-party extensions

---

## 13. Phase 14 — AI Asset Generation

StageFlip ships first-class AI asset generation across five modalities (audio / image / video / 3D / music+SFX) behind a vendor-neutral seam. The model: agents describe what they need; the platform routes to a per-tenant-permitted adapter; results are cached, license-classified, and provenance-stamped.

### 13.1 Provider Seam (ADR-007) + Asset Generation Contract (ADR-008)

Two architectural decisions frame the Phase 14 surface:

- **ADR-007 — Provider Seam Pattern.** A single orchestration layer (`@stageflip/adapters-core`: `AdapterRegistry` + `CapabilityParser` + `LicenseGate` + `FallbackChainExecutor`) sits between agent tools and every vendor adapter. The seam is reused across LLM, asset-gen, and future modalities.
- **ADR-008 — Asset Generation Contract.** Five canonical modality contracts (audio / image / video / 3D / music) and seven source-grounded provider interfaces. `MediaProvenance` is non-optional on every generated element. `AssetCache` uses content-addressed cache keys (§D1) so re-generation with identical inputs is free.

Both ADRs live at `docs/decisions/ADR-007-provider-seam-pattern.md` and `docs/decisions/ADR-008-asset-generation.md`.

### 13.2 Reference adapters

Nine reference adapters land in Phase 14 β. All ship in `stub mode v1` (deterministic local fixtures); production wire-up is per-tenant.

| Adapter | Modality | License posture | Capability highlights |
|---|---|---|---|
| `@stageflip/tts-kokoro` | TTS | Apache 2.0 | Word-timestamp output (T-436 captions bypass) |
| `@stageflip/tts-fish-speech` | TTS | Apache 2.0 | Voice cloning (consent-gated) |
| `@stageflip/3d-tripo` | 3D | Proprietary-byo | Quad topology + auto-rigging (character) |
| `@stageflip/3d-meshy` | 3D | Proprietary-byo | Triangle topology (props + environment) |
| `@stageflip/video-seedance` | Video | Proprietary-byo | 15s 1080p + native audio + lip-sync (via fal API) |
| `@stageflip/video-runway` | Video | Proprietary-byo | Runway Gen-4 production-tier (no audio) |
| `@stageflip/music-acestep` | Music | MIT | 5-minute track in <10s |
| `@stageflip/music-yue` | Music | Apache 2.0 (attribution req.) | Monetizable output |
| `@stageflip/sfx-stable-audio` | SFX | Apache 2.0 | Short-form Stable Audio Open |

Full catalogue (cost / latency / per-modality capabilities) is auto-generated under `skills/stageflip/reference/asset-providers/SKILL.md`.

### 13.3 Cost budget (T-443)

Every `generate_asset` tool result returns:

- `costIncurred` — the cents spent on this call by the chosen adapter.
- `budgetRemaining` — the tenant's remaining monthly AI-generation budget.

When the cheapest viable adapter would exceed the remaining budget, the agent re-routes to a cheaper provider in the fallback chain. Per-tenant cost ledger lives in `TenantCostTrackerStore`. See `skills/stageflip/concepts/cost-budget/SKILL.md`.

### 13.4 Adapter sandbox model (T-444)

Each adapter declares a `sandbox.kind` in its `AdapterDescriptor`. The platform routes the adapter invocation through a matching `SandboxRunner`:

| `sandbox.kind` | Runner | Use |
|---|---|---|
| `none` | Direct invocation | First-party adapters with no third-party code |
| `process` | OS-process boundary | Local binaries (e.g. on-device models) |
| `container` | OCI container | Bundled vendor binaries |
| `network-isolated` | Container + egress allowlist | Vendor APIs with constrained outbound surface |

Per-tenant credentials never leave `TenantAdapterCredentialsStore`; the runner injects them at invocation boundary only. Every adapter call emits an audit event consumed by the security audit (§13.6). See `skills/stageflip/concepts/adapter-sandbox/SKILL.md`.

### 13.5 Usage telemetry (T-445)

Every adapter call emits an `AdapterUsageEvent` (modality / adapter / tenant / outcome / latency / tokens-or-units / cost). The default emitter is in-memory; production deploys swap in a queue-backed emitter.

Admins query aggregated usage via the `query_usage_telemetry` tool, grouped by adapter, modality, tenant, and time-bucket. See `skills/stageflip/concepts/usage-telemetry/SKILL.md`.

### 13.6 Data-flow security audit (T-446)

Every adapter ships a `SecurityManifest` declaring data-out classification, retention, transit policy, and residency. The `check-data-flow-security` CI gate fails the build when a manifest is missing, drifted, or violates the per-modality whitelist. The inaugural audit report (T-446) covers all 9 reference adapters.

This gate runs on every PR touching `packages/adapters-*/**`. See `skills/stageflip/concepts/data-flow-security/SKILL.md`.

### 13.7 Cross-cutting integrations (Phase 14 γ)

Phase 14 asset adapters feed Phase 13 runtimes via these integrations:

| Integration | Path | Task |
|---|---|---|
| **TTS → captions** | `@stageflip/tts-kokoro` / `@stageflip/tts-fish-speech` emit word-timestamps that bypass Whisper for captions cluster F | T-436 |
| **3D → ThreeSceneClip** | `@stageflip/3d-tripo` / `@stageflip/3d-meshy` produce GLB consumed by the Three.js scene clip via `cacheKey` | T-437 |
| **Provenance → exporters** | Display / video / PPTX exporters surface `MediaProvenance` per §8.3 | T-439 / T-440 / T-441 |

### 13.8 Tenant settings — frontier enablement (T-411)

The Phase 14 γ / Phase 13 hinge: tenants opt in to frontier (Three / shader / Blender) runtimes via a per-tenant flag in `TenantSettings`. The flag also gates live-mount of Cluster H AR overlays. See `skills/stageflip/concepts/tenant-settings/SKILL.md`.

---

**End of User Manual v1.0.** Feedback via Discord or GitHub issues. Manual itself lives in the repo; PRs welcome.
