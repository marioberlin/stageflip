// packages/runtimes/frame-runtime-bridge/src/clips/score-bug.test.tsx
// T-332a — ScoreBug clip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `lyrics.test.tsx`): the barrel
// pulls in every clip module before this test's direct `./score-bug.js`
// import is dereferenced, so `ALL_BRIDGE_CLIPS` is fully populated when read.
import {
  ALL_BRIDGE_CLIPS,
  ScoreBug,
  type ScoreBugProps,
  scoreBugClip,
  scoreBugPropsSchema,
} from './index.js';

afterEach(cleanup);

const FOOTBALL_MIN: ScoreBugProps = {
  style: 'football',
  position: { x: 100, y: 900 },
  home: { code: 'KC', color: '#E31837', score: '24' },
  away: { code: 'PHI', color: '#004C54', score: '21' },
  clock: '02:34',
  period: 'Q4',
};

const RACING_MIN: ScoreBugProps = {
  style: 'racing',
  position: { x: 0, y: 100 },
  rows: [{ position: 1, code: 'VER' }],
};

const CRICKET_MIN: ScoreBugProps = {
  style: 'cricket',
  position: { x: 200, y: 60 },
  battingTeam: { code: 'IND', color: '#0066B3', runs: 247, wickets: 4, overs: '42.3' },
};

const TENNIS_MIN: ScoreBugProps = {
  style: 'tennis',
  position: { x: 60, y: 950 },
  players: [
    { surname: 'Djokovic', countryCode: 'SRB', sets: ['6'] },
    { surname: 'Alcaraz', countryCode: 'ESP', sets: ['4'] },
  ],
};

function renderAt(frame: number, props: ScoreBugProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <ScoreBug {...props} />
    </FrameProvider>,
  );
}

describe('scoreBugPropsSchema — minimal inputs', () => {
  it('accepts minimal football input', () => {
    expect(scoreBugPropsSchema.safeParse(FOOTBALL_MIN).success).toBe(true);
  });

  it('accepts minimal racing input', () => {
    expect(scoreBugPropsSchema.safeParse(RACING_MIN).success).toBe(true);
  });

  it('accepts minimal cricket input', () => {
    expect(scoreBugPropsSchema.safeParse(CRICKET_MIN).success).toBe(true);
  });

  it('accepts minimal tennis input', () => {
    expect(scoreBugPropsSchema.safeParse(TENNIS_MIN).success).toBe(true);
  });
});

describe('scoreBugPropsSchema — required-field rejections', () => {
  it('rejects football missing home / away / clock / period', () => {
    const { home: _h, ...noHome } = FOOTBALL_MIN as Extract<ScoreBugProps, { style: 'football' }>;
    expect(scoreBugPropsSchema.safeParse(noHome).success).toBe(false);
    const { away: _a, ...noAway } = FOOTBALL_MIN as Extract<ScoreBugProps, { style: 'football' }>;
    expect(scoreBugPropsSchema.safeParse(noAway).success).toBe(false);
    const { clock: _c, ...noClock } = FOOTBALL_MIN as Extract<ScoreBugProps, { style: 'football' }>;
    expect(scoreBugPropsSchema.safeParse(noClock).success).toBe(false);
    const { period: _p, ...noPeriod } = FOOTBALL_MIN as Extract<
      ScoreBugProps,
      { style: 'football' }
    >;
    expect(scoreBugPropsSchema.safeParse(noPeriod).success).toBe(false);
  });

  it('rejects racing rows: [] and rows.length > 24', () => {
    expect(scoreBugPropsSchema.safeParse({ ...RACING_MIN, rows: [] as unknown }).success).toBe(
      false,
    );
    const tooMany = Array.from({ length: 25 }, (_, i) => ({ position: i + 1, code: 'XYZ' }));
    expect(scoreBugPropsSchema.safeParse({ ...RACING_MIN, rows: tooMany }).success).toBe(false);
  });

  it('rejects bad hex on team / racingRow / cricket colors', () => {
    expect(
      scoreBugPropsSchema.safeParse({
        ...FOOTBALL_MIN,
        home: { code: 'KC', color: '#ZZZ', score: '0' },
      }).success,
    ).toBe(false);
    expect(
      scoreBugPropsSchema.safeParse({
        ...RACING_MIN,
        rows: [{ position: 1, code: 'VER', teamColor: 'red' }],
      }).success,
    ).toBe(false);
    expect(
      scoreBugPropsSchema.safeParse({
        ...CRICKET_MIN,
        battingTeam: { code: 'IND', color: 'blue', runs: 0, wickets: 0, overs: '0.0' },
      }).success,
    ).toBe(false);
  });

  it('rejects cricket missing battingTeam, batsmen length 3, wickets > 10', () => {
    const { battingTeam: _bt, ...noBat } = CRICKET_MIN as Extract<
      ScoreBugProps,
      { style: 'cricket' }
    >;
    expect(scoreBugPropsSchema.safeParse(noBat).success).toBe(false);
    expect(
      scoreBugPropsSchema.safeParse({
        ...CRICKET_MIN,
        batsmen: [
          { name: 'A', runs: 1 },
          { name: 'B', runs: 2 },
          { name: 'C', runs: 3 },
        ],
      }).success,
    ).toBe(false);
    expect(
      scoreBugPropsSchema.safeParse({
        ...CRICKET_MIN,
        battingTeam: { code: 'IND', color: '#0066B3', runs: 0, wickets: 11, overs: '0.0' },
      }).success,
    ).toBe(false);
  });

  it('rejects tennis players length ≠ 2 and sets length 0 or 6', () => {
    expect(
      scoreBugPropsSchema.safeParse({
        ...TENNIS_MIN,
        players: [{ surname: 'Solo', countryCode: 'SRB', sets: ['6'] }],
      }).success,
    ).toBe(false);
    expect(
      scoreBugPropsSchema.safeParse({
        ...TENNIS_MIN,
        players: [
          { surname: 'A', countryCode: 'SRB', sets: [] as string[] },
          { surname: 'B', countryCode: 'ESP', sets: ['1'] },
        ],
      }).success,
    ).toBe(false);
    expect(
      scoreBugPropsSchema.safeParse({
        ...TENNIS_MIN,
        players: [
          { surname: 'A', countryCode: 'SRB', sets: ['1', '2', '3', '4', '5', '6'] },
          { surname: 'B', countryCode: 'ESP', sets: ['1'] },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects unknown extra keys (strict at top level + nested)', () => {
    expect(scoreBugPropsSchema.safeParse({ ...FOOTBALL_MIN, unknownTopKey: true }).success).toBe(
      false,
    );
    expect(
      scoreBugPropsSchema.safeParse({
        ...FOOTBALL_MIN,
        home: { code: 'KC', color: '#E31837', score: '24', extra: 1 },
      }).success,
    ).toBe(false);
  });

  it('accepts all enum values', () => {
    for (const style of ['football', 'racing', 'cricket', 'tennis'] as const) {
      const valid: ScoreBugProps =
        style === 'football'
          ? FOOTBALL_MIN
          : style === 'racing'
            ? RACING_MIN
            : style === 'cricket'
              ? CRICKET_MIN
              : TENNIS_MIN;
      expect(scoreBugPropsSchema.safeParse(valid).success).toBe(true);
    }
    for (const casing of ['as-is', 'uppercase', 'lowercase', 'title-case'] as const) {
      expect(scoreBugPropsSchema.safeParse({ ...FOOTBALL_MIN, casing }).success).toBe(true);
    }
    for (const sectorColor of ['session-best', 'personal-best', 'slower', 'neutral'] as const) {
      expect(
        scoreBugPropsSchema.safeParse({
          ...RACING_MIN,
          rows: [{ position: 1, code: 'VER', sectorColors: [sectorColor] }],
        }).success,
      ).toBe(true);
    }
    for (const tireCompound of ['soft', 'medium', 'hard', 'inter', 'wet'] as const) {
      expect(
        scoreBugPropsSchema.safeParse({
          ...RACING_MIN,
          rows: [{ position: 1, code: 'VER', tireCompound }],
        }).success,
      ).toBe(true);
    }
    for (const possession of ['home', 'away'] as const) {
      expect(scoreBugPropsSchema.safeParse({ ...FOOTBALL_MIN, possession }).success).toBe(true);
    }
    for (const direction of ['left-to-right', 'right-to-left'] as const) {
      expect(scoreBugPropsSchema.safeParse({ ...FOOTBALL_MIN, direction }).success).toBe(true);
    }
    for (const anchor of ['top-left', 'top-center', 'top-right'] as const) {
      expect(scoreBugPropsSchema.safeParse({ ...CRICKET_MIN, anchor }).success).toBe(true);
    }
    for (const anchor of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
      expect(scoreBugPropsSchema.safeParse({ ...TENNIS_MIN, anchor }).success).toBe(true);
    }
  });
});

describe('<ScoreBug> football', () => {
  it('emits outer + home + away + clock testids and renders codes/scores', () => {
    renderAt(0, FOOTBALL_MIN);
    expect(screen.getByTestId('score-bug-football')).toBeTruthy();
    expect(screen.getByTestId('score-bug-football-home')).toBeTruthy();
    expect(screen.getByTestId('score-bug-football-away')).toBeTruthy();
    expect(screen.getByTestId('score-bug-football-clock')).toBeTruthy();
    const root = screen.getByTestId('score-bug-football');
    expect(root.textContent).toContain('KC');
    expect(root.textContent).toContain('PHI');
    expect(root.textContent).toContain('24');
    expect(root.textContent).toContain('21');
    expect(root.textContent).toContain('02:34');
    expect(root.textContent).toContain('Q4');
  });

  it('emits center-circle when centerCircle: true', () => {
    renderAt(0, { ...FOOTBALL_MIN, centerCircle: true });
    expect(screen.getByTestId('score-bug-football-center-circle')).toBeTruthy();
    cleanup();
    renderAt(0, FOOTBALL_MIN);
    expect(screen.queryByTestId('score-bug-football-center-circle')).toBeNull();
  });

  it('applies brightness(1.12) filter to home section when possession: "home"', () => {
    renderAt(0, { ...FOOTBALL_MIN, possession: 'home' });
    const home = screen.getByTestId('score-bug-football-home');
    const away = screen.getByTestId('score-bug-football-away');
    expect(home.style.filter).toContain('brightness(1.12)');
    expect(away.style.filter).not.toContain('brightness(1.12)');
  });

  it('emits SVG <radialGradient> when backdropGradient set, none otherwise', () => {
    const { container } = renderAt(0, {
      ...FOOTBALL_MIN,
      backdropGradient: { centerOpacity: 0.4, edgeOpacity: 0 },
    });
    expect(container.querySelector('radialGradient')).not.toBeNull();
    cleanup();
    const { container: c2 } = renderAt(0, FOOTBALL_MIN);
    expect(c2.querySelector('radialGradient')).toBeNull();
  });
});

describe('<ScoreBug> racing', () => {
  it('renders N row testids with stripe color, position, code, gap', () => {
    const rows = [
      { position: 1, code: 'VER', teamColor: '#1E5BC6', gap: 'LEADER' },
      { position: 2, code: 'HAM', teamColor: '#00D2BE', gap: '+0.124' },
      { position: 3, code: 'NOR', teamColor: '#FF8000', gap: '+1.084' },
      { position: 4, code: 'LEC', teamColor: '#DC0000', gap: '+2.371' },
      { position: 5, code: 'SAI', teamColor: '#DC0000', gap: '+3.502' },
    ];
    renderAt(0, { style: 'racing', position: { x: 0, y: 100 }, rows });
    expect(screen.getByTestId('score-bug-racing')).toBeTruthy();
    for (let i = 0; i < 5; i += 1) {
      const row = screen.getByTestId(`score-bug-racing-row-${i}`);
      const expected = rows[i];
      if (!expected) continue;
      expect(row.textContent).toContain(expected.code);
      expect(row.textContent).toContain(String(expected.position));
      expect(row.textContent).toContain(expected.gap);
    }
  });

  it('renders 3 sector cells with canonical purple/green/yellow fills', () => {
    renderAt(0, {
      style: 'racing',
      position: { x: 0, y: 100 },
      rows: [
        {
          position: 1,
          code: 'VER',
          sectorColors: ['session-best', 'personal-best', 'slower'],
        },
      ],
    });
    const c0 = screen.getByTestId('score-bug-racing-sector-0-0');
    const c1 = screen.getByTestId('score-bug-racing-sector-0-1');
    const c2 = screen.getByTestId('score-bug-racing-sector-0-2');
    // happy-dom doesn't always normalize hex → rgb; accept either form.
    expect(c0.style.backgroundColor.toLowerCase()).toMatch(/^(#6f2e9e|rgb\(111, 46, 158\))$/);
    expect(c1.style.backgroundColor.toLowerCase()).toMatch(/^(#00b54a|rgb\(0, 181, 74\))$/);
    expect(c2.style.backgroundColor.toLowerCase()).toMatch(/^(#f0c800|rgb\(240, 200, 0\))$/);
  });
});

describe('<ScoreBug> cricket', () => {
  it('renders team + runrate + batsmen + bowler + partnership when present', () => {
    renderAt(0, {
      style: 'cricket',
      position: { x: 200, y: 60 },
      battingTeam: { code: 'IND', color: '#0066B3', runs: 247, wickets: 4, overs: '42.3' },
      bowlingTeam: { code: 'AUS', color: '#FFCD00' },
      runRate: '5.87',
      requiredRunRate: '8.42',
      batsmen: [
        { name: 'Kohli', runs: 47, balls: 38, onStrike: true },
        { name: 'Rohit', runs: 21, balls: 18 },
      ],
      bowler: { name: 'Cummins', figures: '3-42' },
      partnership: '47 (38)',
    });
    expect(screen.getByTestId('score-bug-cricket')).toBeTruthy();
    expect(screen.getByTestId('score-bug-cricket-team')).toBeTruthy();
    expect(screen.getByTestId('score-bug-cricket-runrate')).toBeTruthy();
    expect(screen.getByTestId('score-bug-cricket-batsman-0')).toBeTruthy();
    expect(screen.getByTestId('score-bug-cricket-batsman-1')).toBeTruthy();
    expect(screen.getByTestId('score-bug-cricket-bowler')).toBeTruthy();
    expect(screen.getByTestId('score-bug-cricket-partnership')).toBeTruthy();
  });
});

describe('<ScoreBug> tennis', () => {
  it('renders 2 player rows + server-dot only on activeServerIndex; uppercase country code', () => {
    renderAt(0, {
      style: 'tennis',
      position: { x: 60, y: 950 },
      players: [
        { surname: 'Djokovic', countryCode: 'srb', sets: ['6', '4', '7-6'], gameScore: '40' },
        { surname: 'Alcaraz', countryCode: 'esp', sets: ['4', '6', '6-7'], gameScore: '30' },
      ],
      activeServerIndex: 0,
    });
    expect(screen.getByTestId('score-bug-tennis')).toBeTruthy();
    expect(screen.getByTestId('score-bug-tennis-player-0')).toBeTruthy();
    expect(screen.getByTestId('score-bug-tennis-player-1')).toBeTruthy();
    expect(screen.getByTestId('score-bug-tennis-server-dot-0')).toBeTruthy();
    expect(screen.queryByTestId('score-bug-tennis-server-dot-1')).toBeNull();
    const p0 = screen.getByTestId('score-bug-tennis-player-0');
    const p1 = screen.getByTestId('score-bug-tennis-player-1');
    // Country codes always uppercase regardless of casing
    expect(p0.textContent).toContain('SRB');
    expect(p1.textContent).toContain('ESP');
  });
});

describe('<ScoreBug> casing transform', () => {
  it('applies casing to non-numeric fields; leaves numerics verbatim; tennis country always uppercase', () => {
    renderAt(0, {
      ...FOOTBALL_MIN,
      home: { code: 'kc', color: '#E31837', score: '24' },
      away: { code: 'phi', color: '#004C54', score: '21' },
      period: 'q4',
      casing: 'uppercase',
    });
    const root = screen.getByTestId('score-bug-football');
    expect(root.textContent).toContain('KC');
    expect(root.textContent).toContain('PHI');
    expect(root.textContent).toContain('Q4');
    // Numerics untouched (as-is regardless of casing)
    expect(root.textContent).toContain('24');
    expect(root.textContent).toContain('21');
    expect(root.textContent).toContain('02:34');
    cleanup();
    // Tennis: countryCode forced uppercase even with casing 'lowercase'
    renderAt(0, {
      style: 'tennis',
      position: { x: 60, y: 950 },
      players: [
        { surname: 'Djokovic', countryCode: 'srb', sets: ['6'] },
        { surname: 'Alcaraz', countryCode: 'esp', sets: ['4'] },
      ],
      casing: 'lowercase',
    });
    const t = screen.getByTestId('score-bug-tennis');
    expect(t.textContent).toContain('SRB');
    expect(t.textContent).toContain('ESP');
  });
});

describe('<ScoreBug> tabularNums + theme defaults', () => {
  it('emits tabular-nums by default; absent when font.tabularNums: false', () => {
    const { container } = renderAt(0, FOOTBALL_MIN);
    const root = container.querySelector('[data-testid="score-bug-football"]') as HTMLElement;
    expect(root.style.fontVariantNumeric).toBe('tabular-nums');
    cleanup();
    const { container: c2 } = renderAt(0, {
      ...FOOTBALL_MIN,
      font: { family: 'Inter, sans-serif', weight: 700, tabularNums: false },
    });
    const root2 = c2.querySelector('[data-testid="score-bug-football"]') as HTMLElement;
    expect(root2.style.fontVariantNumeric).not.toBe('tabular-nums');
  });

  it('respects explicit background prop on the root', () => {
    renderAt(0, { ...FOOTBALL_MIN, background: '#0A0A0A' });
    const root = screen.getByTestId('score-bug-football');
    // rgba/rgb mapping in jsdom: '#0A0A0A' may render as rgb(10, 10, 10)
    expect(root.style.backgroundColor.toLowerCase()).toMatch(/rgb\(10, 10, 10\)|#0a0a0a/);
  });
});

describe('clip registration', () => {
  it('registers as kind "score-bug" and is in ALL_BRIDGE_CLIPS at length 55', () => {
    expect(scoreBugClip.kind).toBe('score-bug');
    expect(ALL_BRIDGE_CLIPS).toHaveLength(55);
    expect(ALL_BRIDGE_CLIPS).toContain(scoreBugClip);
  });
});

describe('determinism', () => {
  it('renders byte-identical HTML for the same props at the same frame (any style)', () => {
    const { container: a } = renderAt(30, RACING_MIN);
    const htmlA = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(30, RACING_MIN);
    const htmlB = b.innerHTML;
    expect(htmlA).toBe(htmlB);
  });
});
