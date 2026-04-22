// apps/stageflip-slide/src/components/brand/logo.test.tsx

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Logo } from './logo';

afterEach(() => cleanup());

describe('<Logo>', () => {
  it('renders the product wordmark with an accessible label', () => {
    render(<Logo />);
    const el = screen.getByTestId('brand-logo');
    expect(el).toBeTruthy();
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('StageFlip.Slide');
  });

  it('hides the inner text spans + svg mark from the a11y tree so the role=img label wins', () => {
    render(<Logo />);
    expect(screen.getByTestId('brand-logo-mark').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('brand-logo-brand').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('brand-logo-mode').getAttribute('aria-hidden')).toBe('true');
  });

  it('splits the brand + mode into distinct spans so CSS can style each', () => {
    render(<Logo />);
    expect(screen.getByTestId('brand-logo-brand').textContent).toBe('StageFlip');
    expect(screen.getByTestId('brand-logo-mode').textContent).toBe('.Slide');
  });

  it('accepts a custom size that feeds the svg mark', () => {
    render(<Logo size={24} />);
    const mark = screen.getByTestId('brand-logo-mark');
    expect(mark.getAttribute('width')).toBe('24');
    expect(mark.getAttribute('height')).toBe('24');
  });

  it('applies a configurable className to the outer element', () => {
    render(<Logo className="in-header" />);
    expect(screen.getByTestId('brand-logo').className).toContain('in-header');
  });
});
