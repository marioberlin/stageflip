---
"@stageflip/renderer-cdp": minor
---

Author `packages/renderer-cdp/vendor/NOTICE` (T-081).

Satisfies Apache License 2.0 §4(d) attribution for the
`@hyperframes/engine` payload vendored under T-080. Records:

- Copyright holder (HeyGen Inc.).
- Upstream URL, vendored package path, pinned commit, vendor date.
- That upstream ships no NOTICE of its own — so there is nothing
  from upstream to preserve here; only StageFlip's own attribution.
- Modification policy per THIRD_PARTY.md §2 (file-level
  "Modified by StageFlip, YYYY-MM-DD" comments). No modifications
  recorded yet.
- Trademark posture for "Hyperframes".

`vendor-integrity.test.ts` extended with 3 cases covering NOTICE
existence, Apache-2.0 + commit attribution, and modification-policy
text.
