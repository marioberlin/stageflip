// packages/runtimes/frame-runtime-bridge/src/clips/lyrics.test.tsx
// T-322 — lyricsClip behaviour + propsSchema + themeSlots.
// T-322a — render-fix regression suite (karaoke-wipe width as %, default
// font fits position width, all 3-stack lines visible, glow filter
// composes via feComposite + feMerge).

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue:
// `lyrics.tsx` → `../index.js` (bridge top) → `./clips/index.js` (this
// barrel) → back into `./lyrics.js`. Loading the barrel first lets it
// pull in every clip module (including `./lyrics.js`) before the test's
// own direct `./lyrics.js` import is dereferenced — so the
// `ALL_BRIDGE_CLIPS` array is fully populated by the time it's read.
import {
  ALL_BRIDGE_CLIPS,
  Lyrics,
  type LyricsProps,
  lyricsClip,
  lyricsPropsSchema,
} from './index.js';

afterEach(cleanup);

const FPS = 30;

const MIN_POSITION: LyricsProps['position'] = {
  x: 80,
  y: 540,
  width: 1760,
  alignment: 'center',
};

function renderAt(frame: number, props: LyricsProps, durationInFrames = 600) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: FPS, durationInFrames }}>
      <Lyrics {...props} />
    </FrameProvider>,
  );
}

describe('lyricsPropsSchema (T-322)', () => {
  it('accepts a minimal valid input', () => {
    const result = lyricsPropsSchema.safeParse({
      lines: [{ text: 'wake me up', startMs: 0, endMs: 2000 }],
      style: 'karaoke-wipe',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty lines array (min(1))', () => {
    const result = lyricsPropsSchema.safeParse({
      lines: [],
      style: 'karaoke-wipe',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 40 lines (max(40))', () => {
    const lines = Array.from({ length: 41 }, (_, i) => ({
      text: `line ${i}`,
      startMs: i * 1000,
      endMs: (i + 1) * 1000,
    }));
    const result = lyricsPropsSchema.safeParse({
      lines,
      style: 'karaoke-wipe',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(false);
  });

  it('accepts all three style values, all four casing values, all three entrance values, all three maxLinesVisible', () => {
    const styles: LyricsProps['style'][] = [
      'karaoke-wipe',
      'three-line-stack',
      'highlight-current',
    ];
    for (const style of styles) {
      const r = lyricsPropsSchema.safeParse({
        lines: [{ text: 'a', startMs: 0, endMs: 1000 }],
        style,
        position: MIN_POSITION,
      });
      expect(r.success).toBe(true);
    }
    const casings: NonNullable<LyricsProps['casing']>[] = [
      'as-is',
      'uppercase',
      'lowercase',
      'title-case',
    ];
    for (const casing of casings) {
      const r = lyricsPropsSchema.safeParse({
        lines: [{ text: 'a', startMs: 0, endMs: 1000 }],
        style: 'karaoke-wipe',
        position: MIN_POSITION,
        casing,
      });
      expect(r.success).toBe(true);
    }
    const entrances: NonNullable<LyricsProps['entrance']>[] = ['none', 'fade', 'rise'];
    for (const entrance of entrances) {
      const r = lyricsPropsSchema.safeParse({
        lines: [{ text: 'a', startMs: 0, endMs: 1000 }],
        style: 'karaoke-wipe',
        position: MIN_POSITION,
        entrance,
      });
      expect(r.success).toBe(true);
    }
    for (const max of [1, 3, 5] as const) {
      const r = lyricsPropsSchema.safeParse({
        lines: [{ text: 'a', startMs: 0, endMs: 1000 }],
        style: 'karaoke-wipe',
        position: MIN_POSITION,
        maxLinesVisible: max,
      });
      expect(r.success).toBe(true);
    }
  });

  it('rejects unknown top-level keys (.strict())', () => {
    const result = lyricsPropsSchema.safeParse({
      lines: [{ text: 'a', startMs: 0, endMs: 1000 }],
      style: 'karaoke-wipe',
      position: MIN_POSITION,
      mysteryProp: 'nope',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a line missing required fields', () => {
    const result = lyricsPropsSchema.safeParse({
      lines: [{ text: 'a', startMs: 0 }],
      style: 'karaoke-wipe',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(false);
  });
});

describe('Lyrics component (T-322)', () => {
  const THREE_LINES: LyricsProps['lines'] = [
    { text: 'line zero', startMs: 0, endMs: 1000 },
    { text: 'line one', startMs: 1000, endMs: 2000 },
    { text: 'line two', startMs: 2000, endMs: 3000 },
  ];

  it("style: 'karaoke-wipe' produces ~50% wipe at mid-line", () => {
    renderAt(15, {
      // frame 15 @ 30fps = 500 ms (mid of 0..1000)
      lines: [{ text: 'wake me up', startMs: 0, endMs: 1000 }],
      style: 'karaoke-wipe',
      position: MIN_POSITION,
      entrance: 'none',
      highlightColor: '#F3CE32',
      foreground: '#CCCCCC',
    });
    const fillRect = screen.getByTestId('lyrics-line-clip-fill-0');
    const widthPct = Number.parseFloat(fillRect.getAttribute('width') ?? '0');
    expect(widthPct).toBeGreaterThanOrEqual(45);
    expect(widthPct).toBeLessThanOrEqual(55);
    // Stable clipPath ID (line-index-derived)
    const clipPath = screen.getByTestId('lyrics-line-clip-0');
    expect(clipPath.getAttribute('id')).toBe('lyrics-line-clip-0');
  });

  it("style: 'three-line-stack' shows past dimmed + active highlighted + next preview", () => {
    renderAt(45, {
      // 1500 ms — inside line 1 (1000..2000)
      lines: THREE_LINES,
      style: 'three-line-stack',
      position: MIN_POSITION,
      entrance: 'none',
      highlightColor: '#F3CE32',
      foreground: '#CCCCCC',
      muteOpacity: 0.5,
    });
    const l0 = screen.getByTestId('lyrics-line-0');
    const l1 = screen.getByTestId('lyrics-line-1');
    const l2 = screen.getByTestId('lyrics-line-2');
    // Active (line 1) at full opacity in highlightColor
    expect(Number.parseFloat(l1.style.opacity || '1')).toBeCloseTo(1, 2);
    expect(l1.style.color.toLowerCase()).toBe('#f3ce32');
    // Past (line 0) at muteOpacity
    expect(Number.parseFloat(l0.style.opacity || '1')).toBeCloseTo(0.5, 2);
    // Next preview (line 2) at muteOpacity
    expect(Number.parseFloat(l2.style.opacity || '1')).toBeCloseTo(0.5, 2);
  });

  it("style: 'highlight-current' shows only the active line", () => {
    renderAt(45, {
      lines: THREE_LINES,
      style: 'highlight-current',
      position: MIN_POSITION,
      entrance: 'none',
    });
    expect(screen.queryByTestId('lyrics-line-0')).toBeNull();
    expect(screen.getByTestId('lyrics-line-1')).toBeDefined();
    expect(screen.queryByTestId('lyrics-line-2')).toBeNull();
  });

  it("casing: 'uppercase' renders text uppercased", () => {
    renderAt(15, {
      lines: [{ text: 'wake me up', startMs: 0, endMs: 1000 }],
      style: 'three-line-stack',
      casing: 'uppercase',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const line = screen.getByTestId('lyrics-line-0');
    expect(line.textContent).toContain('WAKE ME UP');
  });

  it("casing: 'title-case' capitalises first letter of each word", () => {
    renderAt(15, {
      lines: [{ text: 'wake me up', startMs: 0, endMs: 1000 }],
      style: 'three-line-stack',
      casing: 'title-case',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const line = screen.getByTestId('lyrics-line-0');
    expect(line.textContent).toContain('Wake Me Up');
  });

  it('glow prop renders SVG <filter> with stable ID', () => {
    const { container } = renderAt(15, {
      lines: [{ text: 'glow time', startMs: 0, endMs: 1000 }],
      style: 'three-line-stack',
      position: MIN_POSITION,
      entrance: 'none',
      glow: { color: '#FFFF00', blur: 8 },
    });
    const filter = container.querySelector('filter#lyrics-glow-0');
    expect(filter).not.toBeNull();
    const blur = filter?.querySelector('feGaussianBlur');
    expect(blur?.getAttribute('stdDeviation')).toBe('8');
    cleanup();
    const r2 = renderAt(15, {
      lines: [{ text: 'glow time', startMs: 0, endMs: 1000 }],
      style: 'three-line-stack',
      position: MIN_POSITION,
      entrance: 'none',
    });
    expect(r2.container.querySelector('filter#lyrics-glow-0')).toBeNull();
  });

  it('maxLinesVisible: 1 hides past + next neighbors', () => {
    renderAt(45, {
      lines: THREE_LINES,
      style: 'three-line-stack',
      maxLinesVisible: 1,
      position: MIN_POSITION,
      entrance: 'none',
    });
    expect(screen.queryByTestId('lyrics-line-0')).toBeNull();
    expect(screen.getByTestId('lyrics-line-1')).toBeDefined();
    expect(screen.queryByTestId('lyrics-line-2')).toBeNull();
  });

  it('maxLinesVisible: 5 shows active + 2 past + 2 next', () => {
    const FIVE_LINES: LyricsProps['lines'] = Array.from({ length: 5 }, (_, i) => ({
      text: `line ${i}`,
      startMs: i * 1000,
      endMs: (i + 1) * 1000,
    }));
    renderAt(75, {
      // 2500 ms — inside line 2
      lines: FIVE_LINES,
      style: 'three-line-stack',
      maxLinesVisible: 5,
      position: MIN_POSITION,
      entrance: 'none',
    });
    for (let i = 0; i < 5; i += 1) {
      expect(screen.getByTestId(`lyrics-line-${i}`)).toBeDefined();
    }
  });

  it("entrance: 'fade' produces fade-in over 12-frame window", () => {
    // line 1 starts at 1000ms = frame 30; active at frame 30
    renderAt(30, {
      lines: THREE_LINES,
      style: 'three-line-stack',
      entrance: 'fade',
      position: MIN_POSITION,
    });
    const l1Pre = screen.getByTestId('lyrics-line-1');
    expect(Number.parseFloat(l1Pre.style.opacity || '1')).toBeLessThan(1);
    cleanup();
    // 12 frames after frame 30 → frame 42
    renderAt(42, {
      lines: THREE_LINES,
      style: 'three-line-stack',
      entrance: 'fade',
      position: MIN_POSITION,
    });
    const l1Post = screen.getByTestId('lyrics-line-1');
    // Past 12-frame entrance window → muteOpacity (default 0.5) baseline applies because line 1 has just become past
    // line 1 is past at 1400ms — but at frame 42 (1400ms), still active (1000..2000). Active at full opacity, fade settled.
    expect(Number.parseFloat(l1Post.style.opacity || '1')).toBeCloseTo(1, 2);

    cleanup();
    renderAt(30, {
      lines: THREE_LINES,
      style: 'three-line-stack',
      entrance: 'none',
      position: MIN_POSITION,
    });
    const l1None = screen.getByTestId('lyrics-line-1');
    expect(Number.parseFloat(l1None.style.opacity || '1')).toBeCloseTo(1, 2);
  });

  it('is frame-deterministic — identical HTML across two renders at the same frame', () => {
    const props: LyricsProps = {
      lines: [
        { text: 'wake me up', startMs: 0, endMs: 1000 },
        { text: 'before you go-go', startMs: 1000, endMs: 2000 },
      ],
      style: 'karaoke-wipe',
      position: MIN_POSITION,
      glow: { color: '#FFFF00', blur: 8 },
      entrance: 'fade',
    };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });

  it('three-line-stack edge: active at line 0 (no past line above)', () => {
    renderAt(15, {
      // 500 ms — inside line 0
      lines: THREE_LINES,
      style: 'three-line-stack',
      maxLinesVisible: 3,
      position: MIN_POSITION,
      entrance: 'none',
    });
    // No past neighbor; active is line 0; line 1 below as preview
    expect(screen.queryByTestId('lyrics-line-prev-of-0')).toBeNull();
    expect(screen.getByTestId('lyrics-line-0')).toBeDefined();
    expect(screen.getByTestId('lyrics-line-1')).toBeDefined();
  });
});

describe('Lyrics render-fix regressions (T-322a)', () => {
  // T-367 canonical inputs — three-line stack of anthemic phrasing with
  // per-line karaoke wipe. Frame 105 @ 30 fps = 3500 ms → mid-line2
  // (line index 1, startMs 2500, endMs 5000) at progress 0.40.
  const T367_LINES: LyricsProps['lines'] = [
    { text: 'Once upon a time', startMs: 0, endMs: 2500 },
    { text: 'We were stronger together', startMs: 2500, endMs: 5000 },
    { text: 'Now we sing alone', startMs: 5000, endMs: 7500 },
  ];
  const T367_POSITION: LyricsProps['position'] = {
    x: 128,
    y: 360,
    width: 1024,
    alignment: 'center',
  };

  it('AC #1 (D-T322a-1): karaoke-wipe rect width is "40%" string at progress 0.4', () => {
    // Single line [0, 1000ms]; frame 12 @ 30fps = 400 ms → progress 0.40.
    renderAt(12, {
      lines: [{ text: 'wake me up', startMs: 0, endMs: 1000 }],
      style: 'karaoke-wipe',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const fillRect = screen.getByTestId('lyrics-line-clip-fill-0');
    expect(fillRect.getAttribute('width')).toBe('40%');
    expect(fillRect.getAttribute('height')).toBe('100%');
  });

  it('AC #2 (D-T322a-2): DEFAULT_FONT.size is 64 so 25-char default-font line fits 1024 px', () => {
    // Render T-367's longest line at default font, 1024 px position width.
    // Default size (post D-T322a-2) is 64; assert the rendered line uses 64.
    renderAt(15, {
      // 500 ms ∈ [0, 2000) so the line is active at this frame.
      lines: [{ text: 'WE WERE STRONGER TOGETHER', startMs: 0, endMs: 2000 }],
      style: 'karaoke-wipe',
      position: T367_POSITION,
      entrance: 'none',
    });
    const line = screen.getByTestId('lyrics-line-0');
    // fontSize is read off the inline style; JSDOM normalizes to "64px".
    expect(line.style.fontSize).toBe('64px');
  });

  it('AC #3 (D-T322a-3): all 3 lines render with non-zero opacity at mid-line2 frame 105', () => {
    renderAt(
      105,
      {
        lines: T367_LINES,
        style: 'karaoke-wipe',
        position: T367_POSITION,
        maxLinesVisible: 3,
        entrance: 'fade',
        glow: { color: '#FFFFFF', blur: 6 },
      },
      225,
    );
    // activeIndex = 1 (currentTimeMs 3500 ∈ [2500, 5000)). Window {0, 1, 2}.
    const l0 = screen.getByTestId('lyrics-line-0');
    const l1 = screen.getByTestId('lyrics-line-1');
    const l2 = screen.getByTestId('lyrics-line-2');
    // All 3 lines present in the DOM.
    expect(l0).toBeDefined();
    expect(l1).toBeDefined();
    expect(l2).toBeDefined();
    // Each line has non-zero opacity (line 2 was the regression — its
    // future startMs (5000 ms > 3500 ms) clamped entrance opacity to 0).
    expect(Number.parseFloat(l0.style.opacity || '1')).toBeGreaterThan(0);
    expect(Number.parseFloat(l1.style.opacity || '1')).toBeGreaterThan(0);
    expect(Number.parseFloat(l2.style.opacity || '1')).toBeGreaterThan(0);
  });

  it('AC #4 (D-T322a-4): glow filter composes blur + flood via feComposite + feMerge', () => {
    const { container } = renderAt(105, {
      lines: T367_LINES,
      style: 'karaoke-wipe',
      position: T367_POSITION,
      maxLinesVisible: 3,
      entrance: 'none',
      glow: { color: '#FFFFFF', blur: 6 },
    });
    // Active line is index 1. Filter ID derived from line index per
    // T-322 D-T322-4 stable-ID contract.
    const filter = container.querySelector('filter#lyrics-glow-1');
    expect(filter).not.toBeNull();
    // Standard SVG glow recipe — all four primitives present.
    expect(filter?.querySelector('feGaussianBlur')?.getAttribute('in')).toBe('SourceAlpha');
    expect(filter?.querySelector('feFlood')?.getAttribute('flood-color')?.toLowerCase()).toBe(
      '#ffffff',
    );
    expect(filter?.querySelector('feComposite')?.getAttribute('operator')).toBe('in');
    const merge = filter?.querySelector('feMerge');
    expect(merge).not.toBeNull();
    // Two merge nodes: coloredBlur underneath, SourceGraphic on top.
    const mergeNodes = merge?.querySelectorAll('feMergeNode') ?? [];
    expect(mergeNodes.length).toBe(2);
    expect(mergeNodes[0]?.getAttribute('in')).toBe('coloredBlur');
    expect(mergeNodes[1]?.getAttribute('in')).toBe('SourceGraphic');
    // Active line (index 1) inner element carries filter="url(#lyrics-glow-1)".
    // Substring match — JSDOM serializes inline style filter as a string.
    expect(container.innerHTML).toContain('url(#lyrics-glow-1)');
  });

  it('Backward-compat sentinel — same props twice → byte-identical HTML (post-fix determinism)', () => {
    const props: LyricsProps = {
      lines: T367_LINES,
      style: 'karaoke-wipe',
      position: T367_POSITION,
      maxLinesVisible: 3,
      entrance: 'fade',
      glow: { color: '#FFFFFF', blur: 6 },
      casing: 'uppercase',
    };
    const a = renderAt(105, props, 225).container.innerHTML;
    cleanup();
    const b = renderAt(105, props, 225).container.innerHTML;
    expect(a).toBe(b);
    // Casing still applies after fixes — substring sanity.
    expect(a).toContain('WE WERE STRONGER TOGETHER');
  });
});

describe('lyricsClip definition (T-322)', () => {
  it("registers under kind 'lyrics' with the expected theme slots", () => {
    expect(lyricsClip.kind).toBe('lyrics');
    expect(lyricsClip.propsSchema).toBe(lyricsPropsSchema);
    expect(lyricsClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
    });
  });

  it('ALL_BRIDGE_CLIPS includes lyricsClip and is length 58', () => {
    expect(ALL_BRIDGE_CLIPS.length).toBe(64);
    expect(ALL_BRIDGE_CLIPS.some((c) => c.kind === 'lyrics')).toBe(true);
  });
});
