// apps/audience-join/src/components/word-cloud-voter-input.test.tsx
// T-467 — Verifies the voter UI for the `word-cloud` clip family.
// Asserts:
//   - parses comma-separated text into words array;
//   - slices to `maxWordsPerVoter`;
//   - truncates over-MAX_WORD_LENGTH words;
//   - filters empty / whitespace-only tokens;
//   - rejects empty submission (button disabled);
//   - disables input + button after submit;
//   - emits `{ kind: 'word-cloud', words: [...] }` once.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_WORD_LENGTH,
  WordCloudVoterInput,
  WordCloudVoterInputDomain,
  parseSubmittedWords,
} from './word-cloud-voter-input.js';

afterEach(() => {
  cleanup();
});

describe('parseSubmittedWords', () => {
  it('splits on commas + trims', () => {
    expect(parseSubmittedWords({ text: 'foo, bar, baz', maxWordsPerVoter: 5 })).toEqual([
      'foo',
      'bar',
      'baz',
    ]);
  });

  it('filters empties / whitespace-only tokens', () => {
    expect(parseSubmittedWords({ text: ' , foo, , bar, ', maxWordsPerVoter: 5 })).toEqual([
      'foo',
      'bar',
    ]);
  });

  it('slices to maxWordsPerVoter', () => {
    expect(parseSubmittedWords({ text: 'a, b, c, d, e', maxWordsPerVoter: 3 })).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('truncates over-length words to MAX_WORD_LENGTH', () => {
    const long = 'a'.repeat(40);
    const result = parseSubmittedWords({ text: long, maxWordsPerVoter: 5 });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(MAX_WORD_LENGTH);
  });

  it('returns an empty array for whitespace-only input', () => {
    expect(parseSubmittedWords({ text: '   ', maxWordsPerVoter: 3 })).toEqual([]);
    expect(parseSubmittedWords({ text: '', maxWordsPerVoter: 3 })).toEqual([]);
    expect(parseSubmittedWords({ text: ',,,', maxWordsPerVoter: 3 })).toEqual([]);
  });
});

describe('<WordCloudVoterInputDomain>', () => {
  it('renders the prompt + textarea + submit button', () => {
    render(
      <WordCloudVoterInputDomain
        prompt="Describe today"
        maxWordsPerVoter={3}
        onSubmit={() => {}}
      />,
    );
    const ta = screen.getByTestId('voter-input-textarea');
    expect(ta.getAttribute('placeholder')).toMatch(/up to 3 words/);
    expect(ta.getAttribute('data-max-words-per-voter')).toBe('3');
    const btn = screen.getByTestId('voter-input-submit');
    expect(btn).toBeDefined();
  });

  it('disables submit when textarea is empty', () => {
    render(<WordCloudVoterInputDomain prompt="p" maxWordsPerVoter={3} onSubmit={() => {}} />);
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('emits parsed words on submit', () => {
    const onSubmit = vi.fn();
    render(<WordCloudVoterInputDomain prompt="p" maxWordsPerVoter={3} onSubmit={onSubmit} />);
    const ta = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'design, react, rust' } });
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'word-cloud',
      words: ['design', 'react', 'rust'],
    });
  });

  it('slices to maxWordsPerVoter on submit', () => {
    const onSubmit = vi.fn();
    render(<WordCloudVoterInputDomain prompt="p" maxWordsPerVoter={2} onSubmit={onSubmit} />);
    const ta = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'a, b, c, d' } });
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'word-cloud',
      words: ['a', 'b'],
    });
  });

  it('truncates over-length words client-side', () => {
    const onSubmit = vi.fn();
    const longWord = 'a'.repeat(50);
    render(<WordCloudVoterInputDomain prompt="p" maxWordsPerVoter={3} onSubmit={onSubmit} />);
    const ta = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: longWord } });
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const call = onSubmit.mock.calls[0]?.[0];
    expect(call?.words).toHaveLength(1);
    expect(call?.words[0]).toHaveLength(MAX_WORD_LENGTH);
  });

  it('does NOT emit when all parsed words are empty', () => {
    const onSubmit = vi.fn();
    render(<WordCloudVoterInputDomain prompt="p" maxWordsPerVoter={3} onSubmit={onSubmit} />);
    const ta = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    // Type whitespace; the parser yields []; the button stays disabled.
    fireEvent.change(ta, { target: { value: '   ,  ,  ' } });
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables input + button after submit and shows status', () => {
    const onSubmit = vi.fn();
    render(<WordCloudVoterInputDomain prompt="p" maxWordsPerVoter={3} onSubmit={onSubmit} />);
    const ta = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'foo, bar' } });
    fireEvent.click(screen.getByTestId('voter-input-submit'));
    expect(ta.disabled).toBe(true);
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    const status = screen.getByTestId('voter-input-status');
    expect(status.textContent).toBe('Words submitted');
  });

  it('cannot be submitted twice', () => {
    const onSubmit = vi.fn();
    render(<WordCloudVoterInputDomain prompt="p" maxWordsPerVoter={3} onSubmit={onSubmit} />);
    const ta = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'foo' } });
    const btn = screen.getByTestId('voter-input-submit');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('respects the disabled prop (no submission possible)', () => {
    const onSubmit = vi.fn();
    render(
      <WordCloudVoterInputDomain prompt="p" maxWordsPerVoter={3} onSubmit={onSubmit} disabled />,
    );
    const ta = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
    const btn = screen.getByTestId('voter-input-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe('<WordCloudVoterInput>', () => {
  it('renders a wrapper with the dispatcher props on data attributes', () => {
    render(<WordCloudVoterInput sessionId="sess-1" clipKind="word-cloud" />);
    const wrapper = screen.getByTestId('voter-input-word-cloud-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-1');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('word-cloud');
  });

  it('renders a placeholder domain (disabled) until the real wiring lands', () => {
    render(<WordCloudVoterInput sessionId="sess-1" clipKind="word-cloud" />);
    const ta = screen.getByTestId('voter-input-textarea') as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
  });
});
