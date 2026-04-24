---
title: Quickstart
description: Install + first render across slide, video, and display modes.
---

StageFlip ships as a Claude plugin, a CLI, a web editor, and an MCP
server. For the fastest path from zero to a rendered artifact, pick
the surface that matches your workflow.

## Install the CLI

```bash
npm install -g @stageflip/cli
stageflip doctor       # environment check
stageflip login        # OAuth round-trip; persists a JWT
```

Alternatively for MCP-aware agents:

```bash
claude plugin install stageflip
```

## Slide — make a deck from a prompt

```bash
stageflip new my-deck --mode=slide \
  --from-prompt="10-slide Series A pitch for B2B observability SaaS"

stageflip render my-deck --format=pptx
# → ./my-deck/my-deck.pptx
```

From Claude, the same flow runs as:

```
/stageflip-slide create a 10-slide Series A pitch for a B2B observability SaaS
```

## Video — make a 30-second ad

```bash
stageflip new coffee-ad --mode=video \
  --aspect=9:16 --duration=30s \
  --from-prompt="Ad for sustainable coffee brand, urban young audience"

stageflip render coffee-ad --format=mp4 --bounce=9:16,1:1,16:9
# → 3 aspect-ratio variants rendered in parallel
```

Captions are auto-generated via Whisper with deterministic content-
hash caching — re-renders never re-bill the transcription API.

## Display — make an IAB banner suite

```bash
stageflip new saas-banner --mode=display \
  --size=300x250 \
  --from-prompt="Banner for SaaS trial, CTA 'Start Free Trial'"

stageflip render saas-banner \
  --format=html5-zip \
  --sizes=300x250,728x90,160x600,320x50

stageflip lint saas-banner   # IAB + GDN compliance
```

Every banner is enforced under a 150 KB IAB initial-load cap, with a
midpoint-frame PNG + animated GIF fallback embedded automatically.

## What's next

- Read the [concepts](/skills/stageflip/concepts/rir/) to build a
  mental model of the shared engine.
- Browse the [tool index](/skills/stageflip/tools/) to see what
  semantic tools the agent triad has.
- Skim the [CLI reference](/skills/stageflip/reference/cli/) for the
  full command surface.
