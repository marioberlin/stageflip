// packages/runtimes/frame-runtime-bridge/src/clips/ar-overlay.tsx
// T-375a — `arOverlay` runtime-clip primitive: shared Cluster H AR-overlay
// register. First-of-six PR opening Cluster H; the 4 Cluster H presets
// (T-375 sky-sports-ar-formations / T-376 hawkeye-var-3d-skeletal /
// T-377 olympic-swim-lane-track / T-378 nba-ar-replay) bind to
// `clipKind: arOverlay` via their preset frontmatter.
//
// Single-style v1 (no `discriminatedUnion` — the 4 presets share one
// prop surface; per-sport canon is supplied as caller-side staticFallback
// content + (when live) an author-defined ThreeSceneClip setupRef).
// Mirrors T-347g weatherStar4000Panel / T-347h imrStaticFallback single-
// object-schema precedent.
//
// **v1 ships static-fallback rendering ONLY** (D-T375a-2). The live-
// mount API surface (`setupRef`, `permissions`) is DECLARED on the
// schema for forward compatibility — preset bindings can already author
// these — but the v1 dispatch ignores `setupRef` at render time and
// always renders the static-fallback poster. Live-mount via
// ThreeSceneClip is GATED on Track A finale (T-397+ not yet merged);
// downstream task T-375a-live-mount wires the integration once T-397+
// lands. Same posture as T-347h imrStaticFallback's stub-canon-explicit
// static-fallback allowance for ThreeSceneClip deferral.
//
// **No canonical palettes baked at the primitive level** (D-T375a-3).
// Unlike T-347a weatherMap (NEXRAD / Mark-Allen / Meriam) or T-347h
// imrStaticFallback (storm-grays / danger-reds), AR overlays composite
// OVER existing video / sport context; per-sport color canon (Sky Sports
// navy + PL purple, Hawk-Eye green offside lines, Olympic gold/red WR-
// line flash, NBA orange) lives in the per-preset binding, not in this
// primitive.
//
// **Frame-deterministic** (D-T375a-6) — no `Date.now` / `Math.random` /
// `crypto.*` / `setTimeout` / `setInterval` / `fetch` /
// `requestAnimationFrame` / `addEventListener`. Static-fallback render
// is a pure function of `(props)` — same input → byte-identical inner
// HTML across renders + across frames.
//
// **Theme slots**: `backgroundColor` → `palette.background`,
// `foregroundColor` → `palette.foreground`, `accentColor` →
// `palette.accent` (top-level surface; nested `staticFallback.*` colors
// are resolved by caller before binding).
//
// **mixBlendMode posture**: NOT declared in v1 — the static-fallback
// renders an OPAQUE card on an opaque backdrop. When live-mount lands
// (post-T-397), this posture may need revisiting (transparent
// compositing over background video).
//
// v1 carve-outs (deferred):
//   - T-375a-live-mount: wire ThreeSceneClip mount path; primitive's
//     render dispatches to live-mount factory when setupRef supplied
//     AND tenant frontier posture enabled.
//   - T-375a-camera-tracking: surface + thread `cameraTrack` input
//     (Zero Density / Stype / Omega Vionardo / SMT ISO Track 2.0).
//   - T-375a-display-tier-adapt: auto-reduce complexity when
//     `displayTier === 'mobile'`.
//   - T-375a-poster-image: image-asset poster surface (data: URL or
//     absolute URL); v1 ships structured 2D placeholder only.

import { useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

// ─── schema ──────────────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const hex = () => z.string().regex(HEX_COLOR_RE);

const positionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive().min(1).max(1920),
    height: z.number().positive().min(1).max(1080),
  })
  .strict();

const fontSchema = z
  .object({
    family: z.string().min(1),
    weight: z.number().int().min(100).max(900).optional(),
    size: z.number().int().positive().optional(),
  })
  .strict();

/**
 * Static-fallback content surface — the 2D placeholder rendered when
 * live-mount is not exercised. v1 ships structured 2D placeholder ONLY
 * (image-asset poster deferred to T-375a-poster-image).
 */
const staticFallbackSchema = z
  .object({
    label: z.string().min(1).max(80),
    sublabel: z.string().max(120).optional(),
    backgroundColor: hex().optional(),
    foregroundColor: hex().optional(),
    accentColor: hex().optional(),
    showLiveMountIndicator: z.boolean().optional(),
  })
  .strict();

/**
 * Live-mount surface — DECLARED for forward compatibility but NOT
 * exercised in v1. Reserved schema slot per D-T375a-2; the v1 dispatch
 * always renders the static-fallback path even when `setupRef` is
 * supplied. Live-mount integration lands in T-375a-live-mount after
 * Track A finale (T-397+).
 */
const setupRefSchema = z
  .object({
    module: z.string().min(1),
    symbol: z.string().min(1).optional(),
  })
  .strict();

const permissionEnum = z.enum(['camera-tracking', 'live-data', 'network', 'audio']);

export const arOverlayPropsSchema = z
  .object({
    staticFallback: staticFallbackSchema,
    setupRef: setupRefSchema.optional(),
    permissions: z.array(permissionEnum).optional(),
    displayTier: z.enum(['broadcast', 'mobile']).optional(),
    position: positionSchema.optional(),
    font: fontSchema.optional(),
    backgroundColor: hex().optional(),
    foregroundColor: hex().optional(),
    accentColor: hex().optional(),
  })
  .strict();

export type ArOverlayProps = z.infer<typeof arOverlayPropsSchema>;
export type ArOverlayStaticFallback = z.infer<typeof staticFallbackSchema>;
export type ArOverlayPermission = z.infer<typeof permissionEnum>;
export type ArOverlayDisplayTier = NonNullable<ArOverlayProps['displayTier']>;
export type ArOverlaySetupRef = z.infer<typeof setupRefSchema>;

// ─── constants ───────────────────────────────────────────────────────────

const SYSTEM_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DEFAULT_FONT_FAMILY = `'Inter', ${SYSTEM_FONT_STACK}`;
const MONO_FONT_STACK = "'SF Mono', Menlo, Consolas, monospace";

/** Default neutral broadcast-dark backdrop per D-T375a-5. NOT a canonical
 * palette — just a sensible default; preset bindings override via
 * `staticFallback.backgroundColor` or theme slots. */
const DEFAULT_BACKGROUND = '#1A1A1A';
const DEFAULT_FOREGROUND = '#FFFFFF';

// ─── component ───────────────────────────────────────────────────────────

/**
 * Renders the AR-overlay static-fallback register: a centered card
 * announcing the AR overlay context (label + optional sublabel) on a
 * neutral broadcast-dark backdrop, with optional accent border + a
 * subtle "AR · STATIC FALLBACK" badge signalling the live-mount path
 * is gated. Per D-T375a-2: v1 static-only; live-mount via
 * ThreeSceneClip deferred to T-375a-live-mount (post-T-397). Frame-
 * deterministic per D-T375a-6 (pure function of props; no useEffect).
 */
export function ArOverlay(props: ArOverlayProps): ReactElement {
  const { width: canvasW, height: canvasH } = useVideoConfig();
  const region = props.position ?? { x: 0, y: 0, width: canvasW, height: canvasH };

  const fontFamily = props.font?.family ?? DEFAULT_FONT_FAMILY;
  // Nested-staticFallback colors take precedence over top-level theme-
  // slot fallbacks per the D-T375a-7 posture (caller resolves theme
  // slots into the top-level surface, then primitive merges into nested
  // staticFallback for render).
  const background =
    props.staticFallback.backgroundColor ?? props.backgroundColor ?? DEFAULT_BACKGROUND;
  const foreground =
    props.staticFallback.foregroundColor ?? props.foregroundColor ?? DEFAULT_FOREGROUND;
  const accent = props.staticFallback.accentColor ?? props.accentColor;

  const showLiveMountIndicator = props.staticFallback.showLiveMountIndicator !== false;

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: region.x,
    top: region.y,
    width: region.width,
    height: region.height,
    backgroundColor: background,
    color: foreground,
    fontFamily,
    overflow: 'hidden',
    pointerEvents: 'none',
    border: accent !== undefined ? `1px solid ${accent}` : 'none',
    boxSizing: 'border-box',
  };

  // Centered card (60% × 40% of region).
  const cardWidth = Math.round(region.width * 0.6);
  const cardHeight = Math.round(region.height * 0.4);
  const cardLeft = Math.round((region.width - cardWidth) / 2);
  const cardTop = Math.round((region.height - cardHeight) / 2);
  const cardStyle: CSSProperties = {
    position: 'absolute',
    left: cardLeft,
    top: cardTop,
    width: cardWidth,
    height: cardHeight,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '24px 32px',
    pointerEvents: 'none',
  };

  const labelStyle: CSSProperties = {
    fontSize: 48,
    fontWeight: 800,
    letterSpacing: 1,
    color: foreground,
    textTransform: 'uppercase',
    textAlign: 'center',
    margin: 0,
  };

  const sublabelStyle: CSSProperties = {
    fontSize: 22,
    fontWeight: 400,
    marginTop: 12,
    color: foreground,
    opacity: 0.7,
    textAlign: 'center',
  };

  // Bottom-right "AR · STATIC FALLBACK" badge — signals to the operator
  // that the live-mount path is gated.
  const badgeStyle: CSSProperties = {
    position: 'absolute',
    right: 16,
    bottom: 12,
    fontSize: 14,
    fontFamily: MONO_FONT_STACK,
    color: foreground,
    opacity: 0.5,
    letterSpacing: 0.5,
    pointerEvents: 'none',
  };

  return (
    <div data-testid="ar-overlay" style={containerStyle}>
      <div data-testid="ar-overlay-card" style={cardStyle}>
        <div data-testid="ar-overlay-label" style={labelStyle}>
          {props.staticFallback.label}
        </div>
        {props.staticFallback.sublabel !== undefined ? (
          <div data-testid="ar-overlay-sublabel" style={sublabelStyle}>
            {props.staticFallback.sublabel}
          </div>
        ) : null}
      </div>
      {showLiveMountIndicator ? (
        <div data-testid="ar-overlay-live-mount-indicator" style={badgeStyle}>
          AR · STATIC FALLBACK
        </div>
      ) : null}
    </div>
  );
}

/**
 * `arOverlayClip` — registered as `kind: 'arOverlay'`. Theme slots:
 * `backgroundColor` → `palette.background`, `foregroundColor` →
 * `palette.foreground`, `accentColor` → `palette.accent`. Per D-T375a-3,
 * canonical palettes are NOT baked at the primitive level — per-sport
 * color canon lives in the per-preset binding. Per D-T375a-8,
 * `fontRequirements` is omitted (preset-driven).
 */
export const arOverlayClip: ClipDefinition<unknown> = defineFrameClip<ArOverlayProps>({
  kind: 'arOverlay',
  component: ArOverlay,
  propsSchema: arOverlayPropsSchema,
  themeSlots: {
    backgroundColor: { kind: 'palette', role: 'background' },
    foregroundColor: { kind: 'palette', role: 'foreground' },
    accentColor: { kind: 'palette', role: 'accent' },
  },
});
