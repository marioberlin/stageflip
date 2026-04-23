// packages/parity-cli/src/viewer-html.test.ts
// Pure HTML renderer tests — no IO, no fs.

import { describe, expect, it } from 'vitest';

import { type ViewerFixture, type ViewerHtmlInput, renderViewerHtml } from './viewer-html.js';

const baseFixture: ViewerFixture = {
  name: 'css-solid-background',
  status: 'scored',
  summary: 'css-solid-background: PASS (PSNR min 40.12 dB, SSIM min 0.9912, 0/3 failing)',
  manifestDescription: 'CSS solid-background fixture',
  width: 320,
  height: 180,
  thresholds: { minPsnr: 40, minSsim: 0.99, maxFailingFrames: 0 },
  frames: [
    {
      frame: 0,
      goldenUri: 'data:image/png;base64,iVBORw0KGgoAAA',
      candidateUri: 'data:image/png;base64,iVBORw0KGgoAAB',
      score: { frame: 0, psnr: 42.5, ssim: 0.9988, passed: true, reasons: [] },
    },
    {
      frame: 15,
      goldenUri: 'data:image/png;base64,iVBORw0KGgoAAC',
      candidateUri: 'data:image/png;base64,iVBORw0KGgoAAD',
      score: { frame: 15, psnr: 40.1, ssim: 0.9912, passed: true, reasons: [] },
    },
  ],
};

function input(fixtures: readonly ViewerFixture[] = [baseFixture]): ViewerHtmlInput {
  return {
    title: 'StageFlip parity report',
    fixtures,
    generatedAt: '2026-04-23T12:00:00.000Z',
  };
}

describe('renderViewerHtml', () => {
  it('emits a single self-contained HTML document string starting with <!doctype html>', () => {
    const html = renderViewerHtml(input());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('inlines all CSS + JS — no external URLs in <link> or <script src>', () => {
    const html = renderViewerHtml(input());
    expect(html).not.toMatch(/<link[^>]*\bhref=/i);
    expect(html).not.toMatch(/<script[^>]*\bsrc=/i);
  });

  it('embeds the title when provided and falls back to a default when absent', () => {
    expect(renderViewerHtml(input())).toContain('StageFlip parity report');
    const fallback = renderViewerHtml({
      fixtures: [baseFixture],
      generatedAt: '2026-04-23T12:00:00.000Z',
    });
    expect(fallback).toMatch(/<title>[^<]+<\/title>/);
  });

  it('embeds each fixture name, summary, and per-frame metrics in the document', () => {
    const html = renderViewerHtml(input());
    expect(html).toContain('css-solid-background');
    expect(html).toContain('css-solid-background: PASS');
    // frame numbers
    expect(html).toMatch(/frame\s*0\b/);
    expect(html).toMatch(/frame\s*15\b/);
    // PSNR + SSIM readouts (formatted to the same precision as CLI output)
    expect(html).toContain('42.50');
    expect(html).toContain('0.9988');
  });

  it('uses the supplied base64 data URIs as golden/candidate <img> src values', () => {
    const html = renderViewerHtml(input());
    expect(html).toContain('data:image/png;base64,iVBORw0KGgoAAA');
    expect(html).toContain('data:image/png;base64,iVBORw0KGgoAAB');
  });

  it('renders a missing-frame placeholder when goldenUri or candidateUri is null', () => {
    const withMissing = renderViewerHtml(
      input([
        {
          ...baseFixture,
          frames: [
            {
              frame: 0,
              goldenUri: null,
              candidateUri: 'data:image/png;base64,iVBORw0KGgoAAA',
              score: null,
              missingReason: 'golden',
            },
          ],
        },
      ]),
    );
    expect(withMissing).toMatch(/missing\s+golden/i);
  });

  it('marks failing frames with a visible FAIL indicator and renders the per-frame reasons', () => {
    const html = renderViewerHtml(
      input([
        {
          ...baseFixture,
          status: 'scored',
          summary: 'css-solid-background: FAIL',
          frames: [
            {
              frame: 0,
              goldenUri: 'data:image/png;base64,iVBORw0KGgoAAA',
              candidateUri: 'data:image/png;base64,iVBORw0KGgoAAB',
              score: {
                frame: 0,
                psnr: 28.2,
                ssim: 0.94,
                passed: false,
                reasons: ['PSNR 28.20 < 40', 'SSIM 0.9400 < 0.99'],
              },
            },
          ],
        },
      ]),
    );
    expect(html).toContain('FAIL');
    expect(html).toContain('PSNR 28.20 &lt; 40');
    expect(html).toContain('SSIM 0.9400 &lt; 0.99');
  });

  it('HTML-escapes fixture names and summaries so an untrusted string cannot inject markup', () => {
    const naughty = renderViewerHtml(
      input([
        {
          ...baseFixture,
          name: '<script>alert(1)</script>',
          summary: 'summary with <b>tags</b> & "quotes"',
          frames: [],
        },
      ]),
    );
    expect(naughty).not.toContain('<script>alert(1)</script>');
    expect(naughty).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(naughty).toContain('&quot;quotes&quot;');
  });

  it('renders three view-mode toggles: side-by-side, slider, and overlay-diff', () => {
    const html = renderViewerHtml(input());
    expect(html).toMatch(/side-by-side/i);
    expect(html).toMatch(/slider/i);
    expect(html).toMatch(/overlay|difference/i);
  });

  it('includes the resolved thresholds so the reader knows the bar the fixture was held to', () => {
    const html = renderViewerHtml(input());
    expect(html).toContain('40'); // minPsnr
    expect(html).toContain('0.99'); // minSsim
  });

  it('emits a non-scored status (no-goldens / no-candidates) as a skip banner rather than a frame grid', () => {
    const html = renderViewerHtml(
      input([
        {
          ...baseFixture,
          status: 'no-goldens',
          summary: 'css-solid-background: skipped (no goldens block; fixture is input-only)',
          frames: [],
        },
      ]),
    );
    expect(html).toMatch(/skipped|no goldens/i);
  });

  it('renders missing-frames fixtures with the grid intact — per-frame banners, not a whole-fixture skip', () => {
    const html = renderViewerHtml(
      input([
        {
          ...baseFixture,
          status: 'missing-frames',
          summary: 'css-solid-background: skipped (1/2 frame(s) missing)',
          frames: [
            {
              frame: 0,
              goldenUri: null,
              candidateUri: 'data:image/png;base64,iVBORw0KGgoAAA',
              score: null,
              missingReason: 'golden',
            },
            {
              frame: 15,
              goldenUri: 'data:image/png;base64,iVBORw0KGgoAAC',
              candidateUri: 'data:image/png;base64,iVBORw0KGgoAAD',
              score: { frame: 15, psnr: 40.1, ssim: 0.9912, passed: true, reasons: [] },
            },
          ],
        },
      ]),
    );
    // Partial-banner at the fixture level (not the whole-fixture skip).
    expect(html).toMatch(/partial/i);
    // Per-frame missing banner for frame 0.
    expect(html).toMatch(/missing\s+golden/i);
    // Frame 15 renders with its PSNR readout — grid is intact.
    expect(html).toContain('40.10');
  });

  it('renders an empty-input document without crashing (no fixtures at all)', () => {
    const html = renderViewerHtml({
      fixtures: [],
      generatedAt: '2026-04-23T12:00:00.000Z',
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toMatch(/no fixtures/i);
  });

  it('puts the generatedAt stamp in the output so readers know when the report was produced', () => {
    const html = renderViewerHtml(input());
    expect(html).toContain('2026-04-23T12:00:00.000Z');
  });
});
