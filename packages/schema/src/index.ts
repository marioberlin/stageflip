// packages/schema/src/index.ts
// @stageflip/schema — the canonical schema for StageFlip documents.
// Invariant I-1 (CLAUDE.md §3, skills/stageflip/concepts/schema/SKILL.md): every
// input, every edit, every export round-trips through these types. Mode-specific
// content types (slide / video / display) arrive with T-021; animations + timing
// arrive with T-022; versioning + migrations with T-023.

export * from './elements/index.js';
export * from './primitives.js';
