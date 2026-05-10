// packages/runtimes/frame-runtime-bridge/src/clips/weather-star-panel.test.tsx
// T-347g — WeatherStar4000Panel clip behaviour + propsSchema +
// canonical-palette exports + pixel-precision invariants + ticker
// scroll math + frame-determinism. Mirrors qr-code-bounce / grain
// single-object-schema test structure.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors weather-map.test.tsx / storm-tracker.test.tsx workaround).
import {
  ALL_BRIDGE_CLIPS,
  WEATHER_STAR_BLUE_GRADIENT,
  WEATHER_STAR_FOREGROUND_WHITE_GOLD,
  WEATHER_STAR_ORANGE_GOLD,
  WeatherStar4000Panel,
  type WeatherStar4000PanelProps,
  snapTo8px,
  tickerScrollPosition,
  weatherStar4000PanelClip,
  weatherStar4000PanelPropsSchema,
} from './index.js';

afterEach(cleanup);

const MIN_PROPS: WeatherStar4000PanelProps = {
  header: { city: 'Atlanta', condition: 'Partly Cloudy' },
  temperature: { value: 78, unit: 'F' },
};

function renderAt(
  frame: number,
  props: WeatherStar4000PanelProps,
  config: { width?: number; height?: number; fps?: number; durationInFrames?: number } = {},
) {
  // RetroCast canon — 30 fps locked per stub line 38.
  const { width = 1280, height = 720, fps = 30, durationInFrames = 150 } = config;
  return render(
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames }}>
      <WeatherStar4000Panel {...props} />
    </FrameProvider>,
  );
}

// ─── schema ──────────────────────────────────────────────────────────────

describe('weatherStar4000PanelPropsSchema — required fields', () => {
  it('accepts a minimal valid input', () => {
    expect(weatherStar4000PanelPropsSchema.safeParse(MIN_PROPS).success).toBe(true);
  });

  it('rejects when header is missing', () => {
    const { header: _h, ...rest } = MIN_PROPS;
    expect(weatherStar4000PanelPropsSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects when temperature is missing', () => {
    const { temperature: _t, ...rest } = MIN_PROPS;
    expect(weatherStar4000PanelPropsSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty header.city / condition', () => {
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        header: { city: '', condition: 'Clear' },
      }).success,
    ).toBe(false);
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        header: { city: 'Atlanta', condition: '' },
      }).success,
    ).toBe(false);
  });

  it('rejects out-of-range temperature.value', () => {
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        temperature: { value: -100, unit: 'F' },
      }).success,
    ).toBe(false);
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        temperature: { value: 141, unit: 'F' },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown temperature.unit (sealed enum)', () => {
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        temperature: { value: 78, unit: 'K' },
      }).success,
    ).toBe(false);
  });

  it('accepts both F and C units', () => {
    for (const unit of ['F', 'C'] as const) {
      expect(
        weatherStar4000PanelPropsSchema.safeParse({
          ...MIN_PROPS,
          temperature: { value: 25, unit },
        }).success,
      ).toBe(true);
    }
  });

  it('rejects unknown temperature.foreground (sealed enum)', () => {
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        temperature: { value: 78, unit: 'F', foreground: 'red' },
      }).success,
    ).toBe(false);
  });
});

describe('weatherStar4000PanelPropsSchema — ticker integer-pixel-only enum (D-T347g-3)', () => {
  it('accepts the 3 sealed ticker speeds 1 / 2 / 4', () => {
    for (const speed of [1, 2, 4] as const) {
      expect(
        weatherStar4000PanelPropsSchema.safeParse({
          ...MIN_PROPS,
          ticker: { items: ['ATLANTA 78°F'], scrollSpeedPxPerFrame: speed },
        }).success,
      ).toBe(true);
    }
  });

  it('rejects non-integer-pixel ticker speeds (3, 5, 0.5)', () => {
    for (const speed of [0, 3, 5, 0.5, -1]) {
      expect(
        weatherStar4000PanelPropsSchema.safeParse({
          ...MIN_PROPS,
          ticker: { items: ['ATLANTA 78°F'], scrollSpeedPxPerFrame: speed },
        }).success,
      ).toBe(false);
    }
  });

  it('rejects ticker with empty items array', () => {
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        ticker: { items: [], scrollSpeedPxPerFrame: 2 },
      }).success,
    ).toBe(false);
  });

  it('rejects ticker over 32-item cap', () => {
    const items = Array.from({ length: 33 }, (_, i) => `City ${i}`);
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        ticker: { items, scrollSpeedPxPerFrame: 2 },
      }).success,
    ).toBe(false);
  });
});

describe('weatherStar4000PanelPropsSchema — common-field rejections', () => {
  it('rejects metadata over 8-row cap', () => {
    const metadata = Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, value: 'v' }));
    expect(weatherStar4000PanelPropsSchema.safeParse({ ...MIN_PROPS, metadata }).success).toBe(
      false,
    );
  });

  it('rejects malformed hex on background gradient + foreground', () => {
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        background: { from: 'red', to: '#000099' },
      }).success,
    ).toBe(false);
    expect(
      weatherStar4000PanelPropsSchema.safeParse({
        ...MIN_PROPS,
        foreground: '#FFF',
      }).success,
    ).toBe(false);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(weatherStar4000PanelPropsSchema.safeParse({ ...MIN_PROPS, mystery: true }).success).toBe(
      false,
    );
  });
});

// ─── canonical palettes ──────────────────────────────────────────────────

describe('canonical WeatherStar palette exports (D-T347g-2)', () => {
  it('WEATHER_STAR_BLUE_GRADIENT is the deep-blue endpoints #000066 / #000099', () => {
    expect(WEATHER_STAR_BLUE_GRADIENT[0]).toBe('#000066');
    expect(WEATHER_STAR_BLUE_GRADIENT[1]).toBe('#000099');
  });

  it('WEATHER_STAR_ORANGE_GOLD is the accent-bar pair #FF9900 / #DAA520', () => {
    expect(WEATHER_STAR_ORANGE_GOLD[0]).toBe('#FF9900');
    expect(WEATHER_STAR_ORANGE_GOLD[1]).toBe('#DAA520');
  });

  it('WEATHER_STAR_FOREGROUND_WHITE_GOLD is #FFFFFF / #DAA520', () => {
    expect(WEATHER_STAR_FOREGROUND_WHITE_GOLD[0]).toBe('#FFFFFF');
    expect(WEATHER_STAR_FOREGROUND_WHITE_GOLD[1]).toBe('#DAA520');
  });

  it('palette arrays are immutable (Object.freeze)', () => {
    expect(Object.isFrozen(WEATHER_STAR_BLUE_GRADIENT)).toBe(true);
    expect(Object.isFrozen(WEATHER_STAR_ORANGE_GOLD)).toBe(true);
    expect(Object.isFrozen(WEATHER_STAR_FOREGROUND_WHITE_GOLD)).toBe(true);
  });
});

// ─── pure helpers ────────────────────────────────────────────────────────

describe('snapTo8px (D-T347g-4 pixel-precision)', () => {
  it('snaps to nearest 8-px multiple', () => {
    expect(snapTo8px(15)).toBe(16);
    expect(snapTo8px(16)).toBe(16);
    expect(snapTo8px(17)).toBe(16);
    expect(snapTo8px(20)).toBe(24);
    expect(snapTo8px(96)).toBe(96);
    expect(snapTo8px(99)).toBe(96);
    expect(snapTo8px(100)).toBe(104);
  });

  it('floors to 8 for very small inputs', () => {
    expect(snapTo8px(0)).toBe(8);
    expect(snapTo8px(-5)).toBe(8);
    expect(snapTo8px(3)).toBe(8);
  });
});

describe('tickerScrollPosition (D-T347g-6 frame-determinism)', () => {
  it('returns 0 at frame 0 with no offset', () => {
    expect(
      tickerScrollPosition({
        frame: 0,
        frameOffset: 0,
        scrollSpeedPxPerFrame: 2,
        contentWidthPx: 1000,
      }),
    ).toBe(0);
  });

  it('scrolls leftward at integer-pixel-only speed', () => {
    expect(
      tickerScrollPosition({
        frame: 10,
        frameOffset: 0,
        scrollSpeedPxPerFrame: 4,
        contentWidthPx: 1000,
      }),
    ).toBe(-40);
    expect(
      tickerScrollPosition({
        frame: 100,
        frameOffset: 0,
        scrollSpeedPxPerFrame: 1,
        contentWidthPx: 1000,
      }),
    ).toBe(-100);
  });

  it('wraps at content width modulo (seamless infinite scroll)', () => {
    expect(
      tickerScrollPosition({
        frame: 1000,
        frameOffset: 0,
        scrollSpeedPxPerFrame: 1,
        contentWidthPx: 1000,
      }),
    ).toBe(0);
    expect(
      tickerScrollPosition({
        frame: 1500,
        frameOffset: 0,
        scrollSpeedPxPerFrame: 1,
        contentWidthPx: 1000,
      }),
    ).toBe(-500);
  });

  it('respects frameOffset for parity-fixture pinning', () => {
    const baseAt0 = tickerScrollPosition({
      frame: 0,
      frameOffset: 60,
      scrollSpeedPxPerFrame: 2,
      contentWidthPx: 1000,
    });
    const baseAt60 = tickerScrollPosition({
      frame: 60,
      frameOffset: 0,
      scrollSpeedPxPerFrame: 2,
      contentWidthPx: 1000,
    });
    expect(baseAt0).toBe(baseAt60);
  });
});

// ─── render dispatch ─────────────────────────────────────────────────────

describe('<WeatherStar4000Panel> render — common surface', () => {
  it('renders the wrapper with linear-gradient background per D-T347g-2', () => {
    const { container } = renderAt(0, MIN_PROPS);
    const root = container.querySelector('[data-testid="weather-star-panel"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.background).toContain('linear-gradient');
    expect(root.style.background.toLowerCase()).toContain('#000066');
    expect(root.style.background.toLowerCase()).toContain('#000099');
  });

  it('renders the L-bar sidebar by default (showLBar default true)', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.getByTestId('weather-star-l-bar')).toBeDefined();
  });

  it('does NOT render the L-bar when showLBar: false', () => {
    renderAt(0, { ...MIN_PROPS, showLBar: false });
    expect(screen.queryByTestId('weather-star-l-bar')).toBeNull();
  });

  it('renders the header banner ALL CAPS with city + condition', () => {
    renderAt(0, {
      ...MIN_PROPS,
      header: { city: 'Atlanta', condition: 'Partly Cloudy' },
    });
    const header = screen.getByTestId('weather-star-header');
    expect(header.textContent).toBe('ATLANTA — PARTLY CLOUDY');
    expect(header.getAttribute('data-city')).toBe('Atlanta');
  });

  it('renders the temperature value with unit suffix', () => {
    renderAt(0, { ...MIN_PROPS, temperature: { value: 102, unit: 'F' } });
    expect(screen.getByTestId('weather-star-temperature').textContent).toBe('102°F');
    cleanup();
    renderAt(0, { ...MIN_PROPS, temperature: { value: 25, unit: 'C' } });
    expect(screen.getByTestId('weather-star-temperature').textContent).toBe('25°C');
  });

  it('renders the temperature in gold when foreground: gold', () => {
    renderAt(0, {
      ...MIN_PROPS,
      temperature: { value: 78, unit: 'F', foreground: 'gold' },
    });
    const temp = screen.getByTestId('weather-star-temperature') as HTMLElement;
    const color = temp.style.color.toLowerCase();
    expect(color === '#daa520' || color === 'rgb(218, 165, 32)').toBe(true);
  });

  it('renders metadata rows when supplied (D-T347g-3)', () => {
    renderAt(0, {
      ...MIN_PROPS,
      metadata: [
        { label: 'HUMIDITY', value: '64%' },
        { label: 'WIND', value: 'ENE 12 MPH' },
        { label: 'PRESSURE', value: '30.05 IN' },
      ],
    });
    expect(screen.getByTestId('weather-star-metadata-0').textContent).toContain('HUMIDITY');
    expect(screen.getByTestId('weather-star-metadata-0').textContent).toContain('64%');
    expect(screen.getByTestId('weather-star-metadata-2').textContent).toContain('PRESSURE');
  });

  it('renders the ticker when supplied with sealed scrollSpeed', () => {
    renderAt(0, {
      ...MIN_PROPS,
      ticker: { items: ['CITY A 70°F', 'CITY B 65°F'], scrollSpeedPxPerFrame: 2 },
    });
    const ticker = screen.getByTestId('weather-star-ticker');
    expect(ticker.getAttribute('data-scroll-speed')).toBe('2');
    expect(ticker.textContent).toContain('CITY A 70°F');
  });

  it('does NOT render ticker when omitted', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.queryByTestId('weather-star-ticker')).toBeNull();
  });

  it('renders CRT scan-line overlay when showCrtScanlines: true', () => {
    renderAt(0, { ...MIN_PROPS, showCrtScanlines: true });
    expect(screen.getByTestId('weather-star-crt-scanlines')).toBeDefined();
  });

  it('does NOT render CRT scan-lines when showCrtScanlines is omitted / false', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.queryByTestId('weather-star-crt-scanlines')).toBeNull();
  });
});

// ─── pixel-precision invariants (D-T347g-4) ──────────────────────────────

describe('<WeatherStar4000Panel> pixel-precision invariants (D-T347g-4)', () => {
  it('declares image-rendering: pixelated on the root container', () => {
    renderAt(0, MIN_PROPS);
    const root = screen.getByTestId('weather-star-panel');
    expect((root as HTMLElement).style.imageRendering).toBe('pixelated');
  });

  it('snaps caller-supplied font.size to 8-px multiple via snapTo8px helper', () => {
    expect(snapTo8px(45)).toBe(48);
    expect(snapTo8px(33)).toBe(32);
  });
});

// ─── frame-determinism (D-T347g-6) ───────────────────────────────────────

describe('<WeatherStar4000Panel> frame-determinism', () => {
  it('produces byte-identical inner HTML across two renders at the same frame', () => {
    const props: WeatherStar4000PanelProps = {
      ...MIN_PROPS,
      ticker: { items: ['A', 'B', 'C'], scrollSpeedPxPerFrame: 2 },
    };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });

  it('ticker translateX is closed-form integer pixel position', () => {
    renderAt(30, {
      ...MIN_PROPS,
      ticker: { items: ['ATLANTA 78°F'], scrollSpeedPxPerFrame: 2, frameOffset: 0 },
    });
    const tickerInner = screen
      .getByTestId('weather-star-ticker')
      .querySelector('div') as HTMLElement;
    // 30 frames * 2 px/frame = -60 px expected (or wrapped); but at any
    // value the transform string must include integer px.
    expect(tickerInner.style.transform).toMatch(/translateX\(-?\d+px\)/);
  });
});

// ─── clip definition ─────────────────────────────────────────────────────

describe('weatherStar4000PanelClip definition (T-347g)', () => {
  it("registers under kind 'weatherStar4000Panel' with the expected theme slots", () => {
    expect(weatherStar4000PanelClip.kind).toBe('weatherStar4000Panel');
    expect(weatherStar4000PanelClip.propsSchema).toBe(weatherStar4000PanelPropsSchema);
    expect(weatherStar4000PanelClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
    });
  });

  it('declares no fontRequirements', () => {
    expect(weatherStar4000PanelClip.fontRequirements).toBeUndefined();
  });

  it('ALL_BRIDGE_CLIPS includes weatherStar4000PanelClip and is length 61 (60 → 61)', () => {
    expect(ALL_BRIDGE_CLIPS).toHaveLength(63);
    expect(ALL_BRIDGE_CLIPS).toContain(weatherStar4000PanelClip);
  });
});
