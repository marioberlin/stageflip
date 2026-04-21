// packages/cdp-host-bundle/src/composition.tsx
// React composition renderer for the browser-side host. Walks the
// RIRDocument and renders each element:
//
//   - shape → absolutely-positioned div with background + optional
//     ellipse radius.
//   - text → absolutely-positioned div with the text content +
//     individual font properties.
//   - clip → dispatches through `findClip(kind)` and mounts the
//     runtime's React element inside a positioned wrapper. Elements
//     whose runtime is not registered (T-100d ships only CSS) fall
//     back to a labelled placeholder.
//   - video / image → placeholder box. Pre-extracted frames arrive
//     in T-100e via the asset-preflight pipeline.
//
// Visibility: elements outside `[startFrame, endFrame)` or with
// `visible: false` render as `display: none`. Same semantic as
// `richPlaceholderHostHtml` from T-100c.
//
// Frame state: the whole composition mounts inside a `FrameProvider`
// so runtime-rendered clips can call `useCurrentFrame()` + friends.

import { FrameProvider } from '@stageflip/frame-runtime';
import type { RIRDocument, RIRElement } from '@stageflip/rir';
import { findClip } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export interface CompositionProps {
  readonly document: RIRDocument;
  readonly frame: number;
}

/**
 * Top-level React component. Consumers wrap this in `<FrameProvider>`
 * externally OR let the boot code do it via `<BootedComposition>`.
 */
export function Composition({ document, frame }: CompositionProps): ReactElement {
  // NOTE: this div is the React tree root rendered INTO the host
  // HTML's `<div id="__sf_root">` mount point via `createRoot`.
  // It must NOT carry `id="__sf_root"` itself or the live page
  // ends up with two elements sharing that ID — `getElementById`
  // would return the outer wrapper and consumers reading
  // `data-sf-frame` would see nothing.
  const rootStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: `${document.width}px`,
    height: `${document.height}px`,
    background: '#ffffff',
  };
  return (
    <div data-sf-composition="" style={rootStyle} data-sf-frame={frame}>
      {document.elements.map((el) => (
        <ElementNode key={el.id} element={el} frame={frame} document={document} />
      ))}
    </div>
  );
}

/**
 * Convenience: renders `<Composition>` inside a `<FrameProvider>` so
 * clip runtimes can call `useCurrentFrame()`.
 */
export function BootedComposition({ document, frame }: CompositionProps): ReactNode {
  return (
    <FrameProvider
      frame={frame}
      config={{
        width: document.width,
        height: document.height,
        fps: document.frameRate,
        durationInFrames: document.durationFrames,
      }}
    >
      <Composition document={document} frame={frame} />
    </FrameProvider>
  );
}

interface ElementNodeProps {
  readonly element: RIRElement;
  readonly frame: number;
  readonly document: RIRDocument;
}

function ElementNode({ element, frame, document }: ElementNodeProps): ReactElement {
  const inWindow = frame >= element.timing.startFrame && frame < element.timing.endFrame;
  const editorialVisible = element.visible !== false;
  const display = inWindow && editorialVisible ? undefined : ('none' as const);
  const t = element.transform;
  const baseStyle: CSSProperties = {
    position: 'absolute',
    boxSizing: 'border-box',
    left: `${t.x}px`,
    top: `${t.y}px`,
    width: `${t.width}px`,
    height: `${t.height}px`,
    opacity: t.opacity,
    zIndex: element.zIndex,
    ...(t.rotation ? { transform: `rotate(${t.rotation}deg)` } : {}),
    ...(display ? { display } : {}),
  };

  if (element.type === 'shape' && element.content.type === 'shape') {
    const content = element.content;
    const shapeStyle: CSSProperties = {
      ...baseStyle,
      ...(content.fill ? { background: content.fill } : {}),
      ...(content.shape === 'ellipse' ? { borderRadius: '50%' } : {}),
    };
    return <div data-sf-el={element.id} data-sf-type="shape" style={shapeStyle} />;
  }

  if (element.type === 'text' && element.content.type === 'text') {
    const content = element.content;
    const textStyle: CSSProperties = {
      ...baseStyle,
      fontFamily: content.fontFamily,
      fontSize: `${content.fontSize}px`,
      fontWeight: content.fontWeight,
      color: content.color,
      textAlign: content.align,
      lineHeight: content.lineHeight,
    };
    return (
      <div data-sf-el={element.id} data-sf-type="text" style={textStyle}>
        {content.text}
      </div>
    );
  }

  if (element.type === 'clip' && element.content.type === 'clip') {
    const clipContent = element.content;
    return (
      <div data-sf-el={element.id} data-sf-type="clip" style={baseStyle}>
        <ClipSlot
          element={element}
          kind={clipContent.clipName}
          runtimeId={clipContent.runtime}
          params={clipContent.params}
          frame={frame}
          document={document}
        />
      </div>
    );
  }

  // video / image / unknown — placeholder.
  return (
    <div
      data-sf-el={element.id}
      data-sf-type={element.type}
      style={baseStyle}
      className="__sf_placeholder"
    >
      {element.type.toUpperCase()} {element.id}
    </div>
  );
}

interface ClipSlotProps {
  readonly element: RIRElement;
  readonly kind: string;
  readonly runtimeId: string;
  readonly params: Record<string, unknown>;
  readonly frame: number;
  readonly document: RIRDocument;
}

function ClipSlot({ element, kind, runtimeId, params, frame, document }: ClipSlotProps): ReactNode {
  const resolved = findClip(kind);
  if (!resolved || resolved.runtime.id !== runtimeId) {
    return (
      <div className="__sf_placeholder" style={{ width: '100%', height: '100%' }}>
        CLIP {element.id} ({runtimeId}:{kind})
      </div>
    );
  }
  return resolved.clip.render({
    frame,
    fps: document.frameRate,
    width: document.width,
    height: document.height,
    clipFrom: element.timing.startFrame,
    clipDurationInFrames: element.timing.durationFrames,
    props: params,
  });
}
