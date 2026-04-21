// apps/dev-harness/src/harness.tsx
// Scrub UI: composition picker + frame slider + rendered preview. The
// interactive surface through which a human verifies the frame-runtime
// primitives during Phase 2 development.

import { useMemo, useState } from 'react';

import { getComposition, renderFrame } from '@stageflip/frame-runtime';

import { DEMO_IDS, type DemoId } from './compositions.js';

export function Harness(): React.ReactElement {
  const [compId, setCompId] = useState<DemoId>(DEMO_IDS[0]);
  const [frame, setFrame] = useState<number>(0);

  const def = useMemo(() => {
    const d = getComposition(compId);
    if (d === undefined) {
      throw new Error(`Harness: composition '${compId}' not registered`);
    }
    return d;
  }, [compId]);

  const element = useMemo(() => renderFrame(compId, frame), [compId, frame]);

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>frame-runtime dev harness</h1>
        <select
          value={compId}
          onChange={(e) => {
            setCompId(e.target.value as DemoId);
            setFrame(0);
          }}
          style={selectStyle}
        >
          {DEMO_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </header>

      <section style={previewWrapStyle}>
        <div
          style={{
            width: def.width,
            height: def.height,
            background: '#111',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          {element}
        </div>
      </section>

      <footer style={footerStyle}>
        <span style={labelStyle}>frame</span>
        <input
          type="range"
          min={0}
          max={def.durationInFrames - 1}
          value={frame}
          onChange={(e) => setFrame(Number(e.target.value))}
          style={sliderStyle}
        />
        <span style={valueStyle}>
          {frame} / {def.durationInFrames - 1}
        </span>
        <span style={metaStyle}>
          {def.fps} fps · {def.width}×{def.height}
        </span>
      </footer>
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  height: '100vh',
  gap: 16,
  padding: 24,
  boxSizing: 'border-box',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  opacity: 0.85,
};

const selectStyle: React.CSSProperties = {
  background: '#14181e',
  color: '#e7eaee',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: '6px 10px',
  fontFamily: 'inherit',
  fontSize: 14,
};

const previewWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'auto',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '12px 16px',
  borderRadius: 8,
  background: '#14181e',
};

const labelStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontSize: 12,
  opacity: 0.6,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const sliderStyle: React.CSSProperties = {
  flex: 1,
  accentColor: '#00d4ff',
};

const valueStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontSize: 14,
  minWidth: 80,
  textAlign: 'right',
};

const metaStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.5,
};
