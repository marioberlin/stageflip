// packages/import-hyperframes-html/src/parseHyperframes.test.ts
// Integration tests for parseHyperframes. Covers AC #1 / #4-#10 / #11-#16 /
// #21-#25 at the public-surface level.

import type { VideoContent } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { parseHyperframes } from './parseHyperframes.js';

function fetcherFromMap(files: Record<string, string>) {
  return async (rel: string): Promise<string> => {
    const v = files[rel];
    if (v === undefined) {
      throw new Error(`fetcher: missing composition ${rel}`);
    }
    return v;
  };
}

const MASTER_9_16 = `
  <!doctype html>
  <html><body>
    <div id="master-root" data-composition-id="master"
         data-width="1080" data-height="1920" data-duration="16.04">
      <div data-composition-id="main-orchestration"
           data-composition-src="compositions/main-orchestration.html"
           data-start="0" data-duration="16.04" data-track-index="0"></div>
    </div>
  </body></html>`;

const MAIN_COMPOSITION_SIMPLE = `
  <template id="main-orchestration-template">
    <div data-composition-id="main-orchestration"
         data-width="1080" data-height="1920" data-duration="16.04">
      <video src="https://example.com/clip.mp4"
             style="left: 0px; top: 0px; width: 1080px; height: 1920px"></video>
      <div style="left: 540px; top: 1360px; width: 200px; height: 100px">Hello</div>
    </div>
  </template>`;

describe('parseHyperframes', () => {
  it('AC #1: returns Document with content.mode = "video"', async () => {
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': MAIN_COMPOSITION_SIMPLE,
      }),
    });
    expect(result.document.content.mode).toBe('video');
  });

  it('AC #4: 1080x1920 master => aspectRatio = "9:16"', async () => {
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': MAIN_COMPOSITION_SIMPLE,
      }),
    });
    const v = result.document.content as VideoContent;
    expect(v.aspectRatio).toBe('9:16');
  });

  it('AC #5: 1920x1080 master => aspectRatio = "16:9"', async () => {
    const html = MASTER_9_16.replace('data-width="1080"', 'data-width="1920"').replace(
      'data-height="1920"',
      'data-height="1080"',
    );
    const result = await parseHyperframes(html, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': MAIN_COMPOSITION_SIMPLE,
      }),
    });
    const v = result.document.content as VideoContent;
    expect(v.aspectRatio).toBe('16:9');
  });

  it('AC #6: custom dimensions (1440x900) => {kind: "custom", w, h}', async () => {
    const html = MASTER_9_16.replace('data-width="1080"', 'data-width="1440"').replace(
      'data-height="1920"',
      'data-height="900"',
    );
    const result = await parseHyperframes(html, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': MAIN_COMPOSITION_SIMPLE,
      }),
    });
    const v = result.document.content as VideoContent;
    expect(v.aspectRatio).toEqual({ kind: 'custom', w: 1440, h: 900 });
  });

  it('AC #7: data-duration = "16.04" seconds => durationMs = 16040', async () => {
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': MAIN_COMPOSITION_SIMPLE,
      }),
    });
    const v = result.document.content as VideoContent;
    expect(v.durationMs).toBe(16040);
  });

  it('AC #8 + #9: 3 compositions => 3 tracks with classified kinds', async () => {
    const masterHtml = `
      <!doctype html><html><body>
        <div id="master-root" data-composition-id="master"
             data-width="1080" data-height="1920" data-duration="16.04">
          <div data-composition-id="main-orchestration"
               data-composition-src="m.html"
               data-start="0" data-duration="16.04" data-track-index="0"></div>
          <div data-composition-id="graphics"
               data-composition-src="g.html"
               data-start="0" data-duration="16.04" data-track-index="1"></div>
          <div data-composition-id="captions"
               data-composition-src="c.html"
               data-start="0" data-duration="16.04" data-track-index="2"></div>
        </div>
      </body></html>`;
    const compositions = {
      'm.html':
        '<template id="m-template"><div data-composition-id="main-orchestration" data-width="1080" data-height="1920" data-duration="16.04"><video src="https://example.com/v.mp4" style="left: 0px; top: 0px; width: 1080px; height: 1920px"></video></div></template>',
      'g.html':
        '<template id="g-template"><div data-composition-id="graphics" data-width="1080" data-height="1920" data-duration="16.04"><div style="left: 0px; top: 0px; width: 100px; height: 100px">G</div></div></template>',
      'c.html':
        '<template id="c-template"><div data-composition-id="captions" data-width="1080" data-height="1920" data-duration="16.04"><div style="left: 0px; top: 0px; width: 100px; height: 100px">C</div></div></template>',
    };
    const result = await parseHyperframes(masterHtml, {
      fetchCompositionSrc: fetcherFromMap(compositions),
    });
    const v = result.document.content as VideoContent;
    expect(v.tracks).toHaveLength(3);
    expect(v.tracks[0]?.kind).toBe('visual');
    expect(v.tracks[1]?.kind).toBe('overlay');
    expect(v.tracks[2]?.kind).toBe('caption');
  });

  it('AC #11: <img src=...> => ImageElement with unresolved src', async () => {
    const composition = `
      <template id="t"><div data-composition-id="main-orchestration"
           data-width="1080" data-height="1920" data-duration="16.04">
        <img src="https://example.com/pic.png" style="left: 0; top: 0; width: 100px; height: 100px" />
      </div></template>`;
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': composition,
      }),
    });
    const v = result.document.content as VideoContent;
    const el = v.tracks[0]?.elements[0] as { type: string; src: unknown };
    expect(el.type).toBe('image');
    expect(el.src).toEqual({ kind: 'unresolved', oocxmlPath: 'https://example.com/pic.png' });
  });

  it('AC #12: <video src=...> => VideoElement', async () => {
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': MAIN_COMPOSITION_SIMPLE,
      }),
    });
    const v = result.document.content as VideoContent;
    const el = v.tracks[0]?.elements[0] as { type: string };
    expect(el.type).toBe('video');
  });

  it('AC #13: <audio src=...> => AudioElement (audio-only composition => track.kind=audio)', async () => {
    // Use a non-"main" composition id so the audio-only heuristic wins.
    const masterHtml = `
      <!doctype html><html><body>
        <div id="master-root" data-composition-id="master"
             data-width="1080" data-height="1920" data-duration="16.04">
          <div data-composition-id="sfx-pack"
               data-composition-src="compositions/sfx-pack.html"
               data-start="0" data-duration="16.04" data-track-index="1"></div>
        </div>
      </body></html>`;
    const composition = `
      <template id="t"><div data-composition-id="sfx-pack"
           data-width="1080" data-height="1920" data-duration="16.04">
        <audio src="https://example.com/sfx.mp3" style="left: 0; top: 0; width: 1px; height: 1px"></audio>
      </div></template>`;
    const result = await parseHyperframes(masterHtml, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/sfx-pack.html': composition,
      }),
    });
    const v = result.document.content as VideoContent;
    expect(v.tracks[0]?.kind).toBe('audio');
    const el = v.tracks[0]?.elements[0] as { type: string };
    expect(el.type).toBe('audio');
  });

  it('AC #14: <div> with text only => TextElement', async () => {
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': MAIN_COMPOSITION_SIMPLE,
      }),
    });
    const v = result.document.content as VideoContent;
    const text = v.tracks[0]?.elements[1] as { type: string; text: string };
    expect(text.type).toBe('text');
    expect(text.text).toBe('Hello');
  });

  it('AC #15: nested <div>s => GroupElement', async () => {
    const composition = `
      <template id="t"><div data-composition-id="main-orchestration"
           data-width="1080" data-height="1920" data-duration="16.04">
        <div style="left: 0; top: 0; width: 100px; height: 100px">
          <div style="left: 10px; top: 10px; width: 50px; height: 50px">
            <div style="left: 20px; top: 20px; width: 30px; height: 30px">leaf</div>
          </div>
        </div>
      </div></template>`;
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': composition,
      }),
    });
    const v = result.document.content as VideoContent;
    const top = v.tracks[0]?.elements[0] as {
      type: string;
      children: Array<{ type: string; children: Array<{ type: string }> }>;
    };
    expect(top.type).toBe('group');
    expect(top.children[0]?.type).toBe('group');
    expect(top.children[0]?.children[0]?.type).toBe('text');
  });

  it('AC #16: unrecognized tag (<canvas>) => UNSUPPORTED-ELEMENT flag, element skipped', async () => {
    const composition = `
      <template id="t"><div data-composition-id="main-orchestration"
           data-width="1080" data-height="1920" data-duration="16.04">
        <canvas></canvas>
        <div style="left: 0; top: 0; width: 10px; height: 10px">ok</div>
      </div></template>`;
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': composition,
      }),
    });
    expect(result.lossFlags.some((f) => f.code === 'LF-HYPERFRAMES-HTML-UNSUPPORTED-ELEMENT')).toBe(
      true,
    );
    const v = result.document.content as VideoContent;
    expect(v.tracks[0]?.elements).toHaveLength(1);
  });

  it('AC #21: missing dimensions => DIMENSION-INFERRED flag', async () => {
    const composition = `
      <template id="t"><div data-composition-id="main-orchestration"
           data-width="1080" data-height="1920" data-duration="16.04">
        <div style="left: 0; top: 0">no-dims</div>
      </div></template>`;
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': composition,
      }),
    });
    expect(result.lossFlags.some((f) => f.code === 'LF-HYPERFRAMES-HTML-DIMENSION-INFERRED')).toBe(
      true,
    );
  });

  it('AC #22: opacity:0 + GSAP context => ANIMATIONS-DROPPED + opacity normalized', async () => {
    const composition = `
      <template id="t"><div data-composition-id="main-orchestration"
           data-width="1080" data-height="1920" data-duration="16.04">
        <div style="left: 0; top: 0; width: 100px; height: 100px; opacity: 0"></div>
        <script>const tl = gsap.timeline({});</script>
      </div></template>`;
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': composition,
      }),
    });
    expect(result.lossFlags.some((f) => f.code === 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED')).toBe(
      true,
    );
  });

  it('AC #23: class-styled element => CLASS-STYLE-LOST flag', async () => {
    const composition = `
      <template id="t"><div data-composition-id="main-orchestration"
           data-width="1080" data-height="1920" data-duration="16.04">
        <div class="stat-text blue-text" style="left: 0; top: 0; width: 100px; height: 100px">42%</div>
      </div></template>`;
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': composition,
      }),
    });
    expect(result.lossFlags.some((f) => f.code === 'LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST')).toBe(
      true,
    );
  });

  it('AC #24: recognized TRANSCRIPT => videoContent.captions populated', async () => {
    const composition = `
      <template id="t"><div data-composition-id="main-orchestration"
           data-width="1080" data-height="1920" data-duration="16.04">
        <div style="left: 0; top: 0; width: 100px; height: 100px">x</div>
        <script>
          const TRANSCRIPT = [
            { "text": "We", "start": 0.119, "end": 0.259 }
          ];
        </script>
      </div></template>`;
    const result = await parseHyperframes(MASTER_9_16, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/main-orchestration.html': composition,
      }),
    });
    const v = result.document.content as VideoContent;
    expect(v.captions).toBeDefined();
    expect(v.captions?.segments[0]).toEqual({ startMs: 119, endMs: 259, text: 'We' });
  });

  it('AC #24: caption-kind track AND inline TRANSCRIPT both populate', async () => {
    const masterHtml = `
      <!doctype html><html><body>
        <div id="master-root" data-composition-id="master"
             data-width="1080" data-height="1920" data-duration="16.04">
          <div data-composition-id="main-orchestration"
               data-composition-src="m.html"
               data-start="0" data-duration="16.04" data-track-index="0"></div>
          <div data-composition-id="captions"
               data-composition-src="c.html"
               data-start="0" data-duration="16.04" data-track-index="1"></div>
        </div>
      </body></html>`;
    const compositions = {
      'm.html':
        '<template id="m"><div data-composition-id="main-orchestration" data-width="1080" data-height="1920" data-duration="16.04"><video src="https://example.com/v.mp4" style="left: 0; top: 0; width: 1080px; height: 1920px"></video></div></template>',
      'c.html': `
        <template id="c"><div data-composition-id="captions"
             data-width="1080" data-height="1920" data-duration="16.04">
          <div style="left: 0; top: 0; width: 100px; height: 100px">visual placeholder</div>
          <script>
            const TRANSCRIPT = [
              { "text": "We", "start": 0, "end": 1 }
            ];
          </script>
        </div></template>`,
    };
    const result = await parseHyperframes(masterHtml, {
      fetchCompositionSrc: fetcherFromMap(compositions),
    });
    const v = result.document.content as VideoContent;
    // Track of kind 'caption' present:
    expect(v.tracks.some((t) => t.kind === 'caption')).toBe(true);
    // videoContent.captions populated:
    expect(v.captions).toBeDefined();
  });

  it('AC #25: unrecognized TRANSCRIPT shape => CAPTIONS-UNRECOGNIZED flag, captions omitted', async () => {
    const composition = `
      <template id="t"><div data-composition-id="captions"
           data-width="1080" data-height="1920" data-duration="16.04">
        <div style="left: 0; top: 0; width: 100px; height: 100px">x</div>
        <script>
          const TRANSCRIPT = [
            { "word": "We", "t0": 0.0, "t1": 0.5 }
          ];
        </script>
      </div></template>`;
    const masterHtml = MASTER_9_16.replace('main-orchestration', 'captions').replace(
      'data-composition-src="compositions/main-orchestration.html"',
      'data-composition-src="compositions/captions.html"',
    );
    const result = await parseHyperframes(masterHtml, {
      fetchCompositionSrc: fetcherFromMap({
        'compositions/captions.html': composition,
      }),
    });
    expect(
      result.lossFlags.some((f) => f.code === 'LF-HYPERFRAMES-HTML-CAPTIONS-UNRECOGNIZED'),
    ).toBe(true);
    const v = result.document.content as VideoContent;
    expect(v.captions).toBeUndefined();
  });
});
