// packages/engine/src/bundles/types.test.ts

import { describe, expect, it } from 'vitest';
import { summarise } from './types.js';

describe('summarise', () => {
  it('collapses a ToolBundle into name / description / toolCount', () => {
    const bundle = {
      name: 'read',
      description: 'read-only',
      tools: [
        { name: 'get_document', description: 'd', input_schema: { type: 'object' } },
        { name: 'get_slide', description: 'd', input_schema: { type: 'object' } },
      ],
    };
    expect(summarise(bundle)).toEqual({
      name: 'read',
      description: 'read-only',
      toolCount: 2,
    });
  });

  it('returns toolCount 0 for an empty bundle', () => {
    expect(summarise({ name: 'x', description: 'y', tools: [] })).toEqual({
      name: 'x',
      description: 'y',
      toolCount: 0,
    });
  });
});
