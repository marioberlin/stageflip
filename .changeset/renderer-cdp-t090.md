---
"@stageflip/renderer-cdp": minor
---

Reference render tests — 3 fixtures → MP4 → ffprobe verify (T-090).

**Phase 4 exit criterion reached**: three fixture RIR documents
render end-to-end through a real headless browser, a real FFmpeg
process, and a real ffprobe verification. No stubs on the hot path.

New modules (packages/renderer-cdp/src/):

- `puppeteer-session.ts` — concrete `CdpSession` backed by
  `puppeteer-core`. Browser-factory seam for tests (no chrome
  launch). Host HTML is pluggable; defaults to
  `canvasPlaceholderHostHtml` — a minimal canvas page that exposes
  `window.__sf.setFrame(n)` so the pipeline is exercised without a
  full React bundle (that lands with T-100 parity harness).
  Session reuses one browser across concurrent mounts; has a
  separate `closeSession()` to tear it down.
- `ffprobe.ts` — `ffprobe(filePath)` →
  `{ format, streams, raw }`. Spawns via the T-085 `ChildRunner`
  seam, parses the `-print_format json` output, surfaces
  `FfprobeError` on non-zero exit.
- `reference-fixtures.ts` — three deterministic RIR documents
  (`solidBackground`, `multiElement`, `videoClip`). None use clip
  content so the e2e suite doesn't depend on runtime registration.
- `reference-render.ts` — `renderReferenceFixture(opts)` orchestrates
  session + encoder + ffprobe + returns `{ export, probe }`.
  `canRunReferenceRenders()` detects Chrome (standard paths +
  `PUPPETEER_EXECUTABLE_PATH` + `CHROME_BIN`) + ffmpeg + ffprobe
  (PATH + `FFMPEG_PATH` / `FFPROBE_PATH`) so the e2e suite skips
  cleanly on CI without them.

**Tests split into two suites**:

- Unit (`puppeteer-session.test.ts`, `ffprobe.test.ts`,
  `reference-render.test.ts`) — fake browser + fake runner; run
  everywhere; 24 new cases.
- E2E (`reference-render.e2e.test.ts`) — real chrome + real ffmpeg
  + real ffprobe; 3 cases one per fixture; guarded by
  `canRunReferenceRenders()`. Per-test budget 60s. Vitest skips
  the whole `describe` with the reason surfaced in output when
  tooling is missing.

**Behavioural fix in the dispatcher**: `exportDocument`'s
preflight-blocked path now swallows a secondary `sink.close()`
failure so the `PreflightBlockedError` reaches the caller. Before:
if a real `FFmpegEncoder` was handed in, its close would fail with
"Output file does not contain any stream" (ffmpeg got zero writes),
masking the actual preflight diagnostic. Unit tests continue to
pass because `InMemoryFrameSink.close()` never threw in the first
place.

**Dependency added**: `puppeteer-core@23.11.1`
(pre-pinned in `docs/dependencies.md` §3 for T-090). MIT. Dynamic
import inside `createPuppeteerBrowserFactory` so consumers that
never instantiate a Puppeteer session don't pay the load cost.

Test surface: 27 new cases (9 puppeteer-session + 9 ffprobe + 6
reference-render unit + 3 reference-render e2e) = 201 total
across 20 files (+ 27 from T-089's 174). E2E suite adds ~3s per
run when tooling is present.
