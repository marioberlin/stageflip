// packages/agent/src/planner/types.test.ts

import { describe, expect, it } from 'vitest';
import { planSchema, planStepSchema } from './types.js';

describe('planStepSchema', () => {
  it('accepts a minimal step with just the required fields', () => {
    const result = planStepSchema.safeParse({
      id: 's1',
      description: 'Add a title slide',
      bundles: ['create-mutate'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional rationale and dependsOn', () => {
    const result = planStepSchema.safeParse({
      id: 's2',
      description: 'Apply theme',
      bundles: ['layout', 'validate'],
      rationale: 'match brand deck',
      dependsOn: ['s1'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty bundles array', () => {
    const result = planStepSchema.safeParse({
      id: 's3',
      description: 'noop',
      bundles: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty-string fields', () => {
    expect(planStepSchema.safeParse({ id: '', description: 'x', bundles: ['a'] }).success).toBe(
      false,
    );
    expect(planStepSchema.safeParse({ id: 'a', description: '', bundles: ['a'] }).success).toBe(
      false,
    );
  });
});

describe('planSchema', () => {
  it('accepts a plan with steps and a justification', () => {
    const result = planSchema.safeParse({
      steps: [{ id: 's1', description: 'x', bundles: ['read'] }],
      justification: 'single read is enough',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a plan with zero steps', () => {
    const result = planSchema.safeParse({ steps: [], justification: 'ok' });
    expect(result.success).toBe(false);
  });

  it('rejects a plan with an empty justification', () => {
    const result = planSchema.safeParse({
      steps: [{ id: 's1', description: 'x', bundles: ['read'] }],
      justification: '',
    });
    expect(result.success).toBe(false);
  });
});
