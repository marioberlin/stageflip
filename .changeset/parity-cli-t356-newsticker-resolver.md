---
'@stageflip/parity-cli': patch
---

T-356 — Add `newsTicker → news-ticker-bar` resolver branch + exported
`BLOOMBERG_CANONICAL_SNAPSHOT` constant for the `bloomberg-ticker`
preset's parity golden.

Wires `DEFAULT_CLIP_KIND_RESOLVER('newsTicker') → news-ticker-bar`
(frame-runtime) per T-356 D-T356-3. The new clipKind-default entry
mounts the T-356a `news-ticker-bar` primitive directly with the cached
six-token Bloomberg snapshot (4 equities + 1 crypto, mixed up + down
deltas) inlined as props — bypassing the `LiveDataClip` wrapper /
`defaultLiveDataStaticFallback` per D-T356-11 (the parity golden's
purpose is to verify the rendered visual, not the wrapper integration
mechanism). Backward-compat preserved for `bigNumber` / `scoreBug` /
per-preset overrides (T-358 / T-359 / T-360).

`BLOOMBERG_CANONICAL_SNAPSHOT` is exported so future preset retries or
sister-cluster ticker bindings can compose against the same shape.
