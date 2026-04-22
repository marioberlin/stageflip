// packages/runtimes/frame-runtime-bridge/src/clips/scene-3d.tsx
// T-131d port of reference/slidemotion/.../clips/scene-3d.tsx.
// CSS-3D transform simulation — no three.js / WebGL despite the name.
// Renders a rotating cube / sphere / torus / pyramid using `transform:
// rotateX/rotateY` + `transformStyle: preserve-3d`.

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

export const scene3dPropsSchema = z
  .object({
    shape: z.enum(['cube', 'sphere', 'torus', 'pyramid']).optional(),
    color: z.string().optional(),
    background: z.string().optional(),
    titleColor: z.string().optional(),
    title: z.string().optional(),
    rotationSpeed: z.number().optional(),
    size: z.number().positive().optional(),
  })
  .strict();

export type Scene3DProps = z.infer<typeof scene3dPropsSchema>;

const DEFAULT_SIZE = 200;

export function Scene3D({
  shape = 'cube',
  color = '#0072e5',
  background = '#080f15',
  titleColor = '#ebf1fa',
  title,
  rotationSpeed = 45,
  size = DEFAULT_SIZE,
}: Scene3DProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const rotY = (frame / fps) * rotationSpeed;
  const rotX = (frame / fps) * rotationSpeed * 0.3 + 15;

  let body: ReactNode;
  switch (shape) {
    case 'pyramid':
      body = renderPyramid(size, color, rotX, rotY);
      break;
    case 'sphere':
      body = renderSphere(size, color, frame);
      break;
    case 'torus':
      body = renderTorus(size, color, rotX, rotY);
      break;
    default:
      body = renderCube(size, color, rotX, rotY);
      break;
  }

  return (
    <div
      data-testid="scene-3d-clip"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeIn,
        perspective: 1200,
      }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          data-testid="scene-3d-title"
          style={{
            position: 'absolute',
            top: 60,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 32,
            fontWeight: 700,
            color: titleColor,
          }}
        >
          {title}
        </div>
      )}
      {body}
      <div
        // Floor reflection — alpha-suffixed colour preserved from reference.
        style={{
          position: 'absolute',
          bottom: '20%',
          width: size * 2,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
          filter: 'blur(4px)',
        }}
      />
    </div>
  );
}

function renderCube(size: number, color: string, rotX: number, rotY: number): ReactElement {
  const half = size / 2;
  const faceStyle = (transform: string, opacity: number): CSSProperties => ({
    position: 'absolute',
    width: size,
    height: size,
    border: `2px solid ${color}`,
    backgroundColor: `${color}${Math.round(opacity * 255)
      .toString(16)
      .padStart(2, '0')}`,
    transform,
    backfaceVisibility: 'visible',
  });
  return (
    <div
      data-testid="scene-3d-cube"
      style={{
        width: size,
        height: size,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
      }}
    >
      <div style={faceStyle(`translateZ(${half}px)`, 0.15)} />
      <div style={faceStyle(`rotateY(180deg) translateZ(${half}px)`, 0.1)} />
      <div style={faceStyle(`rotateY(90deg) translateZ(${half}px)`, 0.12)} />
      <div style={faceStyle(`rotateY(-90deg) translateZ(${half}px)`, 0.12)} />
      <div style={faceStyle(`rotateX(90deg) translateZ(${half}px)`, 0.08)} />
      <div style={faceStyle(`rotateX(-90deg) translateZ(${half}px)`, 0.18)} />
    </div>
  );
}

function renderPyramid(size: number, color: string, rotX: number, rotY: number): ReactElement {
  return (
    <div
      data-testid="scene-3d-pyramid"
      style={{
        width: size,
        height: size,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
      }}
    >
      {[0, 90, 180, 270].map((rot, i) => {
        // Pad to two hex digits — same convention as the cube's faceStyle
        // helper. The current per-face range stays in [20..35] decimal so
        // every value is two-char anyway, but the explicit pad guards
        // future tweaks to the alpha-ramp formula.
        const alphaHex = (20 + i * 5).toString(16).padStart(2, '0');
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional pyramid face — slot i is the same face across renders.
            key={i}
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              borderLeft: `${size / 2}px solid transparent`,
              borderRight: `${size / 2}px solid transparent`,
              borderBottom: `${size}px solid ${color}${alphaHex}`,
              transform: `rotateY(${rot}deg) translateZ(${size / 4}px) rotateX(30deg)`,
              transformOrigin: 'bottom center',
            }}
          />
        );
      })}
    </div>
  );
}

function renderSphere(size: number, color: string, frame: number): ReactElement {
  // Tiny pulse over time for visual life — purely a function of frame.
  const pulse = 1 + Math.sin(frame * 0.1) * 0.05;
  return (
    <div
      data-testid="scene-3d-sphere"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${color}60, ${color}20 60%, ${color}05)`,
        border: `2px solid ${color}40`,
        transform: `scale(${pulse})`,
        boxShadow: `0 0 60px ${color}20, inset 0 0 40px ${color}10`,
      }}
    />
  );
}

function renderTorus(size: number, color: string, rotX: number, rotY: number): ReactElement {
  const ringCount = 12;
  return (
    <div
      data-testid="scene-3d-torus"
      style={{
        width: size * 1.5,
        height: size,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
      }}
    >
      {Array.from({ length: ringCount }, (_, i) => {
        const angle = (i / ringCount) * 360;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional torus ring — slot i is the same ring across renders.
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: '50%',
              border: `3px solid ${color}`,
              backgroundColor: `${color}10`,
              transform: `rotateY(${angle}deg) translateX(${size * 0.5}px) translateZ(0)`,
              transformOrigin: '0 0',
            }}
          />
        );
      })}
    </div>
  );
}

export const scene3dClip: ClipDefinition<unknown> = defineFrameClip<Scene3DProps>({
  kind: 'scene-3d',
  component: Scene3D,
  propsSchema: scene3dPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'primary' },
    background: { kind: 'palette', role: 'background' },
    titleColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 700 }],
});
