// packages/runtimes/frame-runtime-bridge/src/clips/video-background.test.tsx
// T-131e.1 — videoBackgroundClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  VideoBackground,
  type VideoBackgroundProps,
  videoBackgroundClip,
  videoBackgroundPropsSchema,
} from './video-background.js';

afterEach(cleanup);

function renderAt(frame: number, props: VideoBackgroundProps, durationInFrames = 120) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <VideoBackground {...props} />
    </FrameProvider>,
  );
}

describe('VideoBackground component (T-131e.1)', () => {
  it('renders a <video> element with the given videoUrl', () => {
    const { container } = renderAt(0, { videoUrl: 'https://example.test/bg.mp4' });
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://example.test/bg.mp4');
  });

  it('omits the <video> when videoUrl is empty (hasVideo=false, placeholder shown)', () => {
    const { container } = renderAt(0, { videoUrl: '' });
    expect(container.querySelector('video')).toBeNull();
  });

  it('muted + objectFit:cover are applied (preserved from reference)', () => {
    const { container } = renderAt(0, { videoUrl: '/a.mp4' });
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.style.objectFit).toBe('cover');
  });

  it('title fades in between frames 10 and 35', () => {
    renderAt(10, { videoUrl: '/a.mp4', title: 'Hello' });
    const t0 = screen.getByTestId('video-background-title') as HTMLElement;
    expect(Number(t0.style.opacity)).toBe(0);
    cleanup();
    renderAt(35, { videoUrl: '/a.mp4', title: 'Hello' });
    const t1 = screen.getByTestId('video-background-title') as HTMLElement;
    expect(Number(t1.style.opacity)).toBe(1);
  });

  it('subtitle fades in after the title (25 → 50)', () => {
    renderAt(25, { videoUrl: '/a.mp4', subtitle: 'World' });
    const s0 = screen.getByTestId('video-background-subtitle') as HTMLElement;
    expect(Number(s0.style.opacity)).toBe(0);
    cleanup();
    renderAt(50, { videoUrl: '/a.mp4', subtitle: 'World' });
    const s1 = screen.getByTestId('video-background-subtitle') as HTMLElement;
    expect(Number(s1.style.opacity)).toBe(1);
  });

  it('does not render the title when title prop is absent', () => {
    renderAt(60, { videoUrl: '/a.mp4' });
    expect(screen.queryByTestId('video-background-title')).toBeNull();
  });

  it('does not render the subtitle when subtitle prop is absent', () => {
    renderAt(60, { videoUrl: '/a.mp4' });
    expect(screen.queryByTestId('video-background-subtitle')).toBeNull();
  });
});

describe('videoBackgroundClip definition (T-131e.1)', () => {
  it("registers under kind 'video-background' with a propsSchema", () => {
    expect(videoBackgroundClip.kind).toBe('video-background');
    expect(videoBackgroundClip.propsSchema).toBe(videoBackgroundPropsSchema);
  });

  it('declares themeSlots binding titleColor → foreground, subtitleColor → secondary, background → background', () => {
    expect(videoBackgroundClip.themeSlots).toEqual({
      titleColor: { kind: 'palette', role: 'foreground' },
      subtitleColor: { kind: 'palette', role: 'secondary' },
      background: { kind: 'palette', role: 'background' },
    });
  });

  it('font requirements are conditional on which text props are supplied', () => {
    const noText = videoBackgroundClip.fontRequirements?.({ videoUrl: '' }) ?? [];
    expect(noText).toEqual([]);

    const titleOnly = videoBackgroundClip.fontRequirements?.({ videoUrl: '', title: 'Hi' }) ?? [];
    expect(titleOnly).toEqual([{ family: 'Plus Jakarta Sans', weight: 800 }]);

    const both =
      videoBackgroundClip.fontRequirements?.({ videoUrl: '', title: 'Hi', subtitle: 'Yo' }) ?? [];
    expect(both).toContainEqual({ family: 'Plus Jakarta Sans', weight: 400 });
    expect(both).toContainEqual({ family: 'Plus Jakarta Sans', weight: 800 });
  });

  it('propsSchema accepts an empty-string videoUrl (hasVideo=false placeholder path)', () => {
    expect(videoBackgroundPropsSchema.safeParse({ videoUrl: '' }).success).toBe(true);
    expect(videoBackgroundPropsSchema.safeParse({ videoUrl: 'https://x.test/a.mp4' }).success).toBe(
      true,
    );
  });

  it('propsSchema rejects unknown props (strict mode)', () => {
    expect(videoBackgroundPropsSchema.safeParse({ videoUrl: '/a.mp4', bogus: true }).success).toBe(
      false,
    );
  });

  it('integrates with resolveClipDefaultsForTheme — palette swap re-flows title + subtitle colors', () => {
    const theme: Theme = {
      palette: { foreground: '#ebf1fa', secondary: '#a5acb4' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      videoBackgroundClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<VideoBackgroundProps>
      >[0],
      theme,
      { videoUrl: '/a.mp4' } as VideoBackgroundProps,
    );
    expect(out.titleColor).toBe('#ebf1fa');
    expect(out.subtitleColor).toBe('#a5acb4');
  });
});
