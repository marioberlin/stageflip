// packages/pack-parity-validator/src/report/parity-report.test.ts

import { describe, expect, it } from 'vitest';
import type { PackParityReport } from '../validator/validate-pack';
import { formatPackParityReport } from './parity-report';

const PASS_THRESHOLD = { clusterId: 'cluster-a', minPsnr: 35, minSsim: 0.95 } as const;

describe('formatPackParityReport', () => {
  it('renders the no-fixtures sentinel when total is 0', () => {
    const report: PackParityReport = {
      results: [],
      summary: { total: 0, passed: 0, failed: 0, byReason: {} },
    };
    expect(formatPackParityReport(report)).toBe('Pack parity validation: no fixtures shipped.');
  });

  it('renders a single concise summary line when all fixtures pass', () => {
    const report: PackParityReport = {
      results: [
        {
          fixturePath: 'a.png',
          result: { ok: true, psnr: Number.POSITIVE_INFINITY, ssim: 1, threshold: PASS_THRESHOLD },
        },
      ],
      summary: { total: 1, passed: 1, failed: 0, byReason: {} },
    };
    expect(formatPackParityReport(report)).toBe('Pack parity validation: 1/1 fixtures passed.');
  });

  it('renders summary + grouped reasons + per-fixture details when some fail', () => {
    const report: PackParityReport = {
      results: [
        {
          fixturePath: 'pack/fixtures/cluster-a/intro.png',
          result: {
            ok: false,
            psnr: 28.4,
            ssim: 0.91,
            threshold: PASS_THRESHOLD,
            reason: 'psnr-below-threshold',
          },
        },
        {
          fixturePath: 'pack/fixtures/cluster-finance/widget.png',
          result: {
            ok: false,
            psnr: Number.POSITIVE_INFINITY,
            ssim: 1,
            threshold: { clusterId: 'default', minPsnr: 35, minSsim: 0.95 },
            reason: 'unknown-cluster',
          },
        },
      ],
      summary: {
        total: 2,
        passed: 0,
        failed: 2,
        byReason: { 'psnr-below-threshold': 1, 'unknown-cluster': 1 },
      },
    };
    const output = formatPackParityReport(report);
    expect(output).toContain('Pack parity validation: 0/2 fixtures passed (2 failed).');
    expect(output).toContain('Failures by reason:');
    expect(output).toContain('  psnr-below-threshold: 1');
    expect(output).toContain('  unknown-cluster: 1');
    expect(output).toContain('Failing fixtures:');
    expect(output).toContain('pack/fixtures/cluster-a/intro.png');
    expect(output).toContain('PSNR 28.40 dB < 35');
    expect(output).toContain('SSIM 0.9100 < 0.95');
    expect(output).toContain('cluster `unknown` not enumerated');
  });

  it('formats malformed-png with a human-readable suffix (not raw metrics)', () => {
    const report: PackParityReport = {
      results: [
        {
          fixturePath: 'bad.png',
          result: {
            ok: false,
            psnr: 0,
            ssim: 0,
            threshold: PASS_THRESHOLD,
            reason: 'malformed-png',
          },
        },
      ],
      summary: { total: 1, passed: 0, failed: 1, byReason: { 'malformed-png': 1 } },
    };
    const output = formatPackParityReport(report);
    expect(output).toContain('bad.png — malformed-png (could not decode PNG bytes)');
    // Does NOT include numeric metrics that would be misleading for a
    // decode failure.
    expect(output).not.toContain('PSNR 0');
  });

  it('formats dimension-mismatch with a human-readable suffix', () => {
    const report: PackParityReport = {
      results: [
        {
          fixturePath: 'mismatch.png',
          result: {
            ok: false,
            psnr: 0,
            ssim: 0,
            threshold: PASS_THRESHOLD,
            reason: 'dimension-mismatch',
          },
        },
      ],
      summary: { total: 1, passed: 0, failed: 1, byReason: { 'dimension-mismatch': 1 } },
    };
    const output = formatPackParityReport(report);
    expect(output).toContain(
      'mismatch.png — dimension-mismatch (candidate and reference differ in size)',
    );
  });
});
