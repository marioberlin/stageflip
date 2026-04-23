// packages/frame-runtime/src/media-host.test.tsx
// Unit tests for <FrameVideo> / <FrameAudio> / <FrameImage>. The sync
// semantics come from useMediaSync (exhaustively covered in its own
// test file); these tests verify the element shape, prop passthrough,
// and the window-gated mount behaviour unique to FrameImage.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FrameProvider, type VideoConfig } from './frame-context.js';
import { FrameAudio, FrameImage, FrameVideo } from './media-host.js';

afterEach(cleanup);

const CONFIG: VideoConfig = {
  width: 1920,
  height: 1080,
  fps: 60,
  durationInFrames: 600,
};

function wrap(node: React.ReactNode, frame = 0): HTMLElement {
  const { container } = render(
    <FrameProvider frame={frame} config={CONFIG}>
      {node}
    </FrameProvider>,
  );
  return container;
}

describe('FrameVideo', () => {
  it('renders a <video> element with the given src', () => {
    const container = wrap(<FrameVideo src="https://example.test/clip.mp4" muted />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://example.test/clip.mp4');
  });

  it('passes through native video attributes (muted, loop, preload, className)', () => {
    const container = wrap(
      <FrameVideo src="/a.mp4" muted loop preload="auto" className="bg-video" data-testid="bg" />,
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.preload).toBe('auto');
    expect(video.className).toBe('bg-video');
    expect(video.getAttribute('data-testid')).toBe('bg');
  });

  it('does not bleed offsetMs / durationMs onto the DOM', () => {
    const container = wrap(<FrameVideo src="/a.mp4" offsetMs={500} durationMs={2000} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.hasAttribute('offsetMs')).toBe(false);
    expect(video.hasAttribute('durationMs')).toBe(false);
    expect(video.hasAttribute('offsetms')).toBe(false);
    expect(video.hasAttribute('durationms')).toBe(false);
  });

  it('mounts the <video> element regardless of the active window (sync hook handles pause)', () => {
    // Outside window: currentMs=0, offsetMs=1000 → useMediaSync pauses the
    // element but the DOM node remains mounted so the ref stays stable.
    const container = wrap(<FrameVideo src="/a.mp4" offsetMs={1000} durationMs={500} />);
    expect(container.querySelector('video')).not.toBeNull();
  });

  it('keeps the <video> mounted when durationMs=0 (sync hook holds it paused)', () => {
    // Zero-length window means useMediaSync never matches `inWindow`; the
    // element must still mount so the ref is stable for consumers.
    const container = wrap(<FrameVideo src="/a.mp4" offsetMs={0} durationMs={0} />);
    expect(container.querySelector('video')).not.toBeNull();
  });
});

describe('FrameAudio', () => {
  it('renders an <audio> element with the given src', () => {
    const container = wrap(<FrameAudio src="/voice.mp3" />);
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe('/voice.mp3');
  });

  it('passes through native audio attributes', () => {
    const container = wrap(
      <FrameAudio src="/voice.mp3" loop preload="metadata" data-role="narration" />,
    );
    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio.loop).toBe(true);
    expect(audio.preload).toBe('metadata');
    expect(audio.getAttribute('data-role')).toBe('narration');
  });

  it('does not bleed offsetMs / durationMs onto the DOM', () => {
    const container = wrap(<FrameAudio src="/voice.mp3" offsetMs={1000} durationMs={3000} />);
    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio.hasAttribute('offsetMs')).toBe(false);
    expect(audio.hasAttribute('durationMs')).toBe(false);
    expect(audio.hasAttribute('offsetms')).toBe(false);
    expect(audio.hasAttribute('durationms')).toBe(false);
  });

  it('keeps the <audio> mounted when durationMs=0 (sync hook holds it paused)', () => {
    const container = wrap(<FrameAudio src="/voice.mp3" offsetMs={0} durationMs={0} />);
    expect(container.querySelector('audio')).not.toBeNull();
  });
});

describe('FrameImage — window gating', () => {
  it('renders an <img> inside the active window', () => {
    // frame=0, no offset/duration → full-composition window → inside.
    const container = wrap(<FrameImage src="/a.gif" alt="anim" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/a.gif');
    expect(img?.getAttribute('alt')).toBe('anim');
  });

  it('returns null before the window (frame.currentMs < offsetMs)', () => {
    // frame=0 → currentMs=0; offsetMs=1000 → before window.
    const container = wrap(<FrameImage src="/a.gif" alt="anim" offsetMs={1000} />, 0);
    expect(container.querySelector('img')).toBeNull();
  });

  it('returns null after the window (frame.currentMs >= offsetMs + durationMs)', () => {
    // frame=120 at fps=60 → currentMs=2000; window [0, 1000) → after window.
    const container = wrap(
      <FrameImage src="/a.gif" alt="anim" offsetMs={0} durationMs={1000} />,
      120,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('includes the frame at offsetMs (inclusive start)', () => {
    // frame=60 at fps=60 → currentMs=1000 === offsetMs → inside.
    const container = wrap(<FrameImage src="/a.gif" alt="anim" offsetMs={1000} />, 60);
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('excludes the frame at offsetMs + durationMs (exclusive end)', () => {
    // frame=60 at fps=60 → currentMs=1000; window [0, 1000) → outside.
    const container = wrap(
      <FrameImage src="/a.gif" alt="anim" offsetMs={0} durationMs={1000} />,
      60,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('passes through className + style + data attributes when inside window', () => {
    const container = wrap(
      <FrameImage
        src="/a.gif"
        alt="anim"
        className="cover"
        style={{ objectFit: 'cover' }}
        data-testid="gif"
      />,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.className).toBe('cover');
    expect(img.style.objectFit).toBe('cover');
    expect(img.getAttribute('data-testid')).toBe('gif');
  });

  it('does not bleed offsetMs / durationMs onto the DOM', () => {
    const container = wrap(<FrameImage src="/a.gif" alt="anim" offsetMs={0} durationMs={5000} />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.hasAttribute('offsetMs')).toBe(false);
    expect(img.hasAttribute('durationMs')).toBe(false);
    expect(img.hasAttribute('offsetms')).toBe(false);
    expect(img.hasAttribute('durationms')).toBe(false);
  });

  it('treats durationMs=0 as a zero-length (never-active) window', () => {
    const container = wrap(<FrameImage src="/a.gif" alt="anim" offsetMs={0} durationMs={0} />, 0);
    expect(container.querySelector('img')).toBeNull();
  });
});
