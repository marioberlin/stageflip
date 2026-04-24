// apps/stageflip-video/src/app/editor-app-client.tsx
// Walking-skeleton entrypoint for StageFlip.Video. Mounts <EditorShell>
// with a seeded video document (one visual + one audio + one caption
// track) and renders a minimal track-list view so the app has something
// to show while T-187b/c wire the real canvas + multi-track timeline
// panel.
//
// Component-level styling lives inline for now; the T-123-family canvas
// + properties panel lands in follow-up PRs.

'use client';

import { EditorShell, t, useDocument } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import type { ReactElement } from 'react';

// Seeded document — a 30-second 16:9 video at 30 fps with one element
// per track kind so the walking skeleton exercises every lane the
// multi-track timeline (T-181) will eventually render.
const INITIAL_DOCUMENT = {
  meta: {
    id: 'walking-skeleton-video',
    version: 0,
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
    title: 'Walking skeleton — StageFlip.Video',
    locale: 'en',
    schemaVersion: 1,
  },
  theme: { tokens: {} },
  variables: {},
  components: {},
  content: {
    mode: 'video',
    aspectRatio: '16:9',
    durationMs: 30000,
    frameRate: 30,
    tracks: [
      {
        id: 'track-visual-1',
        kind: 'visual',
        name: 'Visual',
        muted: false,
        elements: [],
      },
      {
        id: 'track-audio-1',
        kind: 'audio',
        name: 'Audio',
        muted: false,
        elements: [],
      },
      {
        id: 'track-caption-1',
        kind: 'caption',
        name: 'Captions',
        muted: false,
        elements: [],
      },
    ],
  },
} as unknown as Document;

function ShellBody(): ReactElement {
  const { document } = useDocument();
  if (document === null) {
    return (
      <main data-testid="app-video-root" style={{ padding: 24, color: 'var(--sf-muted)' }}>
        Loading…
      </main>
    );
  }
  const content = document.content;
  const isVideo = content.mode === 'video';
  return (
    <main
      data-testid="app-video-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        padding: 24,
        gap: 16,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          {document.meta.title ?? 'StageFlip.Video'}
        </h1>
        <span
          data-testid="app-video-mode-badge"
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: 'var(--sf-surface)',
            color: 'var(--sf-accent)',
            fontSize: 12,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          mode: {content.mode}
        </span>
      </header>
      {isVideo ? (
        <section data-testid="app-video-track-list" style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 14, color: 'var(--sf-muted)' }}>
            {content.tracks.length} track{content.tracks.length === 1 ? '' : 's'} ·{' '}
            {(content.durationMs / 1000).toFixed(1)}s · {content.frameRate}fps · aspect{' '}
            {typeof content.aspectRatio === 'string' ? content.aspectRatio : 'custom'}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {content.tracks.map((track) => (
              <li
                key={track.id}
                data-testid={`app-video-track-row-${track.id}`}
                data-track-kind={track.kind}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  background: 'var(--sf-surface)',
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--sf-muted)',
                    width: 64,
                  }}
                >
                  {track.kind}
                </span>
                <span style={{ fontWeight: 500 }}>{track.name ?? track.id}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--sf-muted)' }}>
                  {track.elements.length} element{track.elements.length === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div data-testid="app-video-unhydrated" style={{ color: 'var(--sf-muted)' }}>
          {t('video.empty-mode') /* falls back to key; i18n catalog not yet extended */}
        </div>
      )}
    </main>
  );
}

export function EditorAppClient(): ReactElement {
  return (
    <EditorShell initialDocument={INITIAL_DOCUMENT}>
      <ShellBody />
    </EditorShell>
  );
}
