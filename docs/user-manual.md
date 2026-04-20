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

**End of User Manual v1.0.** Feedback via Discord or GitHub issues. Manual itself lives in the repo; PRs welcome.
