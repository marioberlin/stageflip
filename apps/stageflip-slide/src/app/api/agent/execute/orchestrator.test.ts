// @vitest-environment node
// apps/stageflip-slide/src/app/api/agent/execute/orchestrator.test.ts
// Smoke tests for the Phase-7 orchestrator wiring. The triad (Planner /
// Executor / Validator) has its own unit tests in @stageflip/agent —
// these tests only verify the slide-app wiring: registry is populated
// with all 14 bundles, env-based provider construction throws cleanly
// when the API key is absent, and createOrchestrator returns the
// expected shape. Node env — Anthropic SDK construction fails in
// happy-dom, and the orchestrator is server-side anyway.

import { describe, expect, it } from 'vitest';
import {
  OrchestratorNotConfigured,
  buildProviderFromEnv,
  createOrchestrator,
} from './orchestrator';

// Matches `LLMProvider` surface enough for orchestrator tests; nothing
// below actually calls `complete` / `stream` — we just need a non-null
// placeholder that satisfies TS.
function fakeProvider() {
  return {
    name: 'anthropic' as const,
    async complete() {
      throw new Error('unused');
    },
    stream() {
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              throw new Error('unused');
            },
          };
        },
      };
    },
  };
}

describe('buildProviderFromEnv', () => {
  it('throws OrchestratorNotConfigured when ANTHROPIC_API_KEY is the empty string', () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    try {
      // Empty-string treated identically to unset by orchestrator's
      // `!apiKey || apiKey.length === 0` guard.
      process.env.ANTHROPIC_API_KEY = '';
      expect(() => buildProviderFromEnv()).toThrow(OrchestratorNotConfigured);
    } finally {
      if (saved === undefined) {
        process.env.ANTHROPIC_API_KEY = '';
      } else {
        process.env.ANTHROPIC_API_KEY = saved;
      }
    }
  });

  it('returns an anthropic provider when ANTHROPIC_API_KEY is set', () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    try {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const p = buildProviderFromEnv();
      expect(p.name).toBe('anthropic');
    } finally {
      if (saved === undefined) {
        process.env.ANTHROPIC_API_KEY = '';
      } else {
        process.env.ANTHROPIC_API_KEY = saved;
      }
    }
  });
});

describe('createOrchestrator', () => {
  it('registers all 15 handler bundles on the router', () => {
    const deps = createOrchestrator(fakeProvider());
    const summaries = deps.registry.list();
    expect(summaries.length).toBe(15);
    let totalTools = 0;
    for (const s of summaries) {
      expect(s.toolCount).toBeGreaterThan(0);
      totalTools += s.toolCount;
      const bundle = deps.registry.get(s.name);
      expect(bundle?.tools.length).toBe(s.toolCount);
    }
    expect(deps.router.size).toBe(totalTools);
  });

  it('returns a planner / executor / validator triad', () => {
    const deps = createOrchestrator(fakeProvider());
    expect(typeof deps.planner.plan).toBe('function');
    expect(typeof deps.executor.run).toBe('function');
    expect(typeof deps.validator.validate).toBe('function');
  });
});
