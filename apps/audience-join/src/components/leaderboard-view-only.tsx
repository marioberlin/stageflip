// apps/audience-join/src/components/leaderboard-view-only.tsx
// T-466 — View-only voter UI for the `leaderboard` clip family.
//
// Per ADR-010 §D2 `LeaderboardVote = never` — voters do NOT submit
// votes against the leaderboard. The leaderboard's aggregation is
// DERIVED server-side from the upstream `LiveQuizClip` referenced by
// `props.quizId`. This component is the FIRST view-only voter UI on
// disk; it sets the precedent for future "results-only display" clip
// kinds.
//
// The component accepts an optional `onSubmit` prop to satisfy the
// dispatcher's structural contract (other clip kinds wire vote-emitting
// inputs through the same registry). It deliberately IGNORES `onSubmit`
// — invocation is impossible from this UI because there are no
// interactive elements that emit a vote.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) —
// this is presentation code in an `apps/**` voter app.

'use client';

import type { ReactElement } from 'react';

import type { VoterInputProps } from './voter-input-dispatcher';

/**
 * Inputs for the standalone presentational component. The dispatcher
 * uses the wrapper below (`LeaderboardViewOnly`) which adapts the
 * dispatcher's narrower `VoterInputProps` to this domain shape.
 *
 * `onSubmit` is accepted to satisfy the dispatcher's structural
 * contract; it is NEVER invoked because the leaderboard has no voter
 * input — `LeaderboardVote = never` per ADR-010 §D2.
 */
export interface LeaderboardViewOnlyDomainProps {
  /** Optional display title shown above the notice. */
  readonly title?: string;
  /**
   * Optional submit callback — accepted for structural compatibility
   * with the dispatcher's vote-emitting siblings. **NEVER invoked** by
   * this component (the leaderboard is a derived clip; voters do not
   * cast votes). Future view-only kinds reuse this convention.
   */
  readonly onSubmit?: () => void;
}

/**
 * Presentational view-only notice. Renders a friendly "results
 * display" message with no interactive controls. There is no path
 * inside this tree that calls `onSubmit`.
 */
export function LeaderboardViewOnlyDomain(props: LeaderboardViewOnlyDomainProps): ReactElement {
  const { title } = props;
  // `onSubmit` is intentionally not destructured / not called — see TSDoc.
  return (
    <section data-testid="voter-input-leaderboard">
      {title !== undefined && title.length > 0 ? (
        <h2
          data-role="title"
          data-testid="voter-input-leaderboard-title"
          style={{ marginBottom: '8px', fontSize: '16px', color: '#111827', fontWeight: 700 }}
        >
          {title}
        </h2>
      ) : null}
      <p
        data-role="view-only-notice"
        data-testid="voter-input-leaderboard-notice"
        style={{
          fontSize: '15px',
          color: '#374151',
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '14px 16px',
          margin: 0,
        }}
      >
        This is a results display. Sit back and watch the leaderboard!
      </p>
    </section>
  );
}

/**
 * Dispatcher-shape wrapper. The dispatcher passes only `sessionId` +
 * `clipKind`; T-466 wires this wrapper into the dispatcher registry to
 * register the kind. The wrapper renders the static view-only notice;
 * there is no `onSubmit` to forward (the dispatcher contract does not
 * pass one for view-only kinds either, but per the TSDoc the
 * structural acceptance keeps the dispatcher's registry homogeneous
 * for future view-only siblings).
 */
export function LeaderboardViewOnly(props: VoterInputProps): ReactElement {
  return (
    <section
      data-testid="voter-input-leaderboard-wrapper"
      data-clip-kind={props.clipKind}
      data-session-id={props.sessionId}
    >
      <LeaderboardViewOnlyDomain />
    </section>
  );
}
