// packages/runtimes/frame-runtime-bridge/src/clips/magic-wall-panel.tsx
// T-355a — `magic-wall-panel` runtime-clip primitive: a fullscreen
// layered hierarchical-data panel of N (1..56) labeled, color-shaded
// region tiles arranged at absolute-positioned bounds (x / y / width /
// height per region). Each tile carries a `label` and an optional
// `value` (rendered via `valueFormat: 'percent' | 'count' | 'raw'`)
// or `valueLabel` override (e.g., 'CALLED'). Per-region `color`
// override with theme-`foreground` fallback. Optional top-of-panel
// `title` + `subtitle`. Three entrance modes (`stagger-rise` default
// / `fade` / `none`); per-region delay derived from frame, fps, and
// `staggerMs`. Generic primitive used by Cluster A/B/C/E presets
// (election results, broadcast big-boards, sports playoff brackets,
// weather radar drilldown, scientific heatmaps). Cluster-specific
// region geometry + palettes live in `parity-cli` resolver shims, not
// in this primitive.

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const hex = () => z.string().regex(HEX_COLOR_RE);

const boundsSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict();

const magicWallPanelRegionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.number().optional(),
    valueLabel: z.string().optional(),
    color: hex().optional(),
    bounds: boundsSchema,
  })
  .strict();

export const magicWallPanelPropsSchema = z
  .object({
    regions: z.array(magicWallPanelRegionSchema).min(1).max(56),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    valueFormat: z.enum(['percent', 'count', 'raw']).optional(),
    panelPadding: z.number().nonnegative().optional(),
    regionGap: z.number().nonnegative().optional(),
    entrance: z.enum(['none', 'fade', 'stagger-rise']).optional(),
    staggerMs: z.number().nonnegative().optional(),
    background: hex().optional(),
    foreground: hex().optional(),
  })
  .strict();

export type MagicWallPanelProps = z.infer<typeof magicWallPanelPropsSchema>;
type MagicWallPanelRegion = MagicWallPanelProps['regions'][number];
type ValueFormat = NonNullable<MagicWallPanelProps['valueFormat']>;
type EntranceMode = NonNullable<MagicWallPanelProps['entrance']>;

const DEFAULT_VALUE_FORMAT: ValueFormat = 'percent';
const DEFAULT_PANEL_PADDING = 40;
const DEFAULT_REGION_GAP = 4;
const DEFAULT_ENTRANCE: EntranceMode = 'stagger-rise';
const DEFAULT_STAGGER_MS = 60;
const DEFAULT_BACKGROUND = '#0E0E12';
const DEFAULT_FOREGROUND = '#FFFFFF';
const ENTRANCE_FRAMES = 12;
const RISE_DISTANCE_PX = 12;
const TITLE_HEIGHT = 64;
const SUBTITLE_HEIGHT = 32;
const FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

interface FormattedValue {
  text: string;
  numeric: boolean;
}

function formatRegionValue(
  region: MagicWallPanelRegion,
  valueFormat: ValueFormat,
): FormattedValue | null {
  if (region.valueLabel !== undefined) {
    return { text: region.valueLabel, numeric: false };
  }
  if (region.value === undefined) return null;
  switch (valueFormat) {
    case 'percent':
      return { text: `${region.value.toFixed(1)}%`, numeric: true };
    case 'count':
      return { text: region.value.toLocaleString('en-US'), numeric: true };
    case 'raw':
      return { text: String(region.value), numeric: true };
  }
}

interface EntranceFrameOutput {
  opacity: number;
  translateY: number;
}

function entranceForRegion(
  index: number,
  frame: number,
  fps: number,
  entrance: EntranceMode,
  staggerMs: number,
): EntranceFrameOutput {
  if (entrance === 'none') {
    return { opacity: 1, translateY: 0 };
  }
  const delay = (index * staggerMs) / (1000 / fps);
  const opacity = interpolate(frame, [delay, delay + ENTRANCE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY =
    entrance === 'stagger-rise'
      ? interpolate(frame, [delay, delay + ENTRANCE_FRAMES], [RISE_DISTANCE_PX, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;
  return { opacity, translateY };
}

/**
 * Renders a fullscreen layered hierarchical-data panel of N
 * absolute-positioned region tiles. Each region tile is a `<div>` at
 * `region.bounds.{x, y, width, height}` filled with `region.color`
 * (theme `foreground` fallback). Numeric value cells (`'percent'` /
 * `'count'` formats, OR `'raw'` when value is a number) carry
 * `font-variant-numeric: tabular-nums` for column-edge alignment.
 * Frame-derived per-region entrance: `delay = i * staggerMs /
 * (1000 / fps)` opens a 12-frame window where opacity ramps `0 → 1`
 * and (in `stagger-rise` mode) `translateY` slides `12 → 0` px. No
 * `Date.now()`, no `Math.random()`, no `setTimeout` / `setInterval`,
 * no `fetch`. Pure frame-derived render.
 */
export function MagicWallPanel({
  regions,
  title,
  subtitle,
  valueFormat = DEFAULT_VALUE_FORMAT,
  panelPadding = DEFAULT_PANEL_PADDING,
  regionGap: _regionGap = DEFAULT_REGION_GAP,
  entrance = DEFAULT_ENTRANCE,
  staggerMs = DEFAULT_STAGGER_MS,
  background = DEFAULT_BACKGROUND,
  foreground = DEFAULT_FOREGROUND,
}: MagicWallPanelProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    backgroundColor: background,
    color: foreground,
    fontFamily: FONT_FAMILY,
    padding: panelPadding,
    overflow: 'hidden',
  };

  return (
    <div data-testid="magic-wall-panel-clip" style={containerStyle}>
      {title !== undefined ? (
        <div
          data-testid="magic-wall-panel-title"
          style={{
            width: '100%',
            height: TITLE_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(TITLE_HEIGHT * 0.5),
            fontWeight: 700,
            color: foreground,
            textAlign: 'center',
          }}
        >
          {title}
        </div>
      ) : null}
      {subtitle !== undefined ? (
        <div
          data-testid="magic-wall-panel-subtitle"
          style={{
            width: '100%',
            height: SUBTITLE_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(SUBTITLE_HEIGHT * 0.55),
            fontWeight: 500,
            color: foreground,
            opacity: 0.7,
            textAlign: 'center',
          }}
        >
          {subtitle}
        </div>
      ) : null}
      <div
        data-testid="magic-wall-panel-regions"
        style={{ position: 'relative', width: '100%', height: '100%' }}
      >
        {regions.map((region, i) => {
          const { opacity, translateY } = entranceForRegion(i, frame, fps, entrance, staggerMs);
          const tileFill = region.color ?? foreground;
          const formatted = formatRegionValue(region, valueFormat);
          const tileStyle: CSSProperties = {
            position: 'absolute',
            left: region.bounds.x,
            top: region.bounds.y,
            width: region.bounds.width,
            height: region.bounds.height,
            backgroundColor: tileFill,
            color: foreground,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            padding: '4px 6px',
            opacity,
            transform: `translateY(${translateY}px)`,
            overflow: 'hidden',
          };
          const labelFontSize = Math.max(
            12,
            Math.round(Math.min(region.bounds.width, region.bounds.height) * 0.28),
          );
          const valueFontSize = Math.max(
            10,
            Math.round(Math.min(region.bounds.width, region.bounds.height) * 0.22),
          );
          const valueStyle: CSSProperties = {
            fontSize: valueFontSize,
            fontWeight: 500,
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          };
          if (formatted?.numeric === true) {
            valueStyle.fontVariantNumeric = 'tabular-nums';
          }
          return (
            <div
              key={region.id}
              data-testid={`magic-wall-panel-region-${region.id}`}
              style={tileStyle}
            >
              <div
                data-testid={`magic-wall-panel-region-label-${region.id}`}
                style={{
                  fontSize: labelFontSize,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {region.label}
              </div>
              {formatted !== null ? (
                <div data-testid={`magic-wall-panel-region-value-${region.id}`} style={valueStyle}>
                  {formatted.text}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// D-T355a-6: theme-slot fallback. `MagicWallPanel`'s only theme-bound
// props are `background` (panel backdrop) and `foreground` (panel text
// + region-tile fill fallback when `region.color` is absent). Per-
// region color literals + cluster palettes live in the preset's
// `parity-cli` resolver shim, not here.
export const magicWallPanelClip: ClipDefinition<unknown> = defineFrameClip<MagicWallPanelProps>({
  kind: 'magic-wall-panel',
  component: MagicWallPanel,
  propsSchema: magicWallPanelPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
  },
});
