// scripts/backup-restore.test.ts
// T-272 AC #13, #14 — backup-restore CLI dry-run prints plan; execute mode
// is gated behind --i-have-read-the-runbook AND, for prod, an interactive
// confirmation prompt.

import { describe, expect, it } from 'vitest';
import { run } from './backup-restore.js';

class StringStream {
  output = '';
  write(chunk: string): boolean {
    this.output += chunk;
    return true;
  }
  on(): this {
    return this;
  }
  once(): this {
    return this;
  }
  emit(): boolean {
    return false;
  }
  end(): void {}
}

describe('backup-restore CLI (T-272 AC #13, #14)', () => {
  it('exits 1 with usage when required args are missing', () => {
    const out = new StringStream();
    const err = new StringStream();
    const code = run([], {
      stdout: out as unknown as NodeJS.WritableStream,
      stderr: err as unknown as NodeJS.WritableStream,
    });
    expect(code).toBe(1);
    expect(err.output).toContain('--target=');
  });

  it('exits 2 on invalid --target', () => {
    const err = new StringStream();
    const code = run(['--dry-run', '--target=mars', '--backup-date=2026-04-28'], {
      stderr: err as unknown as NodeJS.WritableStream,
    });
    expect(code).toBe(2);
    expect(err.output).toContain('--target');
  });

  it('exits 2 on invalid --backup-date', () => {
    const err = new StringStream();
    const code = run(['--dry-run', '--target=staging', '--backup-date=April 28'], {
      stderr: err as unknown as NodeJS.WritableStream,
    });
    expect(code).toBe(2);
    expect(err.output).toContain('YYYY-MM-DD');
  });

  it('exits 2 on invalid --scope', () => {
    const err = new StringStream();
    const code = run(
      ['--dry-run', '--target=staging', '--backup-date=2026-04-28', '--scope=halfsies'],
      { stderr: err as unknown as NodeJS.WritableStream },
    );
    expect(code).toBe(2);
    expect(err.output).toContain('--scope');
  });

  it('--dry-run prints planned operations for staging full restore', () => {
    const out = new StringStream();
    const code = run(['--dry-run', '--target=staging', '--backup-date=2026-04-28'], {
      stdout: out as unknown as NodeJS.WritableStream,
    });
    expect(code).toBe(0);
    expect(out.output).toContain('# Restore plan — DRY RUN');
    expect(out.output).toContain('target: staging');
    expect(out.output).toContain('backup-date: 2026-04-28');
    expect(out.output).toContain('gcloud firestore import');
    expect(out.output).toContain("--database='(default)'");
    expect(out.output).toContain("--database='eu-west'");
    expect(out.output).toContain('gsutil -m rsync');
    expect(out.output).toContain('stageflip-staging');
    expect(out.output).toContain('stageflip-backups-staging');
  });

  it('--dry-run --scope=firestore-only skips storage steps', () => {
    const out = new StringStream();
    run(['--dry-run', '--target=staging', '--backup-date=2026-04-28', '--scope=firestore-only'], {
      stdout: out as unknown as NodeJS.WritableStream,
    });
    expect(out.output).toContain('gcloud firestore import');
    expect(out.output).not.toContain('gsutil -m rsync');
  });

  it('--dry-run --scope=storage-only skips firestore steps', () => {
    const out = new StringStream();
    run(['--dry-run', '--target=staging', '--backup-date=2026-04-28', '--scope=storage-only'], {
      stdout: out as unknown as NodeJS.WritableStream,
    });
    expect(out.output).not.toContain('gcloud firestore import');
    expect(out.output).toContain('gsutil -m rsync');
  });

  it('--execute against staging requires --i-have-read-the-runbook (exits 3 without)', () => {
    const err = new StringStream();
    const code = run(['--execute', '--target=staging', '--backup-date=2026-04-28'], {
      stderr: err as unknown as NodeJS.WritableStream,
    });
    expect(code).toBe(3);
    expect(err.output).toContain('--i-have-read-the-runbook');
  });

  it('--execute --target=staging --i-have-read-the-runbook prints executable shell script', () => {
    const out = new StringStream();
    const code = run(
      ['--execute', '--target=staging', '--backup-date=2026-04-28', '--i-have-read-the-runbook'],
      { stdout: out as unknown as NodeJS.WritableStream },
    );
    expect(code).toBe(0);
    expect(out.output).toContain('#!/usr/bin/env bash');
    expect(out.output).toContain('set -euo pipefail');
    expect(out.output).toContain('gcloud firestore import');
  });

  it('--execute --target=prod refuses without interactive confirmation (exits 4)', () => {
    const err = new StringStream();
    const code = run(
      ['--execute', '--target=prod', '--backup-date=2026-04-28', '--i-have-read-the-runbook'],
      {
        stderr: err as unknown as NodeJS.WritableStream,
        confirmPrompt: () => 'no',
      },
    );
    expect(code).toBe(4);
    expect(err.output).toContain('prod restore requires interactive confirmation');
  });

  it('--execute --target=prod proceeds when prompt returns "yes"', () => {
    const out = new StringStream();
    const code = run(
      ['--execute', '--target=prod', '--backup-date=2026-04-28', '--i-have-read-the-runbook'],
      {
        stdout: out as unknown as NodeJS.WritableStream,
        confirmPrompt: () => 'yes',
      },
    );
    expect(code).toBe(0);
    expect(out.output).toContain('target=prod');
    expect(out.output).toContain('gcloud firestore import');
  });
});
