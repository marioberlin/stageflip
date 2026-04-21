// packages/validation/src/rules/clips.ts
// Rules that need LintContext.findClip to classify clip elements.
// When `findClip` is unregistered (caller didn't inject), every
// clip-resolution rule degrades to an `info` finding rather than an
// `error` — linting a doc in isolation (e.g. in a fixture test)
// shouldn't hard-fail just because the test didn't register
// runtimes.

import type { LintFinding, LintRule } from '../types.js';

export const clipKindResolvable: LintRule = {
  id: 'clip-kind-resolvable',
  severity: 'error',
  description: 'every clip element must resolve to a registered runtime + clip kind',
  run(doc, ctx) {
    if (!ctx.findClip) {
      return [
        {
          rule: this.id,
          severity: 'info',
          message:
            'LintContext.findClip is not wired — skipping clip-resolution check. Inject @stageflip/runtimes-contract.findClip to enable.',
        },
      ];
    }
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'clip') {
        const resolved = ctx.findClip(el.content.clipName);
        if (!resolved) {
          out.push({
            rule: this.id,
            severity: 'error',
            message: `clip element '${el.id}' references kind '${el.content.clipName}' — no registered runtime claims it`,
            elementId: el.id,
          });
        }
      }
    }
    return out;
  },
};

export const clipRuntimeMatchesRegistered: LintRule = {
  id: 'clip-runtime-matches-registered',
  severity: 'error',
  description: "a clip's declared runtime must match the runtime that actually owns its kind",
  run(doc, ctx) {
    if (!ctx.findClip) return [];
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'clip') {
        const resolved = ctx.findClip(el.content.clipName);
        if (resolved && resolved.runtime.id !== el.content.runtime) {
          out.push({
            rule: this.id,
            severity: 'error',
            message: `clip '${el.id}' declares runtime '${el.content.runtime}' but kind '${el.content.clipName}' is registered under runtime '${resolved.runtime.id}'`,
            elementId: el.id,
          });
        }
      }
    }
    return out;
  },
};

export const CLIP_RULES: readonly LintRule[] = [
  clipKindResolvable,
  clipRuntimeMatchesRegistered,
] as const;
