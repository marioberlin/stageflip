// apps/cli/src/commands/render.test.ts

import { describe, expect, it } from 'vitest';

import type { CliEnv } from '../types.js';
import { runRender } from './render.js';

function makeEnv(): { env: CliEnv; logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    env: {
      cwd: '/tmp/fake',
      env: {},
      log: (l) => logs.push(l),
      error: (l) => errors.push(l),
      exit: () => {
        throw new Error('unexpected exit');
      },
    },
  };
}

describe('render', () => {
  it('errors when the document name is missing', async () => {
    const { env, errors } = makeEnv();
    const code = await runRender({ env, args: [], flags: {} });
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/missing document name/i);
  });

  it('errors when --format is missing', async () => {
    const { env, errors } = makeEnv();
    const code = await runRender({ env, args: ['deck'], flags: {} });
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/--format/i);
  });

  it('rejects an unsupported format', async () => {
    const { env, errors } = makeEnv();
    const code = await runRender({ env, args: ['deck'], flags: { format: 'bogus' } });
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/unsupported/i);
  });

  it('accepts html5-zip and dispatches (api bridge pending)', async () => {
    const { env, logs } = makeEnv();
    const code = await runRender({
      env,
      args: ['banner'],
      flags: { format: 'html5-zip', bounce: '300x250,728x90' },
    });
    expect(code).toBe(0);
    expect(logs.join('\n')).toContain('banner');
    expect(logs.join('\n')).toContain('html5-zip');
    expect(logs.join('\n')).toContain('T-229');
  });
});
