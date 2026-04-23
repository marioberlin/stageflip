// apps/stageflip-slide/src/components/onboarding/onboarding.test.tsx
// Tests for the first-run coachmark sequence (T-139c).

import { ShortcutRegistryProvider } from '@stageflip/editor-shell';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Onboarding } from './onboarding';
import {
  isOnboardingComplete,
  markOnboardingComplete,
  resetOnboardingForTest,
} from './onboarding-storage';

beforeEach(() => resetOnboardingForTest());
afterEach(() => cleanup());

/**
 * Wrap in a `<ShortcutRegistryProvider>` so the Escape-dismiss
 * registration in `<Onboarding>` (T-140 sweep — migrated from a raw
 * window listener) has a registry to register against.
 */
function renderWithRegistry(ui: ReactElement): ReturnType<typeof render> {
  return render(<ShortcutRegistryProvider>{ui}</ShortcutRegistryProvider>);
}

describe('<Onboarding />', () => {
  it('renders on first mount when localStorage is clear', () => {
    renderWithRegistry(<Onboarding />);
    expect(screen.getByTestId('onboarding')).toBeTruthy();
    expect(screen.getByTestId('onboarding-title').textContent).toBe('Welcome to StageFlip');
  });

  it('does not render when markOnboardingComplete() was called before', () => {
    markOnboardingComplete();
    renderWithRegistry(<Onboarding />);
    expect(screen.queryByTestId('onboarding')).toBeNull();
  });

  it('advances through steps on Next', () => {
    renderWithRegistry(<Onboarding />);
    expect(screen.getByTestId('onboarding-step-counter').textContent).toContain('1 / 5');
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-step-counter').textContent).toContain('2 / 5');
    expect(screen.getByTestId('onboarding-title').textContent).toBe('The canvas');
  });

  it('Previous button is disabled on the first step', () => {
    renderWithRegistry(<Onboarding />);
    const prev = screen.getByTestId('onboarding-previous') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(prev.disabled).toBe(false);
  });

  it('Done button on the last step closes the tour + persists completion', () => {
    renderWithRegistry(<Onboarding />);
    // Step through all 5.
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-next').textContent).toBe('Done');
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.queryByTestId('onboarding')).toBeNull();
    expect(isOnboardingComplete()).toBe(true);
  });

  it('Skip button dismisses + persists completion', () => {
    renderWithRegistry(<Onboarding />);
    fireEvent.click(screen.getByTestId('onboarding-skip'));
    expect(screen.queryByTestId('onboarding')).toBeNull();
    expect(isOnboardingComplete()).toBe(true);
  });

  it('Escape key on the focused coachmark dismisses the tour', () => {
    renderWithRegistry(<Onboarding />);
    // Coachmark auto-focuses on mount via useLayoutEffect; Escape
    // routes through its onKeyDown so focus determines which modal
    // owns the key, not registry order.
    fireEvent.keyDown(screen.getByTestId('onboarding-coachmark'), { key: 'Escape' });
    expect(screen.queryByTestId('onboarding')).toBeNull();
    expect(isOnboardingComplete()).toBe(true);
  });

  it('forceOpen re-opens even when localStorage is set', () => {
    markOnboardingComplete();
    renderWithRegistry(<Onboarding forceOpen />);
    expect(screen.getByTestId('onboarding')).toBeTruthy();
  });

  it('respects a custom step list', () => {
    renderWithRegistry(
      <Onboarding
        forceOpen
        steps={[
          {
            id: 'x',
            titleKey: 'onboarding.coachmark.welcome.title',
            bodyKey: 'onboarding.coachmark.welcome.body',
          },
        ]}
      />,
    );
    expect(screen.getByTestId('onboarding-step-counter').textContent).toContain('1 / 1');
  });
});
