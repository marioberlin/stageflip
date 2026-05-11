// packages/asset-gen-contract/src/source-grounded/table-generation-provider.test.ts
// TableGenerationProvider tests.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  type TableCall,
  type TableCapabilityDescriptor,
  type TableGenerationProvider,
  type TableResult,
  tableCapabilityDescriptorSchema,
  validateTableCapability,
} from './table-generation-provider.js';

const validCapability: TableCapabilityDescriptor = {
  maxRows: 100,
  maxCols: 20,
};

describe('tableCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(tableCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('rejects non-positive maxRows', () => {
    expect(() =>
      tableCapabilityDescriptorSchema.parse({ ...validCapability, maxRows: 0 }),
    ).toThrow();
  });

  it('rejects non-positive maxCols', () => {
    expect(() =>
      tableCapabilityDescriptorSchema.parse({ ...validCapability, maxCols: -1 }),
    ).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() => tableCapabilityDescriptorSchema.parse({ ...validCapability, extra: 1 })).toThrow();
  });
});

describe('validateTableCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateTableCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    expect(validateTableCapability({ maxRows: 'big' }).ok).toBe(false);
  });
});

describe('TableGenerationProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: TableGenerationProvider = {
      id: 'table-stub',
      modality: { kind: 'table-gen' },
      capability: validCapability,
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'in-process' },
      async generate(_call: TableCall): Promise<TableResult> {
        return { table: { rows: [] }, provenance: { kind: 'imported' } };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('table-gen');
  });
});
