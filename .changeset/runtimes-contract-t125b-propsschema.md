---
'@stageflip/runtimes-contract': minor
---

T-125b — optional `propsSchema?: ZodType<P>` on `ClipDefinition`. Clips
that declare one are auto-inspected by the editor's ZodForm; clips that
omit it surface a "no schema" notice in the inspector. Non-breaking:
existing runtimes compile and register unchanged. Phase 7 agent tool
plumbing will consume the same field without a further contract bump.
