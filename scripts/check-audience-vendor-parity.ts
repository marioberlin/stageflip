// scripts/check-audience-vendor-parity.ts
// CI gate (T-485) — verifies the 5 vendor audience-backend adapters
// ship descriptors consistent with the ADR-009 §D8 vendor parity
// matrix:
//
//   | Adapter | live-poll-* | live-qa | live-quiz | leaderboard | word-cloud | survey | heatmap | reaction-stream | audience-ai-prompt |
//   |---|---|---|---|---|---|---|---|---|---|
//   | audience-native | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
//   | audience-slido | ✓ | ✓ | ✓ | ✓[¹] | ✓ | ✓ | ✗ | ✗ | ✗ |
//   | audience-mentimeter | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
//   | audience-polleverywhere | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
//   | audience-vevox | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
//   | audience-wooclap | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
//
// Each row's `supportedClipKinds` MUST match this table. Drift between
// the descriptor and the ADR is the failure mode; the gate catches it
// before merge.
//
// Determinism: pure script. No `Date.now()`, no `Math.random()`,
// no `fetch()`. CLAUDE.md §3 determinism rules scope to clip/runtime
// code; gates at `scripts/` are explicitly out of scope.

import { audienceNativeDescriptor } from '../packages/audience-native/src/descriptor.js';
import { audienceSlidoDescriptor } from '../packages/audience-slido/src/descriptor.js';
import { audienceMentimeterDescriptor } from '../packages/audience-mentimeter/src/descriptor.js';
import { audiencePollEverywhereDescriptor } from '../packages/audience-polleverywhere/src/descriptor.js';
import { audienceVevoxDescriptor } from '../packages/audience-vevox/src/descriptor.js';
import { audienceWooclapDescriptor } from '../packages/audience-wooclap/src/descriptor.js';

interface ParityRow {
  readonly adapterId: string;
  readonly descriptor: { readonly capability: { readonly supportedClipKinds: readonly string[] } };
  readonly expectedSupportedKinds: readonly string[];
  readonly expectedSupportsMotionNative: boolean;
}

/**
 * The expected vendor parity matrix per ADR-009 §D8. Each row's
 * `expectedSupportedKinds` is the closed list of `AudienceClipKind`
 * discriminants the adapter MUST declare.
 */
export const VENDOR_PARITY_MATRIX: readonly ParityRow[] = [
  {
    adapterId: 'audience-native',
    descriptor: audienceNativeDescriptor as unknown as ParityRow['descriptor'],
    expectedSupportedKinds: [
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'leaderboard',
      'word-cloud',
      'survey',
      'heatmap',
      'reaction-stream',
      'audience-ai-prompt',
    ],
    expectedSupportsMotionNative: true,
  },
  {
    adapterId: 'audience-slido',
    descriptor: audienceSlidoDescriptor as unknown as ParityRow['descriptor'],
    expectedSupportedKinds: [
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'leaderboard',
      'word-cloud',
      'survey',
    ],
    expectedSupportsMotionNative: false,
  },
  {
    adapterId: 'audience-mentimeter',
    descriptor: audienceMentimeterDescriptor as unknown as ParityRow['descriptor'],
    expectedSupportedKinds: [
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'leaderboard',
      'word-cloud',
      'survey',
    ],
    expectedSupportsMotionNative: false,
  },
  {
    adapterId: 'audience-polleverywhere',
    descriptor: audiencePollEverywhereDescriptor as unknown as ParityRow['descriptor'],
    expectedSupportedKinds: [
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'leaderboard',
      'word-cloud',
      'survey',
    ],
    expectedSupportsMotionNative: false,
  },
  {
    adapterId: 'audience-vevox',
    descriptor: audienceVevoxDescriptor as unknown as ParityRow['descriptor'],
    expectedSupportedKinds: [
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'word-cloud',
      'survey',
    ],
    expectedSupportsMotionNative: false,
  },
  {
    adapterId: 'audience-wooclap',
    descriptor: audienceWooclapDescriptor as unknown as ParityRow['descriptor'],
    expectedSupportedKinds: [
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'leaderboard',
      'word-cloud',
      'survey',
    ],
    expectedSupportsMotionNative: false,
  },
];

/** A single drift between a descriptor and the expected matrix row. */
export interface ParityDrift {
  readonly adapterId: string;
  readonly field:
    | 'supportedClipKinds.missing'
    | 'supportedClipKinds.extra'
    | 'supportsMotionNative';
  readonly expected: unknown;
  readonly actual: unknown;
}

/**
 * Compare a single matrix row against its live descriptor. Returns
 * the drift list (empty == PASS).
 */
export function checkRow(row: ParityRow): readonly ParityDrift[] {
  const drifts: ParityDrift[] = [];
  const actualKinds = new Set(row.descriptor.capability.supportedClipKinds);
  const expectedKinds = new Set(row.expectedSupportedKinds);

  for (const k of expectedKinds) {
    if (!actualKinds.has(k)) {
      drifts.push({
        adapterId: row.adapterId,
        field: 'supportedClipKinds.missing',
        expected: k,
        actual: undefined,
      });
    }
  }
  for (const k of actualKinds) {
    if (!expectedKinds.has(k)) {
      drifts.push({
        adapterId: row.adapterId,
        field: 'supportedClipKinds.extra',
        expected: undefined,
        actual: k,
      });
    }
  }

  const actualMotionNative = (
    row.descriptor as unknown as {
      capability: { supportsMotionNative: boolean };
    }
  ).capability.supportsMotionNative;
  if (actualMotionNative !== row.expectedSupportsMotionNative) {
    drifts.push({
      adapterId: row.adapterId,
      field: 'supportsMotionNative',
      expected: row.expectedSupportsMotionNative,
      actual: actualMotionNative,
    });
  }

  return drifts;
}

/**
 * Run the check across every matrix row. Returns the consolidated
 * drift list (empty == PASS).
 */
export function runCheck(): readonly ParityDrift[] {
  const allDrifts: ParityDrift[] = [];
  for (const row of VENDOR_PARITY_MATRIX) {
    allDrifts.push(...checkRow(row));
  }
  return allDrifts;
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function main(): void {
  const drifts = runCheck();
  console.log(`check-audience-vendor-parity: ${VENDOR_PARITY_MATRIX.length} adapters inspected`);
  if (drifts.length === 0) {
    console.log('check-audience-vendor-parity: PASS');
    process.exit(0);
  }
  console.log('');
  console.log(`  DRIFT (${drifts.length}):`);
  for (const d of drifts) {
    console.log(
      `    ${d.adapterId} :: ${d.field} expected=${JSON.stringify(d.expected)} actual=${JSON.stringify(d.actual)}`,
    );
  }
  console.log('');
  console.log('check-audience-vendor-parity: FAIL');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
