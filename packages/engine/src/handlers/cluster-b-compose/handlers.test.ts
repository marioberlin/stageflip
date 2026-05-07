// packages/engine/src/handlers/cluster-b-compose/handlers.test.ts
// Vitest coverage for the 4 cluster-b-compose tools — happy-path
// dispatch per (sport, brand) tuple, error reasons, schema rejection,
// reserved-surface posture for VAR + player-intro.

import { describe, expect, it } from 'vitest';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import { CLUSTER_B_COMPOSE_HANDLERS, CLUSTER_B_PRESET_IDS } from './handlers.js';

const ctx: ToolContext = {};

function getTool(name: string): ToolHandler<unknown, unknown, ToolContext> {
  const found = CLUSTER_B_COMPOSE_HANDLERS.find((h) => h.name === name);
  if (!found) throw new Error(`tool ${name} not found in CLUSTER_B_COMPOSE_HANDLERS`);
  return found;
}

async function invoke(name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  const parsed = tool.inputSchema.parse(input);
  const result = await tool.handle(parsed, ctx);
  // Round-trip the output through its schema to catch shape drift.
  return tool.outputSchema.parse(result);
}

const homeAway = {
  home: { code: 'ARS', color: '#EF0107', score: '2' },
  away: { code: 'CHE', color: '#034694', score: '1' },
};

describe('compose_sports_score', () => {
  it('happy path: Premier League', async () => {
    const out = (await invoke('compose_sports_score', {
      sport: 'football',
      brand: 'premier-league',
      ...homeAway,
      clock: '67:42',
      period: '2H',
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(out.ok).toBe(true);
    expect(out.presetId).toBe('premier-league-field-of-play');
    expect(out.clipKind).toBe('scoreBug');
    expect(out.props).toMatchObject({
      home: homeAway.home,
      away: homeAway.away,
      clock: '67:42',
      period: '2H',
    });
    // sport / brand are NOT forwarded into props (consumed by dispatch).
    expect(out.props.sport).toBeUndefined();
    expect(out.props.brand).toBeUndefined();
  });

  it('happy path: Fox NFL with down + possession + backdropGradient default', async () => {
    const out = (await invoke('compose_sports_score', {
      sport: 'football',
      brand: 'fox-nfl',
      home: { code: 'KC', color: '#E31837', score: '21' },
      away: { code: 'PHI', color: '#004C54', score: '14' },
      clock: '02:34',
      period: 'Q4',
      possession: 'home',
      down: '3rd & 7',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(out.presetId).toBe('fox-nfl-no-chrome');
    expect(out.props.possession).toBe('home');
    expect(out.props.down).toBe('3rd & 7');
    // PRESET_DEFAULTS for fox-nfl-no-chrome backfills backdropGradient.
    expect(out.props.backdropGradient).toEqual({ centerOpacity: 0.7, edgeOpacity: 0 });
  });

  it('happy path: NBC SNF with caller-supplied centerCircle override', async () => {
    const out = (await invoke('compose_sports_score', {
      sport: 'football',
      brand: 'nbc-snf',
      ...homeAway,
      clock: '12:00',
      period: 'Q3',
      centerCircle: false, // explicit override of preset default
      direction: 'left-to-right',
    })) as { ok: true; presetId: string; props: Record<string, unknown> };
    expect(out.presetId).toBe('nbc-snf-possession-illuminated');
    expect(out.props.centerCircle).toBe(false);
    expect(out.props.direction).toBe('left-to-right');
  });

  it('happy path: NBC SNF default centerCircle = true', async () => {
    const out = (await invoke('compose_sports_score', {
      sport: 'football',
      brand: 'nbc-snf',
      ...homeAway,
      clock: '12:00',
      period: 'Q3',
    })) as { ok: true; props: Record<string, unknown> };
    expect(out.props.centerCircle).toBe(true);
  });

  it('happy path: F1 racing', async () => {
    const out = (await invoke('compose_sports_score', {
      sport: 'racing',
      brand: 'f1',
      home: { code: 'VER', color: '#1E5BC6', score: '1' },
      away: { code: 'HAM', color: '#27F4D2', score: '2' },
      clock: '00:00',
      period: 'L42',
    })) as { ok: true; presetId: string };
    expect(out.presetId).toBe('f1-timing-tower');
  });

  it('happy paths: cricket / wimbledon / espn (newsTicker)', async () => {
    const cricket = (await invoke('compose_sports_score', {
      sport: 'cricket',
      brand: 'icc',
      home: { code: 'IND', color: '#0A0A6F', score: '276/4' },
      away: { code: 'AUS', color: '#FFD200', score: '275' },
      clock: '49.4',
      period: '50',
    })) as { ok: true; presetId: string; clipKind: string };
    expect(cricket.presetId).toBe('cricket-scorebug');
    expect(cricket.clipKind).toBe('scoreBug');

    const wim = (await invoke('compose_sports_score', {
      sport: 'tennis',
      brand: 'wimbledon',
      home: { code: 'SIN', color: '#522D80', score: '6-4 3-6 2' },
      away: { code: 'ALC', color: '#006633', score: '4-6 6-3 1' },
      clock: '01:42',
      period: 'S3',
    })) as { ok: true; presetId: string };
    expect(wim.presetId).toBe('wimbledon-green-purple');

    const espnFootball = (await invoke('compose_sports_score', {
      sport: 'football',
      brand: 'espn',
      ...homeAway,
      clock: '90:00',
      period: 'FT',
    })) as { ok: true; presetId: string; clipKind: string };
    expect(espnFootball.presetId).toBe('espn-bottomline-flipper');
    expect(espnFootball.clipKind).toBe('newsTicker');

    for (const sport of ['soccer', 'racing', 'cricket', 'tennis'] as const) {
      const out = (await invoke('compose_sports_score', {
        sport,
        brand: 'espn',
        home: { code: 'AAA', color: '#000000', score: '0' },
        away: { code: 'BBB', color: '#FFFFFF', score: '0' },
        clock: '0',
        period: '?',
      })) as { ok: true; presetId: string };
      expect(out.presetId).toBe('espn-bottomline-flipper');
    }
  });

  it('soccer is a synonym for football for premier-league', async () => {
    const a = (await invoke('compose_sports_score', {
      sport: 'soccer',
      brand: 'premier-league',
      ...homeAway,
      clock: '67:42',
      period: '2H',
    })) as { ok: true; presetId: string };
    expect(a.presetId).toBe('premier-league-field-of-play');
  });

  it('rejects (golf, masters) → routes to compose_standings_table', async () => {
    const out = (await invoke('compose_sports_score', {
      sport: 'golf',
      brand: 'masters',
      ...homeAway,
      clock: '0',
      period: '?',
    })) as { ok: false; reason: string; detail?: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('sport_not_supported_by_compose_sports_score');
    expect(out.detail).toContain('compose_standings_table');
  });

  it('rejects (football, uefa-cl) → no_preset_for_sport_brand with candidates', async () => {
    const out = (await invoke('compose_sports_score', {
      sport: 'football',
      brand: 'uefa-cl',
      ...homeAway,
      clock: '0',
      period: '?',
    })) as { ok: false; reason: string; candidatePresets?: string[] };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('no_preset_for_sport_brand');
    expect(out.candidatePresets).toContain('premier-league-field-of-play');
  });

  it('schema rejects bad hex / bad sport / missing field / extra field', () => {
    const tool = getTool('compose_sports_score');
    expect(() =>
      tool.inputSchema.parse({
        sport: 'football',
        brand: 'premier-league',
        home: { code: 'ARS', color: '#ZZZ', score: '2' },
        away: homeAway.away,
        clock: '0',
        period: '?',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        sport: 'badminton',
        brand: 'premier-league',
        ...homeAway,
        clock: '0',
        period: '?',
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        sport: 'football',
        brand: 'premier-league',
        ...homeAway,
        period: '?',
      }),
    ).toThrow();
    // extra field at root
    expect(() =>
      tool.inputSchema.parse({
        sport: 'football',
        brand: 'premier-league',
        ...homeAway,
        clock: '0',
        period: '?',
        rogue: 'x',
      }),
    ).toThrow();
    // extra field nested in team
    expect(() =>
      tool.inputSchema.parse({
        sport: 'football',
        brand: 'premier-league',
        home: { code: 'ARS', color: '#EF0107', score: '2', rogue: 'x' },
        away: homeAway.away,
        clock: '0',
        period: '?',
      }),
    ).toThrow();
  });

  it('determinism — same input twice yields deeply-equal output', async () => {
    const input = {
      sport: 'football' as const,
      brand: 'premier-league' as const,
      ...homeAway,
      clock: '67:42',
      period: '2H',
    };
    const a = await invoke('compose_sports_score', input);
    const b = await invoke('compose_sports_score', input);
    expect(a).toEqual(b);
  });
});

describe('compose_standings_table', () => {
  it('happy path: Masters', async () => {
    const rows = [
      { rank: 1, label: 'Scottie Scheffler', primary: '−12', delta: 'F', highlight: true },
      { rank: 2, label: 'Rory McIlroy', primary: '−9', delta: 'F', highlight: true },
    ];
    const out = (await invoke('compose_standings_table', {
      sport: 'golf',
      brand: 'masters',
      rows,
      title: 'THE MASTERS LEADERBOARD',
    })) as { ok: true; presetId: string; clipKind: string; props: Record<string, unknown> };
    expect(out.ok).toBe(true);
    expect(out.presetId).toBe('masters-red-under-par');
    expect(out.clipKind).toBe('standings');
    expect(out.props.rows).toEqual(rows);
    expect(out.props.title).toBe('THE MASTERS LEADERBOARD');
  });

  it('rejects non-golf → not_applicable_in_cluster_b', async () => {
    const out = (await invoke('compose_standings_table', {
      sport: 'football',
      brand: 'premier-league',
      rows: [{ rank: 1, label: 'Arsenal', primary: '52' }],
    })) as { ok: false; reason: string; detail?: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('not_applicable_in_cluster_b');
    expect(out.detail).toContain('Cluster E');
  });

  it('rejects (golf, espn) → not_applicable_in_cluster_b', async () => {
    const out = (await invoke('compose_standings_table', {
      sport: 'golf',
      brand: 'espn',
      rows: [{ rank: 1, label: 'Tiger Woods', primary: '−4' }],
    })) as { ok: false; reason: string };
    expect(out.reason).toBe('not_applicable_in_cluster_b');
  });

  it('schema rejects rows.length === 0 / 21 / missing required', () => {
    const tool = getTool('compose_standings_table');
    expect(() => tool.inputSchema.parse({ sport: 'golf', brand: 'masters', rows: [] })).toThrow();
    const big = Array.from({ length: 21 }, (_, i) => ({
      rank: i + 1,
      label: `P${i}`,
      primary: '0',
    }));
    expect(() => tool.inputSchema.parse({ sport: 'golf', brand: 'masters', rows: big })).toThrow();
    // Missing rank
    expect(() =>
      tool.inputSchema.parse({
        sport: 'golf',
        brand: 'masters',
        rows: [{ label: 'X', primary: '0' }],
      }),
    ).toThrow();
    // Missing label
    expect(() =>
      tool.inputSchema.parse({
        sport: 'golf',
        brand: 'masters',
        rows: [{ rank: 1, primary: '0' }],
      }),
    ).toThrow();
  });
});

describe('compose_var_call', () => {
  it('always returns not_yet_implemented for valid inputs', async () => {
    for (const input of [
      {
        sport: 'football' as const,
        brand: 'premier-league' as const,
        decision: 'goal' as const,
      },
      {
        sport: 'soccer' as const,
        brand: 'uefa-cl' as const,
        decision: 'no-penalty' as const,
        reason: 'Ball struck the defender outside the box.',
      },
    ]) {
      const out = (await invoke('compose_var_call', input)) as {
        ok: false;
        reason: string;
        detail?: string;
      };
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('not_yet_implemented');
      expect(out.detail).toContain('T-320');
    }
  });

  it('schema rejects NFL VAR (no fox-nfl brand allowed)', () => {
    const tool = getTool('compose_var_call');
    expect(() =>
      tool.inputSchema.parse({
        sport: 'football',
        brand: 'fox-nfl',
        decision: 'goal',
      }),
    ).toThrow();
    // F1 doesn't have VAR — sport enum is football|soccer only
    expect(() =>
      tool.inputSchema.parse({
        sport: 'racing',
        brand: 'premier-league',
        decision: 'goal',
      }),
    ).toThrow();
  });
});

describe('compose_player_intro', () => {
  it('always returns not_yet_implemented for a valid minimal input', async () => {
    const out = (await invoke('compose_player_intro', {
      sport: 'racing',
      brand: 'f1',
      player: { name: 'Max Verstappen', code: 'VER', countryCode: 'NLD' },
      stats: [
        { label: 'POLES', value: '40' },
        { label: 'WINS', value: '60' },
      ],
    })) as { ok: false; reason: string };
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('not_yet_implemented');
  });

  it('schema rejects invalid player.countryCode length / extra fields', () => {
    const tool = getTool('compose_player_intro');
    expect(() =>
      tool.inputSchema.parse({
        sport: 'football',
        brand: 'premier-league',
        player: { name: 'Bukayo Saka', countryCode: 'GB' }, // ISO-3 length 3
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        sport: 'football',
        brand: 'premier-league',
        player: { name: 'X' },
        rogue: 'x',
      }),
    ).toThrow();
    // stats max 6
    expect(() =>
      tool.inputSchema.parse({
        sport: 'football',
        brand: 'premier-league',
        player: { name: 'X' },
        stats: Array.from({ length: 7 }, () => ({ label: 'A', value: 'B' })),
      }),
    ).toThrow();
  });
});

describe('barrel discipline', () => {
  it('CLUSTER_B_PRESET_IDS contains 9 entries', () => {
    expect(CLUSTER_B_PRESET_IDS.length).toBe(9);
  });

  it('handlers array length is 4', () => {
    expect(CLUSTER_B_COMPOSE_HANDLERS.length).toBe(4);
  });

  it('every handler declares bundle === "cluster-b-compose"', () => {
    for (const h of CLUSTER_B_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe('cluster-b-compose');
    }
  });
});
