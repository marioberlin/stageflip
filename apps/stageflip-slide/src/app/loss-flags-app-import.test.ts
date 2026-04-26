// apps/stageflip-slide/src/app/loss-flags-app-import.test.ts
// AC #9 (T-247-loss-flags): proves @stageflip/loss-flags is consumable from
// app code without pulling in @stageflip/import-pptx. The reporter UI (T-248)
// will lean on this — editor-shell must depend on the canonical LossFlag
// types directly, never via the importer.

import type { LossFlag, LossFlagSeverity } from '@stageflip/loss-flags';
import { describe, expect, it } from 'vitest';

describe('@stageflip/loss-flags app-level consumability (T-247-loss-flags AC #9)', () => {
  it('LossFlag type is importable from app code as a type-only import', () => {
    const sample: LossFlag = {
      id: 'abcdef012345',
      source: 'pptx',
      code: 'LF-PPTX-PRESET-GEOMETRY',
      severity: 'info' satisfies LossFlagSeverity,
      category: 'shape',
      location: { slideId: 'slide-1' },
      message: 'preset shape not yet supported',
    };
    expect(sample.severity).toBe('info');
    expect(sample.source).toBe('pptx');
  });
});
