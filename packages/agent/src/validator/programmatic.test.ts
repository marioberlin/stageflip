// packages/agent/src/validator/programmatic.test.ts

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROGRAMMATIC_CHECKS,
  runProgrammaticChecks,
  schemaRoundTripCheck,
} from './programmatic.js';
import type { ProgrammaticCheck } from './types.js';

function validSlideDoc(overrides: Partial<Document> = {}): Document {
  return {
    meta: {
      id: 'doc-1',
      version: 1,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      schemaVersion: 1,
      locale: 'en',
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
    ...overrides,
  } as Document;
}

describe('schemaRoundTripCheck', () => {
  it('passes on a valid document', async () => {
    const result = await schemaRoundTripCheck.run(validSlideDoc());
    expect(result).toEqual({ name: 'schema_round_trip', status: 'pass' });
  });

  it('fails when documentSchema rejects the shape', async () => {
    const bad = { meta: { id: '' } } as unknown as Document;
    const result = await schemaRoundTripCheck.run(bad);
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('documentSchema.parse failed');
  });
});

describe('runProgrammaticChecks', () => {
  it('runs the default checks and reports every result', async () => {
    const results = await runProgrammaticChecks(validSlideDoc(), DEFAULT_PROGRAMMATIC_CHECKS);
    expect(results.map((r) => r.name)).toEqual(['schema_round_trip']);
    expect(results[0]?.status).toBe('pass');
  });

  it('catches exceptions from a misbehaving check and reports them as fail', async () => {
    const broken: ProgrammaticCheck = {
      name: 'throws',
      run() {
        throw new Error('oops');
      },
    };
    const results = await runProgrammaticChecks(validSlideDoc(), [broken]);
    expect(results).toEqual([{ name: 'throws', status: 'fail', detail: 'Check threw: oops' }]);
  });

  it('runs every check in order even when earlier ones fail', async () => {
    const names: string[] = [];
    const track = (name: string, status: 'pass' | 'fail'): ProgrammaticCheck => ({
      name,
      run() {
        names.push(name);
        return { name, status };
      },
    });
    await runProgrammaticChecks(validSlideDoc(), [track('first', 'fail'), track('second', 'pass')]);
    expect(names).toEqual(['first', 'second']);
  });
});
