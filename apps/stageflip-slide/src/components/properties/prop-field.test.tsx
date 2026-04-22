// apps/stageflip-slide/src/components/properties/prop-field.test.tsx

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PropField } from './prop-field';

afterEach(() => cleanup());

describe('<PropField>', () => {
  it('renders label + suffix and prefills the input with the value', () => {
    render(<PropField label="X" value={42} suffix="px" onCommit={() => undefined} testId="f" />);
    expect(screen.getByText('X')).toBeTruthy();
    expect(screen.getByText('px')).toBeTruthy();
    expect((screen.getByTestId('f') as HTMLInputElement).value).toBe('42');
  });

  it('does not emit on keystroke — only on blur / Enter', () => {
    const onCommit = vi.fn();
    render(<PropField label="X" value={0} onCommit={onCommit} testId="f" />);
    const input = screen.getByTestId('f') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(12);
  });

  it('Enter commits via blur semantics', () => {
    const onCommit = vi.fn();
    render(<PropField label="X" value={0} onCommit={onCommit} testId="f" />);
    const input = screen.getByTestId('f') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '55' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // `keyDown` blurs; the blur handler commits.
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(55);
  });

  it('Escape reverts the draft and does not commit', () => {
    const onCommit = vi.fn();
    render(<PropField label="X" value={7} onCommit={onCommit} testId="f" />);
    const input = screen.getByTestId('f') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('7');
  });

  it('non-numeric input reverts on blur without committing', () => {
    const onCommit = vi.fn();
    render(<PropField label="X" value={3} onCommit={onCommit} testId="f" />);
    const input = screen.getByTestId('f') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'banana' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('3');
  });

  it('clamps to min/max on commit', () => {
    const onCommit = vi.fn();
    render(<PropField label="H" value={50} min={1} max={100} onCommit={onCommit} testId="f" />);
    const input = screen.getByTestId('f') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(100);
  });

  it('skips onCommit when the clamped value equals the current value', () => {
    const onCommit = vi.fn();
    render(<PropField label="X" value={10} onCommit={onCommit} testId="f" />);
    const input = screen.getByTestId('f') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('is disabled when prop.disabled is true', () => {
    render(<PropField label="X" value={0} onCommit={() => undefined} testId="f" disabled />);
    expect((screen.getByTestId('f') as HTMLInputElement).disabled).toBe(true);
  });
});
