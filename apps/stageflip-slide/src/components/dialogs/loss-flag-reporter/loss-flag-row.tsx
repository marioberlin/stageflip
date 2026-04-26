// apps/stageflip-slide/src/components/dialogs/loss-flag-reporter/loss-flag-row.tsx
// Per-flag row in the loss-flag reporter — scaffold; behavior lands in
// the follow-up `feat:` commit.

'use client';

import type { LossFlag } from '@stageflip/loss-flags';
import type { ReactElement } from 'react';

export interface LossFlagRowProps {
  flag: LossFlag;
  onDismiss: (id: string) => void;
  onLocate: (flag: LossFlag) => void;
  /** True when the flag's `location.slideId` resolves to a slide. */
  locateAvailable: boolean;
}

export function LossFlagRow(_props: LossFlagRowProps): ReactElement {
  return <div data-testid="loss-flag-row" />;
}
