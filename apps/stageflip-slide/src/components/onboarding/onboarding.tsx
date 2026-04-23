// apps/stageflip-slide/src/components/onboarding/onboarding.tsx
// Guided coachmark tour shown on first editor load (T-139c).

'use client';

import { t } from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { isOnboardingComplete, markOnboardingComplete } from './onboarding-storage';

/**
 * A single coachmark step. `anchorSelector` is a CSS selector the
 * overlay uses to find the UI element the step points at; when the
 * selector matches nothing, the coachmark renders centered over the
 * viewport instead of anchored. Anchor-less centering is the
 * deliberate graceful degradation — we never block the editor.
 */
export interface CoachmarkStep {
  id: string;
  titleKey: string;
  bodyKey: string;
  anchorSelector?: string;
}

/**
 * Default tour: welcome + four editor surfaces. The selectors match
 * the test-id data attributes every panel already sets.
 */
export const DEFAULT_COACHMARK_STEPS: ReadonlyArray<CoachmarkStep> = [
  {
    id: 'welcome',
    titleKey: 'onboarding.coachmark.welcome.title',
    bodyKey: 'onboarding.coachmark.welcome.body',
  },
  {
    id: 'canvas',
    titleKey: 'onboarding.coachmark.canvas.title',
    bodyKey: 'onboarding.coachmark.canvas.body',
    anchorSelector: '[data-testid="slide-canvas"]',
  },
  {
    id: 'filmstrip',
    titleKey: 'onboarding.coachmark.filmstrip.title',
    bodyKey: 'onboarding.coachmark.filmstrip.body',
    anchorSelector: '[data-testid="filmstrip"]',
  },
  {
    id: 'toolbar',
    titleKey: 'onboarding.coachmark.toolbar.title',
    bodyKey: 'onboarding.coachmark.toolbar.body',
    anchorSelector: '[data-testid="persistent-toolbar"]',
  },
  {
    id: 'properties',
    titleKey: 'onboarding.coachmark.properties.title',
    bodyKey: 'onboarding.coachmark.properties.body',
    anchorSelector: '[data-testid="properties-panel"]',
  },
];

export interface OnboardingProps {
  /** Force the tour open regardless of localStorage — useful for "Show tour again" actions. */
  forceOpen?: boolean;
  /** Override the default step list. */
  steps?: ReadonlyArray<CoachmarkStep>;
}

/**
 * Walks a sequence of tooltip coachmarks over the editor shell. On
 * first mount we check `isOnboardingComplete()`; if false, we show the
 * first step. Next / Previous / Skip cycle; Done / Skip call
 * `markOnboardingComplete()` so the tour never re-runs on subsequent
 * loads until cleared.
 */
export function Onboarding({ forceOpen, steps = DEFAULT_COACHMARK_STEPS }: OnboardingProps): ReactElement | null {
  const [open, setOpen] = useState<boolean>(() => forceOpen ?? !isOnboardingComplete());
  const [stepIdx, setStepIdx] = useState<number>(0);

  const finish = useCallback((): void => {
    markOnboardingComplete();
    setOpen(false);
  }, []);

  const next = useCallback((): void => {
    setStepIdx((i) => {
      if (i >= steps.length - 1) {
        markOnboardingComplete();
        setOpen(false);
        return i;
      }
      return i + 1;
    });
  }, [steps.length]);

  const prev = useCallback((): void => {
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, finish]);

  if (!open) return null;
  const step = steps[stepIdx];
  if (!step) return null;

  const isFirst = stepIdx === 0;
  const isLast = stepIdx === steps.length - 1;

  return (
    <div data-testid="onboarding" style={overlayStyle}>
      <div style={backdropStyle} />
      <div data-testid="onboarding-coachmark" style={coachmarkStyle} role="dialog" aria-modal="true">
        <header style={coachmarkHeaderStyle}>
          <span data-testid="onboarding-step-counter" style={stepCounterStyle}>
            {t('onboarding.coachmark.stepCounter')} {stepIdx + 1} / {steps.length}
          </span>
          <button
            type="button"
            data-testid="onboarding-skip"
            onClick={finish}
            style={skipButtonStyle}
          >
            {t('onboarding.coachmark.skip')}
          </button>
        </header>
        <h3 data-testid="onboarding-title" style={titleStyle}>
          {t(step.titleKey)}
        </h3>
        <p data-testid="onboarding-body" style={bodyStyle}>
          {t(step.bodyKey)}
        </p>
        <footer style={footerStyle}>
          <button
            type="button"
            data-testid="onboarding-previous"
            disabled={isFirst}
            onClick={prev}
            style={navButtonStyle(false)}
          >
            {t('onboarding.coachmark.previous')}
          </button>
          <button
            type="button"
            data-testid="onboarding-next"
            onClick={next}
            style={navButtonStyle(true)}
          >
            {isLast ? t('onboarding.coachmark.done') : t('onboarding.coachmark.next')}
          </button>
        </footer>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(8, 15, 21, 0.6)',
  backdropFilter: 'blur(4px)',
};

const coachmarkStyle: CSSProperties = {
  position: 'relative',
  maxWidth: 420,
  background: 'rgba(21, 28, 35, 0.95)',
  border: '1px solid rgba(90, 248, 251, 0.2)',
  borderRadius: 12,
  padding: 24,
  color: '#ebf1fa',
  boxShadow: '0 16px 48px rgba(0, 114, 229, 0.18)',
};

const coachmarkHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
};

const stepCounterStyle: CSSProperties = {
  fontSize: 10,
  color: '#5af8fb',
  textTransform: 'uppercase',
  letterSpacing: 0.1,
  fontWeight: 600,
};

const skipButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#a5acb4',
  fontSize: 11,
  cursor: 'pointer',
};

const titleStyle: CSSProperties = {
  margin: 0,
  marginBottom: 8,
  fontSize: 18,
  fontWeight: 700,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  marginBottom: 20,
  fontSize: 13,
  lineHeight: 1.6,
  color: '#a5acb4',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

function navButtonStyle(primary: boolean): CSSProperties {
  return {
    padding: '6px 14px',
    background: primary ? 'rgba(90, 248, 251, 0.15)' : 'transparent',
    color: primary ? '#5af8fb' : '#a5acb4',
    border: `1px solid ${primary ? 'rgba(90, 248, 251, 0.3)' : 'rgba(129, 174, 255, 0.2)'}`,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  };
}
