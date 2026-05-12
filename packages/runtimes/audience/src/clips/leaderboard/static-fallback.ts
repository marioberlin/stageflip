// packages/runtimes/audience/src/clips/leaderboard/static-fallback.ts
// T-466 — Static-fallback renderer for the `leaderboard` clip. Pure
// function: `(snapshot, ctx) → ReactElement`. Given identical snapshot
// + context bytes the output React tree is byte-equal — no Date /
// random / fetch / setTimeout per CLAUDE.md §3 (the audience runtime
// IS inside the determinism perimeter).
//
// Layout (per T-466 spec + ADR-010 §D4):
//   - Vertical ranked list of `ranking` entries in rank order.
//   - Each row: `#${rank}` badge, display name (or "Anonymous voter"
//     if `displayName` absent), score badge.
//   - Top-3 rows carry `data-medal="gold" | "silver" | "bronze"` plus
//     accent fill (gold #fbbf24, silver #d1d5db, bronze #d97706).
//     Rows with `rank > 3` carry no `data-medal` attribute and use the
//     default row chrome.
//   - Optional title (from `clip.props.title`) rendered above the list
//     as an `<h3>`.
//   - Total label below the list: `${totalParticipants} participants`.
//   - Empty-ranking shape: "Waiting for participants…" placeholder.
//
// Determinism note (CLAUDE.md §3): NO `Date.now()`, NO `Math.random()`.
//
// Browser-safe pure JSX (createElement). No DOM API calls; the React
// renderer (the host) materialises the tree.

import type { LeaderboardAggregation } from '@stageflip/audience-contract';
import { type ReactElement, createElement } from 'react';

/**
 * Visual context for the static-fallback render. Width / height in CSS
 * px. The optional `title` overrides any title carried on the clip
 * props (the renderer-core dispatch supplies it from `clip.props.title`).
 */
export interface LeaderboardStaticFallbackContext {
  /** Bounding-box width in CSS px. Positive integer. */
  readonly width: number;
  /** Bounding-box height in CSS px. Positive integer. */
  readonly height: number;
  /**
   * Optional display title — rendered above the ranking list when
   * present. Sourced from the clip's `props.title`.
   */
  readonly title?: string;
}

/** Default panel background colour. */
const PANEL_BG = '#ffffff';
/** Default row background. */
const ROW_BG = '#f9fafb';
/** Default row border. */
const ROW_BORDER = '#e5e7eb';
/** Default text colour. */
const TEXT_COLOR = '#111827';
/** Secondary-text colour (badges + meta). */
const SECONDARY_TEXT_COLOR = '#6b7280';
/** Score badge background. */
const SCORE_BADGE_BG = '#f3f4f6';
/** Gold medal fill (rank 1). */
const MEDAL_GOLD = '#fbbf24';
/** Silver medal fill (rank 2). */
const MEDAL_SILVER = '#d1d5db';
/** Bronze medal fill (rank 3). */
const MEDAL_BRONZE = '#d97706';
/** Anonymous-voter display fallback. */
const ANONYMOUS_DISPLAY_NAME = 'Anonymous voter';

/**
 * Resolve the medal label for a rank. `1 → 'gold'`, `2 → 'silver'`,
 * `3 → 'bronze'`, anything else → `null`. Exported for the test surface.
 */
export function medalForRank(rank: number): 'gold' | 'silver' | 'bronze' | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

/**
 * Resolve the medal accent colour for a rank. Returns `null` for ranks
 * outside the medal tier. Pure function.
 */
export function medalColorForRank(rank: number): string | null {
  const medal = medalForRank(rank);
  if (medal === 'gold') return MEDAL_GOLD;
  if (medal === 'silver') return MEDAL_SILVER;
  if (medal === 'bronze') return MEDAL_BRONZE;
  return null;
}

/**
 * Format the total-participants label. Matches the `${n} participants`
 * / `1 participant` singular-plural precedent from the prior families.
 */
export function formatParticipantsLabel(totalParticipants: number): string {
  return `${totalParticipants} ${totalParticipants === 1 ? 'participant' : 'participants'}`;
}

/**
 * Resolve the display label for a ranking entry. `displayName` when
 * present and non-empty, otherwise the `ANONYMOUS_DISPLAY_NAME`
 * fallback per the T-466 spec.
 */
function displayLabelFor(entry: LeaderboardAggregation['ranking'][number]): string {
  if (entry.displayName !== undefined && entry.displayName.length > 0) {
    return entry.displayName;
  }
  return ANONYMOUS_DISPLAY_NAME;
}

/**
 * Render a single ranking row. `index` is the row's position in the
 * rendered list (0-based); `entry` is the snapshot row.
 */
function renderRankingRow(input: {
  entry: LeaderboardAggregation['ranking'][number];
  index: number;
}): ReactElement {
  const { entry, index } = input;
  const medal = medalForRank(entry.rank);
  const medalColor = medalColorForRank(entry.rank);
  const displayLabel = displayLabelFor(entry);

  const rowProps: Record<string, unknown> = {
    key: `row-${entry.voterToken}`,
    'data-testid': `leaderboard-row-${index}`,
    'data-rank': entry.rank,
    'data-voter-token': entry.voterToken,
    'data-row-index': index,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: ROW_BG,
      border: `1px solid ${ROW_BORDER}`,
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '8px',
      gap: '12px',
    },
  };
  if (medal !== null) rowProps['data-medal'] = medal;

  const rankBadgeStyle: Record<string, unknown> = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '36px',
    height: '28px',
    borderRadius: '14px',
    fontSize: '13px',
    fontWeight: 700,
    background: medalColor ?? SCORE_BADGE_BG,
    color: medal === null ? TEXT_COLOR : '#1f2937',
  };

  const rankBadge = createElement(
    'span',
    {
      key: 'rank-badge',
      'data-role': 'rank-badge',
      'data-testid': `leaderboard-rank-${index}`,
      style: rankBadgeStyle,
    },
    `#${entry.rank}`,
  );

  const nameSpan = createElement(
    'span',
    {
      key: 'display-name',
      'data-role': 'display-name',
      'data-testid': `leaderboard-name-${index}`,
      style: {
        flex: 1,
        color: TEXT_COLOR,
        fontSize: '14px',
        fontWeight: 500,
        textAlign: 'left',
        marginLeft: '12px',
      },
    },
    displayLabel,
  );

  const scoreBadge = createElement(
    'span',
    {
      key: 'score-badge',
      'data-role': 'score-badge',
      'data-testid': `leaderboard-score-${index}`,
      'data-score': entry.score,
      style: {
        display: 'inline-block',
        background: SCORE_BADGE_BG,
        color: SECONDARY_TEXT_COLOR,
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: 600,
      },
    },
    `${entry.score}`,
  );

  return createElement('div', rowProps, [rankBadge, nameSpan, scoreBadge]);
}

/**
 * Render an idle / waiting placeholder. Used when the snapshot's
 * `ranking` is empty (no scored voters yet).
 */
function renderWaitingPlaceholder(width: number, height: number): ReactElement {
  return createElement(
    'div',
    {
      'data-stageflip-clip': 'leaderboard',
      'data-testid': 'leaderboard-root',
      'data-state': 'waiting',
      style: {
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: 'border-box',
        padding: '16px',
        background: PANEL_BG,
        color: TEXT_COLOR,
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    createElement(
      'p',
      {
        'data-role': 'waiting-label',
        'data-testid': 'leaderboard-waiting',
        style: { fontSize: '16px', color: SECONDARY_TEXT_COLOR },
      },
      'Waiting for participants…',
    ),
  );
}

/**
 * Render the static-fallback React tree from a frozen aggregation
 * snapshot + visual context. Pure: same `(snapshot, ctx)` → byte-equal
 * `ReactElement`.
 *
 * Routing (per the T-466 spec):
 *   - `ranking.length === 0` → "Waiting for participants…" placeholder.
 *   - otherwise → vertical ranked list with optional title above and
 *     `${totalParticipants} participants` label below.
 */
export function renderLeaderboardStaticFallback(input: {
  readonly snapshot: LeaderboardAggregation;
  readonly context: LeaderboardStaticFallbackContext;
}): ReactElement {
  const { snapshot, context } = input;
  const { ranking, totalParticipants } = snapshot;
  const { width, height, title } = context;

  if (ranking.length === 0) {
    return renderWaitingPlaceholder(width, height);
  }

  const rows = ranking.map((entry, index) => renderRankingRow({ entry, index }));

  const children: ReactElement[] = [];
  if (title !== undefined && title.length > 0) {
    children.push(
      createElement(
        'h3',
        {
          key: 'title',
          'data-role': 'title',
          'data-testid': 'leaderboard-title',
          style: {
            margin: '0 0 12px 0',
            color: TEXT_COLOR,
            fontSize: '18px',
            fontWeight: 700,
          },
        },
        title,
      ),
    );
  }
  children.push(
    createElement(
      'div',
      {
        key: 'rows',
        'data-role': 'rows',
        'data-testid': 'leaderboard-rows',
        style: { display: 'flex', flexDirection: 'column' },
      },
      rows,
    ),
  );
  children.push(
    createElement(
      'span',
      {
        key: 'total-label',
        'data-role': 'total-label',
        'data-testid': 'leaderboard-total',
        'data-total-participants': totalParticipants,
        style: {
          display: 'inline-block',
          marginTop: '12px',
          color: SECONDARY_TEXT_COLOR,
          fontSize: '13px',
        },
      },
      formatParticipantsLabel(totalParticipants),
    ),
  );

  return createElement(
    'div',
    {
      'data-stageflip-clip': 'leaderboard',
      'data-testid': 'leaderboard-root',
      'data-state': 'ranked',
      'data-quiz-id': snapshot.quizId,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        boxSizing: 'border-box',
        padding: '16px',
        background: PANEL_BG,
        color: TEXT_COLOR,
        fontFamily: 'system-ui, sans-serif',
        overflow: 'auto',
      },
    },
    children,
  );
}
