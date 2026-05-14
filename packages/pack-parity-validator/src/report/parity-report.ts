// packages/pack-parity-validator/src/report/parity-report.ts
// T-549 — Human-readable formatter for `PackParityReport`. Emits a
// terse multi-line block suitable for CLI output, CI logs, and
// marketplace publish-handler error messages.
//
// Format (passing pack):
//
//   Pack parity validation: 12/12 fixtures passed.
//
// Format (mixed pack):
//
//   Pack parity validation: 10/12 fixtures passed (2 failed).
//   Failures by reason:
//     psnr-below-threshold: 1
//     unknown-cluster: 1
//   Failing fixtures:
//     pack/fixtures/cluster-a/intro.png — psnr-below-threshold (PSNR 28.40 dB < 35; SSIM 0.9100 < 0.95)
//     pack/fixtures/cluster-finance/widget.png — unknown-cluster (cluster `cluster-finance` not enumerated)
//
// Pure: no IO, no clock. The formatter is the only place that turns
// numeric metrics into rounded strings; producers keep raw floats.

import type { PackParityReport, PackParityReportEntry } from '../validator/validate-pack.js';

/**
 * Format a `PackParityReport` as a human-readable multi-line string.
 * Returns the empty string if `report.summary.total === 0`.
 */
export function formatPackParityReport(report: PackParityReport): string {
  const { summary, results } = report;
  if (summary.total === 0) {
    return 'Pack parity validation: no fixtures shipped.';
  }
  const lines: string[] = [];
  if (summary.failed === 0) {
    lines.push(`Pack parity validation: ${summary.passed}/${summary.total} fixtures passed.`);
    return lines.join('\n');
  }
  lines.push(
    `Pack parity validation: ${summary.passed}/${summary.total} fixtures passed (${summary.failed} failed).`,
  );
  const reasonKeys = Object.keys(summary.byReason).sort();
  if (reasonKeys.length > 0) {
    lines.push('Failures by reason:');
    for (const key of reasonKeys) {
      lines.push(`  ${key}: ${summary.byReason[key] ?? 0}`);
    }
  }
  const failing = results.filter((entry) => !entry.result.ok);
  if (failing.length > 0) {
    lines.push('Failing fixtures:');
    for (const entry of failing) {
      lines.push(`  ${entry.fixturePath} — ${describeFailure(entry)}`);
    }
  }
  return lines.join('\n');
}

function describeFailure(entry: PackParityReportEntry): string {
  const { result } = entry;
  const reason = result.reason ?? 'unknown';
  if (reason === 'malformed-png') {
    return 'malformed-png (could not decode PNG bytes)';
  }
  if (reason === 'dimension-mismatch') {
    return 'dimension-mismatch (candidate and reference differ in size)';
  }
  if (reason === 'unknown-cluster') {
    return `unknown-cluster (cluster \`${result.threshold.clusterId === 'default' ? 'unknown' : result.threshold.clusterId}\` not enumerated)`;
  }
  const psnr = formatMetric(result.psnr, 2);
  const ssim = formatMetric(result.ssim, 4);
  return `${reason} (PSNR ${psnr} dB < ${result.threshold.minPsnr}; SSIM ${ssim} < ${result.threshold.minSsim})`;
}

function formatMetric(value: number, decimals: number): string {
  if (!Number.isFinite(value)) {
    return value > 0 ? '∞' : '-∞';
  }
  return value.toFixed(decimals);
}
