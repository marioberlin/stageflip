// packages/runtimes/frame-runtime-bridge/src/clips/ar-overlay.test.tsx
// T-375a — ArOverlay clip behaviour + propsSchema + static-fallback render
// + frame-determinism + ALL_BRIDGE_CLIPS membership. Mirrors imr-static-
// fallback.test.tsx single-object-schema test structure (T-347h precedent).

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ALL_BRIDGE_CLIPS,
  ArOverlay,
  type ArOverlayProps,
  arOverlayClip,
  arOverlayPropsSchema,
} from './index.js';

afterEach(cleanup);

const MIN_PROPS: ArOverlayProps = {
  staticFallback: {
    label: 'AR FORMATION OVERLAY',
  },
};

function renderAt(
  frame: number,
  props: ArOverlayProps,
  config: { width?: number; height?: number; fps?: number; durationInFrames?: number } = {},
) {
  const { width = 1280, height = 720, fps = 30, durationInFrames = 150 } = config;
  return render(
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames }}>
      <ArOverlay {...props} />
    </FrameProvider>,
  );
}

// ─── schema ──────────────────────────────────────────────────────────────

describe('arOverlayPropsSchema — required fields', () => {
  it('accepts a minimal valid input (only staticFallback.label)', () => {
    expect(arOverlayPropsSchema.safeParse(MIN_PROPS).success).toBe(true);
  });

  it('rejects when staticFallback is missing', () => {
    expect(arOverlayPropsSchema.safeParse({}).success).toBe(false);
  });

  it('rejects when staticFallback.label is missing or empty', () => {
    expect(arOverlayPropsSchema.safeParse({ staticFallback: {} }).success).toBe(false);
    expect(arOverlayPropsSchema.safeParse({ staticFallback: { label: '' } }).success).toBe(false);
  });

  it('accepts optional sublabel', () => {
    expect(
      arOverlayPropsSchema.safeParse({
        staticFallback: { label: 'VAR — CHECKING', sublabel: 'Loading review' },
      }).success,
    ).toBe(true);
  });

  it('accepts hex backgroundColor / foregroundColor / accentColor', () => {
    expect(
      arOverlayPropsSchema.safeParse({
        staticFallback: {
          label: 'X',
          backgroundColor: '#0A1128',
          foregroundColor: '#FFFFFF',
          accentColor: '#38003C',
        },
      }).success,
    ).toBe(true);
  });

  it('rejects malformed hex colors', () => {
    expect(
      arOverlayPropsSchema.safeParse({
        staticFallback: { label: 'X', backgroundColor: 'navy' },
      }).success,
    ).toBe(false);
    expect(
      arOverlayPropsSchema.safeParse({
        staticFallback: { label: 'X', foregroundColor: '#FFF' },
      }).success,
    ).toBe(false);
  });
});

describe('arOverlayPropsSchema — live-mount surface (reserved, NOT exercised in v1)', () => {
  it('accepts setupRef with module string', () => {
    expect(
      arOverlayPropsSchema.safeParse({
        ...MIN_PROPS,
        setupRef: { module: '@stageflip/runtimes-interactive/clips/three-scene#ThreeSceneClip' },
      }).success,
    ).toBe(true);
  });

  it('accepts permissions sealed enum', () => {
    expect(
      arOverlayPropsSchema.safeParse({
        ...MIN_PROPS,
        permissions: ['camera-tracking', 'live-data'],
      }).success,
    ).toBe(true);
  });

  it('rejects unknown permission strings', () => {
    expect(
      arOverlayPropsSchema.safeParse({
        ...MIN_PROPS,
        permissions: ['mystery'],
      }).success,
    ).toBe(false);
  });

  it("accepts displayTier 'broadcast' | 'mobile'; rejects others", () => {
    for (const tier of ['broadcast', 'mobile'] as const) {
      expect(arOverlayPropsSchema.safeParse({ ...MIN_PROPS, displayTier: tier }).success).toBe(
        true,
      );
    }
    expect(arOverlayPropsSchema.safeParse({ ...MIN_PROPS, displayTier: 'tablet' }).success).toBe(
      false,
    );
  });
});

describe('arOverlayPropsSchema — strict mode', () => {
  it('rejects extra unknown field at the top level', () => {
    expect(arOverlayPropsSchema.safeParse({ ...MIN_PROPS, mystery: true }).success).toBe(false);
  });

  it('rejects extra unknown field inside staticFallback', () => {
    expect(
      arOverlayPropsSchema.safeParse({
        staticFallback: { label: 'X', mystery: true },
      }).success,
    ).toBe(false);
  });
});

// ─── render dispatch ─────────────────────────────────────────────────────

describe('<ArOverlay> render — static-fallback v1', () => {
  it('renders the wrapper with default neutral broadcast-dark backdrop', () => {
    const { container } = renderAt(0, MIN_PROPS);
    const root = container.querySelector('[data-testid="ar-overlay"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.backgroundColor.toLowerCase()).toMatch(/(rgb\(26, 26, 26\)|#1a1a1a)/);
  });

  it('renders the centered card + label per D-T375a-5', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.getByTestId('ar-overlay-card')).toBeDefined();
    expect(screen.getByTestId('ar-overlay-label').textContent).toBe('AR FORMATION OVERLAY');
  });

  it('renders sublabel when provided', () => {
    renderAt(0, {
      staticFallback: { label: 'VAR — CHECKING', sublabel: 'Loading review' },
    });
    expect(screen.getByTestId('ar-overlay-sublabel').textContent).toBe('Loading review');
  });

  it('does NOT render sublabel when omitted', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.queryByTestId('ar-overlay-sublabel')).toBeNull();
  });

  it('renders the live-mount indicator badge by default', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.getByTestId('ar-overlay-live-mount-indicator')).toBeDefined();
  });

  it('does NOT render the live-mount indicator badge when showLiveMountIndicator: false', () => {
    renderAt(0, {
      staticFallback: { label: 'X', showLiveMountIndicator: false },
    });
    expect(screen.queryByTestId('ar-overlay-live-mount-indicator')).toBeNull();
  });

  it('applies caller-supplied backgroundColor / foregroundColor', () => {
    const { container } = renderAt(0, {
      staticFallback: {
        label: 'X',
        backgroundColor: '#0A1128',
        foregroundColor: '#FFFFFF',
      },
    });
    const root = container.querySelector('[data-testid="ar-overlay"]') as HTMLElement;
    expect(root.style.backgroundColor.toLowerCase()).toMatch(/(rgb\(10, 17, 40\)|#0a1128)/);
    const label = screen.getByTestId('ar-overlay-label') as HTMLElement;
    expect(label.style.color.toLowerCase()).toMatch(/(rgb\(255, 255, 255\)|#ffffff|white)/);
  });

  it('applies accent border when accentColor is supplied', () => {
    const { container } = renderAt(0, {
      staticFallback: { label: 'X', accentColor: '#38003C' },
    });
    const root = container.querySelector('[data-testid="ar-overlay"]') as HTMLElement;
    // Border should reference the accent hex
    expect(root.style.border.toLowerCase()).toContain('#38003c');
  });

  it('does NOT exercise setupRef in v1 — static-fallback always wins', () => {
    // Even when setupRef is supplied, the v1 dispatch renders the static
    // fallback. PR2 (T-375) verifies this via parity-fixture; here we
    // verify the wired-up shape.
    renderAt(0, {
      ...MIN_PROPS,
      setupRef: { module: '@stageflip/runtimes-interactive/clips/three-scene#ThreeSceneClip' },
      permissions: ['camera-tracking'],
    });
    expect(screen.getByTestId('ar-overlay-card')).toBeDefined();
    expect(screen.queryByTestId('ar-overlay-live-mount')).toBeNull();
  });
});

// ─── frame-determinism ───────────────────────────────────────────────────

describe('<ArOverlay> frame-determinism (D-T375a-6)', () => {
  it('produces byte-identical inner HTML across two renders at the same frame', () => {
    const props: ArOverlayProps = {
      staticFallback: {
        label: 'AR FORMATION OVERLAY',
        sublabel: '4-3-3 LINEUP',
        backgroundColor: '#0A1128',
        foregroundColor: '#FFFFFF',
        accentColor: '#38003C',
      },
    };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });

  it('static-fallback v1 — output identical across frames 0 / 60 / 120', () => {
    const props: ArOverlayProps = {
      staticFallback: { label: 'VAR — CHECKING', sublabel: 'Loading review' },
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

describe('arOverlayClip definition (T-375a)', () => {
  it("registers under kind 'arOverlay' with the expected theme slots", () => {
    expect(arOverlayClip.kind).toBe('arOverlay');
    expect(arOverlayClip.propsSchema).toBe(arOverlayPropsSchema);
    expect(arOverlayClip.themeSlots).toEqual({
      backgroundColor: { kind: 'palette', role: 'background' },
      foregroundColor: { kind: 'palette', role: 'foreground' },
      accentColor: { kind: 'palette', role: 'accent' },
    });
  });

  it('declares no fontRequirements (preset-driven per D-T375a-8)', () => {
    expect(arOverlayClip.fontRequirements).toBeUndefined();
  });

  it('does NOT declare mixBlendMode in v1 (opaque static-fallback render)', () => {
    expect(arOverlayClip.mixBlendMode).toBeUndefined();
  });

  it('ALL_BRIDGE_CLIPS includes arOverlayClip and is length 63 (62 → 63)', () => {
    expect(ALL_BRIDGE_CLIPS).toHaveLength(64);
    expect(ALL_BRIDGE_CLIPS).toContain(arOverlayClip);
  });
});
