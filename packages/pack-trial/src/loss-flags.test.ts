// packages/pack-trial/src/loss-flags.test.ts

import { describe, expect, it } from 'vitest';

import { trialActiveLossFlag, trialExpiredLossFlag } from './loss-flags.js';

describe('trialActiveLossFlag', () => {
  it('returns code=LF-LICENSE-TRIAL-ACTIVE with severity=warn', () => {
    const flag = trialActiveLossFlag('pack-a');
    expect(flag.code).toBe('LF-LICENSE-TRIAL-ACTIVE');
    expect(flag.severity).toBe('warn');
  });

  it('populates packId from the argument', () => {
    expect(trialActiveLossFlag('pack-a').packId).toBe('pack-a');
  });

  it('includes the pack id in the detail string', () => {
    expect(trialActiveLossFlag('pack-a').detail).toContain('pack-a');
  });
});

describe('trialExpiredLossFlag', () => {
  it('returns code=LF-LICENSE-TRIAL-EXPIRED with severity=error', () => {
    const flag = trialExpiredLossFlag('pack-a', '2025-01-01');
    expect(flag.code).toBe('LF-LICENSE-TRIAL-EXPIRED');
    expect(flag.severity).toBe('error');
  });

  it('populates packId from the first argument', () => {
    expect(trialExpiredLossFlag('pack-a', '2025-01-01').packId).toBe('pack-a');
  });

  it('includes both pack id and expiresAt in the detail string', () => {
    const detail = trialExpiredLossFlag('pack-a', '2025-01-01').detail;
    expect(detail).toContain('pack-a');
    expect(detail).toContain('2025-01-01');
  });
});
