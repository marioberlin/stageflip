// packages/asset-gen-contract/src/source-grounded/report-generation-provider.test.ts
// ReportGenerationProvider tests.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  REPORT_FORMATS,
  type ReportCall,
  type ReportCapabilityDescriptor,
  type ReportGenerationProvider,
  type ReportResult,
  reportCapabilityDescriptorSchema,
  validateReportCapability,
} from './report-generation-provider.js';

const validCapability: ReportCapabilityDescriptor = {
  formats: ['briefing-doc', 'study-guide', 'blog-post', 'custom'],
  maxTokens: 8192,
};

describe('reportCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(reportCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('round-trips every report format', () => {
    expect(REPORT_FORMATS).toHaveLength(4);
    for (const fmt of REPORT_FORMATS) {
      const cap: ReportCapabilityDescriptor = { ...validCapability, formats: [fmt] };
      expect(reportCapabilityDescriptorSchema.parse(cap).formats).toEqual([fmt]);
    }
  });

  it('rejects empty formats', () => {
    expect(() =>
      reportCapabilityDescriptorSchema.parse({ ...validCapability, formats: [] }),
    ).toThrow();
  });

  it('rejects unknown format literal', () => {
    expect(() =>
      reportCapabilityDescriptorSchema.parse({ ...validCapability, formats: ['white-paper'] }),
    ).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() =>
      reportCapabilityDescriptorSchema.parse({ ...validCapability, extra: 1 }),
    ).toThrow();
  });

  it('rejects non-positive maxTokens', () => {
    expect(() =>
      reportCapabilityDescriptorSchema.parse({ ...validCapability, maxTokens: 0 }),
    ).toThrow();
  });
});

describe('validateReportCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateReportCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    expect(validateReportCapability({ formats: ['custom'] }).ok).toBe(false);
  });
});

describe('ReportGenerationProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: ReportGenerationProvider = {
      id: 'notebooklm-report',
      modality: { kind: 'report-gen' },
      capability: validCapability,
      license: { kind: 'proprietary-byo' },
      sandbox: { kind: 'remote-service', baseUrlEnvVar: 'NOTEBOOKLM_BASE_URL' },
      sourceGrounded: true,
      requiresResearchProvider: 'notebooklm',
      async generate(_call: ReportCall): Promise<ReportResult> {
        return { text: { paragraphs: [] }, provenance: { kind: 'imported' } };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('report-gen');
    expect(asBase.requiresResearchProvider).toBe('notebooklm');
  });
});
