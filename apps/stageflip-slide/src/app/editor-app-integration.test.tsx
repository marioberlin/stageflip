// apps/stageflip-slide/src/app/editor-app-integration.test.tsx
// Integration tests for the four T-139c surfaces wired into the app
// shell: find/replace, onboarding, cloud-save, and presentation mode.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetOnboardingForTest } from '../components/onboarding/onboarding-storage';
import { EditorAppClient } from './editor-app-client';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  // Every test runs in first-mount state; individual tests that want
  // the "completed" state mark it via `markOnboardingComplete()`.
  resetOnboardingForTest();
});

describe('EditorAppClient — T-139c integration', () => {
  describe('find/replace', () => {
    it('Mod+F opens the find/replace dialog', () => {
      render(<EditorAppClient />);
      expect(screen.queryByTestId('find-replace')).toBeNull();
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
      expect(screen.getByTestId('find-replace')).toBeTruthy();
    });

    it('the dialog renders the replace input by default', () => {
      render(<EditorAppClient />);
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
      expect(screen.getByTestId('find-replace-query')).toBeTruthy();
      expect(screen.getByTestId('find-replace-replace-with')).toBeTruthy();
    });
  });

  describe('onboarding', () => {
    it('shows the onboarding coachmark on first mount', () => {
      render(<EditorAppClient />);
      expect(screen.getByTestId('onboarding-coachmark')).toBeTruthy();
    });

    it('does not show the coachmark after completion is marked', () => {
      // Walk through the tour via the Skip affordance — matches user flow.
      render(<EditorAppClient />);
      const skip = screen.getByTestId('onboarding-skip');
      fireEvent.click(skip);
      cleanup();
      render(<EditorAppClient />);
      expect(screen.queryByTestId('onboarding-coachmark')).toBeNull();
    });
  });

  describe('cloud-save', () => {
    it('toggles the cloud-save drawer via the header button', () => {
      render(<EditorAppClient />);
      expect(screen.queryByTestId('cloud-save-drawer')).toBeNull();
      fireEvent.click(screen.getByTestId('cloud-save-toggle'));
      expect(screen.getByTestId('cloud-save-drawer')).toBeTruthy();
      expect(screen.getByTestId('cloud-save-panel')).toBeTruthy();
    });

    it('closing the panel clears the drawer', () => {
      render(<EditorAppClient />);
      fireEvent.click(screen.getByTestId('cloud-save-toggle'));
      fireEvent.click(screen.getByTestId('cloud-save-close'));
      expect(screen.queryByTestId('cloud-save-drawer')).toBeNull();
    });
  });

  describe('presentation mode', () => {
    it('Mod+Enter enters presentation mode', () => {
      render(<EditorAppClient />);
      expect(screen.queryByTestId('presentation')).toBeNull();
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
      expect(screen.getByTestId('presentation')).toBeTruthy();
    });

    it('Esc exits presentation mode', () => {
      render(<EditorAppClient />);
      fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
      expect(screen.getByTestId('presentation')).toBeTruthy();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('presentation')).toBeNull();
    });

    it('persistent toolbar Present button enters presentation mode', () => {
      render(<EditorAppClient />);
      fireEvent.click(screen.getByTestId('persistent-toolbar-present'));
      expect(screen.getByTestId('presentation')).toBeTruthy();
    });
  });
});
