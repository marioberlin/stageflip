// apps/audience-join/src/components/reaction-stream-voter-input.test.tsx
// T-470 — Verifies the voter UI for the `reaction-stream` clip family.
// Asserts:
//   - renders the prompt + one button per palette entry;
//   - tapping a button emits a vote with the matching emojiId;
//   - multi-tap is permitted (no client-side disable after submit);
//   - respects the `disabled` prop;
//   - dispatcher wrapper carries clip-kind + session-id data attributes.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ReactionStreamVoterInput,
  ReactionStreamVoterInputDomain,
} from './reaction-stream-voter-input.js';

afterEach(() => {
  cleanup();
});

const PALETTE = [
  { emojiId: 'heart', glyph: '❤️' },
  { emojiId: 'thumbs-up', glyph: '👍' },
  { emojiId: 'fire', glyph: '🔥' },
];

describe('<ReactionStreamVoterInputDomain>', () => {
  it('renders the prompt + one button per palette entry', () => {
    render(
      <ReactionStreamVoterInputDomain
        prompt="React to the talk"
        palette={PALETTE}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId('reaction-stream-voter-prompt').textContent).toBe(
      'React to the talk',
    );
    for (const entry of PALETTE) {
      const btn = screen.getByTestId(`reaction-stream-voter-button-${entry.emojiId}`);
      expect(btn).not.toBeNull();
      expect(btn.getAttribute('data-emoji-id')).toBe(entry.emojiId);
      expect(btn.textContent).toContain(entry.glyph);
    }
  });

  it('emits a vote with the matching emojiId on tap', () => {
    const onSubmit = vi.fn();
    render(<ReactionStreamVoterInputDomain prompt="Q" palette={PALETTE} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId('reaction-stream-voter-button-heart'));
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'reaction-stream', emojiId: 'heart' });
    fireEvent.click(screen.getByTestId('reaction-stream-voter-button-fire'));
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'reaction-stream', emojiId: 'fire' });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('permits multi-tap on the same button (no client-side disable)', () => {
    const onSubmit = vi.fn();
    render(<ReactionStreamVoterInputDomain prompt="Q" palette={PALETTE} onSubmit={onSubmit} />);
    const btn = screen.getByTestId('reaction-stream-voter-button-heart');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(3);
    // Each invocation carries the same emojiId.
    for (const call of onSubmit.mock.calls) {
      expect(call[0]).toEqual({ kind: 'reaction-stream', emojiId: 'heart' });
    }
    // Button stays interactive — no `disabled` attribute appears.
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('respects the disabled prop (no submission possible)', () => {
    const onSubmit = vi.fn();
    render(
      <ReactionStreamVoterInputDomain prompt="Q" palette={PALETTE} onSubmit={onSubmit} disabled />,
    );
    const btn = screen.getByTestId('reaction-stream-voter-button-heart');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('reaction-stream-voter-status').textContent).toBe('Voting closed');
  });

  it('renders no buttons for an empty palette', () => {
    render(<ReactionStreamVoterInputDomain prompt="Q" palette={[]} onSubmit={() => {}} />);
    const row = screen.getByTestId('reaction-stream-voter-row');
    expect(row.children.length).toBe(0);
  });
});

describe('<ReactionStreamVoterInput>', () => {
  it('renders a wrapper with the dispatcher props on data attributes', () => {
    render(<ReactionStreamVoterInput sessionId="sess-1" clipKind="reaction-stream" />);
    const wrapper = screen.getByTestId('voter-input-reaction-stream-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-1');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('reaction-stream');
  });

  it('renders a disabled placeholder until the real wiring lands', () => {
    render(<ReactionStreamVoterInput sessionId="sess-1" clipKind="reaction-stream" />);
    const btn = screen.getByTestId('reaction-stream-voter-button-heart');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
