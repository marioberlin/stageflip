---
"@stageflip/frame-runtime": major
---

Move `interpolatePath` from the main entry to a dedicated
`@stageflip/frame-runtime/path` sub-entry. Consumers that morph paths
update their import:

```diff
- import { interpolatePath } from '@stageflip/frame-runtime';
+ import { interpolatePath } from '@stageflip/frame-runtime/path';
```

Rationale: flubber (~18 KB gz) was the dominant cost in the base bundle
and pushed us within 0.95 KB of the 25 KB budget after T-053. Splitting
it into a sub-entry drops the main bundle to ~5.3 KB gz (10 KB new
limit) and keeps the sub-entry at ~19.5 KB gz (25 KB limit). Callers
that don't morph paths save the full 18 KB.

Public-API freeze (T-054) policy allows this as a major bump. Package
is still `private: true` and pre-1.0; documented in
`docs/dependencies.md` §4 Audit 3 addendum and
`skills/stageflip/runtimes/frame-runtime/SKILL.md` I-14 section.
