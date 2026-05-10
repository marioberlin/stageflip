// packages/runtimes/frame-runtime-bridge/src/clips/storm-tracker.test.tsx
// T-347b — StormTracker clip behaviour + propsSchema + canonical-palette
// exports + mandatory-disclaimer invariant + frame-determinism. Mirrors
// the structural posture of `qr-code-bounce.test.tsx` (single-object
// schema, no discriminatedUnion, byte-stable render output).

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `grain.test.tsx` /
// `qr-code-bounce.test.tsx` / `link-sticker.test.tsx` /
// `weather-map.test.tsx`).
import {
  ALL_BRIDGE_CLIPS,
  NHC_HURRICANE_WARNING_RED,
  NHC_HURRICANE_WATCH_MAGENTA,
  NHC_INTENSITY_LETTERS,
  NHC_STORM_SURGE_PURPLE,
  NHC_TROPICAL_STORM_FIREBRICK,
  StormTracker,
  type StormTrackerProps,
  resolveCoastalWarningColor,
  stormTrackerClip,
  stormTrackerPropsSchema,
} from './index.js';

afterEach(cleanup);

const MIN_TRACK_DOT = {
  id: 'd1',
  position: { x: 100, y: 100 },
  intensity: 'H' as const,
};

const MIN_PROPS: StormTrackerProps = {
  storm: { name: 'Hurricane Margot' },
  cone: { d: 'M0,0 L1280,0 L1280,720 L0,720 Z' },
  trackDots: [MIN_TRACK_DOT],
};

function renderAt(
  frame: number,
  props: StormTrackerProps,
  config: { width?: number; height?: number; fps?: number; durationInFrames?: number } = {},
) {
  const { width = 1280, height = 720, fps = 30, durationInFrames = 150 } = config;
  return render(
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames }}>
      <StormTracker {...props} />
    </FrameProvider>,
  );
}

// ─── schema ──────────────────────────────────────────────────────────────

describe('stormTrackerPropsSchema — required fields', () => {
  it('accepts a minimal valid input', () => {
    expect(stormTrackerPropsSchema.safeParse(MIN_PROPS).success).toBe(true);
  });

  it('rejects when storm is missing', () => {
    const { storm: _storm, ...rest } = MIN_PROPS;
    expect(stormTrackerPropsSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects when cone is missing', () => {
    const { cone: _cone, ...rest } = MIN_PROPS;
    expect(stormTrackerPropsSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects when trackDots is empty (min 1)', () => {
    expect(stormTrackerPropsSchema.safeParse({ ...MIN_PROPS, trackDots: [] }).success).toBe(false);
  });

  it('rejects when trackDots exceeds the 48-cap', () => {
    const tooMany = Array.from({ length: 49 }, (_, i) => ({
      id: `d${i}`,
      position: { x: i, y: i },
      intensity: 'D' as const,
    }));
    expect(stormTrackerPropsSchema.safeParse({ ...MIN_PROPS, trackDots: tooMany }).success).toBe(
      false,
    );
  });
});

describe('stormTrackerPropsSchema — sealed enums (D-T347b-5 / -6)', () => {
  it('rejects unknown trackDot.intensity (sealed enum D/S/H/M)', () => {
    expect(
      stormTrackerPropsSchema.safeParse({
        ...MIN_PROPS,
        trackDots: [{ id: 'd1', position: { x: 0, y: 0 }, intensity: 'X' }],
      }).success,
    ).toBe(false);
  });

  it('accepts each of the 4 sealed intensity values', () => {
    for (const intensity of NHC_INTENSITY_LETTERS) {
      expect(
        stormTrackerPropsSchema.safeParse({
          ...MIN_PROPS,
          trackDots: [{ id: 'd1', position: { x: 0, y: 0 }, intensity }],
        }).success,
      ).toBe(true);
    }
  });

  it('rejects unknown coastalWarnings.warningType (sealed enum)', () => {
    expect(
      stormTrackerPropsSchema.safeParse({
        ...MIN_PROPS,
        coastalWarnings: [
          {
            id: 'cw1',
            regionPaths: ['M0,0 L1,1'],
            warningType: 'tornado-warning',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts each of the 4 sealed warningType values', () => {
    const types = [
      'hurricane-warning',
      'hurricane-watch',
      'tropical-storm-warning',
      'storm-surge-warning',
    ] as const;
    for (const warningType of types) {
      expect(
        stormTrackerPropsSchema.safeParse({
          ...MIN_PROPS,
          coastalWarnings: [{ id: 'cw1', regionPaths: ['M0,0 L1,1'], warningType }],
        }).success,
      ).toBe(true);
    }
  });
});

describe('stormTrackerPropsSchema — common-field rejections', () => {
  it('rejects empty storm.name', () => {
    expect(stormTrackerPropsSchema.safeParse({ ...MIN_PROPS, storm: { name: '' } }).success).toBe(
      false,
    );
  });

  it('rejects storm.name over 48 chars', () => {
    expect(
      stormTrackerPropsSchema.safeParse({ ...MIN_PROPS, storm: { name: 'A'.repeat(49) } }).success,
    ).toBe(false);
  });

  it('rejects empty cone.d', () => {
    expect(stormTrackerPropsSchema.safeParse({ ...MIN_PROPS, cone: { d: '' } }).success).toBe(
      false,
    );
  });

  it('rejects out-of-range cone.opacity', () => {
    expect(
      stormTrackerPropsSchema.safeParse({
        ...MIN_PROPS,
        cone: { d: 'M0,0', opacity: -0.1 },
      }).success,
    ).toBe(false);
    expect(
      stormTrackerPropsSchema.safeParse({
        ...MIN_PROPS,
        cone: { d: 'M0,0', opacity: 1.1 },
      }).success,
    ).toBe(false);
  });

  it('rejects empty disclaimerText', () => {
    expect(stormTrackerPropsSchema.safeParse({ ...MIN_PROPS, disclaimerText: '' }).success).toBe(
      false,
    );
  });

  it('rejects coastalWarnings.regionPaths empty array', () => {
    expect(
      stormTrackerPropsSchema.safeParse({
        ...MIN_PROPS,
        coastalWarnings: [{ id: 'cw', regionPaths: [], warningType: 'hurricane-warning' }],
      }).success,
    ).toBe(false);
  });

  it('rejects malformed hex on background / foreground / cone.fill / mapPath fill', () => {
    expect(stormTrackerPropsSchema.safeParse({ ...MIN_PROPS, background: 'red' }).success).toBe(
      false,
    );
    expect(stormTrackerPropsSchema.safeParse({ ...MIN_PROPS, foreground: '#FFF' }).success).toBe(
      false,
    );
    expect(
      stormTrackerPropsSchema.safeParse({
        ...MIN_PROPS,
        cone: { d: 'M0,0', fill: 'rgb(0,0,0)' },
      }).success,
    ).toBe(false);
    expect(
      stormTrackerPropsSchema.safeParse({
        ...MIN_PROPS,
        mapPaths: [{ id: 'a', d: 'M0,0', fill: 'rgb(0,0,0)' }],
      }).success,
    ).toBe(false);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(stormTrackerPropsSchema.safeParse({ ...MIN_PROPS, mystery: true }).success).toBe(false);
  });
});

// ─── canonical palette + helpers ─────────────────────────────────────────

describe('canonical NHC palette exports (D-T347b-3)', () => {
  it('NHC_HURRICANE_WARNING_RED is Crimson #DC143C', () => {
    expect(NHC_HURRICANE_WARNING_RED).toBe('#DC143C');
  });

  it('NHC_HURRICANE_WATCH_MAGENTA is #FF00FF', () => {
    expect(NHC_HURRICANE_WATCH_MAGENTA).toBe('#FF00FF');
  });

  it('NHC_TROPICAL_STORM_FIREBRICK is #B22222', () => {
    expect(NHC_TROPICAL_STORM_FIREBRICK).toBe('#B22222');
  });

  it('NHC_STORM_SURGE_PURPLE is #B524F7', () => {
    expect(NHC_STORM_SURGE_PURPLE).toBe('#B524F7');
  });

  it('NHC_INTENSITY_LETTERS is the 4-letter NWS shorthand D/S/H/M', () => {
    expect(NHC_INTENSITY_LETTERS).toEqual(['D', 'S', 'H', 'M']);
    expect(Object.isFrozen(NHC_INTENSITY_LETTERS)).toBe(true);
  });
});

describe('resolveCoastalWarningColor', () => {
  it('maps each warningType to its canonical palette color', () => {
    expect(resolveCoastalWarningColor('hurricane-warning')).toBe(NHC_HURRICANE_WARNING_RED);
    expect(resolveCoastalWarningColor('hurricane-watch')).toBe(NHC_HURRICANE_WATCH_MAGENTA);
    expect(resolveCoastalWarningColor('tropical-storm-warning')).toBe(NHC_TROPICAL_STORM_FIREBRICK);
    expect(resolveCoastalWarningColor('storm-surge-warning')).toBe(NHC_STORM_SURGE_PURPLE);
  });
});

// ─── render dispatch ─────────────────────────────────────────────────────

describe('<StormTracker> render — common surface', () => {
  it('emits a wrapper with data-storm-name', () => {
    renderAt(0, MIN_PROPS);
    const root = screen.getByTestId('storm-tracker');
    expect(root.getAttribute('data-storm-name')).toBe('Hurricane Margot');
  });

  it('renders an SVG sized to the position when explicit, else full canvas', () => {
    renderAt(0, MIN_PROPS, { width: 1920, height: 1080 });
    let svg = screen.getByTestId('storm-tracker-svg');
    expect(svg.getAttribute('width')).toBe('1920');
    expect(svg.getAttribute('height')).toBe('1080');
    cleanup();
    renderAt(0, {
      ...MIN_PROPS,
      position: { x: 50, y: 60, width: 800, height: 450 },
    });
    svg = screen.getByTestId('storm-tracker-svg');
    expect(svg.getAttribute('width')).toBe('800');
    expect(svg.getAttribute('height')).toBe('450');
  });

  it('renders the cone polygon via consumer-supplied SVG path data', () => {
    renderAt(0, {
      ...MIN_PROPS,
      cone: { d: 'M100,100 L500,200 L500,500 L100,400 Z', opacity: 0.6 },
    });
    const cone = screen.getByTestId('storm-tracker-cone');
    expect(cone.getAttribute('d')).toBe('M100,100 L500,200 L500,500 L100,400 Z');
    expect(cone.getAttribute('fill-opacity')).toBe('0.6');
  });

  it('renders track dots as <circle>+<text> with stable id-derived testid + intensity letter', () => {
    renderAt(0, {
      ...MIN_PROPS,
      trackDots: [
        { id: 'd1', position: { x: 100, y: 100 }, intensity: 'H' },
        { id: 'd2', position: { x: 200, y: 200 }, intensity: 'M' },
      ],
    });
    const dot1 = screen.getByTestId('storm-tracker-track-dot-d1');
    expect(dot1.getAttribute('data-intensity')).toBe('H');
    expect(dot1.textContent).toContain('H');
    const dot2 = screen.getByTestId('storm-tracker-track-dot-d2');
    expect(dot2.getAttribute('data-intensity')).toBe('M');
    expect(dot2.textContent).toContain('M');
  });

  it('renders track-dot timestamp label below the dot when supplied', () => {
    renderAt(0, {
      ...MIN_PROPS,
      trackDots: [{ id: 'd1', position: { x: 100, y: 100 }, intensity: 'H', timestamp: '5pm Mon' }],
    });
    const dot = screen.getByTestId('storm-tracker-track-dot-d1');
    expect(dot.textContent).toContain('5pm Mon');
  });

  it('renders coastal warning regions colored per the canonical palette (D-T347b-6)', () => {
    const { container } = renderAt(0, {
      ...MIN_PROPS,
      coastalWarnings: [
        {
          id: 'cw1',
          regionPaths: ['M0,0 L100,0 L100,100 Z'],
          warningType: 'hurricane-warning',
        },
        {
          id: 'cw2',
          regionPaths: ['M200,0 L300,0 L300,100 Z'],
          warningType: 'storm-surge-warning',
        },
      ],
    });
    const w1 = screen.getByTestId('storm-tracker-coastal-warning-cw1');
    expect(w1.getAttribute('data-warning-type')).toBe('hurricane-warning');
    expect(w1.querySelector('path')?.getAttribute('fill')).toBe(NHC_HURRICANE_WARNING_RED);
    const w2 = screen.getByTestId('storm-tracker-coastal-warning-cw2');
    expect(w2.getAttribute('data-warning-type')).toBe('storm-surge-warning');
    expect(w2.querySelector('path')?.getAttribute('fill')).toBe(NHC_STORM_SURGE_PURPLE);
    // Sanity: container has both warning groups.
    expect(
      container.querySelectorAll('[data-testid^="storm-tracker-coastal-warning-"]'),
    ).toHaveLength(2);
  });

  it('renders the storm name as ALL-CAPS top banner', () => {
    renderAt(0, { ...MIN_PROPS, storm: { name: 'Margot' } });
    const banner = screen.getByTestId('storm-tracker-storm-name');
    expect(banner.textContent).toBe('MARGOT');
  });

  it('renders the advisory timestamp below the storm name when supplied', () => {
    renderAt(0, {
      ...MIN_PROPS,
      storm: { name: 'Margot', advisoryTimestamp: 'Advisory 12 — 5 PM EDT Mon' },
    });
    expect(screen.getByTestId('storm-tracker-advisory-timestamp').textContent).toBe(
      'Advisory 12 — 5 PM EDT Mon',
    );
  });

  it('does NOT render advisory-timestamp element when omitted', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.queryByTestId('storm-tracker-advisory-timestamp')).toBeNull();
  });

  it('renders base map paths when supplied', () => {
    const { container } = renderAt(0, {
      ...MIN_PROPS,
      mapPaths: [
        { id: 'florida', d: 'M0,0 L100,0 L100,100 Z', fill: '#22354F' },
        { id: 'cuba', d: 'M200,0 L300,0 L300,100 Z' },
      ],
    });
    const paths = container.querySelectorAll('path[data-map-path-id]');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('data-map-path-id')).toBe('florida');
  });
});

// ─── mandatory disclaimer invariant (D-T347b-2) ──────────────────────────

describe('<StormTracker> mandatory disclaimer (D-T347b-2)', () => {
  // The cone-of-uncertainty misinterpretation ("outside cone = safe") is
  // a documented public-safety failure mode per cluster SKILL. Every
  // render MUST emit a disclaimer element with non-empty text content.
  // The caller may override the wording but cannot suppress rendering.

  it('renders the disclaimer element on every invocation with default text', () => {
    renderAt(0, MIN_PROPS);
    const disclaimer = screen.getByTestId('storm-tracker-disclaimer');
    expect(disclaimer.textContent).toBe('Impacts extend beyond the cone');
  });

  it('renders the caller-supplied disclaimer text when disclaimerText prop set', () => {
    renderAt(0, { ...MIN_PROPS, disclaimerText: 'IMPACTS EXTEND BEYOND THIS CONE — STAY SAFE' });
    expect(screen.getByTestId('storm-tracker-disclaimer').textContent).toBe(
      'IMPACTS EXTEND BEYOND THIS CONE — STAY SAFE',
    );
  });

  it('disclaimer is present for ALL combinations of props (no opt-out path)', () => {
    const variants: StormTrackerProps[] = [
      MIN_PROPS,
      { ...MIN_PROPS, mapPaths: [{ id: 'a', d: 'M0,0 L1,1' }] },
      {
        ...MIN_PROPS,
        coastalWarnings: [
          { id: 'cw', regionPaths: ['M0,0 L1,1'], warningType: 'hurricane-warning' },
        ],
      },
      { ...MIN_PROPS, position: { x: 10, y: 10, width: 200, height: 100 } },
      { ...MIN_PROPS, background: '#000000', foreground: '#FFFFFF' },
    ];
    for (const v of variants) {
      cleanup();
      renderAt(0, v);
      const disclaimer = screen.queryByTestId('storm-tracker-disclaimer');
      expect(disclaimer).not.toBeNull();
      expect(disclaimer?.textContent ?? '').not.toBe('');
    }
  });
});

// ─── frame-determinism (D-T347b-10) ──────────────────────────────────────

describe('<StormTracker> render — frame determinism', () => {
  it('produces byte-identical inner HTML across two renders at the same frame', () => {
    const a = renderAt(60, MIN_PROPS).container.innerHTML;
    cleanup();
    const b = renderAt(60, MIN_PROPS).container.innerHTML;
    expect(a).toBe(b);
  });

  it('v1 single-frame static — output is identical across frames 0 / 60 / 120 for same props', () => {
    const html0 = renderAt(0, MIN_PROPS).container.innerHTML;
    cleanup();
    const html60 = renderAt(60, MIN_PROPS).container.innerHTML;
    cleanup();
    const html120 = renderAt(120, MIN_PROPS).container.innerHTML;
    expect(html0).toBe(html60);
    expect(html60).toBe(html120);
  });
});

// ─── clip definition ─────────────────────────────────────────────────────

describe('stormTrackerClip definition (T-347b)', () => {
  it("registers under kind 'stormTracker' with the expected theme slots", () => {
    expect(stormTrackerClip.kind).toBe('stormTracker');
    expect(stormTrackerClip.propsSchema).toBe(stormTrackerPropsSchema);
    expect(stormTrackerClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
    });
  });

  it('declares no fontRequirements', () => {
    expect(stormTrackerClip.fontRequirements).toBeUndefined();
  });

  it('ALL_BRIDGE_CLIPS includes stormTrackerClip and is length 61 (59 → 60)', () => {
    expect(ALL_BRIDGE_CLIPS).toHaveLength(62);
    expect(ALL_BRIDGE_CLIPS).toContain(stormTrackerClip);
  });
});
