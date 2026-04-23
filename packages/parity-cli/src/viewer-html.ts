// packages/parity-cli/src/viewer-html.ts
// Pure HTML generator for the T-137 visual-diff viewer. Takes a
// pre-built `ViewerHtmlInput` (fixture metadata + base64-encoded
// PNG data URIs) and returns a self-contained HTML string. All
// styles + JS are inlined; no external URLs, no network fetches.
//
// The caller (viewer.ts / report-cli.ts) is responsible for loading
// PNGs off disk and base64-encoding them; keeping this file IO-free
// makes it trivially testable without a fixture on disk.
//
// Three view modes are rendered per frame:
//   1. side-by-side — golden | candidate next to each other
//   2. slider       — draggable divider reveals the golden under the candidate
//   3. overlay-diff — candidate layered with CSS `mix-blend-mode: difference`
//                    over the golden; pure-black means identical
//
// Pixel-accurate SSIM / PSNR heatmaps are a follow-up. The mean
// per-frame scores are reported verbatim via the per-frame table
// rendered alongside each frame panel.

import type { FrameScore } from '@stageflip/parity';

import type { FixtureScoreOutcome, MissingFrame } from './score-fixture.js';

/** One reference frame's data for the HTML view. */
export interface ViewerFrame {
  readonly frame: number;
  /** `data:image/png;base64,…` URI, or null if the golden is missing. */
  readonly goldenUri: string | null;
  /** `data:image/png;base64,…` URI, or null if the candidate is missing. */
  readonly candidateUri: string | null;
  /** Per-frame score from `@stageflip/parity`. `null` for unscored fixtures. */
  readonly score: FrameScore | null;
  /** Reason a golden/candidate is absent. Mirrors `MissingFrame.reason`. */
  readonly missingReason?: MissingFrame['reason'];
}

/** One fixture's slice of the viewer document. */
export interface ViewerFixture {
  readonly name: string;
  readonly status: FixtureScoreOutcome['status'];
  readonly summary: string;
  /** Free-text description from the fixture's manifest (if any). */
  readonly manifestDescription?: string;
  /** Composition dimensions — lets the HTML preserve aspect ratio. */
  readonly width: number;
  readonly height: number;
  readonly thresholds: {
    readonly minPsnr: number;
    readonly minSsim: number;
    readonly maxFailingFrames: number;
  };
  readonly frames: readonly ViewerFrame[];
}

/** Whole-document input for `renderViewerHtml`. */
export interface ViewerHtmlInput {
  /** Optional document title. Defaults to `"StageFlip parity report"`. */
  readonly title?: string;
  readonly fixtures: readonly ViewerFixture[];
  /**
   * ISO 8601 timestamp stamped into the document footer. Injected by the
   * caller rather than sampled with `new Date()` so unit tests produce a
   * byte-stable output.
   */
  readonly generatedAt: string;
}

/** Produce a self-contained HTML document from the viewer input. */
export function renderViewerHtml(input: ViewerHtmlInput): string {
  const title = input.title ?? 'StageFlip parity report';
  const body = input.fixtures.length === 0 ? renderEmpty() : renderFixtures(input.fixtures);
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLES}</style>`,
    '</head>',
    '<body>',
    `<header class="report-header"><h1>${escapeHtml(title)}</h1>`,
    `<p class="generated-at">Generated ${escapeHtml(input.generatedAt)}</p></header>`,
    `<main>${body}</main>`,
    `<script>${SCRIPT}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}

function renderEmpty(): string {
  return '<section class="fixture empty"><p>No fixtures in this report.</p></section>';
}

function renderFixtures(fixtures: readonly ViewerFixture[]): string {
  return fixtures.map(renderFixture).join('\n');
}

function renderFixture(fixture: ViewerFixture): string {
  const header = [
    `<header class="fixture-header">`,
    `<h2>${escapeHtml(fixture.name)}</h2>`,
    `<p class="summary">${escapeHtml(fixture.summary)}</p>`,
    fixture.manifestDescription
      ? `<p class="description">${escapeHtml(fixture.manifestDescription)}</p>`
      : '',
    `<p class="thresholds">Thresholds: PSNR ≥ ${fixture.thresholds.minPsnr} dB · SSIM ≥ ${fixture.thresholds.minSsim} · max failing frames ${fixture.thresholds.maxFailingFrames}</p>`,
    '</header>',
  ].join('');

  // no-goldens / no-candidates / empty render as a skip banner — nothing to
  // show frame-wise. missing-frames is different: at least SOME reference
  // frames have both sides present, so we render the grid and let
  // `renderFrame` show per-frame "missing golden/candidate" banners for
  // the ones that don't.
  if (
    fixture.frames.length === 0 ||
    fixture.status === 'no-goldens' ||
    fixture.status === 'no-candidates'
  ) {
    const reason =
      fixture.status === 'no-goldens'
        ? 'Skipped — no goldens block (fixture is input-only).'
        : fixture.status === 'no-candidates'
          ? 'Skipped — no candidate frames found.'
          : 'No frames to display.';
    return `<section class="fixture skipped">${header}<div class="skip-banner">${escapeHtml(reason)}</div></section>`;
  }

  const aspectRatio = `${fixture.width} / ${fixture.height}`;
  const frames = fixture.frames.map((f) => renderFrame(f, aspectRatio)).join('\n');
  // missing-frames fixtures get a banner above the grid so the reader
  // knows why some frames show only one side.
  const missingBanner =
    fixture.status === 'missing-frames'
      ? `<div class="skip-banner">Partial — one or more reference frames are missing their golden or candidate; see per-frame banners below.</div>`
      : '';
  return `<section class="fixture">${header}${missingBanner}<div class="frames">${frames}</div></section>`;
}

function renderFrame(f: ViewerFrame, aspectRatio: string): string {
  const score = f.score;
  const passMark = score ? (score.passed ? 'PASS' : 'FAIL') : f.missingReason ? 'MISSING' : '—';
  const passClass = score ? (score.passed ? 'pass' : 'fail') : 'missing';
  const psnr = score && Number.isFinite(score.psnr) ? score.psnr.toFixed(2) : '∞';
  const ssim = score ? score.ssim.toFixed(4) : '—';
  const reasonsList =
    score && score.reasons.length > 0
      ? `<ul class="reasons">${score.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
      : '';

  if (f.goldenUri === null || f.candidateUri === null) {
    const missing = f.missingReason
      ? `missing ${escapeHtml(f.missingReason)}`
      : 'missing frame asset';
    return [
      `<div class="frame frame-missing" data-frame="${f.frame}">`,
      `<div class="frame-header"><span class="frame-num">frame ${f.frame}</span><span class="pass ${passClass}">${passMark}</span></div>`,
      `<div class="frame-missing-banner">${missing}</div>`,
      '</div>',
    ].join('');
  }

  // Three view modes per frame, switched client-side by the toolbar.
  // The HTML always emits all three; CSS class toggles show/hide.
  const modeToolbar = [
    `<div class="mode-toolbar" role="tablist">`,
    `<button type="button" class="mode-btn active" data-mode="side-by-side">side-by-side</button>`,
    `<button type="button" class="mode-btn" data-mode="slider">slider</button>`,
    `<button type="button" class="mode-btn" data-mode="overlay">overlay · difference</button>`,
    '</div>',
  ].join('');

  const sideBySide = [
    `<div class="view view-side-by-side" data-view="side-by-side">`,
    `<figure><figcaption>golden</figcaption><img alt="golden frame ${f.frame}" src="${f.goldenUri}" /></figure>`,
    `<figure><figcaption>candidate</figcaption><img alt="candidate frame ${f.frame}" src="${f.candidateUri}" /></figure>`,
    '</div>',
  ].join('');

  // Slider uses a `<input type=range>` controlling a CSS variable that
  // clips the candidate image so the golden underneath is revealed.
  const slider = [
    `<div class="view view-slider" data-view="slider" style="--slider: 50%; aspect-ratio: ${aspectRatio};">`,
    `<img class="slider-golden" alt="golden frame ${f.frame}" src="${f.goldenUri}" />`,
    `<img class="slider-candidate" alt="candidate frame ${f.frame}" src="${f.candidateUri}" />`,
    `<input type="range" min="0" max="100" value="50" class="slider-input" aria-label="slider position" />`,
    '</div>',
  ].join('');

  // Overlay-difference uses CSS mix-blend-mode: difference — pure black
  // pixels indicate identical channels; any colour is delta.
  const overlay = [
    `<div class="view view-overlay" data-view="overlay" style="aspect-ratio: ${aspectRatio};">`,
    `<img class="overlay-golden" alt="golden frame ${f.frame}" src="${f.goldenUri}" />`,
    `<img class="overlay-candidate" alt="candidate frame ${f.frame}" src="${f.candidateUri}" />`,
    '</div>',
  ].join('');

  const metrics = [
    `<dl class="frame-metrics">`,
    `<dt>PSNR</dt><dd>${psnr} dB</dd>`,
    `<dt>SSIM</dt><dd>${ssim}</dd>`,
    '</dl>',
    reasonsList,
  ].join('');

  return [
    `<div class="frame" data-frame="${f.frame}">`,
    `<div class="frame-header"><span class="frame-num">frame ${f.frame}</span><span class="pass ${passClass}">${passMark}</span></div>`,
    modeToolbar,
    sideBySide,
    slider,
    overlay,
    metrics,
    '</div>',
  ].join('');
}

/** HTML-escape untrusted strings sourced from fixture content. */
function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const STYLES = `
:root { --bg: #0f1115; --surface: #1b1e25; --border: #2a2f38; --text: #e7ecf3; --muted: #9aa2ad;
        --pass: #4ade80; --fail: #f87171; --missing: #fbbf24; --accent: #5af8fb; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Plus Jakarta Sans", sans-serif; }
.report-header { padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; z-index: 2; }
.report-header h1 { margin: 0; font-size: 18px; font-weight: 600; }
.generated-at { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
main { padding: 24px; display: flex; flex-direction: column; gap: 32px; }
.fixture { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
.fixture-header h2 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
.summary { margin: 0 0 4px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; color: var(--muted); }
.description, .thresholds { margin: 0 0 4px; color: var(--muted); font-size: 12px; }
.frames { display: flex; flex-direction: column; gap: 24px; margin-top: 16px; }
.frame { border-top: 1px solid var(--border); padding-top: 16px; }
.frame-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.frame-num { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 14px; }
.pass { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
.pass.pass { background: rgba(74, 222, 128, 0.12); color: var(--pass); }
.pass.fail { background: rgba(248, 113, 113, 0.12); color: var(--fail); }
.pass.missing { background: rgba(251, 191, 36, 0.12); color: var(--missing); }
.mode-toolbar { display: inline-flex; gap: 4px; margin-bottom: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 4px; }
.mode-btn { background: transparent; border: 0; color: var(--muted); font: inherit; font-size: 12px; padding: 4px 10px; border-radius: 4px; cursor: pointer; }
.mode-btn.active { background: var(--surface); color: var(--text); }
.view { display: none; }
.view.active { display: block; }
.view-side-by-side.active { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.view-side-by-side figure { margin: 0; }
.view-side-by-side figcaption { font-size: 11px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
.view-side-by-side img { width: 100%; display: block; border: 1px solid var(--border); border-radius: 4px; image-rendering: pixelated; }
.view-slider { position: relative; width: 100%; max-width: 960px; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
.view-slider img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
.view-slider .slider-candidate { clip-path: inset(0 calc(100% - var(--slider)) 0 0); }
.view-slider .slider-input { position: absolute; bottom: 8px; left: 12px; right: 12px; width: calc(100% - 24px); z-index: 3; }
.view-overlay { position: relative; width: 100%; max-width: 960px; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; background: #000; }
.view-overlay img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
.view-overlay .overlay-candidate { mix-blend-mode: difference; }
.frame-metrics { display: inline-grid; grid-template-columns: auto auto; gap: 4px 16px; margin: 12px 0 0; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; }
.frame-metrics dt { color: var(--muted); margin: 0; }
.frame-metrics dd { margin: 0; }
.reasons { margin: 8px 0 0; padding-left: 20px; color: var(--fail); font-size: 12px; }
.frame-missing, .fixture.skipped { opacity: 0.85; }
.frame-missing-banner, .skip-banner { background: rgba(251, 191, 36, 0.08); color: var(--missing); border: 1px dashed rgba(251, 191, 36, 0.4); border-radius: 4px; padding: 12px; font-size: 13px; margin-top: 8px; }
.fixture.empty { color: var(--muted); font-style: italic; }
`;

// Client-side JS: view-mode toggles + slider input wiring. Kept tiny;
// no framework, no bundler, works from file:// without a server.
const SCRIPT = `
(function () {
  function activate(frame, mode) {
    frame.querySelectorAll('.mode-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    frame.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('active', v.dataset.view === mode);
    });
  }
  document.querySelectorAll('.frame').forEach(function (frame) {
    activate(frame, 'side-by-side');
    frame.querySelectorAll('.mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { activate(frame, btn.dataset.mode); });
    });
    var sliderView = frame.querySelector('.view-slider');
    var input = frame.querySelector('.slider-input');
    if (sliderView && input) {
      input.addEventListener('input', function () {
        sliderView.style.setProperty('--slider', input.value + '%');
      });
    }
  });
})();
`;
