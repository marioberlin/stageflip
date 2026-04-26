// apps/stageflip-slide/src/components/dialogs/loss-flag-reporter/loss-flag-reporter.tsx
// Modal listing every visible loss flag from the last import — scaffold;
// behavior lands in the follow-up `feat:` commit.

'use client';

import type { ReactElement } from 'react';

export interface LossFlagReporterProps {
  open: boolean;
  onClose: () => void;
}

export function LossFlagReporter(_props: LossFlagReporterProps): ReactElement | null {
  return null;
}
