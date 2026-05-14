// packages/runtimes/frame-runtime-bridge/src/clips/var-banner.test.tsx
// T-320 — VarBanner clip behaviour + propsSchema + themeSlots + registry.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Barrel-first import (mirrors lyrics.test.tsx workaround) so
// ALL_BRIDGE_CLIPS is fully populated when read.
import {
  ALL_BRIDGE_CLIPS,
  VarBanner,
  type VarBannerProps,
  varBannerClip,
  varBannerPropsSchema,
} from './index.js';

afterEach(cleanup);

const MIN_PROPS: VarBannerProps = {
  decision: 'goal-confirmed',
  competition: 'Premier League VAR',
};

function renderAt(frame: number, props: VarBannerProps, durationInFrames = 120) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <VarBanner {...props} />
    </FrameProvider>,
  );
}

describe('varBannerPropsSchema', () => {
  it('accepts minimal valid input (only required fields)', () => {
    expect(varBannerPropsSchema.safeParse(MIN_PROPS).success).toBe(true);
  });

  it('rejects missing decision', () => {
    expect(varBannerPropsSchema.safeParse({ competition: 'Premier League VAR' }).success).toBe(
      false,
    );
  });

  it('rejects missing competition', () => {
    expect(varBannerPropsSchema.safeParse({ decision: 'goal-confirmed' }).success).toBe(false);
  });

  it('rejects unknown decision enum value', () => {
    expect(
      varBannerPropsSchema.safeParse({ decision: 'overturn-other', competition: 'X' }).success,
    ).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(varBannerPropsSchema.safeParse({ ...MIN_PROPS, unknownKey: true }).success).toBe(false);
  });

  it('accepts each of the four decisions', () => {
    for (const decision of [
      'goal-confirmed',
      'goal-disallowed',
      'penalty-awarded',
      'no-foul',
    ] as const) {
      expect(varBannerPropsSchema.safeParse({ ...MIN_PROPS, decision }).success).toBe(true);
    }
  });

  it('accepts the full optional surface', () => {
    expect(
      varBannerPropsSchema.safeParse({
        ...MIN_PROPS,
        pendingDurationFrames: 45,
        accentColor: '#123456',
        backgroundColor: '#000000',
        slideDirection: 'right-to-left',
        insetBottomPx: 0,
      }).success,
    ).toBe(true);
  });

  it('rejects non-positive pendingDurationFrames', () => {
    expect(varBannerPropsSchema.safeParse({ ...MIN_PROPS, pendingDurationFrames: 0 }).success).toBe(
      false,
    );
    expect(
      varBannerPropsSchema.safeParse({ ...MIN_PROPS, pendingDurationFrames: -5 }).success,
    ).toBe(false);
  });

  it('rejects invalid slideDirection enum', () => {
    expect(
      varBannerPropsSchema.safeParse({ ...MIN_PROPS, slideDirection: 'diagonal' }).success,
    ).toBe(false);
  });
});

describe('<VarBanner> pending stage', () => {
  it('renders the pending register at frame 0 (decision label NOT shown)', () => {
    renderAt(0, MIN_PROPS);
    expect(screen.queryByTestId('var-banner-pending')).not.toBeNull();
    expect(screen.queryByTestId('var-banner-decision')).toBeNull();
  });

  it('renders the pending register mid-window (frame 15, default duration 30)', () => {
    renderAt(15, MIN_PROPS);
    expect(screen.queryByTestId('var-banner-pending')).not.toBeNull();
    expect(screen.queryByTestId('var-banner-decision')).toBeNull();
  });

  it('renders the pending register at the last pending frame (29)', () => {
    renderAt(29, MIN_PROPS);
    expect(screen.queryByTestId('var-banner-pending')).not.toBeNull();
    expect(screen.queryByTestId('var-banner-decision')).toBeNull();
  });

  it('renders the dot-loader inside the pending register', () => {
    renderAt(10, MIN_PROPS);
    expect(screen.queryByTestId('var-banner-dots')).not.toBeNull();
  });

  it('hides the accent bar while pending (opacity 0)', () => {
    renderAt(10, MIN_PROPS);
    const bar = screen.getByTestId('var-banner-accent-bar');
    expect(Number(bar.style.opacity)).toBe(0);
  });
});

describe('<VarBanner> decision stage', () => {
  it('switches to the decision register at the boundary (frame 30, default duration)', () => {
    renderAt(30, MIN_PROPS);
    expect(screen.queryByTestId('var-banner-pending')).toBeNull();
    const decision = screen.getByTestId('var-banner-decision');
    expect(decision.textContent).toBe('GOAL CONFIRMED');
  });

  it('renders the decision register fully at frame 60 (post-entrance)', () => {
    renderAt(60, MIN_PROPS);
    const decision = screen.getByTestId('var-banner-decision');
    expect(decision.style.transform).toBe('translateX(0%)');
    expect(Number(decision.style.opacity)).toBe(1);
  });

  it('shifts the boundary when pendingDurationFrames is overridden', () => {
    renderAt(40, { ...MIN_PROPS, pendingDurationFrames: 60 });
    expect(screen.queryByTestId('var-banner-pending')).not.toBeNull();
    expect(screen.queryByTestId('var-banner-decision')).toBeNull();
  });

  it('reverses entrance translate for slideDirection: right-to-left', () => {
    renderAt(30, { ...MIN_PROPS, slideDirection: 'right-to-left' });
    const decision = screen.getByTestId('var-banner-decision');
    expect(decision.style.transform).toBe('translateX(100%)');
  });

  it('left-to-right (default) starts at translateX(-100%) at the boundary', () => {
    renderAt(30, MIN_PROPS);
    const decision = screen.getByTestId('var-banner-decision');
    expect(decision.style.transform).toBe('translateX(-100%)');
  });

  it('renders each decision label canon-bound to its enum value', () => {
    const cases: Array<[VarBannerProps['decision'], string]> = [
      ['goal-confirmed', 'GOAL CONFIRMED'],
      ['goal-disallowed', 'NO GOAL'],
      ['penalty-awarded', 'PENALTY AWARDED'],
      ['no-foul', 'NO FOUL'],
    ];
    for (const [decision, label] of cases) {
      renderAt(60, { ...MIN_PROPS, decision });
      expect(screen.getByTestId('var-banner-decision').textContent).toBe(label);
      cleanup();
    }
  });
});

describe('<VarBanner> accent register', () => {
  it('auto-derives accent colour per decision (goal-confirmed → green)', () => {
    renderAt(60, { ...MIN_PROPS, decision: 'goal-confirmed' });
    const bar = screen.getByTestId('var-banner-accent-bar');
    expect(bar.style.background).toBe('#00a85a');
  });

  it('auto-derives accent colour per decision (goal-disallowed → red)', () => {
    renderAt(60, { ...MIN_PROPS, decision: 'goal-disallowed' });
    expect(screen.getByTestId('var-banner-accent-bar').style.background).toBe('#e53e3e');
  });

  it('auto-derives accent colour per decision (penalty-awarded → amber)', () => {
    renderAt(60, { ...MIN_PROPS, decision: 'penalty-awarded' });
    expect(screen.getByTestId('var-banner-accent-bar').style.background).toBe('#f59e0b');
  });

  it('auto-derives accent colour per decision (no-foul → neutral)', () => {
    renderAt(60, { ...MIN_PROPS, decision: 'no-foul' });
    expect(screen.getByTestId('var-banner-accent-bar').style.background).toBe('#737373');
  });

  it('explicit accentColor wins over auto-derivation', () => {
    renderAt(60, { ...MIN_PROPS, accentColor: '#FFFFFF' });
    expect(screen.getByTestId('var-banner-accent-bar').style.background).toBe('#FFFFFF');
  });
});

describe('<VarBanner> container styling', () => {
  it('applies insetBottomPx to the outer container', () => {
    renderAt(60, { ...MIN_PROPS, insetBottomPx: 200 });
    const el = screen.getByTestId('var-banner-clip');
    expect(el.style.bottom).toBe('200px');
  });

  it('default insetBottomPx is 80', () => {
    renderAt(60, MIN_PROPS);
    expect(screen.getByTestId('var-banner-clip').style.bottom).toBe('80px');
  });
});

describe('<VarBanner> determinism', () => {
  it('renders byte-identical HTML across two calls at the same (frame, props)', () => {
    const r1 = renderAt(60, MIN_PROPS);
    const html1 = r1.container.innerHTML;
    cleanup();
    const r2 = renderAt(60, MIN_PROPS);
    const html2 = r2.container.innerHTML;
    expect(html1).toBe(html2);
  });

  it('compiled source contains no banned non-deterministic APIs', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, 'var-banner.tsx'), 'utf8');
    // Strip comments + string literals before scanning so prose in
    // header / docstrings does not produce false positives.
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');
    expect(stripped).not.toMatch(/\bDate\s*\(/);
    expect(stripped).not.toMatch(/\bDate\.now\b/);
    expect(stripped).not.toMatch(/\bnew Date\b/);
    expect(stripped).not.toMatch(/\bMath\.random\b/);
    expect(stripped).not.toMatch(/\bsetTimeout\b/);
    expect(stripped).not.toMatch(/\bsetInterval\b/);
    expect(stripped).not.toMatch(/\brequestAnimationFrame\b/);
    expect(stripped).not.toMatch(/\bcancelAnimationFrame\b/);
    expect(stripped).not.toMatch(/\bfetch\s*\(/);
    expect(stripped).not.toMatch(/\bXMLHttpRequest\b/);
    expect(stripped).not.toMatch(/\bperformance\.now\b/);
  });
});

describe('varBannerClip definition', () => {
  it('registers under kind "var-banner" with theme slots', () => {
    expect(varBannerClip.kind).toBe('var-banner');
    expect(varBannerClip.propsSchema).toBe(varBannerPropsSchema);
    expect(varBannerClip.themeSlots).toEqual({
      backgroundColor: { kind: 'palette', role: 'background' },
      accentColor: { kind: 'palette', role: 'accent' },
    });
  });

  it('declares Plus Jakarta Sans 800 as a font requirement', () => {
    expect(varBannerClip.fontRequirements?.({} as never)).toEqual([
      { family: 'Plus Jakarta Sans', weight: 800 },
    ]);
  });

  it('is appended to ALL_BRIDGE_CLIPS (length 64, includes var-banner kind)', () => {
    expect(ALL_BRIDGE_CLIPS).toHaveLength(64);
    expect(ALL_BRIDGE_CLIPS.some((c) => c.kind === 'var-banner')).toBe(true);
  });
});
