// apps/audience-join/src/components/leaderboard-view-only.test.tsx
// T-466 — Verifies the view-only voter UI for the `leaderboard` clip
// family. Asserts:
//   - the notice text renders;
//   - the optional title renders above the notice when supplied;
//   - the `onSubmit` prop, even when supplied, is NEVER invoked (the
//     component has no interactive elements that could trigger it).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LeaderboardViewOnly, LeaderboardViewOnlyDomain } from './leaderboard-view-only.js';

afterEach(() => {
  cleanup();
});

describe('<LeaderboardViewOnlyDomain>', () => {
  it('renders the results-display notice', () => {
    render(<LeaderboardViewOnlyDomain />);
    const notice = screen.getByTestId('voter-input-leaderboard-notice');
    expect(notice.textContent).toMatch(/results display/i);
  });

  it('renders the optional title when supplied', () => {
    render(<LeaderboardViewOnlyDomain title="Final Standings" />);
    const title = screen.getByTestId('voter-input-leaderboard-title');
    expect(title.textContent).toBe('Final Standings');
  });

  it('omits the title node when no title is supplied', () => {
    render(<LeaderboardViewOnlyDomain />);
    expect(screen.queryByTestId('voter-input-leaderboard-title')).toBeNull();
  });

  it('NEVER invokes onSubmit (LeaderboardVote = never per ADR-010 §D2)', () => {
    const onSubmit = vi.fn();
    render(<LeaderboardViewOnlyDomain onSubmit={onSubmit} />);
    // No interactive elements present; no path can invoke onSubmit.
    expect(onSubmit).not.toHaveBeenCalled();
    // Defensive: there should be no <button> or <form> in the rendered tree.
    expect(document.querySelectorAll('button').length).toBe(0);
    expect(document.querySelectorAll('form').length).toBe(0);
  });
});

describe('<LeaderboardViewOnly>', () => {
  it('renders a wrapper with the dispatcher props on data attributes', () => {
    render(<LeaderboardViewOnly sessionId="sess-1" clipKind="leaderboard" />);
    const wrapper = screen.getByTestId('voter-input-leaderboard-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-1');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('leaderboard');
  });

  it('emits the view-only notice (NOT a vote-emitting input)', () => {
    render(<LeaderboardViewOnly sessionId="sess-1" clipKind="leaderboard" />);
    const notice = screen.getByTestId('voter-input-leaderboard-notice');
    expect(notice.textContent).toMatch(/results display/i);
    // Defensive: no vote-emitting controls in the wrapper either.
    expect(document.querySelectorAll('button').length).toBe(0);
  });
});
