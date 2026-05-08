// packages/runtimes/frame-runtime-bridge/src/clips/imr-static-fallback.tsx
// T-347h — `imrStaticFallback` runtime-clip primitive: TWC IMR
// (Immersive Mixed Reality) static-fallback register. Single-style v1
// (no `discriminatedUnion` — single consumer
// `twc-immersive-mixed-reality`); future variants would extend a
// sealed-style enum then. Mirrors T-347g weatherStar4000Panel /
// qr-code-bounce single-object-schema precedent.
//
// **Static-fallback canon explicit** per preset stub line 41 ("fall
// back to a high-quality pre-composited video if frontier is not
// enabled"). The live `ThreeSceneClip` IMR path (Unreal Engine +
// Zero Density Reality Engine + Mo-Sys StarTracker) is a Track A
// frontier feature deferred to T-347h-three-scene per ADR-005. v1
// captures the static-fallback visual canon (storm-gray backdrop +
// foreground severity HUD with danger-red callouts) without
// attempting live 3D rendering. Same posture as T-353
// severance-surreal-3d's stub-canon-explicit static-fallback
// allowance.
//
// **Canonical palettes** baked as static module-level constants (NOT
// theme-able per cluster SKILL "Color palettes are standard, not
// brand"):
//   - `IMR_STORM_GRAYS`: ['#1A1F26', '#2C3441', '#4A5566'] (deep /
//     mid / light backdrop gradient stops)
//   - `IMR_DANGER_REDS`: ['#CC0000', '#FF3333'] (severity callout
//     primary + glow-edge per stub line 26)
//   - `IMR_DATA_FOREGROUND_WHITE`: '#FFFFFF' (data label foreground
//     per stub line 30)
//
// **Surface**: required `scenario: 'severe' | 'calm'` (v1 ships
// 'severe' canon; 'calm' documented but defers parity sign-off) +
// `severity: { label, location, timestamp? }` + `data[]` (label/value
// rows); optional `particleDensity` (0..1 — deterministic SVG noise
// approximation; v1 NOT physics-driven), `font?` / `background?` /
// `foreground?` / `position?`.
//
// **Frame-deterministic** — no `Date.now` / `Math.random` /
// `crypto.*` / `setTimeout` / `setInterval` / `fetch` /
// `requestAnimationFrame` / `addEventListener`. Particle overlay
// positions seeded by closed-form 32-bit integer hash mixer (mirrors
// the grain primitive's deterministic-noise pattern). Same `(props)`
// → byte-identical output across renders.
//
// **Theme slots**: `background` → `palette.background`, `foreground`
// → `palette.foreground` (palettes themselves NOT theme-bound).
//
// v1 carve-outs (deferred):
//   - T-347h-three-scene: live `ThreeSceneClip` IMR rendering (Track
//     A frontier per ADR-005).
//   - T-347h-camera-sweep: multi-frame cinematic camera sweep
//     animation (12-20 s per stub line 37).
//   - T-347h-physics-particles: physics-driven particle motion from
//     real / simulated weather telemetry (per stub line 36).
//   - T-347h-calm: optional `scenario: 'calm'` parity-register
//     variant.

import { useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

// ─── canonical palettes ──────────────────────────────────────────────────

/**
 * IMR backdrop gradient stops: deep-storm / mid-storm / light-overcast.
 * Approximates the photo-real-3D atmospheric depth without 3D rendering.
 * Per stub line 26 "storm grays". NOT theme-able.
 */
export const IMR_STORM_GRAYS: readonly [string, string, string] = Object.freeze([
  '#1A1F26',
  '#2C3441',
  '#4A5566',
]) as readonly [string, string, string];

/**
 * IMR severity-callout danger reds: primary + glow-edge per stub
 * line 26 "danger reds #CC0000 for severity". NOT theme-able.
 */
export const IMR_DANGER_REDS: readonly [string, string] = Object.freeze([
  '#CC0000',
  '#FF3333',
]) as readonly [string, string];

/**
 * IMR data-label foreground per stub line 30 "Bold, 22-28pt tabular"
 * with `#FFFFFF`.
 */
export const IMR_DATA_FOREGROUND_WHITE = '#FFFFFF';

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

const severitySchema = z
  .object({
    label: z.string().min(1).max(48),
    location: z.string().min(1).max(48),
    timestamp: z.string().max(48).optional(),
  })
  .strict();

const dataRowSchema = z
  .object({
    label: z.string().min(1).max(16),
    value: z.string().min(1).max(24),
  })
  .strict();

const fontSchema = z
  .object({
    family: z.string().min(1),
    weight: z.number().int().min(100).max(900).optional(),
    size: z.number().int().positive().optional(),
  })
  .strict();

const backgroundGradientSchema = z
  .object({
    from: hex(),
    to: hex(),
  })
  .strict();

export const imrStaticFallbackPropsSchema = z
  .object({
    scenario: z.enum(['severe', 'calm']),
    severity: severitySchema,
    data: z.array(dataRowSchema).min(1).max(8),
    particleDensity: z.number().min(0).max(1).optional(),
    font: fontSchema.optional(),
    background: backgroundGradientSchema.optional(),
    foreground: hex().optional(),
    position: positionSchema.optional(),
  })
  .strict();

export type ImrStaticFallbackProps = z.infer<typeof imrStaticFallbackPropsSchema>;
export type ImrSeverity = z.infer<typeof severitySchema>;
export type ImrDataRow = z.infer<typeof dataRowSchema>;
export type ImrScenario = ImrStaticFallbackProps['scenario'];

// ─── constants ───────────────────────────────────────────────────────────

const SYSTEM_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DEFAULT_FONT_FAMILY = `'Inter Tight', ${SYSTEM_FONT_STACK}`;
const PARTICLE_MAX_COUNT = 200;

// ─── pure helpers ────────────────────────────────────────────────────────

/**
 * Closed-form 32-bit integer hash mixer (xxhash32-style; mirrors the
 * grain primitive's deterministic-noise pattern). Pure function — same
 * input → same output. Used to seed per-particle positions in the
 * static-fallback particle overlay.
 */
export function hashSeed(x: number, y: number, seed: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = (Math.imul(h ^ x, 374761393) >>> 0) | 0;
  h = (Math.imul(h ^ y, 668265263) >>> 0) | 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Generate `count` deterministic particle positions for the storm
 * overlay. Pure function of `(count, regionWidth, regionHeight, seed)`.
 * Returns array of `{ x, y, length, opacity }` line segments per
 * D-T347h-5.
 */
export function generateParticles(args: {
  count: number;
  regionWidth: number;
  regionHeight: number;
  seed: number;
}): ReadonlyArray<{ x: number; y: number; length: number; opacity: number }> {
  const out: Array<{ x: number; y: number; length: number; opacity: number }> = [];
  for (let i = 0; i < args.count; i += 1) {
    const h1 = hashSeed(i, 0, args.seed);
    const h2 = hashSeed(i, 1, args.seed);
    const h3 = hashSeed(i, 2, args.seed);
    const h4 = hashSeed(i, 3, args.seed);
    out.push({
      x: (h1 % args.regionWidth) | 0,
      y: (h2 % args.regionHeight) | 0,
      length: 6 + ((h3 % 18) | 0),
      opacity: 0.18 + ((h4 % 100) / 100) * 0.4,
    });
  }
  return out;
}

// ─── component ───────────────────────────────────────────────────────────

/**
 * Renders the TWC IMR static-fallback register: storm-gray backdrop
 * gradient + optional deterministic particle overlay + bottom-third
 * severity HUD card + top-right data-label strip. Per D-T347h-1: v1
 * static-only; live 3D rendering deferred to T-347h-three-scene
 * (ThreeSceneClip per ADR-005). Frame-deterministic per D-T347h-5
 * (closed-form hash-seeded particle positions; no useEffect).
 */
export function ImrStaticFallback(props: ImrStaticFallbackProps): ReactElement {
  const { width: canvasW, height: canvasH } = useVideoConfig();
  const region = props.position ?? { x: 0, y: 0, width: canvasW, height: canvasH };

  const fontFamily = props.font?.family ?? DEFAULT_FONT_FAMILY;
  const foreground = props.foreground ?? IMR_DATA_FOREGROUND_WHITE;

  // Backdrop gradient — 3-stop vertical for the SEVERE register;
  // calmer override is documented in the spec but deferred.
  const bgFrom = props.background?.from ?? IMR_STORM_GRAYS[0];
  const bgVia = IMR_STORM_GRAYS[1];
  const bgTo = props.background?.to ?? IMR_STORM_GRAYS[2];

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: region.x,
    top: region.y,
    width: region.width,
    height: region.height,
    background: `linear-gradient(180deg, ${bgFrom} 0%, ${bgVia} 50%, ${bgTo} 100%)`,
    color: foreground,
    fontFamily,
    overflow: 'hidden',
    pointerEvents: 'none',
  };

  // Particle overlay — deterministic SVG noise seeded by particleDensity.
  const particleCount =
    props.particleDensity !== undefined
      ? Math.round(props.particleDensity * PARTICLE_MAX_COUNT)
      : 0;
  const particles = generateParticles({
    count: particleCount,
    regionWidth: region.width,
    regionHeight: region.height,
    seed: 0,
  });

  // Severity callout — bottom-third HUD card.
  const severityCardHeight = 168;
  const severityCardTop = region.height - severityCardHeight - 32;
  const severityCardStyle: CSSProperties = {
    position: 'absolute',
    left: 32,
    top: severityCardTop,
    width: region.width - 64,
    height: severityCardHeight,
    background: 'rgba(0, 0, 0, 0.45)',
    borderLeft: `8px solid ${IMR_DANGER_REDS[0]}`,
    boxSizing: 'border-box',
    padding: '24px 32px',
    pointerEvents: 'none',
  };

  // Data labels — top-right HUD strip.
  const dataStripStyle: CSSProperties = {
    position: 'absolute',
    right: 32,
    top: 32,
    width: 200,
    background: 'rgba(0, 0, 0, 0.35)',
    padding: '16px 18px',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  };

  return (
    <div data-testid="imr-static-fallback" data-scenario={props.scenario} style={containerStyle}>
      {/* Particle overlay */}
      {particleCount > 0 ? (
        <svg
          data-testid="imr-particles"
          data-particle-count={particleCount}
          width={region.width}
          height={region.height}
          viewBox={`0 0 ${region.width} ${region.height}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
        >
          <title>IMR storm particles</title>
          {particles.map((p, i) => (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: positional particle slot, deterministic seed.
              key={i}
              x1={p.x}
              y1={p.y}
              x2={p.x + 4}
              y2={p.y + p.length}
              stroke="#FFFFFF"
              strokeWidth={1.5}
              opacity={p.opacity}
            />
          ))}
        </svg>
      ) : null}

      {/* Severity HUD card — bottom third */}
      <div data-testid="imr-severity-card" style={severityCardStyle}>
        <div
          data-testid="imr-severity-label"
          style={{
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: 1,
            color: '#FFFFFF',
            // 2px black stroke per stub line 29 — Webkit-only is fine
            // for parity-fixture render (puppeteer/Chrome).
            WebkitTextStroke: '2px #000000',
            textTransform: 'uppercase',
          }}
        >
          {props.severity.label}
        </div>
        <div
          data-testid="imr-severity-location"
          style={{
            fontSize: 32,
            fontWeight: 700,
            marginTop: 8,
            color: '#FFFFFF',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {props.severity.location}
        </div>
        {props.severity.timestamp !== undefined ? (
          <div
            data-testid="imr-severity-timestamp"
            style={{
              fontSize: 22,
              fontWeight: 400,
              marginTop: 4,
              color: '#CCCCCC',
            }}
          >
            {props.severity.timestamp}
          </div>
        ) : null}
      </div>

      {/* Data-label HUD strip — top right */}
      <div data-testid="imr-data-strip" style={dataStripStyle}>
        {props.data.map((row, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional data-row slot.
            key={i}
            data-testid={`imr-data-${i}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontSize: 24,
              padding: '4px 0',
              borderBottom:
                i < props.data.length - 1 ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
            }}
          >
            <span style={{ fontWeight: 400, opacity: 0.8 }}>{row.label}</span>
            <span style={{ fontWeight: 700 }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * `imrStaticFallbackClip` — registered as `kind: 'imrStaticFallback'`.
 * Theme slots: `background` → `palette.background`, `foreground` →
 * `palette.foreground` (palettes themselves NOT theme-bound).
 */
export const imrStaticFallbackClip: ClipDefinition<unknown> =
  defineFrameClip<ImrStaticFallbackProps>({
    kind: 'imrStaticFallback',
    component: ImrStaticFallback,
    propsSchema: imrStaticFallbackPropsSchema,
    themeSlots: {
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
    },
  });
