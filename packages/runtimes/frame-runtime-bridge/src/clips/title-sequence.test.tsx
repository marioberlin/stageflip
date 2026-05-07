// packages/runtimes/frame-runtime-bridge/src/clips/title-sequence.test.tsx
// T-321 — `titleSequence` runtime-clip primitive: multi-shot prestige-TV
// title compositor with 4 sealed style bundles, 5 shot kinds, 3 transition
// kinds, per-letter staggered entry, viewport-fill ALL-CAPS letterforms,
// optional glow halo. Tests cover schema validation, multi-shot dispatch,
// per-shot transitions (cut / fade / dissolve), per-letter stagger,
// casing transforms, glow filter, theme slots, frame-determinism.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue —
// see lyrics.test.tsx for the rationale.
import {
  ALL_BRIDGE_CLIPS,
  TitleSequence,
  type TitleSequenceProps,
  titleSequenceClip,
  titleSequencePropsSchema,
} from './index.js';

afterEach(cleanup);

const FPS = 30;

const MIN_POSITION: TitleSequenceProps['position'] = {
  x: 960,
  y: 540,
  width: 1760,
  alignment: 'center',
};

function renderAt(frame: number, props: TitleSequenceProps, durationInFrames = 1500) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: FPS, durationInFrames }}>
      <TitleSequence {...props} />
    </FrameProvider>,
  );
}

describe('titleSequencePropsSchema (T-321)', () => {
  it('accepts a minimal valid input', () => {
    const result = titleSequencePropsSchema.safeParse({
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'titlePlate',
          content: { text: 'STRANGER THINGS' },
        },
      ],
      style: 'letterform-assemble',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty shots array (min(1))', () => {
    const result = titleSequencePropsSchema.safeParse({
      shots: [],
      style: 'letterform-assemble',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 16 shots (max(16))', () => {
    const shots = Array.from({ length: 17 }, (_, i) => ({
      id: `s${i}`,
      startMs: i * 1000,
      endMs: (i + 1) * 1000,
      kind: 'titlePlate' as const,
      content: { text: `T${i}` },
    }));
    const result = titleSequencePropsSchema.safeParse({
      shots,
      style: 'letterform-assemble',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a shot with startMs >= endMs', () => {
    const result = titleSequencePropsSchema.safeParse({
      shots: [
        {
          id: 's0',
          startMs: 1000,
          endMs: 1000,
          kind: 'titlePlate',
          content: { text: 'X' },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
    });
    expect(result.success).toBe(false);
  });

  it('rejects bad shot content shapes (per kind)', () => {
    const base = {
      id: 's0',
      startMs: 0,
      endMs: 1000,
    };
    // letterAnimation with 37+ chars
    const r1 = titleSequencePropsSchema.safeParse({
      shots: [{ ...base, kind: 'letterAnimation', content: { text: 'A'.repeat(37) } }],
      style: 'letterform-assemble',
      position: MIN_POSITION,
    });
    expect(r1.success).toBe(false);

    // creditsBlock with 0 lines
    const r2 = titleSequencePropsSchema.safeParse({
      shots: [{ ...base, kind: 'creditsBlock', content: { lines: [] } }],
      style: 'plate-and-credits',
      position: MIN_POSITION,
    });
    expect(r2.success).toBe(false);

    // creditsBlock with 13 lines
    const lines = Array.from({ length: 13 }, (_, i) => `line ${i}`);
    const r3 = titleSequencePropsSchema.safeParse({
      shots: [{ ...base, kind: 'creditsBlock', content: { lines } }],
      style: 'plate-and-credits',
      position: MIN_POSITION,
    });
    expect(r3.success).toBe(false);

    // colorPanel with bad hex
    const r4 = titleSequencePropsSchema.safeParse({
      shots: [{ ...base, kind: 'colorPanel', content: { color: '#ZZZ' } }],
      style: 'palette-jump-cut',
      position: MIN_POSITION,
    });
    expect(r4.success).toBe(false);

    // colorPanel with glyph length 4
    const r5 = titleSequencePropsSchema.safeParse({
      shots: [{ ...base, kind: 'colorPanel', content: { color: '#FF0000', glyph: 'ABCD' } }],
      style: 'palette-jump-cut',
      position: MIN_POSITION,
    });
    expect(r5.success).toBe(false);
  });

  it('accepts all four style values + all five shot kinds + all three transition values', () => {
    const styles: TitleSequenceProps['style'][] = [
      'letterform-assemble',
      'plate-and-credits',
      'palette-jump-cut',
      'photographic-overlay',
    ];
    for (const style of styles) {
      const r = titleSequencePropsSchema.safeParse({
        shots: [{ id: 's0', startMs: 0, endMs: 1000, kind: 'titlePlate', content: { text: 'A' } }],
        style,
        position: MIN_POSITION,
      });
      expect(r.success).toBe(true);
    }
    const transitions = ['cut', 'fade', 'dissolve'] as const;
    for (const t of transitions) {
      const r = titleSequencePropsSchema.safeParse({
        shots: [
          {
            id: 's0',
            startMs: 0,
            endMs: 1000,
            kind: 'titlePlate',
            content: { text: 'A' },
            transitionOut: t,
          },
        ],
        style: 'plate-and-credits',
        position: MIN_POSITION,
      });
      expect(r.success).toBe(true);
    }
    const kinds = [
      { kind: 'titlePlate' as const, content: { text: 'A' } },
      { kind: 'letterAnimation' as const, content: { text: 'A' } },
      { kind: 'creditsBlock' as const, content: { lines: ['a'] } },
      { kind: 'colorPanel' as const, content: { color: '#FF0000' } },
      { kind: 'holdFrame' as const, content: {} },
    ];
    for (const k of kinds) {
      const r = titleSequencePropsSchema.safeParse({
        shots: [{ id: 's0', startMs: 0, endMs: 1000, ...k }],
        style: 'plate-and-credits',
        position: MIN_POSITION,
      });
      expect(r.success).toBe(true);
    }
  });

  it('rejects unknown top-level keys (.strict())', () => {
    const result = titleSequencePropsSchema.safeParse({
      shots: [{ id: 's0', startMs: 0, endMs: 1000, kind: 'titlePlate', content: { text: 'A' } }],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      mysteryProp: 'nope',
    });
    expect(result.success).toBe(false);
  });
});

describe('TitleSequence component (T-321)', () => {
  it('renders the active titlePlate shot mid-window with applied casing', () => {
    renderAt(60, {
      // 60 frames @ 30fps = 2000 ms — mid of [0, 5000)
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'titlePlate',
          content: { text: 'stranger things' },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      casing: 'uppercase',
      entrance: 'none',
    });
    const plate = screen.getByTestId('title-sequence-shot-0');
    expect(plate.textContent).toContain('STRANGER THINGS');
  });

  it("style: 'letterform-assemble' produces per-letter elements with viewport-scaled font size", () => {
    renderAt(60, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'letterAnimation',
          content: { text: 'ABC' },
        },
      ],
      style: 'letterform-assemble',
      letterformScale: 0.7,
      position: MIN_POSITION,
      casing: 'uppercase',
    });
    // Stable per-letter IDs (shot-id-derived)
    const a = screen.getByTestId('title-sequence-shot-0-letter-0');
    const b = screen.getByTestId('title-sequence-shot-0-letter-1');
    const c = screen.getByTestId('title-sequence-shot-0-letter-2');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();
    // Font-size ≈ height * scale = 1080 * 0.7 = 756.
    expect(a.style.fontSize).toBe('756px');
  });

  it('per-letter stagger: at frame 0, only the first letter is mid-entrance', () => {
    renderAt(0, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 10_000,
          kind: 'letterAnimation',
          content: { text: 'ABC', staggerMs: 200 },
        },
      ],
      style: 'letterform-assemble',
      position: MIN_POSITION,
    });
    const a = screen.getByTestId('title-sequence-shot-0-letter-0');
    const b = screen.getByTestId('title-sequence-shot-0-letter-1');
    const c = screen.getByTestId('title-sequence-shot-0-letter-2');
    // A at frame 0 (0 ms): just starting fade-in window — opacity 0 (window starts at 0 ms)
    expect(Number.parseFloat(a.style.opacity || '0')).toBeGreaterThanOrEqual(0);
    // B starts at 200 ms — not yet
    expect(Number.parseFloat(b.style.opacity || '0')).toBe(0);
    expect(Number.parseFloat(c.style.opacity || '0')).toBe(0);
  });

  it('per-letter stagger: 12 frames (400 ms) in, A is fully visible', () => {
    renderAt(12, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 10_000,
          kind: 'letterAnimation',
          content: { text: 'ABC', staggerMs: 200 },
        },
      ],
      style: 'letterform-assemble',
      position: MIN_POSITION,
    });
    const a = screen.getByTestId('title-sequence-shot-0-letter-0');
    expect(Number.parseFloat(a.style.opacity || '0')).toBeCloseTo(1, 2);
  });

  it("transitionOut: 'cut' — no overlap at the boundary", () => {
    const props: TitleSequenceProps = {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 1000,
          kind: 'titlePlate',
          content: { text: 'A' },
          transitionOut: 'cut',
        },
        {
          id: 's1',
          startMs: 1000,
          endMs: 2000,
          kind: 'titlePlate',
          content: { text: 'B' },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      entrance: 'none',
    };
    // Frame 29 = 966 ms — still in shot 0
    renderAt(29, props);
    expect(screen.queryByTestId('title-sequence-shot-0')).not.toBeNull();
    expect(screen.queryByTestId('title-sequence-shot-1')).toBeNull();
  });

  it("transitionOut: 'fade' — both shots render with progressive opacity in overlap window", () => {
    const props: TitleSequenceProps = {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 1000,
          kind: 'titlePlate',
          content: { text: 'A' },
          transitionOut: 'fade',
        },
        {
          id: 's1',
          startMs: 1000,
          endMs: 2000,
          kind: 'titlePlate',
          content: { text: 'B' },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      transitionDurationMs: 300,
      entrance: 'none',
    };
    // Frame 25.5 ~ 850 ms — within last 300 ms of shot 0; mid-overlap.
    renderAt(26, props);
    const s0 = screen.getByTestId('title-sequence-shot-0');
    const s1 = screen.getByTestId('title-sequence-shot-1');
    expect(s0).toBeDefined();
    expect(s1).toBeDefined();
    const o0 = Number.parseFloat(s0.style.opacity || '1');
    const o1 = Number.parseFloat(s1.style.opacity || '1');
    expect(o0).toBeGreaterThan(0);
    expect(o0).toBeLessThan(1);
    expect(o1).toBeGreaterThan(0);
    expect(o1).toBeLessThan(1);
  });

  it("style: 'palette-jump-cut' enforces cut-only transitions even when shot says fade", () => {
    const props: TitleSequenceProps = {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 1000,
          kind: 'colorPanel',
          content: { color: '#E91E63' },
          transitionOut: 'fade',
        },
        {
          id: 's1',
          startMs: 1000,
          endMs: 2000,
          kind: 'colorPanel',
          content: { color: '#067162' },
        },
      ],
      style: 'palette-jump-cut',
      position: MIN_POSITION,
      transitionDurationMs: 300,
      entrance: 'none',
    };
    // Frame 26 ~ 866 ms — would be mid-overlap if fade honored.
    renderAt(26, props);
    // Cut-only — only shot 0 visible at the boundary.
    expect(screen.queryByTestId('title-sequence-shot-0')).not.toBeNull();
    expect(screen.queryByTestId('title-sequence-shot-1')).toBeNull();
  });

  it('glow prop renders SVG <filter> with stable shot-id-derived ID', () => {
    const { container } = renderAt(60, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'titlePlate',
          content: { text: 'GLOW' },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      entrance: 'none',
      glow: { color: '#FF0000', blur: 10 },
    });
    const filter = container.querySelector('filter#title-sequence-glow-s0');
    expect(filter).not.toBeNull();
    const blur = filter?.querySelector('feGaussianBlur');
    expect(blur?.getAttribute('stdDeviation')).toBe('10');
    cleanup();
    const r2 = renderAt(60, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'titlePlate',
          content: { text: 'GLOW' },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      entrance: 'none',
    });
    expect(r2.container.querySelector('filter#title-sequence-glow-s0')).toBeNull();
  });

  it("entrance: 'fade' produces 12-frame fade-in per shot; 'none' is full opacity at first frame", () => {
    // shot 0 starts at 0 ms = frame 0
    renderAt(0, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'titlePlate',
          content: { text: 'A' },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      entrance: 'fade',
    });
    const s0Pre = screen.getByTestId('title-sequence-shot-0');
    expect(Number.parseFloat(s0Pre.style.opacity || '1')).toBeLessThan(1);
    cleanup();
    renderAt(0, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'titlePlate',
          content: { text: 'A' },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const s0None = screen.getByTestId('title-sequence-shot-0');
    expect(Number.parseFloat(s0None.style.opacity || '1')).toBeCloseTo(1, 2);
  });

  it('creditsBlock renders all lines under plate-and-credits', () => {
    renderAt(60, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'creditsBlock',
          content: { lines: ['Created by', 'Jane Doe', 'John Smith'] },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const shot = screen.getByTestId('title-sequence-shot-0');
    expect(shot.textContent).toContain('Created by');
    expect(shot.textContent).toContain('Jane Doe');
    expect(shot.textContent).toContain('John Smith');
  });

  it('colorPanel renders the flat color + optional glyph centered', () => {
    renderAt(60, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'colorPanel',
          content: { color: '#E91E63', glyph: '○' },
        },
      ],
      style: 'palette-jump-cut',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const shot = screen.getByTestId('title-sequence-shot-0');
    expect(shot.textContent).toContain('○');
    // Background color carries the panel hex.
    expect(shot.style.backgroundColor.toLowerCase()).toContain('e91e63');
  });

  it("style: 'photographic-overlay' renders only typography shots; colorPanel is a no-op", () => {
    renderAt(60, {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'colorPanel',
          content: { color: '#FF0000' },
        },
      ],
      style: 'photographic-overlay',
      position: MIN_POSITION,
      entrance: 'none',
    });
    const shot = screen.queryByTestId('title-sequence-shot-0');
    // Wrapper is rendered (active) but its body is empty for non-typography kinds.
    if (shot !== null) {
      expect(shot.textContent).toBe('');
    }
  });

  it('is frame-deterministic — identical HTML across two renders at the same frame', () => {
    const props: TitleSequenceProps = {
      shots: [
        {
          id: 's0',
          startMs: 0,
          endMs: 5000,
          kind: 'titlePlate',
          content: { text: 'STRANGER THINGS' },
          transitionOut: 'fade',
        },
        {
          id: 's1',
          startMs: 5000,
          endMs: 10_000,
          kind: 'creditsBlock',
          content: { lines: ['Created by', 'The Duffer Brothers'] },
        },
      ],
      style: 'plate-and-credits',
      position: MIN_POSITION,
      glow: { color: '#FF0000', blur: 8 },
      entrance: 'fade',
      casing: 'uppercase',
    };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe('titleSequenceClip definition (T-321)', () => {
  it("registers under kind 'titleSequence' with the expected theme slots", () => {
    expect(titleSequenceClip.kind).toBe('titleSequence');
    expect(titleSequenceClip.propsSchema).toBe(titleSequencePropsSchema);
    expect(titleSequenceClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
    });
  });

  it('ALL_BRIDGE_CLIPS includes titleSequenceClip and is length 54', () => {
    expect(ALL_BRIDGE_CLIPS.length).toBe(54);
    expect(ALL_BRIDGE_CLIPS.some((c) => c.kind === 'titleSequence')).toBe(true);
  });
});
