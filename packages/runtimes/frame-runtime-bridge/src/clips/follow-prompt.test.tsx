// packages/runtimes/frame-runtime-bridge/src/clips/follow-prompt.test.tsx
// T-318 — FollowPrompt clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `lyrics.test.tsx` /
// `score-bug.test.tsx` / `subscribe-button.test.tsx`): the barrel pulls
// in every clip module before this test's direct `./follow-prompt.js`
// import is dereferenced, so `ALL_BRIDGE_CLIPS` is fully populated when
// read.
import {
  ALL_BRIDGE_CLIPS,
  FollowPrompt,
  type FollowPromptProps,
  followPromptClip,
  followPromptPropsSchema,
} from './index.js';

afterEach(cleanup);

const TIKTOK_MIN: FollowPromptProps = {
  platform: 'tiktok',
  position: { x: 1015, y: 1500 },
};

const INSTAGRAM_MIN: FollowPromptProps = {
  platform: 'instagram',
  position: { x: 1015, y: 1500 },
};

const YOUTUBE_MIN: FollowPromptProps = {
  platform: 'youtube',
  position: { x: 1015, y: 1500 },
};

const GENERIC_MIN: FollowPromptProps = {
  platform: 'generic',
  position: { x: 1015, y: 1500 },
};

function renderAt(frame: number, props: FollowPromptProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1080, height: 1920, fps: 30, durationInFrames }}>
      <FollowPrompt {...props} />
    </FrameProvider>,
  );
}

describe('followPromptPropsSchema — minimal inputs', () => {
  it('accepts minimal valid TikTok input', () => {
    expect(followPromptPropsSchema.safeParse(TIKTOK_MIN).success).toBe(true);
  });

  it('accepts minimal valid input for all four platforms', () => {
    expect(followPromptPropsSchema.safeParse(TIKTOK_MIN).success).toBe(true);
    expect(followPromptPropsSchema.safeParse(INSTAGRAM_MIN).success).toBe(true);
    expect(followPromptPropsSchema.safeParse(YOUTUBE_MIN).success).toBe(true);
    expect(followPromptPropsSchema.safeParse(GENERIC_MIN).success).toBe(true);
  });

  it('accepts Instagram with showRing + gradient overrides', () => {
    expect(
      followPromptPropsSchema.safeParse({
        ...INSTAGRAM_MIN,
        showRing: true,
        gradient: { start: '#000000', mid: '#777777', end: '#FFFFFF' },
      }).success,
    ).toBe(true);
  });

  it('rejects showRing on non-instagram platform branches (strict mode)', () => {
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, showRing: true }).success).toBe(
      false,
    );
    expect(followPromptPropsSchema.safeParse({ ...YOUTUBE_MIN, showRing: true }).success).toBe(
      false,
    );
    expect(followPromptPropsSchema.safeParse({ ...GENERIC_MIN, showRing: true }).success).toBe(
      false,
    );
  });
});

describe('followPromptPropsSchema — required-field rejections', () => {
  it('rejects unknown platform (sealed enum)', () => {
    expect(
      followPromptPropsSchema.safeParse({
        platform: 'twitter',
        position: { x: 100, y: 100 },
      }).success,
    ).toBe(false);
  });

  it('rejects missing position', () => {
    expect(followPromptPropsSchema.safeParse({ platform: 'tiktok' }).success).toBe(false);
  });

  it('rejects missing platform', () => {
    expect(followPromptPropsSchema.safeParse({ position: { x: 100, y: 100 } }).success).toBe(false);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(
      followPromptPropsSchema.safeParse({
        ...TIKTOK_MIN,
        mystery: true,
      }).success,
    ).toBe(false);
  });

  it('rejects out-of-range pulseRepeat', () => {
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, pulseRepeat: 0 }).success).toBe(
      false,
    );
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, pulseRepeat: 11 }).success).toBe(
      false,
    );
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, pulseRepeat: 1 }).success).toBe(true);
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, pulseRepeat: 10 }).success).toBe(
      true,
    );
  });

  it('rejects malformed avatarText (max 2 chars; min 1 char)', () => {
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, avatarText: 'ABC' }).success).toBe(
      false,
    );
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, avatarText: '' }).success).toBe(
      false,
    );
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, avatarText: 'JD' }).success).toBe(
      true,
    );
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, avatarText: 'X' }).success).toBe(
      true,
    );
  });

  it('accepts all phase values; rejects unknown phase', () => {
    for (const phase of ['idle', 'pulsing', 'followed'] as const) {
      expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, phase }).success).toBe(true);
    }
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, phase: 'mystery' }).success).toBe(
      false,
    );
    // Bad hex rejected
    expect(followPromptPropsSchema.safeParse({ ...TIKTOK_MIN, badgeColor: 'red' }).success).toBe(
      false,
    );
  });
});

describe('<FollowPrompt> tiktok', () => {
  it('phase "idle" renders white avatar circle + pink "+" badge', () => {
    renderAt(0, TIKTOK_MIN);
    const root = screen.getByTestId('follow-prompt-tiktok');
    expect(root.style.borderRadius).toBe('50%');
    const badge = screen.getByTestId('follow-prompt-tiktok-badge');
    expect(badge.style.backgroundColor.toLowerCase()).toMatch(/^(#fe2c55|rgb\(254, 44, 85\))$/);
    expect(badge.textContent).toContain('+');
    // No animation in idle (scale 1)
    expect(root.style.transform).toMatch(/scale\(1\)/);
  });

  it('phase "pulsing" produces scale-pulse 1.00 → 1.05 → 1.00 over a 1500ms cycle', () => {
    // frame=0 (cycle start) → ~1.00
    const { container: c0 } = renderAt(0, { ...TIKTOK_MIN, phase: 'pulsing' });
    const r0 = c0.querySelector('[data-testid="follow-prompt-tiktok"]') as HTMLElement;
    expect(r0.style.transform).toMatch(/scale\(1\)/);
    cleanup();
    // frame=ceil(30 * 0.5)=15 (peak) → ~1.05
    const { container: cPeak } = renderAt(15, { ...TIKTOK_MIN, phase: 'pulsing' });
    const rPeak = cPeak.querySelector('[data-testid="follow-prompt-tiktok"]') as HTMLElement;
    const matchPeak = rPeak.style.transform.match(/scale\(([0-9.]+)\)/);
    expect(matchPeak).not.toBeNull();
    if (matchPeak?.[1] !== undefined) {
      expect(Number.parseFloat(matchPeak[1])).toBeCloseTo(1.05, 2);
    }
    cleanup();
    // frame=ceil(30 * 1.5)=45 (settled after one cycle) → ~1.00
    const { container: cSettle } = renderAt(45, { ...TIKTOK_MIN, phase: 'pulsing' });
    const rSettle = cSettle.querySelector('[data-testid="follow-prompt-tiktok"]') as HTMLElement;
    expect(rSettle.style.transform).toMatch(/scale\(1\)/);
    cleanup();
    // showPulseRing default true — ring DOM present in 'pulsing'
    renderAt(15, { ...TIKTOK_MIN, phase: 'pulsing' });
    expect(screen.getByTestId('follow-prompt-pulse-ring')).toBeTruthy();
    cleanup();
    // showPulseRing: false → no ring
    renderAt(15, { ...TIKTOK_MIN, phase: 'pulsing', showPulseRing: false });
    expect(screen.queryByTestId('follow-prompt-pulse-ring')).toBeNull();
  });

  it('phase "pulsing" with pulseRepeat: 3 runs three cycles then settles', () => {
    // After 3 cycles (45 * 3 = 135 frames) — well past durationInFrames; clamp to 1
    const { container: cAfter } = renderAt(
      136,
      { ...TIKTOK_MIN, phase: 'pulsing', pulseRepeat: 3 },
      300,
    );
    const rAfter = cAfter.querySelector('[data-testid="follow-prompt-tiktok"]') as HTMLElement;
    expect(rAfter.style.transform).toMatch(/scale\(1\)/);
    cleanup();
    // Inside the third cycle (frame=15 + 45*2=105 → peak of cycle 3) → ~1.05
    const { container: cMid } = renderAt(
      105,
      { ...TIKTOK_MIN, phase: 'pulsing', pulseRepeat: 3 },
      300,
    );
    const rMid = cMid.querySelector('[data-testid="follow-prompt-tiktok"]') as HTMLElement;
    const matchMid = rMid.style.transform.match(/scale\(([0-9.]+)\)/);
    expect(matchMid).not.toBeNull();
    if (matchMid?.[1] !== undefined) {
      expect(Number.parseFloat(matchMid[1])).toBeCloseTo(1.05, 2);
    }
  });

  it('phase "followed" renders checkmark glyph + scale-pop on the badge', () => {
    // frame=0 (start of pop) — checkmark glyph present, badge scale ~1.00
    renderAt(0, { ...TIKTOK_MIN, phase: 'followed' });
    const badge = screen.getByTestId('follow-prompt-tiktok-badge');
    expect(badge.textContent).toContain('\u{2713}');
    expect(badge.textContent).not.toContain('+');
    const start = badge.style.transform.match(/scale\(([0-9.]+)\)/);
    expect(start).not.toBeNull();
    if (start?.[1] !== undefined) {
      expect(Number.parseFloat(start[1])).toBeCloseTo(1.0, 2);
    }
    cleanup();
    // frame=ceil(30 * 0.15)=5 (peak) — badge scale ~1.20
    renderAt(5, { ...TIKTOK_MIN, phase: 'followed' });
    const badgePeak = screen.getByTestId('follow-prompt-tiktok-badge');
    const peak = badgePeak.style.transform.match(/scale\(([0-9.]+)\)/);
    expect(peak).not.toBeNull();
    if (peak?.[1] !== undefined) {
      expect(Number.parseFloat(peak[1])).toBeCloseTo(1.2, 2);
    }
    cleanup();
    // frame=ceil(30 * 0.3)=9 (settled) — badge scale ~1.00; avatar always ~1.00
    renderAt(9, { ...TIKTOK_MIN, phase: 'followed' });
    const root = screen.getByTestId('follow-prompt-tiktok');
    expect(root.style.transform).toMatch(/scale\(1\)/);
    const badgeEnd = screen.getByTestId('follow-prompt-tiktok-badge');
    const end = badgeEnd.style.transform.match(/scale\(([0-9.]+)\)/);
    expect(end).not.toBeNull();
    if (end?.[1] !== undefined) {
      expect(Number.parseFloat(end[1])).toBeCloseTo(1.0, 2);
    }
  });
});

describe('<FollowPrompt> instagram', () => {
  it('phase "idle" renders magenta badge; no story-ring by default', () => {
    renderAt(0, INSTAGRAM_MIN);
    const badge = screen.getByTestId('follow-prompt-instagram-badge');
    expect(badge.style.backgroundColor.toLowerCase()).toMatch(/^(#dd2a7b|rgb\(221, 42, 123\))$/);
    expect(screen.queryByTestId('follow-prompt-instagram-ring')).toBeNull();
  });

  it('showRing: true renders the canonical Instagram gradient ring; gradient prop overrides stops', () => {
    renderAt(0, { ...INSTAGRAM_MIN, showRing: true });
    const ring = screen.getByTestId('follow-prompt-instagram-ring');
    const bg = ring.style.backgroundImage.toLowerCase();
    expect(bg).toContain('linear-gradient');
    expect(bg).toContain('#f58529');
    expect(bg).toContain('#dd2a7b');
    expect(bg).toContain('#8134af');
    cleanup();
    renderAt(0, {
      ...INSTAGRAM_MIN,
      showRing: true,
      gradient: { start: '#000000', mid: '#777777', end: '#FFFFFF' },
    });
    const ring2 = screen.getByTestId('follow-prompt-instagram-ring');
    const bg2 = ring2.style.backgroundImage.toLowerCase();
    expect(bg2).toContain('#000000');
    expect(bg2).toContain('#777777');
    expect(bg2).toContain('#ffffff');
  });
});

describe('<FollowPrompt> youtube', () => {
  it('phase "idle" renders red badge with "+" glyph; no story-ring', () => {
    renderAt(0, YOUTUBE_MIN);
    const badge = screen.getByTestId('follow-prompt-youtube-badge');
    expect(badge.style.backgroundColor.toLowerCase()).toMatch(/^(#ff0000|rgb\(255, 0, 0\))$/);
    expect(badge.textContent).toContain('+');
  });
});

describe('<FollowPrompt> generic', () => {
  it('uses fallback default colors when no explicit overrides are passed', () => {
    renderAt(0, GENERIC_MIN);
    const root = screen.getByTestId('follow-prompt-generic');
    const badge = screen.getByTestId('follow-prompt-generic-badge');
    expect(root.style.backgroundColor).not.toBe('');
    expect(badge.style.backgroundColor).not.toBe('');
  });

  it('explicit avatarColor + badgeColor overrides win', () => {
    renderAt(0, { ...GENERIC_MIN, avatarColor: '#222222', badgeColor: '#00ff00' });
    const root = screen.getByTestId('follow-prompt-generic');
    const badge = screen.getByTestId('follow-prompt-generic-badge');
    expect(root.style.backgroundColor.toLowerCase()).toMatch(/^(#222222|rgb\(34, 34, 34\))$/);
    expect(badge.style.backgroundColor.toLowerCase()).toMatch(/^(#00ff00|rgb\(0, 255, 0\))$/);
  });
});

describe('<FollowPrompt> avatar monogram', () => {
  it('renders avatarText monogram inside the avatar circle in TikTok Sans 700', () => {
    renderAt(0, { ...TIKTOK_MIN, avatarText: 'JD' });
    const text = screen.getByTestId('follow-prompt-tiktok-text');
    expect(text.textContent).toBe('JD');
    expect(text.style.fontFamily.toLowerCase()).toContain('tiktok sans');
    expect(text.style.fontWeight).toBe('700');
  });

  it('honors font override (family + weight)', () => {
    renderAt(0, { ...TIKTOK_MIN, avatarText: 'X', font: { family: 'Inter', weight: 600 } });
    const text = screen.getByTestId('follow-prompt-tiktok-text');
    expect(text.style.fontFamily.toLowerCase()).toContain('inter');
    expect(text.style.fontWeight).toBe('600');
  });

  it('honors avatarTextColor override', () => {
    renderAt(0, { ...TIKTOK_MIN, avatarText: 'JD', avatarTextColor: '#0000ff' });
    const text = screen.getByTestId('follow-prompt-tiktok-text');
    expect(text.style.color.toLowerCase()).toMatch(/^(#0000ff|rgb\(0, 0, 255\))$/);
  });
});

describe('<FollowPrompt> size + position', () => {
  it('honors size override on avatar diameter', () => {
    renderAt(0, { ...TIKTOK_MIN, size: 80 });
    const root = screen.getByTestId('follow-prompt-tiktok');
    expect(root.style.width).toBe('80px');
    expect(root.style.height).toBe('80px');
  });

  it('honors avatarColor override on the avatar surface', () => {
    renderAt(0, { ...TIKTOK_MIN, avatarColor: '#222222' });
    const root = screen.getByTestId('follow-prompt-tiktok');
    expect(root.style.backgroundColor.toLowerCase()).toMatch(/^(#222222|rgb\(34, 34, 34\))$/);
  });

  it('places the root at the absolute position', () => {
    renderAt(0, TIKTOK_MIN);
    const root = screen.getByTestId('follow-prompt-tiktok');
    expect(root.style.left).toBe('1015px');
    expect(root.style.top).toBe('1500px');
  });
});

describe('clip registration', () => {
  it('registers as kind "follow-prompt" and is in ALL_BRIDGE_CLIPS at length 63', () => {
    expect(followPromptClip.kind).toBe('follow-prompt');
    expect(ALL_BRIDGE_CLIPS).toHaveLength(63);
    expect(ALL_BRIDGE_CLIPS).toContain(followPromptClip);
  });

  it('fontRequirements registers TikTok Sans / Roboto / Plus Jakarta Sans', () => {
    const fonts = followPromptClip.fontRequirements?.(TIKTOK_MIN as unknown as never);
    expect(fonts).toEqual([
      { family: 'TikTok Sans', weight: 700 },
      { family: 'Roboto', weight: 500 },
      { family: 'Plus Jakarta Sans', weight: 700 },
    ]);
  });
});

describe('determinism', () => {
  it('renders byte-identical HTML for the same props at the same frame', () => {
    const { container: a } = renderAt(30, { ...TIKTOK_MIN, phase: 'pulsing' });
    const htmlA = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(30, { ...TIKTOK_MIN, phase: 'pulsing' });
    const htmlB = b.innerHTML;
    expect(htmlA).toBe(htmlB);
  });
});
