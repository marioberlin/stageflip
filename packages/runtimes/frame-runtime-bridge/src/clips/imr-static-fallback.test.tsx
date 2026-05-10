// packages/runtimes/frame-runtime-bridge/src/clips/imr-static-fallback.test.tsx
// T-347h — ImrStaticFallback clip behaviour + propsSchema + canonical-
// palette exports + deterministic particle overlay + severity HUD
// render + frame-determinism. Mirrors weather-star-panel.test.tsx
// single-object-schema test structure.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ALL_BRIDGE_CLIPS,
  IMR_DANGER_REDS,
  IMR_DATA_FOREGROUND_WHITE,
  IMR_STORM_GRAYS,
  ImrStaticFallback,
  type ImrStaticFallbackProps,
  generateParticles,
  hashSeed,
  imrStaticFallbackClip,
  imrStaticFallbackPropsSchema,
} from './index.js';

afterEach(cleanup);

const MIN_PROPS: ImrStaticFallbackProps = {
  scenario: 'severe',
  severity: { label: 'Tornado Warning', location: 'Atlanta Metro' },
  data: [{ label: 'WIND', value: '155 MPH' }],
};

function renderAt(
  frame: number,
  props: ImrStaticFallbackProps,
  config: { width?: number; height?: number; fps?: number; durationInFrames?: number } = {},
) {
  const { width = 1280, height = 720, fps = 30, durationInFrames = 150 } = config;
  return render(
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames }}>
      <ImrStaticFallback {...props} />
    </FrameProvider>,
  );
}

// ─── schema ──────────────────────────────────────────────────────────────

describe('imrStaticFallbackPropsSchema — required fields', () => {
  it('accepts a minimal valid input', () => {
    expect(imrStaticFallbackPropsSchema.safeParse(MIN_PROPS).success).toBe(true);
  });

  it('rejects when severity is missing', () => {
    const { severity: _s, ...rest } = MIN_PROPS;
    expect(imrStaticFallbackPropsSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects when data is missing or empty', () => {
    const { data: _d, ...rest } = MIN_PROPS;
    expect(imrStaticFallbackPropsSchema.safeParse(rest).success).toBe(false);
    expect(imrStaticFallbackPropsSchema.safeParse({ ...MIN_PROPS, data: [] }).success).toBe(false);
  });

  it('rejects unknown scenario (sealed enum)', () => {
    expect(
      imrStaticFallbackPropsSchema.safeParse({ ...MIN_PROPS, scenario: 'extreme' }).success,
    ).toBe(false);
  });

  it("accepts both 'severe' and 'calm' scenarios", () => {
    for (const scenario of ['severe', 'calm'] as const) {
      expect(imrStaticFallbackPropsSchema.safeParse({ ...MIN_PROPS, scenario }).success).toBe(true);
    }
  });

  it('rejects empty severity.label / location', () => {
    expect(
      imrStaticFallbackPropsSchema.safeParse({
        ...MIN_PROPS,
        severity: { label: '', location: 'Atlanta' },
      }).success,
    ).toBe(false);
    expect(
      imrStaticFallbackPropsSchema.safeParse({
        ...MIN_PROPS,
        severity: { label: 'Warning', location: '' },
      }).success,
    ).toBe(false);
  });
});

describe('imrStaticFallbackPropsSchema — common-field rejections', () => {
  it('rejects data over 8-row cap', () => {
    const data = Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, value: 'v' }));
    expect(imrStaticFallbackPropsSchema.safeParse({ ...MIN_PROPS, data }).success).toBe(false);
  });

  it('rejects out-of-range particleDensity', () => {
    expect(
      imrStaticFallbackPropsSchema.safeParse({ ...MIN_PROPS, particleDensity: -0.1 }).success,
    ).toBe(false);
    expect(
      imrStaticFallbackPropsSchema.safeParse({ ...MIN_PROPS, particleDensity: 1.1 }).success,
    ).toBe(false);
  });

  it('rejects malformed hex on background gradient + foreground', () => {
    expect(
      imrStaticFallbackPropsSchema.safeParse({
        ...MIN_PROPS,
        background: { from: 'red', to: '#000000' },
      }).success,
    ).toBe(false);
    expect(
      imrStaticFallbackPropsSchema.safeParse({ ...MIN_PROPS, foreground: '#FFF' }).success,
    ).toBe(false);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(imrStaticFallbackPropsSchema.safeParse({ ...MIN_PROPS, mystery: true }).success).toBe(
      false,
    );
  });
});

// ─── canonical palettes ──────────────────────────────────────────────────

describe('canonical IMR palette exports (D-T347h-2)', () => {
  it('IMR_STORM_GRAYS is the 3-stop backdrop gradient', () => {
    expect(IMR_STORM_GRAYS).toHaveLength(3);
    expect(IMR_STORM_GRAYS[0]).toBe('#1A1F26');
    expect(IMR_STORM_GRAYS[1]).toBe('#2C3441');
    expect(IMR_STORM_GRAYS[2]).toBe('#4A5566');
  });

  it('IMR_DANGER_REDS is the severity-callout pair', () => {
    expect(IMR_DANGER_REDS).toHaveLength(2);
    expect(IMR_DANGER_REDS[0]).toBe('#CC0000');
    expect(IMR_DANGER_REDS[1]).toBe('#FF3333');
  });

  it('IMR_DATA_FOREGROUND_WHITE is #FFFFFF', () => {
    expect(IMR_DATA_FOREGROUND_WHITE).toBe('#FFFFFF');
  });

  it('palette arrays are immutable', () => {
    expect(Object.isFrozen(IMR_STORM_GRAYS)).toBe(true);
    expect(Object.isFrozen(IMR_DANGER_REDS)).toBe(true);
  });
});

// ─── pure helpers ────────────────────────────────────────────────────────

describe('hashSeed (D-T347h-5 deterministic noise)', () => {
  it('returns same hash for same inputs', () => {
    expect(hashSeed(0, 0, 0)).toBe(hashSeed(0, 0, 0));
    expect(hashSeed(100, 200, 42)).toBe(hashSeed(100, 200, 42));
  });

  it('returns 32-bit unsigned integer', () => {
    const h = hashSeed(123, 456, 789);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it('different inputs produce different hashes (avalanche)', () => {
    const a = hashSeed(0, 0, 0);
    const b = hashSeed(1, 0, 0);
    const c = hashSeed(0, 1, 0);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('generateParticles (D-T347h-5)', () => {
  it('returns the requested count', () => {
    const particles = generateParticles({
      count: 50,
      regionWidth: 1000,
      regionHeight: 500,
      seed: 0,
    });
    expect(particles).toHaveLength(50);
  });

  it('produces deterministic output for same args', () => {
    const a = generateParticles({ count: 10, regionWidth: 800, regionHeight: 400, seed: 0 });
    const b = generateParticles({ count: 10, regionWidth: 800, regionHeight: 400, seed: 0 });
    expect(a).toEqual(b);
  });

  it('all particle x positions are within regionWidth', () => {
    const particles = generateParticles({
      count: 100,
      regionWidth: 1000,
      regionHeight: 500,
      seed: 0,
    });
    for (const p of particles) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(1000);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(500);
    }
  });

  it('returns empty array when count is 0', () => {
    expect(generateParticles({ count: 0, regionWidth: 100, regionHeight: 100, seed: 0 })).toEqual(
      [],
    );
  });
});

// ─── render dispatch ─────────────────────────────────────────────────────

describe('<ImrStaticFallback> render — common surface', () => {
  it('renders the wrapper with 3-stop linear-gradient backdrop per D-T347h-4', () => {
    const { container } = renderAt(0, MIN_PROPS);
    const root = container.querySelector('[data-testid="imr-static-fallback"]') as HTMLElement;
    expect(root.style.background).toContain('linear-gradient');
    expect(root.style.background.toLowerCase()).toContain('#1a1f26');
    expect(root.style.background.toLowerCase()).toContain('#2c3441');
    expect(root.style.background.toLowerCase()).toContain('#4a5566');
  });

  it('records data-scenario attribute on root', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.getByTestId('imr-static-fallback').getAttribute('data-scenario')).toBe('severe');
  });

  it('renders severity callout with label + location + optional timestamp', () => {
    renderAt(0, {
      ...MIN_PROPS,
      severity: {
        label: 'Tornado Warning',
        location: 'Atlanta Metro',
        timestamp: 'Issued 4:12 PM EDT',
      },
    });
    expect(screen.getByTestId('imr-severity-label').textContent).toBe('Tornado Warning');
    expect(screen.getByTestId('imr-severity-location').textContent).toBe('Atlanta Metro');
    expect(screen.getByTestId('imr-severity-timestamp').textContent).toBe('Issued 4:12 PM EDT');
  });

  it('does NOT render timestamp when omitted', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.queryByTestId('imr-severity-timestamp')).toBeNull();
  });

  it('renders danger-red side-band on severity card per D-T347h-6', () => {
    renderAt(0, MIN_PROPS);
    const card = screen.getByTestId('imr-severity-card') as HTMLElement;
    const borderLeft = card.style.borderLeft.toLowerCase();
    expect(borderLeft).toContain('8px');
    expect(borderLeft).toContain('#cc0000');
  });

  it('renders data-label strip with positional testids', () => {
    renderAt(0, {
      ...MIN_PROPS,
      data: [
        { label: 'WIND', value: '155 MPH' },
        { label: 'PRESSURE', value: '948 MB' },
        { label: 'TEMP', value: '76 °F' },
      ],
    });
    expect(screen.getByTestId('imr-data-0').textContent).toContain('WIND');
    expect(screen.getByTestId('imr-data-0').textContent).toContain('155 MPH');
    expect(screen.getByTestId('imr-data-2').textContent).toContain('TEMP');
  });

  it('renders particle overlay when particleDensity > 0', () => {
    renderAt(0, { ...MIN_PROPS, particleDensity: 0.5 });
    const particles = screen.getByTestId('imr-particles');
    expect(particles.getAttribute('data-particle-count')).toBe('100');
    expect(particles.querySelectorAll('line').length).toBe(100);
  });

  it('does NOT render particle overlay when particleDensity is omitted / 0', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.queryByTestId('imr-particles')).toBeNull();
    cleanup();
    renderAt(0, { ...MIN_PROPS, particleDensity: 0 });
    expect(screen.queryByTestId('imr-particles')).toBeNull();
  });
});

// ─── frame-determinism ───────────────────────────────────────────────────

describe('<ImrStaticFallback> frame-determinism', () => {
  it('produces byte-identical inner HTML across two renders at the same frame', () => {
    const props: ImrStaticFallbackProps = { ...MIN_PROPS, particleDensity: 0.4 };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });

  it('static-fallback v1 — output identical across frames 0 / 60 / 120', () => {
    const props: ImrStaticFallbackProps = { ...MIN_PROPS, particleDensity: 0.3 };
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

describe('imrStaticFallbackClip definition (T-347h)', () => {
  it("registers under kind 'imrStaticFallback' with the expected theme slots", () => {
    expect(imrStaticFallbackClip.kind).toBe('imrStaticFallback');
    expect(imrStaticFallbackClip.propsSchema).toBe(imrStaticFallbackPropsSchema);
    expect(imrStaticFallbackClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
    });
  });

  it('declares no fontRequirements', () => {
    expect(imrStaticFallbackClip.fontRequirements).toBeUndefined();
  });

  it('ALL_BRIDGE_CLIPS includes imrStaticFallbackClip and is length 61 (60 → 61)', () => {
    expect(ALL_BRIDGE_CLIPS).toHaveLength(62);
    expect(ALL_BRIDGE_CLIPS).toContain(imrStaticFallbackClip);
  });
});
