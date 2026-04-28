// tests/load/thresholds.d.ts
// Hand-authored types for thresholds.js (consumed by thresholds.test.ts).

export const collabSyncSmoke: Record<string, readonly string[]>;
export const renderSubmitSmoke: Record<string, readonly string[]>;
export const apiMixedSmoke: Record<string, readonly string[]>;
export const collabSyncFull: Record<string, readonly string[]>;
export const renderSubmitFull: Record<string, readonly string[]>;
export const apiMixedFull: Record<string, readonly string[]>;

export interface SmokeVsFullPin {
  smokeMs: number;
  fullMs: number;
  smokeErrRate?: number;
  fullErrRate?: number;
}

export const SMOKE_VS_FULL_PINS: {
  collabSync: SmokeVsFullPin;
  renderSubmit: SmokeVsFullPin;
  apiMixed: SmokeVsFullPin;
};
