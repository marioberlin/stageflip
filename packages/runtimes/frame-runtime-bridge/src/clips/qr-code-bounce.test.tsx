// packages/runtimes/frame-runtime-bridge/src/clips/qr-code-bounce.test.tsx
// T-319 — QRCodeBounce clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `lyrics.test.tsx` /
// `score-bug.test.tsx` / `subscribe-button.test.tsx` /
// `follow-prompt.test.tsx`): the barrel pulls in every clip module
// before this test's direct `./qr-code-bounce.js` import is dereferenced,
// so `ALL_BRIDGE_CLIPS` is fully populated when read.
import {
  ALL_BRIDGE_CLIPS,
  QRCodeBounce,
  type QRCodeBounceProps,
  computeBouncePosition,
  currentHue,
  hslToRgb,
  qrCodeBounceClip,
  qrCodeBouncePropsSchema,
} from './index.js';

afterEach(cleanup);

// Synthetic 7×7 matrix used across the test suite. Avoids inlining
// 21+ rows in every case.
const MATRIX_7x7: readonly string[] = [
  '1010101',
  '0101010',
  '1010101',
  '0101010',
  '1010101',
  '0101010',
  '1010101',
];

const MIN_PROPS: QRCodeBounceProps = {
  qrMatrix: [...MATRIX_7x7],
  bounce: {
    startPosition: { x: 0, y: 0 },
    startVelocity: { vx: 2, vy: 1 },
  },
};

function renderAt(
  frame: number,
  props: QRCodeBounceProps,
  config: { width?: number; height?: number; fps?: number; durationInFrames?: number } = {},
) {
  const { width = 1920, height = 1080, fps = 30, durationInFrames = 1800 } = config;
  return render(
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames }}>
      <QRCodeBounce {...props} />
    </FrameProvider>,
  );
}

describe('qrCodeBouncePropsSchema — minimal inputs', () => {
  it('accepts minimal valid input (7x7 matrix + bounce)', () => {
    expect(qrCodeBouncePropsSchema.safeParse(MIN_PROPS).success).toBe(true);
  });

  it('accepts override of all optional fields', () => {
    expect(
      qrCodeBouncePropsSchema.safeParse({
        ...MIN_PROPS,
        sizePercent: 30,
        colorCycle: { palette: 'rainbow', cycleFrames: 240 },
        background: '#222222',
        lightModuleColor: '#FFFFFF',
      }).success,
    ).toBe(true);
  });
});

describe('qrCodeBouncePropsSchema — required-field rejections', () => {
  it('rejects missing qrMatrix', () => {
    expect(qrCodeBouncePropsSchema.safeParse({ bounce: MIN_PROPS.bounce }).success).toBe(false);
  });

  it('rejects missing bounce', () => {
    expect(qrCodeBouncePropsSchema.safeParse({ qrMatrix: MIN_PROPS.qrMatrix }).success).toBe(false);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(
      qrCodeBouncePropsSchema.safeParse({
        ...MIN_PROPS,
        mystery: true,
      }).success,
    ).toBe(false);
  });

  it('rejects out-of-range sizePercent (< 5 or > 80)', () => {
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, sizePercent: 4 }).success).toBe(false);
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, sizePercent: 81 }).success).toBe(
      false,
    );
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, sizePercent: 5 }).success).toBe(true);
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, sizePercent: 22 }).success).toBe(true);
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, sizePercent: 80 }).success).toBe(true);
  });

  it('rejects bad hex on background / lightModuleColor', () => {
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, background: 'red' }).success).toBe(
      false,
    );
    expect(
      qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, lightModuleColor: '#fff' }).success,
    ).toBe(false);
  });

  it('rejects non-rainbow palette (sealed at "rainbow" in v1)', () => {
    expect(
      qrCodeBouncePropsSchema.safeParse({
        ...MIN_PROPS,
        colorCycle: { palette: 'mono' },
      }).success,
    ).toBe(false);
  });
});

describe('qrCodeBouncePropsSchema — qrMatrix shape', () => {
  it('rejects rows of unequal length', () => {
    const matrix = [
      '1111111',
      '101010', // 6 chars vs 7
      '1111111',
      '1111111',
      '1111111',
      '1111111',
      '1111111',
    ];
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, qrMatrix: matrix }).success).toBe(
      false,
    );
  });

  it('rejects non-square matrix (rows.length !== rows[0].length)', () => {
    // 7 rows × 8 cols
    const matrix = Array(7).fill('11111111');
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, qrMatrix: matrix }).success).toBe(
      false,
    );
  });

  it('rejects matrix with invalid characters (non 0/1)', () => {
    const matrix = ['111X111', '1010101', '1010101', '1010101', '1010101', '1010101', '1010101'];
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, qrMatrix: matrix }).success).toBe(
      false,
    );
  });

  it('rejects matrix smaller than 7×7', () => {
    const matrix = ['111', '101', '111'];
    expect(qrCodeBouncePropsSchema.safeParse({ ...MIN_PROPS, qrMatrix: matrix }).success).toBe(
      false,
    );
  });
});

describe('computeBouncePosition — closed-form fold + mod', () => {
  it('renders at the start position at frame 0', () => {
    const pos = computeBouncePosition(0, { x: 100, y: 200 }, { vx: 2, vy: 1 }, 1920, 1080, 240);
    expect(pos).toEqual({ x: 100, y: 200 });
  });

  it('integrates linearly within bounds', () => {
    // start (0,0) + velocity (2, 1) at frame 60 — naive (120, 60) within bounds
    const pos = computeBouncePosition(60, { x: 0, y: 0 }, { vx: 2, vy: 1 }, 1920, 1080, 240);
    expect(pos).toEqual({ x: 120, y: 60 });
  });

  it('reflects off the right edge via the fold trick', () => {
    // start (0,0) + velocity (20, 15) at frame 120
    // canvas 1920 × 1080, rectSize 240 → spanX = 1680, spanY = 840
    // naive x = 2400; period = 3360; wrapped = 2400; > spanX → folded = 3360-2400 = 960
    // naive y = 1800; period = 1680; wrapped = 1800 % 1680 = 120; <= spanY → folded = 120
    const pos = computeBouncePosition(120, { x: 0, y: 0 }, { vx: 20, vy: 15 }, 1920, 1080, 240);
    expect(pos.x).toBe(960);
    expect(pos.y).toBe(120);
  });

  it('handles negative velocity via fold (wrap-around)', () => {
    // start (100, 100) + velocity (-2, -1) at frame 100 — naive (-100, 0)
    // spanX = 1680, spanY = 840 → folded x via fold(-100, 1680) = period 3360,
    // wrapped = (-100 + 3360) % 3360 = 3260, > spanX → folded = 3360 - 3260 = 100
    const pos = computeBouncePosition(100, { x: 100, y: 100 }, { vx: -2, vy: -1 }, 1920, 1080, 240);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(0);
  });
});

describe('hslToRgb / currentHue', () => {
  it('hue 0 → red (255, 0, 0)', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('hue 120 → green (0, 255, 0)', () => {
    expect(hslToRgb(120, 1, 0.5)).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('hue 240 → blue (0, 0, 255)', () => {
    expect(hslToRgb(240, 1, 0.5)).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('hue 180 → cyan (0, 255, 255)', () => {
    expect(hslToRgb(180, 1, 0.5)).toEqual({ r: 0, g: 255, b: 255 });
  });

  it('currentHue at frame 0 returns 0', () => {
    expect(currentHue(0, 210)).toBe(0);
  });

  it('currentHue at mid-cycle returns 180', () => {
    expect(currentHue(105, 210)).toBeCloseTo(180, 5);
  });

  it('currentHue wraps at cycleFrames boundary', () => {
    expect(currentHue(210, 210)).toBe(0);
    expect(currentHue(420, 210)).toBe(0);
  });
});

describe('<QRCodeBounce> render', () => {
  it('renders outer wrapper with default black background', () => {
    renderAt(0, MIN_PROPS);
    const outer = screen.getByTestId('qr-code-bounce');
    expect(outer.style.backgroundColor.toLowerCase()).toMatch(/^(#000000|rgb\(0, 0, 0\)|black)$/);
  });

  it('honors background override', () => {
    renderAt(0, { ...MIN_PROPS, background: '#222222' });
    const outer = screen.getByTestId('qr-code-bounce');
    expect(outer.style.backgroundColor.toLowerCase()).toMatch(/^(#222222|rgb\(34, 34, 34\))$/);
  });

  it('renders the rectangle at the start position at frame 0', () => {
    renderAt(0, {
      ...MIN_PROPS,
      bounce: { startPosition: { x: 100, y: 200 }, startVelocity: { vx: 2, vy: 1 } },
    });
    const rect = screen.getByTestId('qr-code-bounce-rect');
    expect(rect.style.left).toBe('100px');
    expect(rect.style.top).toBe('200px');
  });

  it('honors sizePercent — rectSize = round(min(W, H) * sizePercent / 100)', () => {
    // 1920×1080, sizePercent=22 → 1080 * 0.22 = 237.6 → round = 238
    renderAt(0, { ...MIN_PROPS });
    const rect = screen.getByTestId('qr-code-bounce-rect');
    expect(rect.dataset.rectSize).toBe('238');
    cleanup();
    // Override sizePercent=50 → 540
    renderAt(0, { ...MIN_PROPS, sizePercent: 50 });
    const rect2 = screen.getByTestId('qr-code-bounce-rect');
    expect(rect2.dataset.rectSize).toBe('540');
  });

  it('renders only dark modules (skips light cells)', () => {
    // MATRIX_7x7 has alternating 1010101 / 0101010 — total dark = (4+3)+(3+4)+... = 25 ones
    // Actually: row0 1010101 = 4, row1 0101010 = 3, row2 = 4, row3 = 3, row4 = 4, row5 = 3, row6 = 4
    // total = 4+3+4+3+4+3+4 = 25
    renderAt(0, MIN_PROPS);
    const modules = screen.getAllByTestId('qr-code-bounce-module');
    expect(modules).toHaveLength(25);
  });

  it('rainbow hue at frame 0 paints dark modules red', () => {
    renderAt(0, MIN_PROPS);
    const rect = screen.getByTestId('qr-code-bounce-rect');
    // Frame 0 → hue 0 → red
    expect(rect.dataset.darkColor).toBe('#FF0000');
    const modules = screen.getAllByTestId('qr-code-bounce-module');
    const firstModule = modules[0];
    expect(firstModule).toBeDefined();
    if (firstModule) {
      expect(firstModule.style.backgroundColor.toLowerCase()).toMatch(
        /^(#ff0000|rgb\(255, 0, 0\)|red)$/,
      );
    }
  });

  it('rainbow hue at mid-cycle paints dark modules cyan', () => {
    // fps 30 → cycleFrames default = ceil(30 * 7) = 210; mid-cycle frame = 105 → hue 180 (cyan)
    renderAt(105, MIN_PROPS);
    const rect = screen.getByTestId('qr-code-bounce-rect');
    expect(rect.dataset.darkColor).toBe('#00FFFF');
  });

  it('rainbow hue cycles back to red at cycleFrames boundary', () => {
    renderAt(210, MIN_PROPS);
    const rect = screen.getByTestId('qr-code-bounce-rect');
    expect(rect.dataset.darkColor).toBe('#FF0000');
  });

  it('honors colorCycle.cycleFrames override', () => {
    // cycleFrames = 60 → frame 30 = hue 180 (cyan)
    renderAt(30, {
      ...MIN_PROPS,
      colorCycle: { palette: 'rainbow', cycleFrames: 60 },
    });
    const rect = screen.getByTestId('qr-code-bounce-rect');
    expect(rect.dataset.darkColor).toBe('#00FFFF');
  });

  it('honors lightModuleColor override on the rectangle background', () => {
    renderAt(0, { ...MIN_PROPS, lightModuleColor: '#EEEEEE' });
    const rect = screen.getByTestId('qr-code-bounce-rect');
    expect(rect.style.backgroundColor.toLowerCase()).toMatch(/^(#eeeeee|rgb\(238, 238, 238\))$/);
  });
});

describe('clip registration', () => {
  it('registers as kind "qr-code-bounce" and is in ALL_BRIDGE_CLIPS at length 55', () => {
    expect(qrCodeBounceClip.kind).toBe('qr-code-bounce');
    expect(ALL_BRIDGE_CLIPS).toHaveLength(55);
    expect(ALL_BRIDGE_CLIPS).toContain(qrCodeBounceClip);
  });

  it('declares no fontRequirements (per D-T319-8)', () => {
    expect(qrCodeBounceClip.fontRequirements).toBeUndefined();
  });
});

describe('determinism', () => {
  it('renders byte-identical HTML for the same props at the same frame', () => {
    const { container: a } = renderAt(60, MIN_PROPS);
    const htmlA = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(60, MIN_PROPS);
    const htmlB = b.innerHTML;
    expect(htmlA).toBe(htmlB);
  });

  it('renders byte-identical HTML at a mid-cycle frame', () => {
    const { container: a } = renderAt(120, MIN_PROPS);
    const htmlA = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(120, MIN_PROPS);
    const htmlB = b.innerHTML;
    expect(htmlA).toBe(htmlB);
  });
});
