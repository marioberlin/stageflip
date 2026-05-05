// packages/runtimes/frame-runtime-bridge/src/clips/caption.test.tsx
// T-316 — captionClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Caption, type CaptionProps, captionClip, captionPropsSchema } from './caption.js';

afterEach(cleanup);

const FPS = 30;

const MIN_POSITION: CaptionProps['position'] = {
  x: 0,
  y: 0,
  width: 800,
  alignment: 'center',
};

function renderAt(frame: number, props: CaptionProps, durationInFrames = 600) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1080, height: 1920, fps: FPS, durationInFrames }}>
      <Caption {...props} />
    </FrameProvider>,
  );
}

describe('captionPropsSchema (T-316)', () => {
  it('accepts a minimal valid input', () => {
    const result = captionPropsSchema.safeParse({
      words: [{ text: 'hi', startMs: 0, endMs: 500 }],
      style: 'hormozi',
      position: { x: 0, y: 0, width: 800, alignment: 'center' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty words array (min(1))', () => {
    const result = captionPropsSchema.safeParse({
      words: [],
      style: 'hormozi',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 200 words (max(200))', () => {
    const words = Array.from({ length: 201 }, (_, i) => ({
      text: `w${i}`,
      startMs: i * 100,
      endMs: (i + 1) * 100,
    }));
    expect(
      captionPropsSchema.safeParse({ words, style: 'hormozi', position: MIN_POSITION }).success,
    ).toBe(false);
  });

  it('rejects unknown style values', () => {
    const result = captionPropsSchema.safeParse({
      words: [{ text: 'hi', startMs: 0, endMs: 500 }],
      style: 'instagram',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level keys (.strict())', () => {
    const result = captionPropsSchema.safeParse({
      words: [{ text: 'hi', startMs: 0, endMs: 500 }],
      style: 'hormozi',
      position: MIN_POSITION,
      mysteryProp: 'nope',
    });
    expect(result.success).toBe(false);
  });

  it('accepts highlightColor as a string', () => {
    const result = captionPropsSchema.safeParse({
      words: [{ text: 'hi', startMs: 0, endMs: 500 }],
      style: 'hormozi',
      position: MIN_POSITION,
      highlightColor: '#FFD60A',
    });
    expect(result.success).toBe(true);
  });

  it('accepts highlightColor as a string array (MrBeast cycling)', () => {
    const result = captionPropsSchema.safeParse({
      words: [{ text: 'hi', startMs: 0, endMs: 500 }],
      style: 'mrbeast',
      position: MIN_POSITION,
      highlightColor: ['#FF3B30', '#FFD60A', '#34C759'],
    });
    expect(result.success).toBe(true);
  });
});

describe('Caption component (T-316)', () => {
  const SIMPLE_WORDS: CaptionProps['words'] = [
    { text: 'hello', startMs: 0, endMs: 500 },
    { text: 'world', startMs: 500, endMs: 1000 },
  ];

  it('renders all six styles successfully', () => {
    const styles: CaptionProps['style'][] = [
      'hormozi',
      'mrbeast',
      'tiktok',
      'ali-abdaal',
      'netflix',
      'karaoke-wipe',
    ];
    for (const style of styles) {
      renderAt(30, { words: SIMPLE_WORDS, style, position: MIN_POSITION });
      expect(screen.getByTestId('caption-clip')).toBeDefined();
      cleanup();
    }
  });

  it('first word at frame 0 with startMs 0 is visible (active)', () => {
    renderAt(0, {
      words: [{ text: 'now', startMs: 0, endMs: 500 }],
      style: 'hormozi',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const word0 = screen.getByTestId('caption-word-0');
    expect(word0).toBeDefined();
    expect(word0.textContent).toContain('NOW'); // hormozi uppercase
  });

  it('word past its endMs remains visible (Hormozi)', () => {
    renderAt(60, {
      words: [{ text: 'past', startMs: 1500, endMs: 1900 }],
      style: 'hormozi',
      position: MIN_POSITION,
      entrance: 'none',
    });
    // frame 60 @ 30fps = 2000 ms; word ended at 1900 ms.
    const word0 = screen.getByTestId('caption-word-0');
    expect(word0).toBeDefined();
    expect(Number.parseFloat(word0.style.opacity || '1')).toBeGreaterThan(0);
  });

  it('uppercase casing transforms rendered text', () => {
    renderAt(30, {
      words: [{ text: 'hello', startMs: 0, endMs: 500 }],
      style: 'tiktok',
      casing: 'uppercase',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const word0 = screen.getByTestId('caption-word-0');
    expect(word0.textContent).toContain('HELLO');
  });

  it('lowercase casing transforms rendered text', () => {
    renderAt(30, {
      words: [{ text: 'HELLO', startMs: 0, endMs: 500 }],
      style: 'tiktok',
      casing: 'lowercase',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const word0 = screen.getByTestId('caption-word-0');
    expect(word0.textContent).toContain('hello');
  });

  it('title-case casing capitalises first letter of each word', () => {
    renderAt(30, {
      words: [
        { text: 'hello', startMs: 0, endMs: 500 },
        { text: 'world', startMs: 500, endMs: 1000 },
      ],
      style: 'tiktok',
      casing: 'title-case',
      position: MIN_POSITION,
      entrance: 'none',
    });
    expect(screen.getByTestId('caption-word-0').textContent).toContain('Hello');
    expect(screen.getByTestId('caption-word-1').textContent).toContain('World');
  });

  it("backdrop 'pill' renders one rect per word with rx attribute", () => {
    renderAt(30, {
      words: SIMPLE_WORDS,
      style: 'tiktok',
      position: MIN_POSITION,
      backdrop: 'pill',
      entrance: 'none',
    });
    const b0 = screen.getByTestId('caption-backdrop-0');
    const b1 = screen.getByTestId('caption-backdrop-1');
    expect(b0.tagName.toLowerCase()).toBe('rect');
    expect(b1.tagName.toLowerCase()).toBe('rect');
    expect(b0.getAttribute('rx')).not.toBeNull();
    expect(Number.parseFloat(b0.getAttribute('rx') ?? '0')).toBeGreaterThan(0);
  });

  it("backdrop 'rect' renders a single rect", () => {
    renderAt(30, {
      words: SIMPLE_WORDS,
      style: 'netflix',
      position: MIN_POSITION,
      backdrop: 'rect',
      entrance: 'none',
    });
    const backdrop = screen.getByTestId('caption-backdrop');
    expect(backdrop.tagName.toLowerCase()).toBe('rect');
    expect(screen.queryByTestId('caption-backdrop-0')).toBeNull();
  });

  it("backdrop 'none' renders no backdrop element", () => {
    renderAt(30, {
      words: SIMPLE_WORDS,
      style: 'hormozi',
      position: MIN_POSITION,
      backdrop: 'none',
      entrance: 'none',
    });
    expect(screen.queryByTestId('caption-backdrop')).toBeNull();
    expect(screen.queryByTestId('caption-backdrop-0')).toBeNull();
  });

  it('strokeWidth > 0 renders SVG <text> with stroke + paint-order', () => {
    renderAt(30, {
      words: [{ text: 'bold', startMs: 0, endMs: 500 }],
      style: 'hormozi',
      strokeColor: '#000000',
      strokeWidth: 4,
      position: MIN_POSITION,
      entrance: 'none',
    });
    const word0 = screen.getByTestId('caption-word-0');
    // Container is svg; find the text child.
    const textEl = word0.querySelector('text');
    expect(textEl).not.toBeNull();
    expect(textEl?.getAttribute('stroke')).toBe('#000000');
    expect(textEl?.getAttribute('stroke-width')).toBe('4');
    expect(textEl?.getAttribute('paint-order')).toBe('stroke fill');
  });

  it('karaoke-wipe at mid-word frame produces ~50% fill width', () => {
    renderAt(15, {
      words: [{ text: 'fill', startMs: 0, endMs: 1000 }],
      style: 'karaoke-wipe',
      position: MIN_POSITION,
      entrance: 'none',
    });
    // frame 15 @ 30fps = 500 ms = exactly mid-word.
    const fillRect = screen.getByTestId('caption-karaoke-fill-0');
    // Width is set as a percentage attribute on the rect (within an SVG <clipPath>).
    const widthPct = Number.parseFloat(fillRect.getAttribute('width') ?? '0');
    // Expect ~50% (within 5% tolerance).
    expect(widthPct).toBeGreaterThanOrEqual(45);
    expect(widthPct).toBeLessThanOrEqual(55);
  });

  it('per-word entrance stagger — word 0 settled, later words pre-roll', () => {
    renderAt(0, {
      words: [
        { text: 'a', startMs: 0, endMs: 200 },
        { text: 'b', startMs: 200, endMs: 400 },
        { text: 'c', startMs: 400, endMs: 600 },
      ],
      style: 'hormozi',
      entrance: 'rise',
      staggerMs: 100,
      position: MIN_POSITION,
    });
    const w0 = screen.getByTestId('caption-word-0');
    const w2 = screen.getByTestId('caption-word-2');
    // Word 0: entranceStartFrame = (0 - 0*100/1000)*30 = 0; at frame 0, t = 0 → opacity 0.
    // Word 2: entranceStartFrame = (0.4 - 2*0.1)*30 = (0.4 - 0.2)*30 = 6; at frame 0, t = -6 → 0.
    expect(Number.parseFloat(w0.style.opacity || '1')).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(w2.style.opacity || '1')).toBeGreaterThanOrEqual(0);
  });

  it('all words fully visible at large frame past entrance window', () => {
    renderAt(120, {
      words: [
        { text: 'a', startMs: 0, endMs: 200 },
        { text: 'b', startMs: 200, endMs: 400 },
        { text: 'c', startMs: 400, endMs: 600 },
      ],
      style: 'hormozi',
      entrance: 'rise',
      staggerMs: 80,
      position: MIN_POSITION,
    });
    for (let i = 0; i < 3; i += 1) {
      const word = screen.getByTestId(`caption-word-${i}`);
      expect(Number.parseFloat(word.style.opacity || '1')).toBe(1);
    }
  });

  it('mrbeast cycling highlight colors apply per highlighted word', () => {
    renderAt(120, {
      words: [
        { text: 'one', startMs: 0, endMs: 200, emphasis: 'highlight' },
        { text: 'two', startMs: 200, endMs: 400, emphasis: 'highlight' },
        { text: 'three', startMs: 400, endMs: 600, emphasis: 'highlight' },
      ],
      style: 'mrbeast',
      highlightColor: ['#FF3B30', '#FFD60A', '#34C759'],
      strokeWidth: 0, // force DOM mode for color introspection
      entrance: 'none',
      position: MIN_POSITION,
    });
    const w0 = screen.getByTestId('caption-word-0');
    const w1 = screen.getByTestId('caption-word-1');
    const w2 = screen.getByTestId('caption-word-2');
    expect(w0.style.color.toLowerCase()).toBe('#ff3b30');
    expect(w1.style.color.toLowerCase()).toBe('#ffd60a');
    expect(w2.style.color.toLowerCase()).toBe('#34c759');
  });

  it('position is respected (alignment + width on container)', () => {
    renderAt(30, {
      words: SIMPLE_WORDS,
      style: 'hormozi',
      position: { x: 100, y: 200, width: 600, alignment: 'right' },
      entrance: 'none',
    });
    const root = screen.getByTestId('caption-clip');
    const inner = root.querySelector('[data-testid="caption-inner"]') as HTMLElement | null;
    expect(inner).not.toBeNull();
    expect(inner?.style.width).toBe('600px');
    expect(inner?.style.justifyContent).toBe('flex-end');
  });

  it('is frame-deterministic — identical HTML across two renders at the same frame', () => {
    const props: CaptionProps = {
      words: [
        { text: 'hello', startMs: 0, endMs: 500 },
        { text: 'world', startMs: 500, endMs: 1000, emphasis: 'highlight' },
      ],
      style: 'hormozi',
      position: { x: 0, y: 0, width: 800, alignment: 'center' },
    };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe('Caption muteOpacity routing (T-316a)', () => {
  // Three words none tagged. With `entrance: 'rise'` + a large `staggerMs`,
  // all three entrance windows fully settle at the test frame (entranceStart
  // becomes ≤ 0 for every word), so `style.opacity` reflects only the
  // emphasis-opacity coming out of `resolveColor`.
  const TRIPLET_WORDS: CaptionProps['words'] = [
    { text: 'past', startMs: 0, endMs: 200 },
    { text: 'active', startMs: 200, endMs: 600 },
    { text: 'future', startMs: 600, endMs: 1000 },
  ];

  it('ali-abdaal (muteOpacity 0.6) dims past + future non-tagged words; active stays full', () => {
    // At frame 12 @ 30fps = 400ms: word 0 past, word 1 active, word 2 future.
    // `entrance: 'rise'` + `staggerMs: 600` shifts every word's entranceStart
    // ≤ 0, so entrance opacity is 1 for all three at frame 12.
    renderAt(12, {
      words: TRIPLET_WORDS,
      style: 'ali-abdaal',
      position: MIN_POSITION,
      entrance: 'rise',
      staggerMs: 600,
    });
    const w0 = screen.getByTestId('caption-word-0');
    const w1 = screen.getByTestId('caption-word-1');
    const w2 = screen.getByTestId('caption-word-2');
    expect(Number.parseFloat(w0.style.opacity || '1')).toBeCloseTo(0.6, 2);
    expect(Number.parseFloat(w1.style.opacity || '1')).toBeCloseTo(1.0, 2);
    expect(Number.parseFloat(w2.style.opacity || '1')).toBeCloseTo(0.6, 2);
  });

  it('hormozi (muteOpacity 1) regression sentinel — all words at opacity 1.0', () => {
    // Hormozi bundle ships `muteOpacity: 1`; new T-316a branch must be
    // unreachable. Past/future non-tagged words stay at opacity 1.0.
    renderAt(12, {
      words: TRIPLET_WORDS,
      style: 'hormozi',
      strokeWidth: 0, // force DOM mode so style.opacity is readable.
      position: MIN_POSITION,
      entrance: 'rise',
      staggerMs: 600,
    });
    for (let i = 0; i < 3; i += 1) {
      const word = screen.getByTestId(`caption-word-${i}`);
      expect(Number.parseFloat(word.style.opacity || '1')).toBeCloseTo(1.0, 2);
    }
  });

  it('active word never picks up muteOpacity dim under ali-abdaal', () => {
    // Guard the branch ordering: the new `muteOpacity < 1` branch sits
    // *below* the highlight/active branch in `resolveColor`, so the active
    // word must remain at opacity 1.0 even with `muteOpacity: 0.6`.
    renderAt(12, {
      words: TRIPLET_WORDS,
      style: 'ali-abdaal',
      position: MIN_POSITION,
      entrance: 'rise',
      staggerMs: 600,
    });
    const w1 = screen.getByTestId('caption-word-1');
    expect(Number.parseFloat(w1.style.opacity || '1')).toBeCloseTo(1.0, 2);
    expect(Number.parseFloat(w1.style.opacity || '1')).not.toBeCloseTo(0.6, 2);
  });
});

describe('captionClip definition (T-316)', () => {
  it("registers under kind 'caption' with the expected theme slots", () => {
    expect(captionClip.kind).toBe('caption');
    expect(captionClip.propsSchema).toBe(captionPropsSchema);
    expect(captionClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
      highlightColor: { kind: 'palette', role: 'accent' },
      muteColor: { kind: 'palette', role: 'foreground' },
      strokeColor: { kind: 'palette', role: 'background' },
    });
  });
});
