// apps/stageflip-slide/src/components/canvas/element-view.tsx
// Minimal per-element renderer used by <SlideCanvas> in T-123a.
// Interactions (selection, drag, resize, text editing) arrive with
// T-123b/c; rich per-runtime rendering (clips, animations, video
// playback) arrives with T-123d.

'use client';

import type {
  Element,
  ImageElement,
  ShapeElement,
  TextElement,
  VideoElement,
} from '@stageflip/schema';
import type { CSSProperties, PointerEventHandler, ReactElement } from 'react';

export interface ElementViewProps {
  element: Element;
  /** Fires on any pointer-down on the element's frame. Used by the canvas
   * to drive selection; absence keeps the element fully inert. */
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
}

/**
 * Absolutely-positioned frame for one element. `transform` fields on
 * `ElementBase` lay the box out in canvas-space; `rotation` + `opacity`
 * layer on as CSS transforms. Invisible elements are skipped entirely;
 * locked is ignored here (T-123b wires it to interactions).
 */
export function ElementView({ element, onPointerDown }: ElementViewProps): ReactElement | null {
  if (element.visible === false) return null;
  const style: CSSProperties = {
    position: 'absolute',
    left: element.transform.x,
    top: element.transform.y,
    width: element.transform.width,
    height: element.transform.height,
    transform: `rotate(${element.transform.rotation ?? 0}deg)`,
    transformOrigin: 'center center',
    opacity: element.transform.opacity ?? 1,
  };

  return (
    <div
      data-testid={`element-${element.id}`}
      data-element-id={element.id}
      data-element-type={element.type}
      style={style}
      onPointerDown={onPointerDown}
    >
      {renderContent(element)}
    </div>
  );
}

function renderContent(element: Element): ReactElement {
  switch (element.type) {
    case 'text':
      return <TextContent element={element} />;
    case 'image':
      return <ImageContent element={element} />;
    case 'shape':
      return <ShapeContent element={element} />;
    case 'video':
      return <VideoContent element={element} />;
    case 'group':
      return <GroupContent element={element} />;
    default:
      return <KindPlaceholder label={element.type} />;
  }
}

function TextContent({ element }: { element: TextElement }): ReactElement {
  const style: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    textAlign: element.align,
  };
  if (element.fontFamily) style.fontFamily = element.fontFamily;
  if (element.fontSize) style.fontSize = element.fontSize;
  if (typeof element.color === 'string') style.color = element.color;
  if (element.lineHeight) style.lineHeight = element.lineHeight;
  return <span style={style}>{element.text}</span>;
}

function ImageContent({ element }: { element: ImageElement }): ReactElement {
  // `src` is an asset ref (`asset:<id>`), not a URL. A future asset
  // resolver (T-084a) will map it to a browser-loadable URL. Until
  // then we expose the ref as a data attribute and render an alt-text
  // fallback so the viewport still shows SOMETHING for every element.
  return (
    <div
      data-asset-ref={element.src}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(165, 172, 180, 0.08)',
        color: '#a5acb4',
        fontSize: 12,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
      title={element.alt ?? element.src}
    >
      {element.alt ?? 'image'}
    </div>
  );
}

function ShapeContent({ element }: { element: ShapeElement }): ReactElement {
  const fill = typeof element.fill === 'string' ? element.fill : '#5af8fb';
  const stroke = element.stroke ? toSvgStroke(element.stroke) : undefined;
  const rx = element.cornerRadius ?? 0;
  return (
    <svg
      viewBox={`0 0 ${element.transform.width} ${element.transform.height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      role="img"
      aria-label={element.name ?? `Shape ${element.shape}`}
    >
      <title>{element.name ?? `Shape ${element.shape}`}</title>
      {renderShapeGeometry(element, fill, stroke, rx)}
    </svg>
  );
}

function renderShapeGeometry(
  element: ShapeElement,
  fill: string,
  stroke: ReturnType<typeof toSvgStroke> | undefined,
  rx: number,
): ReactElement {
  const { width, height } = element.transform;
  switch (element.shape) {
    case 'ellipse':
      return (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={fill}
          {...stroke}
        />
      );
    case 'custom-path':
      return <path d={element.path ?? ''} fill={fill} {...stroke} />;
    default:
      return <rect x="0" y="0" width={width} height={height} rx={rx} fill={fill} {...stroke} />;
  }
}

interface SvgStrokeProps {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
}

function toSvgStroke(stroke: NonNullable<ShapeElement['stroke']>): SvgStrokeProps {
  const props: SvgStrokeProps = {};
  if (typeof stroke.color === 'string') props.stroke = stroke.color;
  if (stroke.width > 0) props.strokeWidth = stroke.width;
  if (stroke.dasharray && stroke.dasharray.length > 0) {
    props.strokeDasharray = stroke.dasharray.join(',');
  }
  props.strokeLinecap = stroke.linecap;
  props.strokeLinejoin = stroke.linejoin;
  return props;
}

function VideoContent({ element }: { element: VideoElement }): ReactElement {
  // `src` is an asset ref. Same deferral as image content until T-084a
  // lands the resolver.
  return (
    <div
      data-asset-ref={element.src}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 114, 229, 0.08)',
        color: '#81aeff',
        fontSize: 12,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
      title={element.src}
    >
      video
    </div>
  );
}

function GroupContent({ element }: { element: Element & { type: 'group' } }): ReactElement {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {element.children.map((child) => (
        <ElementView key={child.id} element={child} />
      ))}
    </div>
  );
}

function KindPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(129, 174, 255, 0.08)',
        border: '1px dashed rgba(129, 174, 255, 0.3)',
        color: '#81aeff',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {label}
    </div>
  );
}
