// packages/schema/src/index.ts
// @stageflip/schema — the canonical schema for StageFlip documents.
// Invariant I-1 (CLAUDE.md §3, skills/stageflip/concepts/schema/SKILL.md): every
// input, every edit, every export round-trips through these types.

export * from './animations.js';
export * from './content/index.js';
export * from './document.js';
export * from './elements/index.js';
export * from './primitives.js';
export * from './theme.js';
export * from './timing.js';
