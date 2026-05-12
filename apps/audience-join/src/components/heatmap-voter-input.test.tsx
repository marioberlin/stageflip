// apps/audience-join/src/components/heatmap-voter-input.test.tsx
// T-469 — Verifies the voter UI for the `heatmap` clip family.
// Asserts:
//   - renders the prompt + image with the correct src;
//   - tap emits a normalised `(x, y)` vote within [0, 1];
//   - multi-tap up to `maxIntensity`, then disables;
//   - respects the `disabled` prop;
//   - dispatcher wrapper carries clip-kind + session-id data attributes.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HeatmapVoterInput, HeatmapVoterInputDomain } from './heatmap-voter-input.js';

afterEach(() => {
  cleanup();
});

/**
 * Mock the image's bounding-rect — RTL/happy-dom defaults to a
 * zero-sized rect, which would short-circuit the tap-emit. The test
 * stubs the rect so the normalisation maths is exercised.
 */
function stubImageRect(width: number, height: number): void {
  const proto = HTMLImageElement.prototype;
  vi.spyOn(proto, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('<HeatmapVoterInputDomain>', () => {
  it('renders the prompt + image with the correct src', () => {
    render(
      <HeatmapVoterInputDomain
        prompt="Tap where you focus"
        imageRef="https://example.com/img.png"
        maxIntensity={3}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId('heatmap-voter-prompt').textContent).toBe('Tap where you focus');
    const img = screen.getByTestId('heatmap-voter-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/img.png');
    expect(img.getAttribute('alt')).toBe('Tap where you focus');
  });

  it('emits a normalised (x, y) vote on tap', () => {
    stubImageRect(200, 100);
    const onSubmit = vi.fn();
    render(
      <HeatmapVoterInputDomain
        prompt="Q"
        imageRef="https://example.com/img.png"
        maxIntensity={3}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('heatmap-voter-image'), {
      clientX: 100,
      clientY: 50,
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'heatmap', x: 0.5, y: 0.5, intensity: 1 });
  });

  it('clamps clicks outside the bounding rect to [0, 1]', () => {
    stubImageRect(200, 100);
    const onSubmit = vi.fn();
    render(
      <HeatmapVoterInputDomain
        prompt="Q"
        imageRef="https://example.com/img.png"
        maxIntensity={3}
        onSubmit={onSubmit}
      />,
    );
    // x = -10 / 200 → clamped to 0; y = 200 / 100 → clamped to 1.
    fireEvent.click(screen.getByTestId('heatmap-voter-image'), {
      clientX: -10,
      clientY: 200,
    });
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'heatmap', x: 0, y: 1, intensity: 1 });
  });

  it('updates the status counter on each tap', () => {
    stubImageRect(200, 100);
    render(
      <HeatmapVoterInputDomain
        prompt="Q"
        imageRef="https://example.com/img.png"
        maxIntensity={3}
        onSubmit={() => {}}
      />,
    );
    const img = screen.getByTestId('heatmap-voter-image');
    fireEvent.click(img, { clientX: 100, clientY: 50 });
    expect(screen.getByTestId('heatmap-voter-status').getAttribute('data-tap-count')).toBe('1');
    fireEvent.click(img, { clientX: 50, clientY: 25 });
    expect(screen.getByTestId('heatmap-voter-status').getAttribute('data-tap-count')).toBe('2');
  });

  it('disables after maxIntensity taps + emits no further votes', () => {
    stubImageRect(200, 100);
    const onSubmit = vi.fn();
    render(
      <HeatmapVoterInputDomain
        prompt="Q"
        imageRef="https://example.com/img.png"
        maxIntensity={2}
        onSubmit={onSubmit}
      />,
    );
    const img = screen.getByTestId('heatmap-voter-image');
    fireEvent.click(img, { clientX: 100, clientY: 50 });
    fireEvent.click(img, { clientX: 50, clientY: 25 });
    fireEvent.click(img, { clientX: 10, clientY: 10 });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('heatmap-voter-status').textContent).toBe('All taps used');
    expect(img.getAttribute('data-disabled')).toBe('true');
  });

  it('respects the disabled prop (no submission possible)', () => {
    stubImageRect(200, 100);
    const onSubmit = vi.fn();
    render(
      <HeatmapVoterInputDomain
        prompt="Q"
        imageRef="https://example.com/img.png"
        maxIntensity={3}
        onSubmit={onSubmit}
        disabled
      />,
    );
    const img = screen.getByTestId('heatmap-voter-image');
    expect(img.getAttribute('data-disabled')).toBe('true');
    fireEvent.click(img, { clientX: 100, clientY: 50 });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('<HeatmapVoterInput>', () => {
  it('renders a wrapper with the dispatcher props on data attributes', () => {
    render(<HeatmapVoterInput sessionId="sess-1" clipKind="heatmap" />);
    const wrapper = screen.getByTestId('voter-input-heatmap-wrapper');
    expect(wrapper.getAttribute('data-session-id')).toBe('sess-1');
    expect(wrapper.getAttribute('data-clip-kind')).toBe('heatmap');
  });

  it('renders a disabled placeholder image until the real wiring lands', () => {
    render(<HeatmapVoterInput sessionId="sess-1" clipKind="heatmap" />);
    const img = screen.getByTestId('heatmap-voter-image') as HTMLImageElement;
    expect(img.getAttribute('data-disabled')).toBe('true');
  });
});
