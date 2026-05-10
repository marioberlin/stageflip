// packages/runtimes/frame-runtime-bridge/src/clips/weather-map.test.tsx
// T-347a — WeatherMap clip behaviour + propsSchema + per-style render
// dispatch + canonical-palette exports + frame-determinism. Mirrors the
// structural posture of `title-sequence.test.tsx` (sealed-style
// discriminatedUnion; per-style branch tests; theme-slot map verification).

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `grain.test.tsx` /
// `qr-code-bounce.test.tsx` / `link-sticker.test.tsx`).
import {
  ALL_BRIDGE_CLIPS,
  DOPPLER_DBZ_REFLECTIVITY,
  DOPPLER_VELOCITY,
  MARK_ALLEN_TEMPERATURE_DISCS,
  MERIAM_38_CLASS_HEAT,
  WeatherMap,
  type WeatherMapProps,
  resolveDopplerPalette,
  resolveHeatMapFill,
  resolveMarkAllenDisc,
  weatherMapClip,
  weatherMapPropsSchema,
} from './index.js';

afterEach(cleanup);

const MIN_REGION = {
  id: 'r1',
  name: 'London',
  dataValue: '12°C',
  screenPosition: { x: 100, y: 100 },
};

const MIN_MARK_ALLEN: WeatherMapProps = {
  style: 'mark-allen-clouds',
  regions: [MIN_REGION],
};
const MIN_DOPPLER: WeatherMapProps = {
  style: 'doppler-radar',
  regions: [MIN_REGION],
  productMode: 'reflectivity',
  loopFrameIndex: 0,
};
const MIN_HEAT: WeatherMapProps = {
  style: 'heat-map',
  regions: [MIN_REGION],
  units: 'F',
};

function renderAt(
  frame: number,
  props: WeatherMapProps,
  config: { width?: number; height?: number; fps?: number; durationInFrames?: number } = {},
) {
  const { width = 1280, height = 720, fps = 30, durationInFrames = 150 } = config;
  return render(
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames }}>
      <WeatherMap {...props} />
    </FrameProvider>,
  );
}

// ─── schema ──────────────────────────────────────────────────────────────

describe('weatherMapPropsSchema — sealed style enum', () => {
  it('accepts each of the 3 sealed styles with valid minimal payload', () => {
    expect(weatherMapPropsSchema.safeParse(MIN_MARK_ALLEN).success).toBe(true);
    expect(weatherMapPropsSchema.safeParse(MIN_DOPPLER).success).toBe(true);
    expect(weatherMapPropsSchema.safeParse(MIN_HEAT).success).toBe(true);
  });

  it('rejects unknown styles (sealed enum)', () => {
    expect(weatherMapPropsSchema.safeParse({ ...MIN_HEAT, style: 'satellite' }).success).toBe(
      false,
    );
  });

  it('rejects missing style discriminator', () => {
    expect(weatherMapPropsSchema.safeParse({ regions: [MIN_REGION] }).success).toBe(false);
  });
});

describe('weatherMapPropsSchema — per-style required fields', () => {
  it("'doppler-radar' requires productMode + loopFrameIndex", () => {
    expect(
      weatherMapPropsSchema.safeParse({
        style: 'doppler-radar',
        regions: [MIN_REGION],
        productMode: 'reflectivity',
        // loopFrameIndex missing
      }).success,
    ).toBe(false);
    expect(
      weatherMapPropsSchema.safeParse({
        style: 'doppler-radar',
        regions: [MIN_REGION],
        loopFrameIndex: 0,
        // productMode missing
      }).success,
    ).toBe(false);
  });

  it("'doppler-radar' rejects out-of-range loopFrameIndex", () => {
    expect(weatherMapPropsSchema.safeParse({ ...MIN_DOPPLER, loopFrameIndex: -1 }).success).toBe(
      false,
    );
    expect(weatherMapPropsSchema.safeParse({ ...MIN_DOPPLER, loopFrameIndex: 32 }).success).toBe(
      false,
    );
    expect(weatherMapPropsSchema.safeParse({ ...MIN_DOPPLER, loopFrameIndex: 1.5 }).success).toBe(
      false,
    );
  });

  it("'doppler-radar' rejects out-of-range sweepBeamPhase", () => {
    expect(weatherMapPropsSchema.safeParse({ ...MIN_DOPPLER, sweepBeamPhase: -0.1 }).success).toBe(
      false,
    );
    expect(weatherMapPropsSchema.safeParse({ ...MIN_DOPPLER, sweepBeamPhase: 1.1 }).success).toBe(
      false,
    );
  });

  it("'heat-map' requires units", () => {
    expect(
      weatherMapPropsSchema.safeParse({
        style: 'heat-map',
        regions: [MIN_REGION],
        // units missing
      }).success,
    ).toBe(false);
  });

  it("'heat-map' rejects unknown units (sealed enum)", () => {
    expect(weatherMapPropsSchema.safeParse({ ...MIN_HEAT, units: 'K' }).success).toBe(false);
  });

  it("'mark-allen-clouds' allows symbols[] but it is optional", () => {
    expect(weatherMapPropsSchema.safeParse(MIN_MARK_ALLEN).success).toBe(true);
    expect(
      weatherMapPropsSchema.safeParse({
        ...MIN_MARK_ALLEN,
        symbols: [{ kind: 'cloud', position: { x: 50, y: 50 } }],
      }).success,
    ).toBe(true);
  });

  it("'mark-allen-clouds' rejects unknown symbol kind", () => {
    expect(
      weatherMapPropsSchema.safeParse({
        ...MIN_MARK_ALLEN,
        symbols: [{ kind: 'tornado', position: { x: 50, y: 50 } }],
      }).success,
    ).toBe(false);
  });
});

describe('weatherMapPropsSchema — common-field rejections', () => {
  it('rejects regions[] over the 64-cap', () => {
    const tooMany = Array.from({ length: 65 }, (_, i) => ({
      id: `r${i}`,
      name: `R${i}`,
      dataValue: `${i}`,
      screenPosition: { x: 0, y: 0 },
    }));
    expect(weatherMapPropsSchema.safeParse({ ...MIN_HEAT, regions: tooMany }).success).toBe(false);
  });

  it('rejects mapPaths[] over the 256-cap', () => {
    const tooMany = Array.from({ length: 257 }, (_, i) => ({ id: `p${i}`, d: 'M0,0 L1,1' }));
    expect(weatherMapPropsSchema.safeParse({ ...MIN_HEAT, mapPaths: tooMany }).success).toBe(false);
  });

  it('rejects out-of-range position dimensions', () => {
    expect(
      weatherMapPropsSchema.safeParse({
        ...MIN_HEAT,
        position: { x: 0, y: 0, width: 0, height: 720 },
      }).success,
    ).toBe(false);
    expect(
      weatherMapPropsSchema.safeParse({
        ...MIN_HEAT,
        position: { x: 0, y: 0, width: 1921, height: 720 },
      }).success,
    ).toBe(false);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(weatherMapPropsSchema.safeParse({ ...MIN_HEAT, mystery: true }).success).toBe(false);
  });

  it('rejects malformed hex on background / foreground / mapPath fill', () => {
    expect(weatherMapPropsSchema.safeParse({ ...MIN_HEAT, background: 'red' }).success).toBe(false);
    expect(weatherMapPropsSchema.safeParse({ ...MIN_HEAT, foreground: '#FFF' }).success).toBe(
      false,
    );
    expect(
      weatherMapPropsSchema.safeParse({
        ...MIN_HEAT,
        mapPaths: [{ id: 'a', d: 'M0,0', fill: 'rgb(0,0,0)' }],
      }).success,
    ).toBe(false);
  });
});

// ─── canonical palettes ──────────────────────────────────────────────────

describe('canonical palette exports (D-T347a-3)', () => {
  it('MARK_ALLEN_TEMPERATURE_DISCS is 6-step blue→red gradient', () => {
    expect(MARK_ALLEN_TEMPERATURE_DISCS).toHaveLength(6);
    expect(MARK_ALLEN_TEMPERATURE_DISCS[0]).toBe('#0000FF');
    expect(MARK_ALLEN_TEMPERATURE_DISCS[5]).toBe('#FF0000');
  });

  it('DOPPLER_DBZ_REFLECTIVITY is 7-step NEXRAD palette ending in magenta', () => {
    expect(DOPPLER_DBZ_REFLECTIVITY).toHaveLength(7);
    expect(DOPPLER_DBZ_REFLECTIVITY[0]).toBe('#00BFFF');
    expect(DOPPLER_DBZ_REFLECTIVITY[6]).toBe('#FF00FF');
  });

  it('DOPPLER_VELOCITY pairs bright green (inbound) with bright red (outbound)', () => {
    expect(DOPPLER_VELOCITY).toHaveLength(2);
    expect(DOPPLER_VELOCITY[0]).toBe('#00FF00');
    expect(DOPPLER_VELOCITY[1]).toBe('#FF0000');
  });

  it('MERIAM_38_CLASS_HEAT is 38-class gradient deep purple → dark maroon', () => {
    expect(MERIAM_38_CLASS_HEAT).toHaveLength(38);
    expect(MERIAM_38_CLASS_HEAT[0]).toBe('#4B0082');
    expect(MERIAM_38_CLASS_HEAT[37]).toBe('#1A0000');
  });

  it('palette arrays are immutable (Object.freeze)', () => {
    expect(Object.isFrozen(MARK_ALLEN_TEMPERATURE_DISCS)).toBe(true);
    expect(Object.isFrozen(DOPPLER_DBZ_REFLECTIVITY)).toBe(true);
    expect(Object.isFrozen(DOPPLER_VELOCITY)).toBe(true);
    expect(Object.isFrozen(MERIAM_38_CLASS_HEAT)).toBe(true);
  });
});

describe('palette resolution helpers', () => {
  it('resolveMarkAllenDisc maps paletteIndex → palette entry; clamps + falls back', () => {
    expect(resolveMarkAllenDisc(0)).toBe('#0000FF');
    expect(resolveMarkAllenDisc(5)).toBe('#FF0000');
    expect(resolveMarkAllenDisc(-1)).toBe('#0000FF');
    expect(resolveMarkAllenDisc(100)).toBe('#FF0000');
    expect(resolveMarkAllenDisc(undefined)).toBe('#00FF00');
  });

  it('resolveHeatMapFill maps paletteIndex → palette entry; oscillation darkens odd classes', () => {
    expect(resolveHeatMapFill(0, false)).toBe('#4B0082');
    expect(resolveHeatMapFill(undefined, false)).toBe('#FFB300');
    expect(resolveHeatMapFill(37, false)).toBe('#1A0000');
    expect(resolveHeatMapFill(100, false)).toBe('#1A0000');
    // Oscillation: even classes pass through; odd classes darken.
    const evenColor = resolveHeatMapFill(0, true);
    const oddColor = resolveHeatMapFill(1, true);
    expect(evenColor).toBe('#4B0082');
    expect(oddColor).not.toBe(MERIAM_38_CLASS_HEAT[1]);
  });

  it('resolveDopplerPalette switches by productMode', () => {
    expect(resolveDopplerPalette('reflectivity')).toBe(DOPPLER_DBZ_REFLECTIVITY);
    expect(resolveDopplerPalette('velocity')).toBe(DOPPLER_VELOCITY);
  });
});

// ─── render dispatch ─────────────────────────────────────────────────────

describe('<WeatherMap> render — common surface', () => {
  it('emits a wrapper with data-style and data-region-count', () => {
    renderAt(0, { ...MIN_HEAT, regions: [MIN_REGION] });
    const root = screen.getByTestId('weather-map');
    expect(root.getAttribute('data-style')).toBe('heat-map');
    expect(root.getAttribute('data-region-count')).toBe('1');
  });

  it('renders an SVG sized to the position when explicit, else full canvas', () => {
    renderAt(0, MIN_DOPPLER, { width: 1920, height: 1080 });
    let svg = screen.getByTestId('weather-map-svg');
    expect(svg.getAttribute('width')).toBe('1920');
    expect(svg.getAttribute('height')).toBe('1080');
    cleanup();
    renderAt(0, {
      ...MIN_DOPPLER,
      position: { x: 50, y: 60, width: 800, height: 450 },
    });
    svg = screen.getByTestId('weather-map-svg');
    expect(svg.getAttribute('width')).toBe('800');
    expect(svg.getAttribute('height')).toBe('450');
  });

  it('renders mapPaths as <path> elements with id-derived data-map-path-id', () => {
    const { container } = renderAt(0, {
      ...MIN_DOPPLER,
      mapPaths: [
        { id: 'usa', d: 'M0,0 L100,0 L100,100 Z', fill: '#1A1A1A' },
        { id: 'canada', d: 'M100,0 L200,0 L200,100 Z' },
      ],
    });
    const paths = container.querySelectorAll('path[data-map-path-id]');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('data-map-path-id')).toBe('usa');
    expect(paths[0]?.getAttribute('fill')).toBe('#1A1A1A');
  });

  it('renders region labels with stable id-derived data-testid', () => {
    renderAt(0, {
      ...MIN_HEAT,
      regions: [
        { id: 'a', name: 'A', dataValue: '50', screenPosition: { x: 100, y: 100 } },
        { id: 'b', name: 'B', dataValue: '60', screenPosition: { x: 200, y: 200 } },
      ],
    });
    expect(screen.getByTestId('weather-map-region-a').textContent).toBe('50');
    expect(screen.getByTestId('weather-map-region-b').textContent).toBe('60');
  });

  it('renders legend when enabled with palette swatches matching the active style', () => {
    renderAt(0, {
      ...MIN_HEAT,
      legend: { enabled: true, position: 'top-right' },
    });
    const legend = screen.getByTestId('weather-map-legend');
    const swatches = legend.querySelectorAll('span[style*="background"]');
    expect(swatches.length).toBe(MERIAM_38_CLASS_HEAT.length);
  });

  it('does NOT render legend when legend.enabled is false or omitted', () => {
    renderAt(0, MIN_HEAT);
    expect(screen.queryByTestId('weather-map-legend')).toBeNull();
  });
});

describe("<WeatherMap> render — 'mark-allen-clouds' branch", () => {
  it('wraps region label in a colored disc using paletteIndex', () => {
    renderAt(0, {
      ...MIN_MARK_ALLEN,
      regions: [
        {
          id: 'london',
          name: 'London',
          dataValue: '12°C',
          screenPosition: { x: 200, y: 200 },
          paletteIndex: 4, // → '#FFA500' (orange)
        },
      ],
    });
    const disc = screen.getByTestId('weather-map-region-london');
    expect((disc as HTMLElement).style.borderRadius).toBe('50%');
    // happy-dom preserves hex; jsdom converts to rgb. Accept either.
    const bg = (disc as HTMLElement).style.backgroundColor.toLowerCase();
    expect(bg === '#ffa500' || bg === 'rgb(255, 165, 0)').toBe(true);
  });

  it('renders cloud / sun / raindrop / snow symbols when symbols[] supplied', () => {
    renderAt(0, {
      ...MIN_MARK_ALLEN,
      symbols: [
        { kind: 'cloud', position: { x: 100, y: 100 } },
        { kind: 'sun', position: { x: 200, y: 200 } },
        { kind: 'raindrop', position: { x: 300, y: 300 } },
        { kind: 'snow', position: { x: 400, y: 400 } },
      ],
    });
    expect(screen.getByTestId('weather-map-symbol-cloud-0')).toBeDefined();
    expect(screen.getByTestId('weather-map-symbol-sun-1')).toBeDefined();
    expect(screen.getByTestId('weather-map-symbol-raindrop-2')).toBeDefined();
    expect(screen.getByTestId('weather-map-symbol-snow-3')).toBeDefined();
  });

  it('does NOT render symbols when symbols[] is omitted', () => {
    const { container } = renderAt(0, MIN_MARK_ALLEN);
    expect(container.querySelectorAll('[data-testid^="weather-map-symbol-"]')).toHaveLength(0);
  });
});

describe("<WeatherMap> render — 'doppler-radar' branch", () => {
  it('renders sweep beam line when sweepBeamPhase is set', () => {
    renderAt(0, { ...MIN_DOPPLER, sweepBeamPhase: 0.25 });
    expect(screen.getByTestId('weather-map-doppler-sweep')).toBeDefined();
  });

  it('does NOT render sweep beam when sweepBeamPhase is omitted', () => {
    renderAt(0, MIN_DOPPLER);
    expect(screen.queryByTestId('weather-map-doppler-sweep')).toBeNull();
  });

  it("legend palette differs between 'reflectivity' and 'velocity' productMode", () => {
    renderAt(0, { ...MIN_DOPPLER, legend: { enabled: true, position: 'bottom-right' } });
    let legend = screen.getByTestId('weather-map-legend');
    expect(legend.querySelectorAll('span[style*="background"]')).toHaveLength(
      DOPPLER_DBZ_REFLECTIVITY.length,
    );
    cleanup();
    renderAt(0, {
      ...MIN_DOPPLER,
      productMode: 'velocity',
      legend: { enabled: true, position: 'bottom-right' },
    });
    legend = screen.getByTestId('weather-map-legend');
    expect(legend.querySelectorAll('span[style*="background"]')).toHaveLength(
      DOPPLER_VELOCITY.length,
    );
  });
});

describe("<WeatherMap> render — 'heat-map' branch", () => {
  it("derives mapPath fill from matching region's paletteIndex when fill omitted", () => {
    const { container } = renderAt(0, {
      style: 'heat-map',
      units: 'F',
      regions: [
        {
          id: 'tx',
          name: 'Texas',
          dataValue: '95°F',
          screenPosition: { x: 100, y: 100 },
          paletteIndex: 26, // hot → '#FF0000'
        },
      ],
      mapPaths: [{ id: 'tx', d: 'M0,0 L10,0 L10,10 Z' }],
    });
    const path = container.querySelector('path[data-map-path-id="tx"]');
    expect(path?.getAttribute('fill')).toBe('#FF0000');
  });

  it('legend renders units suffix per units prop', () => {
    renderAt(0, {
      ...MIN_HEAT,
      units: 'C',
      legend: { enabled: true, position: 'top-left' },
    });
    expect(screen.getByTestId('weather-map-legend').textContent).toContain('°C');
    cleanup();
    renderAt(0, {
      ...MIN_HEAT,
      units: 'F',
      legend: { enabled: true, position: 'top-left' },
    });
    expect(screen.getByTestId('weather-map-legend').textContent).toContain('°F');
  });
});

// ─── frame-determinism ───────────────────────────────────────────────────

describe('<WeatherMap> render — frame determinism (D-T347a-9)', () => {
  it('produces byte-identical inner HTML across two renders at the same frame for each style', () => {
    for (const props of [MIN_MARK_ALLEN, MIN_DOPPLER, MIN_HEAT] as WeatherMapProps[]) {
      const a = renderAt(60, props).container.innerHTML;
      cleanup();
      const b = renderAt(60, props).container.innerHTML;
      expect(a).toBe(b);
      cleanup();
    }
  });

  it('v1 single-frame static — output is identical across frames 0 / 60 / 120 for the same props', () => {
    const props: WeatherMapProps = {
      ...MIN_DOPPLER,
      sweepBeamPhase: 0.5,
      regions: [{ id: 'a', name: 'A', dataValue: 'X', screenPosition: { x: 10, y: 10 } }],
    };
    const html0 = renderAt(0, props).container.innerHTML;
    cleanup();
    const html60 = renderAt(60, props).container.innerHTML;
    cleanup();
    const html120 = renderAt(120, props).container.innerHTML;
    expect(html0).toBe(html60);
    expect(html60).toBe(html120);
  });
});

// ─── clip definition ─────────────────────────────────────────────────────

describe('weatherMapClip definition (T-347a)', () => {
  it("registers under kind 'weatherMap' with the expected theme slots", () => {
    expect(weatherMapClip.kind).toBe('weatherMap');
    expect(weatherMapClip.propsSchema).toBe(weatherMapPropsSchema);
    expect(weatherMapClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
    });
  });

  it('declares no fontRequirements (no specific font registered at primitive level)', () => {
    expect(weatherMapClip.fontRequirements).toBeUndefined();
  });

  it('ALL_BRIDGE_CLIPS includes weatherMapClip and is length 61 (post-T-347b sibling)', () => {
    expect(ALL_BRIDGE_CLIPS).toHaveLength(63);
    expect(ALL_BRIDGE_CLIPS).toContain(weatherMapClip);
  });
});
