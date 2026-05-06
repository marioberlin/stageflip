// packages/runtimes/frame-runtime-bridge/src/clips/score-bug.tsx
// T-332a — `score-bug` runtime-clip primitive: serves six broadcast-sports
// score-bug presets across four sealed style bundles via Zod
// discriminated-union dispatch (`'football'` — horizontal team-vs-team bar;
// `'racing'` — vertical N-driver tower; `'cricket'` — multi-row complex
// panel; `'tennis'` — two-player stack). Frame-deterministic; static
// layouts in v1; animation carve-outs (F1 sector flash, NBC SNF possession
// glow pulse, Fox NFL gradient dynamics, cricket per-ball outcomes,
// Wimbledon match-clock, score-change pulse) deferred to follow-ups
// (T-332b/c/d, T-334a, T-335a, T-336a/b, T-337a/b) OR composed externally
// via `animated-value` / `outcome-row`. No `Date.now` / `Math.random` /
// `crypto.randomUUID` / `setTimeout` / `setInterval` / `fetch`.

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const positionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  })
  .strict();

const fontSchema = z
  .object({
    family: z.string().min(1),
    weight: z.number().int().min(100).max(900).optional(),
    tabularNums: z.boolean().optional(),
  })
  .strict();

const casingSchema = z.enum(['as-is', 'uppercase', 'lowercase', 'title-case']);

// Common props that appear in every style branch. Spread into each branch's
// shape since `discriminatedUnion` requires plain `ZodObject` branches.
const baseShape = {
  position: positionSchema,
  background: z.string().regex(HEX_COLOR_RE).optional(),
  foreground: z.string().regex(HEX_COLOR_RE).optional(),
  accent: z.string().regex(HEX_COLOR_RE).optional(),
  font: fontSchema.optional(),
  casing: casingSchema.optional(),
};

const teamShape = z
  .object({
    code: z.string().min(1),
    color: z.string().regex(HEX_COLOR_RE),
    score: z.string().min(1),
  })
  .strict();

const footballSchema = z
  .object({
    style: z.literal('football'),
    ...baseShape,
    home: teamShape,
    away: teamShape,
    clock: z.string().min(1),
    period: z.string().min(1),
    possession: z.enum(['home', 'away']).optional(),
    centerCircle: z.boolean().optional(),
    backdropGradient: z
      .object({
        centerOpacity: z.number().min(0).max(1),
        edgeOpacity: z.number().min(0).max(1),
      })
      .strict()
      .optional(),
    down: z.string().optional(),
    direction: z.enum(['left-to-right', 'right-to-left']).optional(),
    networkLogo: z.string().optional(),
  })
  .strict();

const racingRowSchema = z
  .object({
    position: z.number().int().positive(),
    code: z.string().min(1),
    teamColor: z.string().regex(HEX_COLOR_RE).optional(),
    gap: z.string().optional(),
    sectorTime: z.string().optional(),
    sectorColors: z
      .array(z.enum(['session-best', 'personal-best', 'slower', 'neutral']))
      .max(3)
      .optional(),
    tireCompound: z.enum(['soft', 'medium', 'hard', 'inter', 'wet']).optional(),
  })
  .strict();

const racingSchema = z
  .object({
    style: z.literal('racing'),
    ...baseShape,
    rows: z.array(racingRowSchema).min(1).max(24),
  })
  .strict();

const cricketTeamSchema = z
  .object({
    code: z.string().min(1),
    color: z.string().regex(HEX_COLOR_RE),
    runs: z.number().int().nonnegative(),
    wickets: z.number().int().min(0).max(10),
    overs: z.string().min(1),
  })
  .strict();

const cricketBowlingTeamSchema = z
  .object({
    code: z.string().min(1),
    color: z.string().regex(HEX_COLOR_RE),
  })
  .strict();

const cricketBatsmanSchema = z
  .object({
    name: z.string().min(1),
    runs: z.number().int().nonnegative(),
    balls: z.number().int().nonnegative().optional(),
    onStrike: z.boolean().optional(),
  })
  .strict();

const cricketBowlerSchema = z
  .object({
    name: z.string().min(1),
    figures: z.string().min(1),
  })
  .strict();

const cricketSchema = z
  .object({
    style: z.literal('cricket'),
    ...baseShape,
    battingTeam: cricketTeamSchema,
    bowlingTeam: cricketBowlingTeamSchema.optional(),
    runRate: z.string().optional(),
    requiredRunRate: z.string().optional(),
    batsmen: z.array(cricketBatsmanSchema).min(1).max(2).optional(),
    bowler: cricketBowlerSchema.optional(),
    partnership: z.string().optional(),
    anchor: z.enum(['top-left', 'top-center', 'top-right']).optional(),
  })
  .strict();

const tennisPlayerSchema = z
  .object({
    surname: z.string().min(1),
    countryCode: z.string().min(2).max(3),
    seed: z.number().int().positive().optional(),
    sets: z.array(z.string()).min(1).max(5),
    gameScore: z.string().optional(),
  })
  .strict();

const tennisSchema = z
  .object({
    style: z.literal('tennis'),
    ...baseShape,
    players: z.array(tennisPlayerSchema).length(2),
    activeServerIndex: z.number().int().min(0).max(1).optional(),
    anchor: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  })
  .strict();

export const scoreBugPropsSchema = z.discriminatedUnion('style', [
  footballSchema,
  racingSchema,
  cricketSchema,
  tennisSchema,
]);

export type ScoreBugProps = z.infer<typeof scoreBugPropsSchema>;

type FootballProps = z.infer<typeof footballSchema>;
type RacingProps = z.infer<typeof racingSchema>;
type CricketProps = z.infer<typeof cricketSchema>;
type TennisProps = z.infer<typeof tennisSchema>;

const DEFAULT_BACKGROUND = '#0d0d0f';
const DEFAULT_FOREGROUND = '#f5f7fa';
const DEFAULT_FONT_FAMILY = 'Plus Jakarta Sans, sans-serif';
const DEFAULT_FONT_WEIGHT = 700;

// Canonical F1 sector colors (D-T332a-7). Matches broadcast standard
// purple (session best) / green (personal best) / yellow (slower) / gray
// (no time yet / neutral).
const SECTOR_COLORS = {
  'session-best': '#6F2E9E',
  'personal-best': '#00B54A',
  slower: '#F0C800',
  neutral: '#666666',
} as const;

const TIRE_COMPOUND_GLYPH: Record<
  NonNullable<RacingProps['rows'][number]['tireCompound']>,
  string
> = {
  soft: 'S',
  medium: 'M',
  hard: 'H',
  inter: 'I',
  wet: 'W',
};

const TIRE_COMPOUND_COLOR: Record<
  NonNullable<RacingProps['rows'][number]['tireCompound']>,
  string
> = {
  soft: '#FF3333',
  medium: '#FFCC33',
  hard: '#FFFFFF',
  inter: '#33CC33',
  wet: '#3399FF',
};

/**
 * Apply casing transform to a non-numeric string. Leaves leading-numeric
 * scores / clocks / overs / runs untouched (D-T332a-12 — numerics render
 * verbatim regardless of `casing`).
 */
function applyCasing(text: string, casing: ScoreBugProps['casing']): string {
  if (!casing || casing === 'as-is') return text;
  // Heuristic: treat strings that begin with a digit as numerics and skip
  // casing. Covers '24', '02:34', '47.3', '5.87'.
  if (/^\d/.test(text)) return text;
  switch (casing) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'title-case':
      return text.replace(/\S+/g, (token) => {
        const first = token.charAt(0);
        return first === '' ? token : first.toUpperCase() + token.slice(1).toLowerCase();
      });
    default:
      return text;
  }
}

/**
 * `<ScoreBug>` — the public component. Discriminates on `props.style` and
 * delegates to a per-style sub-renderer. Frame-derived; static layouts in
 * v1 (per-style animation carve-outs deferred — see file header).
 */
export function ScoreBug(props: ScoreBugProps): ReactElement {
  // Verify frame-runtime is wired (catches misconfigured tests early).
  useCurrentFrame();
  useVideoConfig();

  switch (props.style) {
    case 'football':
      return renderFootball(props);
    case 'racing':
      return renderRacing(props);
    case 'cricket':
      return renderCricket(props);
    case 'tennis':
      return renderTennis(props);
    default: {
      const _exhaustive: never = props;
      return _exhaustive;
    }
  }
}

interface RootStyleInput {
  position: ScoreBugProps['position'];
  background?: string | undefined;
  font?: ScoreBugProps['font'] | undefined;
}

function rootStyle(
  props: RootStyleInput,
  defaultWidth: number,
  defaultHeight: number,
): CSSProperties {
  const tabularNums = props.font?.tabularNums ?? true;
  return {
    position: 'absolute',
    left: props.position.x,
    top: props.position.y,
    width: props.position.width ?? defaultWidth,
    height: props.position.height ?? defaultHeight,
    backgroundColor: props.background ?? DEFAULT_BACKGROUND,
    color: DEFAULT_FOREGROUND,
    fontFamily: props.font?.family ?? DEFAULT_FONT_FAMILY,
    fontWeight: props.font?.weight ?? DEFAULT_FONT_WEIGHT,
    fontVariantNumeric: tabularNums ? 'tabular-nums' : 'normal',
    boxSizing: 'border-box',
    overflow: 'hidden',
  };
}

// ─── football ────────────────────────────────────────────────────────────

function renderFootball(props: FootballProps): ReactElement {
  const fg = props.foreground ?? DEFAULT_FOREGROUND;
  const homeFilter = props.possession === 'home' ? 'brightness(1.12)' : 'none';
  const awayFilter = props.possession === 'away' ? 'brightness(1.12)' : 'none';
  const teamSectionStyle = (color: string, filter: string): CSSProperties => ({
    flex: 1,
    backgroundColor: color,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '0 16px',
    fontSize: 28,
    fontWeight: 800,
    filter,
  });
  const clockStyle: CSSProperties = {
    minWidth: 96,
    color: fg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
  };

  return (
    <div
      data-testid="score-bug-football"
      style={{
        ...rootStyle(props, 720, 80),
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        position: 'absolute',
      }}
    >
      {props.backdropGradient ? (
        <svg
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <title>score-bug football backdrop</title>
          <defs>
            <radialGradient id="score-bug-football-gradient" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor="#000000"
                stopOpacity={props.backdropGradient.centerOpacity}
              />
              <stop
                offset="100%"
                stopColor="#000000"
                stopOpacity={props.backdropGradient.edgeOpacity}
              />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#score-bug-football-gradient)" />
        </svg>
      ) : null}

      <div
        data-testid="score-bug-football-home"
        style={teamSectionStyle(props.home.color, homeFilter)}
      >
        <span>{applyCasing(props.home.code, props.casing)}</span>
        <span>{props.home.score}</span>
      </div>

      <div data-testid="score-bug-football-clock" style={clockStyle}>
        {props.centerCircle ? (
          <div
            data-testid="score-bug-football-center-circle"
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: '#000000',
              color: fg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 4,
            }}
          >
            {props.networkLogo ?? '●'}
          </div>
        ) : null}
        <span>{props.clock}</span>
        <span style={{ fontSize: 12, opacity: 0.8 }}>
          {applyCasing(props.period, props.casing)}
        </span>
        {props.down ? (
          <span style={{ fontSize: 12 }}>{applyCasing(props.down, props.casing)}</span>
        ) : null}
      </div>

      <div
        data-testid="score-bug-football-away"
        style={teamSectionStyle(props.away.color, awayFilter)}
      >
        <span>{props.away.score}</span>
        <span>{applyCasing(props.away.code, props.casing)}</span>
      </div>
    </div>
  );
}

// ─── racing ──────────────────────────────────────────────────────────────

function renderRacing(props: RacingProps): ReactElement {
  const fg = props.foreground ?? DEFAULT_FOREGROUND;
  const rowHeight = 30;
  return (
    <div
      data-testid="score-bug-racing"
      style={{
        ...rootStyle(props, 220, rowHeight * props.rows.length),
        color: fg,
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {props.rows.map((row, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: positional row slot — row i is the same driver across renders.
          key={i}
          data-testid={`score-bug-racing-row-${i}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            height: rowHeight,
            borderLeft: `4px solid ${row.teamColor ?? '#666666'}`,
            paddingLeft: 8,
            gap: 8,
          }}
        >
          <span style={{ width: 24, textAlign: 'right' }}>{row.position}</span>
          <span style={{ width: 40 }}>{applyCasing(row.code, props.casing)}</span>
          {row.sectorColors && row.sectorColors.length > 0 ? (
            <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
              {row.sectorColors.map((sc, j) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional sector slot — slot j is the same sector across renders.
                  key={j}
                  data-testid={`score-bug-racing-sector-${i}-${j}`}
                  style={{
                    width: 12,
                    height: 8,
                    backgroundColor: SECTOR_COLORS[sc],
                    display: 'inline-block',
                  }}
                />
              ))}
            </span>
          ) : null}
          {row.sectorTime ? (
            <span style={{ marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>
              {row.sectorTime}
            </span>
          ) : null}
          <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{row.gap}</span>
          {row.tireCompound ? (
            <span
              data-testid={`score-bug-racing-row-${i}-tire`}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: TIRE_COMPOUND_COLOR[row.tireCompound],
                color: '#000000',
                fontSize: 10,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 4,
              }}
            >
              {TIRE_COMPOUND_GLYPH[row.tireCompound]}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ─── cricket ─────────────────────────────────────────────────────────────

function renderCricket(props: CricketProps): ReactElement {
  const fg = props.foreground ?? DEFAULT_FOREGROUND;
  const team = props.battingTeam;
  return (
    <div
      data-testid="score-bug-cricket"
      style={{
        ...rootStyle(props, 720, 140),
        color: fg,
        padding: 12,
      }}
    >
      <div
        data-testid="score-bug-cricket-team"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 22,
          fontWeight: 800,
          color: '#ffffff',
        }}
      >
        <span
          style={{
            backgroundColor: team.color,
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {applyCasing(team.code, props.casing)}
        </span>
        <span>{`${team.runs}/${team.wickets}`}</span>
        <span style={{ opacity: 0.85, fontSize: 16 }}>{`(${team.overs} ov)`}</span>
        {props.bowlingTeam ? (
          <span
            data-testid="score-bug-cricket-bowling-team"
            style={{
              marginLeft: 'auto',
              backgroundColor: props.bowlingTeam.color,
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 14,
            }}
          >
            v {applyCasing(props.bowlingTeam.code, props.casing)}
          </span>
        ) : null}
      </div>

      {props.runRate ? (
        <div
          data-testid="score-bug-cricket-runrate"
          style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}
        >
          RR {props.runRate}
          {props.requiredRunRate ? <span> · RRR {props.requiredRunRate}</span> : null}
        </div>
      ) : null}

      {props.batsmen ? (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {props.batsmen.map((b, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: positional batsman slot.
              key={i}
              data-testid={`score-bug-cricket-batsman-${i}`}
              style={{ fontSize: 14, fontWeight: b.onStrike ? 800 : 600 }}
            >
              {b.onStrike ? '* ' : '  '}
              {applyCasing(b.name, props.casing)} {b.runs}
              {b.balls !== undefined ? ` (${b.balls})` : ''}
            </div>
          ))}
        </div>
      ) : null}

      {props.bowler ? (
        <div
          data-testid="score-bug-cricket-bowler"
          style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}
        >
          {applyCasing(props.bowler.name, props.casing)} {props.bowler.figures}
        </div>
      ) : null}

      {props.partnership ? (
        <div
          data-testid="score-bug-cricket-partnership"
          style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}
        >
          P/S {props.partnership}
        </div>
      ) : null}
    </div>
  );
}

// ─── tennis ──────────────────────────────────────────────────────────────

function renderTennis(props: TennisProps): ReactElement {
  const fg = props.foreground ?? DEFAULT_FOREGROUND;
  const rowHeight = 32;
  return (
    <div
      data-testid="score-bug-tennis"
      style={{
        ...rootStyle(props, 400, rowHeight * 2 + 8),
        color: fg,
        padding: 4,
      }}
    >
      {props.players.map((player, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: positional player slot — slot i is the same player across renders.
          key={i}
          data-testid={`score-bug-tennis-player-${i}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: rowHeight,
            fontSize: 16,
            fontWeight: 700,
            paddingLeft: 8,
            paddingRight: 8,
          }}
        >
          {props.activeServerIndex === i ? (
            <span
              data-testid={`score-bug-tennis-server-dot-${i}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#ffd700',
                display: 'inline-block',
              }}
            />
          ) : null}
          {/* Tennis countryCode is always uppercase regardless of casing
              (per D-T332a-12 / test contract) — country codes are
              normalized broadcast tokens, not stylable text. */}
          <span style={{ width: 36, opacity: 0.85 }}>{player.countryCode.toUpperCase()}</span>
          {player.seed !== undefined ? (
            <span style={{ fontSize: 12, opacity: 0.7 }}>[{player.seed}]</span>
          ) : null}
          <span style={{ flex: 1 }}>{applyCasing(player.surname, props.casing)}</span>
          {player.sets.map((s, j) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: positional set slot.
              key={j}
              style={{ width: 24, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
            >
              {s}
            </span>
          ))}
          {player.gameScore ? (
            <span
              data-testid={`score-bug-tennis-game-${i}`}
              style={{ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            >
              {player.gameScore}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * `scoreBug` clip definition — registered as `kind: 'score-bug'` in the
 * frame-runtime bridge. Theme slots map `background` / `foreground` /
 * `accent` to the standard palette roles; per-team / per-driver / per-
 * player colors are explicit-prop-only (preset-specific, not theme-
 * derived).
 */
export const scoreBugClip: ClipDefinition<unknown> = defineFrameClip<ScoreBugProps>({
  kind: 'score-bug',
  component: ScoreBug,
  propsSchema: scoreBugPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
    accent: { kind: 'palette', role: 'accent' },
  },
});
