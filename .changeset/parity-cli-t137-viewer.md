---
'@stageflip/parity-cli': minor
---

T-137 — visual-diff viewer. New `stageflip-parity report` subcommand
that renders a self-contained HTML artifact from any set of scored
fixtures.

Three view modes per frame:

- **Side-by-side** — golden ‖ candidate.
- **Slider** — candidate layered over golden with a draggable divider.
- **Overlay · difference** — candidate layered over golden with
  CSS `mix-blend-mode: difference`; black = identical.

Per-frame PSNR / SSIM readouts, failure reasons, and threshold recap
render alongside each frame panel. PNG bytes are base64-embedded so
the HTML is portable (emailable, PR-attachable, file:// viewable).
Skip statuses (`no-goldens` / `no-candidates` / `missing-frames`)
render as banner-only sections so the viewer is useful pre-goldens
too.

New public surface:

- `renderViewerHtml(input)` — pure HTML generator (no IO).
- `buildViewerInput(outcomes, pngReader, options)` — orchestrator
  that reads PNG bytes via an injectable `PngReader` port.
- `runReport(argv, io)` + `parseReportArgs(argv)` + `REPORT_HELP_TEXT`
  — CLI subcommand entry.

Types: `ViewerHtmlInput`, `ViewerFixture`, `ViewerFrame`,
`BuildViewerInputOptions`, `PngReader`, `ReportCliOptions`.

CLI:

```sh
stageflip-parity report [fixture.json ...] --out report.html
stageflip-parity report --fixtures-dir packages/testing/fixtures --out report.html
stageflip-parity report --help
```

Exit `0` on successful HTML emission (scoring PASS/FAIL does not
change the exit code — the viewer is a diagnostic tool, not a gate).

Pixel-level PSNR/SSIM heatmaps are out of scope — they need
block-level SSIM access in `@stageflip/parity` that isn't public yet.
Mean per-frame scores ship today; heatmaps are tracked as a follow-up
in `skills/stageflip/workflows/parity-testing/SKILL.md`.

Plan row promoted `T-137` → `[shipped]`.
